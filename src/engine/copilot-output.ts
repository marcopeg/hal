export interface CopilotStructuredOutput {
  responseText?: string;
  sessionId?: string;
}

interface CopilotJsonLine {
  type?: string;
  sessionId?: string;
  data?: {
    content?: string;
    phase?: string;
  };
}

export function parseCopilotStructuredOutput(
  output: string,
): CopilotStructuredOutput {
  let responseText: string | undefined;
  let fallbackAssistantMessage: string | undefined;
  let sessionId: string | undefined;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let parsed: CopilotJsonLine;
    try {
      parsed = JSON.parse(line) as CopilotJsonLine;
    } catch {
      continue;
    }

    if (parsed.type === "assistant.message") {
      const content = parsed.data?.content?.trim();
      if (content) {
        fallbackAssistantMessage = content;
        if (parsed.data?.phase === "final_answer") {
          responseText = content;
        }
      }
    }

    if (parsed.type === "result" && typeof parsed.sessionId === "string") {
      sessionId = parsed.sessionId;
    }
  }

  return {
    responseText: responseText ?? fallbackAssistantMessage,
    sessionId,
  };
}
