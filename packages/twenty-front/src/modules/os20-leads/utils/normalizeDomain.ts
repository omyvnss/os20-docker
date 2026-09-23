export const normalizeDomain = (value?: string | null): string | undefined => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) return undefined;

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutProtocol
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');

  return host.includes('.') ? host : undefined;
};
