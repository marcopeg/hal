import type pino from "pino";

export type CustomCommandResult =
  | {
      type: "assistant";
      message: string;
    }
  | {
      type: "agent";
      message?: string;
    }
  | {
      type: "void";
    };

function invalidResultError(message: string): Error {
  return new Error(`Invalid command return value: ${message}`);
}

export function normalizeCustomCommandResult(
  value: unknown,
  logger: pino.Logger,
  meta?: Record<string, unknown>,
): CustomCommandResult {
  if (typeof value === "string") {
    logger.warn(
      meta,
      'Custom command returned a legacy string. Migrate to { type: "assistant", message }.',
    );
    return { type: "assistant", message: value };
  }

  if (!value) {
    logger.warn(
      meta,
      'Custom command returned a legacy falsy value. Migrate to { type: "agent" } or { type: "void" }.',
    );
    return { type: "agent" };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw invalidResultError(
      "expected a typed result object, a legacy string, or a legacy falsy value",
    );
  }

  const result = value as Record<string, unknown>;

  switch (result.type) {
    case "assistant": {
      if (typeof result.message !== "string" || !result.message.trim()) {
        throw invalidResultError(
          'type "assistant" requires a non-empty string "message"',
        );
      }
      return { type: "assistant", message: result.message };
    }
    case "agent": {
      if (result.message === undefined) {
        return { type: "agent" };
      }
      if (typeof result.message !== "string" || !result.message.trim()) {
        throw invalidResultError(
          'type "agent" requires "message" to be omitted or a non-empty string',
        );
      }
      return { type: "agent", message: result.message };
    }
    case "void": {
      if ("message" in result && result.message !== undefined) {
        throw invalidResultError('type "void" does not accept a "message"');
      }
      return { type: "void" };
    }
    default:
      throw invalidResultError('expected type "assistant", "agent", or "void"');
  }
}
