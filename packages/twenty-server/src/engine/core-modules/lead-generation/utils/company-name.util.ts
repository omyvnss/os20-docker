import { getRegistrableDomain } from './registrable-domain.util';

const GENERIC_NAME =
  /^(home|homepage|home page|startseite|accueil|inicio|welcome|index|official site|official website)$/i;

const TITLE_SEPARATOR = /\s*[|:]\s*|\s+[-–—·»«]\s+/;

const ORGANIZATION_TYPES = new Set([
  'organization',
  'corporation',
  'localbusiness',
  'onlinebusiness',
  'onlinestore',
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  raquo: '»',
  laquo: '«',
  ndash: '–',
  mdash: '—',
  middot: '·',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
};

export const decodeHtmlEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name] ?? entity);

// Matches the meta tag whichever order its attributes are written in. Values
// are matched per quote style so a match never runs into the next attribute.
export const getMetaContent = (
  html: string,
  attribute: string,
  value: string,
) => {
  const target = `\\b${attribute}=["']${value}["']`;
  const content = `\\bcontent=(?:"([^"]*)"|'([^']*)')`;
  const match =
    html.match(new RegExp(`<meta\\b[^>]*${target}[^>]*${content}`, 'i')) ??
    html.match(new RegExp(`<meta\\b[^>]*${content}[^>]*${target}`, 'i'));

  return match ? (match[1] ?? match[2]) : undefined;
};

export const isSentenceLikeName = (name: string): boolean =>
  name.trim().split(/\s+/).length > 5 || /\.$/.test(name.trim());

const cleanName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const name = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();

  if (!name || GENERIC_NAME.test(name) || isSentenceLikeName(name)) {
    return undefined;
  }

  return name;
};

const isOrganizationNode = (node: Record<string, unknown>) => {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];

  return types.some(
    (type) =>
      typeof type === 'string' && ORGANIZATION_TYPES.has(type.toLowerCase()),
  );
};

const findOrganizationName = (node: unknown, depth = 0): string | undefined => {
  if (!node || typeof node !== 'object' || depth > 5) {
    return undefined;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const name = findOrganizationName(item, depth + 1);

      if (name) {
        return name;
      }
    }

    return undefined;
  }

  const record = node as Record<string, unknown>;

  if (isOrganizationNode(record)) {
    const name = cleanName(record.name);

    if (name) {
      return name;
    }
  }

  return (
    findOrganizationName(record['@graph'], depth + 1) ??
    findOrganizationName(record.publisher, depth + 1)
  );
};

const getJsonLdOrganizationName = (html: string): string | undefined => {
  for (const [, body] of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const name = findOrganizationName(JSON.parse(body));

      if (name) {
        return name;
      }
    } catch {
      continue;
    }
  }

  return undefined;
};

const compact = (value: string) => value.toLowerCase().replace(/[\s-]+/g, '');

const getDomainLabel = (hostname: string) =>
  getRegistrableDomain(hostname).split('.')[0] ?? '';

const getTitleSegmentMatchingLabel = (
  title: string | undefined,
  label: string,
): string | undefined => {
  if (!title || !label) {
    return undefined;
  }

  return decodeHtmlEntities(title)
    .split(TITLE_SEPARATOR)
    .map((segment) => segment.trim())
    .find((segment) => segment && compact(segment) === compact(label));
};

export const titleCaseLabel = (label: string) =>
  label
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const extractCompanyName = (html: string, url: string): string => {
  const hostname = new URL(url).hostname;
  const label = getDomainLabel(hostname);

  const name =
    cleanName(getMetaContent(html, 'property', 'og:site_name')) ??
    getJsonLdOrganizationName(html) ??
    cleanName(getMetaContent(html, 'name', 'application-name')) ??
    getTitleSegmentMatchingLabel(
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1],
      label,
    ) ??
    getTitleSegmentMatchingLabel(
      getMetaContent(html, 'property', 'og:title'),
      label,
    );

  return name ?? (titleCaseLabel(label) || hostname);
};

const URL_LIKE_NAME =
  /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)|^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/?$/i;

export const isUrlLikeName = (name: string): boolean =>
  URL_LIKE_NAME.test(name.trim());

// Stored names get the same rules as scraped ones: taglines, URLs and generic
// titles fall back to the title-cased domain label ("s2-labs.com" -> "S2 Labs").
export const sanitizeCompanyName = (
  name: string | undefined,
  domain: string | undefined,
): string => {
  const cleaned = decodeHtmlEntities(name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const label = domain ? getDomainLabel(domain) : '';

  if (
    cleaned &&
    !isUrlLikeName(cleaned) &&
    !GENERIC_NAME.test(cleaned) &&
    !isSentenceLikeName(cleaned)
  ) {
    return cleaned;
  }

  return titleCaseLabel(label) || cleaned;
};
