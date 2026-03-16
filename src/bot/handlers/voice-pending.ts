import type { Api } from "grammy";

export interface PendingTranscript {
  transcript: string;
  chatId: number;
  msgId: number;
  timer: NodeJS.Timeout;
  execute: () => Promise<void>;
}

const pendingByUserId = new Map<number, PendingTranscript>();

export function buildTranscriptConfirmationText(transcript: string): string {
  return transcript;
}

export function buildTranscriptFinalText(transcript: string): string {
  return `You said:\n${transcript}`;
}

export function buildTranscriptDiscardedText(transcript: string): string {
  return `${buildTranscriptFinalText(transcript)}\n\n(discarded by user)`;
}

export function setPending(userId: number, data: PendingTranscript): void {
  const existing = pendingByUserId.get(userId);
  if (existing) {
    clearTimeout(existing.timer);
  }
  pendingByUserId.set(userId, data);
}

export function getPending(userId: number): PendingTranscript | undefined {
  return pendingByUserId.get(userId);
}

export function clearPending(userId: number): PendingTranscript | undefined {
  const pending = pendingByUserId.get(userId);
  if (!pending) {
    return undefined;
  }
  clearTimeout(pending.timer);
  pendingByUserId.delete(userId);
  return pending;
}

export async function expirePending(userId: number, api: Api): Promise<void> {
  const pending = pendingByUserId.get(userId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingByUserId.delete(userId);

  try {
    await api.editMessageText(
      pending.chatId,
      pending.msgId,
      `${buildTranscriptFinalText(pending.transcript)}\n\n[expired]`,
    );
  } catch {
    // Ignore races when the message was already edited/removed.
  }

  try {
    await api.editMessageReplyMarkup(pending.chatId, pending.msgId, {
      reply_markup: undefined,
    });
  } catch {
    // Ignore races when keyboard is already gone.
  }
}
