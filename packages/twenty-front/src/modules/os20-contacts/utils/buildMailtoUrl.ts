type BuildMailtoUrlInput = {
  to?: string | null;
  subject: string;
  body: string;
};

// URLSearchParams encodes spaces as "+", which mail apps show literally.
const encodeMailtoValue = (value: string) =>
  encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));

export const buildMailtoUrl = ({ to, subject, body }: BuildMailtoUrlInput) => {
  const recipient = to?.trim() ? encodeURIComponent(to.trim()) : '';
  const params = [
    subject.trim() ? `subject=${encodeMailtoValue(subject.trim())}` : null,
    body.trim() ? `body=${encodeMailtoValue(body)}` : null,
  ].filter((param): param is string => param !== null);

  return `mailto:${recipient}${params.length > 0 ? `?${params.join('&')}` : ''}`;
};
