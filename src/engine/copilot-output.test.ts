import { describe, expect, it } from "vitest";
import { parseCopilotStructuredOutput } from "./copilot-output.js";

describe("parseCopilotStructuredOutput", () => {
  it("extracts the final assistant message and session ID from Copilot JSONL", () => {
    const output = [
      JSON.stringify({
        type: "assistant.message",
        data: { content: "intermediate", phase: "thinking" },
      }),
      JSON.stringify({
        type: "assistant.message",
        data: { content: "final answer", phase: "final_answer" },
      }),
      JSON.stringify({
        type: "result",
        sessionId: "1823e6f1-5617-4851-a83f-a62cdd0d0574",
      }),
    ].join("\n");

    expect(parseCopilotStructuredOutput(output)).toEqual({
      responseText: "final answer",
      sessionId: "1823e6f1-5617-4851-a83f-a62cdd0d0574",
    });
  });

  it("falls back to the latest assistant message when no final_answer phase is present", () => {
    const output = [
      JSON.stringify({
        type: "assistant.message",
        data: { content: "first" },
      }),
      JSON.stringify({
        type: "assistant.message",
        data: { content: "second" },
      }),
    ].join("\n");

    expect(parseCopilotStructuredOutput(output)).toEqual({
      responseText: "second",
      sessionId: undefined,
    });
  });

  it("ignores non-JSON lines safely", () => {
    const output = [
      "not json",
      JSON.stringify({
        type: "result",
        sessionId: "1823e6f1-5617-4851-a83f-a62cdd0d0574",
      }),
    ].join("\n");

    expect(parseCopilotStructuredOutput(output)).toEqual({
      responseText: undefined,
      sessionId: "1823e6f1-5617-4851-a83f-a62cdd0d0574",
    });
  });
});
