import psl from 'psl';

const SECOND_LEVEL_LABELS = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'ne',
  'net',
  'or',
  'org',
]);

export const NON_BRAND_SUBDOMAINS = new Set([
  'www',
  'data',
  'app',
  'blog',
  'docs',
  'help',
  'support',
  'careers',
  'jobs',
  'go',
  'get',
  'try',
  'info',
  'en',
  'de',
  'shop',
  'status',
  'community',
  'developer',
  'developers',
]);

const approximateRegistrableDomain = (labels: string[]): string => {
  if (labels.length <= 2) {
    return labels.join('.');
  }

  const [secondLast, last] = labels.slice(-2);
  const size = last.length === 2 && SECOND_LEVEL_LABELS.has(secondLast) ? 3 : 2;

  return labels.slice(-size).join('.');
};

// "blog.acme.co.uk" -> "acme.co.uk", using the public suffix list.
export const getRegistrableDomain = (hostname: string): string => {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  const labels = host
    .replace(/^www\./, '')
    .split('.')
    .filter(Boolean);

  if (labels.length === 0) {
    return '';
  }

  return psl.get(labels.join('.')) ?? approximateRegistrableDomain(labels);
};

// "data.cledara.com" -> "cledara.com". Brand subdomains that are not in the
// non-brand list are also collapsed, since the company record stores the site root.
export const getCompanyRootDomain = (hostname: string): string => {
  const labels = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .split('.')
    .filter(Boolean);

  while (labels.length > 2 && NON_BRAND_SUBDOMAINS.has(labels[0])) {
    labels.shift();
  }

  return getRegistrableDomain(labels.join('.'));
};

// Search hits on "data.acme.com" are scraped from the company homepage instead.
export const getCompanyHomepageHost = (hostname: string): string => {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  const [firstLabel] = host.split('.');

  return firstLabel !== 'www' && NON_BRAND_SUBDOMAINS.has(firstLabel)
    ? getCompanyRootDomain(host) || host
    : host;
};
