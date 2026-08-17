import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * "Every request receives a correlation ID. Async jobs preserve
 * causation/correlation metadata." -- docs/engineering/observability.md.
 *
 * `causationId` is the id of the event/request that directly triggered
 * this one (e.g. the HTTP request that enqueued a job); `correlationId`
 * stays constant across the whole causal chain so every hop can be tied
 * back to the originating request.
 */
export interface CorrelationContext {
  correlationId: string;
  causationId: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

export function newCorrelationId(): string {
  return randomUUID();
}

/** Starts a new causal chain: correlationId and causationId are the same. */
export function runWithNewCorrelation<T>(fn: (ctx: CorrelationContext) => T): T {
  const id = newCorrelationId();
  const ctx: CorrelationContext = { correlationId: id, causationId: id };
  return storage.run(ctx, () => fn(ctx));
}

/**
 * Continues an existing chain (e.g. a worker picking up a job enqueued by
 * a request): correlationId is inherited, causationId becomes this step's
 * own id so the immediate trigger is still recoverable.
 */
export function runWithCausation<T>(parent: CorrelationContext, fn: (ctx: CorrelationContext) => T): T {
  const ctx: CorrelationContext = {
    correlationId: parent.correlationId,
    causationId: newCorrelationId(),
  };
  return storage.run(ctx, () => fn(ctx));
}

export function currentCorrelation(): CorrelationContext | undefined {
  return storage.getStore();
}
