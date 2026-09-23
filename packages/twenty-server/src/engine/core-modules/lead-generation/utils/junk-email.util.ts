const EMAIL_SHAPE = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const ASSET_EXTENSION =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|css|js|mjs|json|map|woff2?|ttf|eot|mp4|webm|pdf)$/;

const PLACEHOLDER_DOMAINS = new Set([
  'company.com',
  'domain.com',
  'email.com',
  'example.com',
  'example.net',
  'example.org',
  'mycompany.com',
  'mydomain.com',
  'mysite.com',
  'sample.com',
  'test.com',
  'website.com',
  'yourcompany.com',
  'yourdomain.com',
  'yoursite.com',
  'yourwebsite.com',
]);

const RESERVED_TLDS = new Set(['example', 'invalid', 'localhost', 'test']);

const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

const VENDOR_DOMAINS = [
  'sentry.io',
  'sentry-next.wixpress.com',
  'wixpress.com',
  'sentry.wixpress.com',
  'ingest.sentry.io',
];

const PLACEHOLDER_LOCALS = new Set([
  'abc',
  'demo',
  'dummy',
  'email',
  'example',
  'first.last',
  'firstname',
  'firstname.lastname',
  'foo',
  'jane.doe',
  'janedoe',
  'john.doe',
  'johndoe',
  'my.name',
  'myemail',
  'name',
  'placeholder',
  'sample',
  'someone',
  'test',
  'testing',
  'user',
  'username',
  'xyz',
  'you',
  'your',
  'your.email',
  'your.name',
  'your-email',
  'your_email',
  'youremail',
  'yourname',
]);

const NO_REPLY_LOCAL =
  /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]?daemon|postmaster|bounces?)([-_.+].*)?$/;

const isReservedDomain = (domain: string) =>
  RESERVED_TLDS.has(domain.slice(domain.lastIndexOf('.') + 1)) ||
  RESERVED_DOMAINS.some(
    (reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
  );

const isVendorDomain = (domain: string) =>
  domain.startsWith('sentry.') ||
  VENDOR_DOMAINS.some(
    (vendor) => domain === vendor || domain.endsWith(`.${vendor}`),
  );

// Scraped markup leaves JSON escapes ("u003e") and mailto: glued on.
export const normalizeLeadEmail = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const email = value
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/^u003e/i, '')
    .replace(/\?.*$/, '')
    .toLowerCase();

  return email || undefined;
};

// Role inboxes (info@, hello@, sales@) are real and kept. Placeholders,
// no-reply senders, monitoring vendors and image filenames are not.
export const isJunkEmail = (value: unknown): boolean => {
  const email = normalizeLeadEmail(value);

  if (!email || !EMAIL_SHAPE.test(email) || ASSET_EXTENSION.test(email)) {
    return true;
  }

  const [local, domain] = email.split('@');

  if (/@\d+x\./.test(email) || /^[0-9a-f]{24,}$/.test(local)) {
    return true;
  }

  return (
    PLACEHOLDER_LOCALS.has(local) ||
    NO_REPLY_LOCAL.test(local) ||
    PLACEHOLDER_DOMAINS.has(domain) ||
    isReservedDomain(domain) ||
    isVendorDomain(domain)
  );
};

export const filterLeadEmails = (emails: unknown): string[] => {
  if (!Array.isArray(emails)) {
    return [];
  }

  const kept = new Set<string>();

  for (const value of emails) {
    const email = normalizeLeadEmail(value);

    if (email && !isJunkEmail(email)) {
      kept.add(email);
    }
  }

  return [...kept];
};
