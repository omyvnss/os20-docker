const AI_KEY_MESSAGE_PATTERN = /\b(api|ai)\b.*\bkey\b|\bprovider\b|\bmodel\b/i;

export const isMissingAiKeyError = (
  status: number,
  message: string | undefined,
): boolean =>
  status === 400 &&
  (message === undefined || AI_KEY_MESSAGE_PATTERN.test(message));
