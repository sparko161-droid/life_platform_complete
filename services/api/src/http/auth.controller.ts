import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { withTransaction } from "../db/pool.js";
import { identityRepository, pairingRepository } from "../repositories/index.js";
import { Session } from "../auth/session.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { SessionClaims } from "../auth/session.js";
import { signInThrottle } from "../auth/throttle.js";

/**
 * Identity operations (P1-031), implementing ADR-0006.
 *
 * These are the endpoints that finally let a real human obtain a
 * session -- until now the vertical slice was only reachable by tests
 * minting their own token (DISC-P1-010-1).
 *
 * Every response deliberately avoids telling a caller anything about
 * whether an email exists. Sign-up conflict, wrong password and unknown
 * account all produce the same shaped failure, because a friendlier
 * message is an account-enumeration oracle.
 */
@Controller()
export class AuthController {
  // POST /auth/sign-up -- creates an account. No session is issued: the
  // account starts PENDING_VERIFICATION and consent has to be accepted
  // first (docs/product/family-lifecycle.md).
  @Post("api/v1/auth/sign-up")
  async signUp(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password) {
      throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Укажите почту и пароль." } });
    }
    // A minimum length is the one password rule enforced here.
    // Composition rules (mixed case, symbols) are deliberately absent --
    // they push users toward predictable substitutions without adding
    // real entropy.
    if (password.length < 10) {
      throw new BadRequestException({
        error: { code: "PASSWORD_TOO_SHORT", message: "Пароль должен быть не короче 10 символов." },
      });
    }

    try {
      const account = await withTransaction((client) =>
        identityRepository.registerAccount(client, { email, password, now: new Date().toISOString() }),
      );
      return { accountId: account.accountId, parentId: account.parentId, status: account.status };
    } catch {
      // Includes the duplicate-email case on purpose. Reporting "email
      // already registered" would confirm the address is in use.
      throw new BadRequestException({
        error: { code: "SIGN_UP_FAILED", message: "Не получилось создать аккаунт." },
      });
    }
  }

  // POST /auth/consent -- accepts consent, moving PENDING_VERIFICATION to
  // ACTIVE. The *content* of consent is a legal question owned by P1-034;
  // this only records that it happened.
  @Post("api/v1/auth/consent")
  @HttpCode(200)
  async acceptConsent(@Body() body: { accountId?: string }) {
    if (!body.accountId) {
      throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Укажите аккаунт." } });
    }
    const account = await withTransaction((client) =>
      identityRepository.acceptConsent(client, body.accountId!, new Date().toISOString()),
    );
    return { accountId: account.accountId, status: account.status };
  }

  // POST /auth/sign-in -- exchanges credentials for a session id.
  @Post("api/v1/auth/sign-in")
  @HttpCode(200)
  async signIn(@Req() req: Request, @Body() body: { email?: string; password?: string; familyId?: string }) {
    const email = body.email?.trim();
    const { password, familyId } = body;
    if (!email || !password) {
      throw new BadRequestException({
        error: { code: "INVALID_INPUT", message: "Укажите почту и пароль." },
      });
    }
    // familyId is optional on purpose. Omitting it yields a *bootstrap*
    // session: a parent who has authenticated but belongs to no family
    // yet, and may only create one. ADR-0006 constraint 3 -- parent
    // identity exists prior to family membership -- and without this
    // onboarding is impossible, since creating a family would itself
    // require already being in one (DISC-P1-031-1).

    const clientAddress = req.ip ?? "unknown";
    const decision = signInThrottle.check(email, clientAddress);
    if (!decision.allowed) {
      throw new UnauthorizedException({
        error: { code: "TOO_MANY_ATTEMPTS", message: "Слишком много попыток. Попробуйте позже." },
      });
    }

    const session = await withTransaction(async (client) => {
      const account = await identityRepository.verifyPassword(client, email, password);
      if (!account) return null;
      // Throws if this account is not an ACTIVE member of that family --
      // authenticating proves who you are, not what you may act on.
      return identityRepository.issueParentSession(client, {
        account,
        ...(familyId ? { familyId } : {}),
        now: new Date().toISOString(),
      });
    }).catch(() => null);

    if (!session) {
      signInThrottle.recordFailure(email, clientAddress);
      // Same response for wrong password, unknown email, suspended
      // account and non-membership. Each distinction would be a signal.
      throw new UnauthorizedException({
        error: { code: "SIGN_IN_FAILED", message: "Не получилось войти." },
      });
    }

    signInThrottle.recordSuccess(email, clientAddress);
    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      role: "parent",
      // Absent on a bootstrap session; the client uses this to know
      // whether it must create a family before anything else.
      ...(session.familyId ? { familyId: session.familyId } : {}),
    };
  }

  // POST /auth/sign-out -- revokes the caller's own session.
  @Post("api/v1/auth/sign-out")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async signOut(@Session() session: SessionClaims) {
    await withTransaction((client) =>
      identityRepository.revokeSession(client, session.sessionId, new Date().toISOString()),
    );
  }

  // POST /auth/child-sessions -- a parent provisions a session for their
  // child's device. ADR-0006 D3: child access is never self-service,
  // because a ChildProfile has no credentials by contract.
  @Post("api/v1/auth/child-sessions")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async provisionChildSession(@Session() session: SessionClaims, @Body() body: { childId?: string }) {
    if (session.role !== "parent") {
      throw new UnauthorizedException({
        error: { code: "PARENT_SESSION_REQUIRED", message: "Только родитель может выдать доступ ребёнку." },
      });
    }
    if (!body.childId || !session.familyId) {
      throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Укажите ребёнка." } });
    }

    const childSession = await withTransaction((client) =>
      identityRepository.provisionChildSession(client, {
        familyId: session.familyId!,
        childId: body.childId!,
        issuedByParentId: session.actorId,
        now: new Date().toISOString(),
      }),
    );
    return { sessionId: childSession.sessionId, expiresAt: childSession.expiresAt, role: "child" };
  }

  // POST /auth/child-pairing-codes -- a parent issues a short code to type
  // on the child device. Closes DISC-P1-032-1: provisionChildSession above
  // returns a session id, and a session id is a bearer credential that
  // must never be read aloud or photographed. This is the artefact that
  // is safe to hand over instead -- short-lived, single-use, and not a
  // session.
  @Post("api/v1/auth/child-pairing-codes")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async issuePairingCode(@Session() session: SessionClaims, @Body() body: { childId?: string }) {
    if (session.role !== "parent") {
      throw new UnauthorizedException({
        error: { code: "PARENT_SESSION_REQUIRED", message: "Только родитель может выдать код." },
      });
    }
    if (!body.childId || !session.familyId) {
      throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Укажите ребёнка." } });
    }
    return withTransaction((client) =>
      pairingRepository.issuePairingCode(client, {
        familyId: session.familyId!,
        childId: body.childId!,
        issuedByParentId: session.actorId,
        now: new Date().toISOString(),
      }),
    );
  }

  // POST /auth/child-pairing-codes/redeem -- the child device exchanges
  // the code for a session. Unauthenticated by necessity: the device has
  // no session yet, which is the entire problem being solved.
  @Post("api/v1/auth/child-pairing-codes/redeem")
  @HttpCode(200)
  async redeemPairingCode(@Body() body: { code?: string }) {
    if (!body.code) {
      throw new BadRequestException({ error: { code: "INVALID_INPUT", message: "Введите код." } });
    }
    const session = await withTransaction((client) =>
      pairingRepository.redeemPairingCode(client, body.code!, new Date().toISOString()),
    );
    return { sessionId: session.sessionId, expiresAt: session.expiresAt, role: "child" };
  }
}
