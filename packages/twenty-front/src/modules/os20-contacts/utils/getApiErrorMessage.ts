// Nest returns `message` as a string, or as a list of validation messages.
export const getApiErrorMessage = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;

  const message = (body as { message?: unknown }).message;

  if (typeof message === 'string' && message.trim().length > 0) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const parts = message.filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  return undefined;
};
