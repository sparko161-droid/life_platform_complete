/**
 * Child device pairing (P1-036), closing DISC-P1-032-1.
 *
 * A parent issues a short code on their own device; the child's device
 * exchanges it for a session. The code is deliberately *not* the session
 * id -- it is a separate artefact that is short-lived, single-use, and
 * dead the moment it has been spent.
 *
 * Why not just show the session id: it is a bearer credential. Displaying
 * one to be typed or photographed defeats the httpOnly posture the web
 * tier is built around, and it would live as long as the session rather
 * than for the minute the parent is standing there.
 */
import { createHash, randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Session } from "@life/domain-types";
import { requireActiveParentMember, requireChildInFamily } from "./auth.js";
import { RepositoryAuthorizationError } from "./errors.js";
import { provisionChildSession } from "./identity-repository.js";

/**
 * Minutes, not hours: the parent is next to the child when they use it.
 * A short code is low-entropy by construction -- someone has to read it
 * aloud -- so the narrow window and single use are what make it safe,
 * not the code's length.
 */
export const PAIRING_CODE_TTL_SECONDS = 300;

/**
 * Digits only, and no ambiguous characters to misread, because a parent
 * reads this to a child or types it on a small screen. Length is a
 * deliberate trade: long enough that guessing inside a 5-minute,
 * single-use window is impractical, short enough to be read once.
 */
const CODE_ALPHABET = "23456789";
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // randomInt, not Math.random: this is a credential, however brief.
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Codes are hashed before storage for the same reason passwords are: a
 * read of the table must not let someone pair a device. Plain SHA-256
 * rather than Argon2 on purpose -- the input is high-enough entropy for
 * its 5-minute life and there is no offline-cracking exposure worth
 * paying a slow KDF for on every redemption attempt.
 */
function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export interface IssuePairingCodeCommand {
  familyId: string;
  childId: string;
  issuedByParentId: string;
  now: string;
  ttlSeconds?: number;
}

export interface IssuedPairingCode {
  /** Shown to the parent once. Never stored, never returned again. */
  code: string;
  expiresAt: string;
}

/**
 * Issues a pairing code, invalidating any the child already has
 * outstanding. Re-issuing must not leave the earlier code live: a parent
 * who asks for a new code has usually lost track of the old one, and two
 * valid codes is two chances for the wrong device to pair.
 */
export async function issuePairingCode(
  client: PoolClient,
  command: IssuePairingCodeCommand,
): Promise<IssuedPairingCode> {
  await requireActiveParentMember(client, command.familyId, command.issuedByParentId);
  await requireChildInFamily(client, command.familyId, command.childId);

  await client.query(
    "UPDATE child_pairing_codes SET redeemed_at = $1 WHERE child_id = $2 AND redeemed_at IS NULL",
    [command.now, command.childId],
  );

  const code = generateCode();
  const expiresAt = new Date(
    new Date(command.now).getTime() + (command.ttlSeconds ?? PAIRING_CODE_TTL_SECONDS) * 1000,
  ).toISOString();

  await client.query(
    `INSERT INTO child_pairing_codes
       (pairing_id, code_hash, family_id, child_id, issued_by_parent_id, issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), hashCode(code), command.familyId, command.childId, command.issuedByParentId, command.now, expiresAt],
  );

  return { code, expiresAt };
}

/**
 * Exchanges a pairing code for a child session.
 *
 * The claim is done with a conditional UPDATE rather than a read followed
 * by a write: two devices racing the same code must not both get a
 * session, and the database deciding the winner is the only version of
 * that which is actually safe. A caller that loses the race sees the same
 * failure as a wrong code.
 *
 * Every failure -- unknown, expired, already redeemed -- returns the same
 * error. A "this code has already been used" message would confirm that a
 * guessed code was real.
 */
export async function redeemPairingCode(client: PoolClient, code: string, now: string): Promise<Session> {
  const claimed = await client.query<{ family_id: string; child_id: string; issued_by_parent_id: string; pairing_id: string }>(
    `UPDATE child_pairing_codes
     SET redeemed_at = $1
     WHERE code_hash = $2 AND redeemed_at IS NULL AND expires_at > $1
     RETURNING pairing_id, family_id, child_id, issued_by_parent_id`,
    [now, hashCode(code)],
  );

  const row = claimed.rows[0];
  if (!row) {
    throw new RepositoryAuthorizationError("PAIRING_CODE_INVALID", "Pairing code is invalid, expired or already used");
  }

  const session = await provisionChildSession(client, {
    familyId: row.family_id,
    childId: row.child_id,
    issuedByParentId: row.issued_by_parent_id,
    now,
  });

  await client.query("UPDATE child_pairing_codes SET redeemed_session_id = $1 WHERE pairing_id = $2", [
    session.sessionId,
    row.pairing_id,
  ]);

  return session;
}
