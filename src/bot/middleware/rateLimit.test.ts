import type { Context, NextFunction } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { createRateLimitMiddleware } from "./rateLimit.js";

function createProjectContext() {
  return {
    config: {
      rateLimit: { max: 1, windowMs: 60_000 },
    },
  } as never;
}

function createGramCtx(userId = 123) {
  return {
    from: { id: userId },
    reply: vi.fn(async () => undefined),
  } as unknown as Context;
}

describe("createRateLimitMiddleware", () => {
  it("does not count buffered debounce follow-up messages against the limit", async () => {
    const debounceActiveUsers = new Set<number>();
    const { middleware } = createRateLimitMiddleware(
      createProjectContext(),
      debounceActiveUsers,
    );
    const next = vi.fn(
      async (_ctx?: Context, _next?: NextFunction) => undefined,
    );

    const firstCtx = createGramCtx();
    await middleware(firstCtx, next as never);
    expect(next).toHaveBeenCalledTimes(1);

    debounceActiveUsers.add(123);
    const bufferedCtx = createGramCtx();
    await middleware(bufferedCtx, next as never);
    expect(next).toHaveBeenCalledTimes(2);
    expect(bufferedCtx.reply).not.toHaveBeenCalled();

    debounceActiveUsers.delete(123);
    const laterCtx = createGramCtx();
    await middleware(laterCtx, next as never);

    expect(next).toHaveBeenCalledTimes(2);
    expect(laterCtx.reply).toHaveBeenCalledTimes(1);
  });
});
