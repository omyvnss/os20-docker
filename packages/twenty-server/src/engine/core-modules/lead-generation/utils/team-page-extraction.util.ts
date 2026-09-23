import { JSDOM } from 'jsdom';

export type PersonExtractionMethod =
  | 'json-ld'
  | 'microdata'
  | 'team-card'
  | 'impressum';

export type ExtractedPerson = {
  name: string;
  jobTitle?: string;
  linkedinUrl?: string;
  email?: string;
  sourceUrl: string;
  method: PersonExtractionMethod;
};

export type PageExtraction = {
  people: ExtractedPerson[];
  emails: string[];
  teamLinks: string[];
};

const MAX_PEOPLE_PER_PAGE = 60;

const NAME_PARTICLES = new Set([
  'von',
  'van',
  'der',
  'den',
  'de',
  'di',
  'da',
  'del',
  'della',
  'dos',
  'du',
  'la',
  'le',
  'bin',
  'al',
  'zu',
  'ten',
  'ter',
]);

const NON_NAME_WORDS = new Set(
  (
    'about academy access account accounts advisory agency all and app apply areas awards blog board book business ' +
    'call careers case center centre clients cloud company contact contacts cookie cookies culture customer customers ' +
    'data datenschutz demo design details development digital directors download email engineering events experience ' +
    'faq features find follow for free get global group help history home how imprint impressum industries industry ' +
    'insights join jobs kontakt latest leadership learn legal login management market marketing media meet menu mission ' +
    'more news newsletter office offices online open our partners people platform policy press pricing privacy product ' +
    'products read request resources sales schedule search security see service services sign solutions staff start ' +
    'started story success support team teams terms the this today top trial unser unsere unternehmen us values view ' +
    'vision watch we welcome what who why with work your'
  ).split(' '),
);

const HONORIFIC = /^(dr|prof|mr|mrs|ms|mag|dipl\.-ing|ing)\.?$/i;

const JOB_TITLE_PATTERN =
  /\b(ceo|cto|cfo|coo|cmo|cpo|cio|cro|ciso|founder|co-?founder|president|director|head|manager|lead|chief|vp|vice president|partner|owner|principal|engineer|developer|designer|officer|executive|chair(?:man|woman|person)?|board member|advisor|adviser|consultant|specialist|architect|scientist|analyst|coordinator|associate|editor|recruiter|attorney|lawyer|counsel|accountant|dentist|physician|therapist|treasurer|secretary|geschäftsführer(?:in)?|inhaber(?:in)?|vorstand|vorsitzende[r]?|gründer(?:in)?|leiter(?:in)?|prokurist(?:in)?|mitgründer(?:in)?|directeur|directrice|gérant(?:e)?|fondateur|fondatrice|responsable|socio|fundador(?:a)?|gerente|amministratore|titolare)\b/i;

const TEAM_LINK_PATTERN =
  /(team|about|ueber-uns|uber-uns|über-uns|leadership|management|people|founders|staff|impressum|imprint|kontakt|contact|unternehmen|company|who-we-are)/i;

const JUNK_EMAIL =
  /example\.|sentry|wixpress|domain\.com|yourdomain|email\.com/i;

const ASSET_EXTENSION = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js)$/i;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const IMPRESSUM_LABEL =
  /^(vertretungsberechtigte[rn]?\s+geschäftsführer(?:in|innen)?|geschäftsführer(?:in|innen)?|geschäftsführung|vertreten durch|inhaber(?:in)?|vorstand|vorstandsvorsitzende[r]?|managing directors?|represented by|chief executive officer|directors?|gérant(?:e)?)\s*[:：]?\s*(.*)$/i;

const IMPRESSUM_TITLES: Record<string, string> = {
  'vertreten durch': 'Legal representative',
  'represented by': 'Legal representative',
  geschäftsführung: 'Geschäftsführer',
};

const collapse = (text: string | null | undefined) =>
  (text ?? '').replace(/\s+/g, ' ').trim();

export const looksLikePersonName = (value: string): boolean => {
  const text = collapse(value);

  if (text.length < 4 || text.length > 50 || /[\d@|/\\:;!?()"“”]/.test(text)) {
    return false;
  }

  const words = text.split(' ').filter((word) => !HONORIFIC.test(word));
  const coreWords = words.filter(
    (word) => !NAME_PARTICLES.has(word.toLowerCase()),
  );

  if (coreWords.length < 2 || words.length > 5) {
    return false;
  }

  return coreWords.every(
    (word) =>
      /^\p{Lu}[\p{L}'’.-]*$/u.test(word) &&
      !NON_NAME_WORDS.has(word.toLowerCase()) &&
      !JOB_TITLE_PATTERN.test(word) &&
      !(word.length > 2 && word === word.toUpperCase() && !/[.-]/.test(word)),
  );
};

export const looksLikeJobTitle = (value: string): boolean => {
  const text = collapse(value);

  return (
    text.length >= 2 &&
    text.length <= 90 &&
    !text.includes('@') &&
    JOB_TITLE_PATTERN.test(text)
  );
};

export const cleanPersonName = (value: string) =>
  collapse(value)
    .split(' ')
    .filter((word) => !HONORIFIC.test(word))
    .join(' ');

const normalizeLinkedinUrl = (href: string | null | undefined) => {
  if (!href || !/linkedin\.com\/in\//i.test(href)) {
    return undefined;
  }

  try {
    const url = new URL(href);

    return `https://www.linkedin.com${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return undefined;
  }
};

export const normalizeEmail = (value: string | null | undefined) => {
  const email = decodeURIComponent(
    (value ?? '').replace(/^mailto:/i, '').split('?')[0],
  )
    .trim()
    .toLowerCase();

  if (
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ||
    JUNK_EMAIL.test(email) ||
    ASSET_EXTENSION.test(email)
  ) {
    return undefined;
  }

  return email;
};

const safeDecode = (value: string) => {
  try {
    return normalizeEmail(value);
  } catch {
    return undefined;
  }
};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return collapse(value) || undefined;
  }

  if (Array.isArray(value)) {
    return asText(value.find((item) => typeof item === 'string'));
  }

  if (value && typeof value === 'object' && 'name' in value) {
    return asText((value as { name: unknown }).name);
  }

  return undefined;
};

const hasType = (node: Record<string, unknown>, type: string) =>
  asArray(node['@type']).some(
    (value) => typeof value === 'string' && value.toLowerCase() === type,
  );

// Reviews and article bylines name customers and guest authors, not staff.
const SKIPPED_JSON_LD_KEYS = new Set([
  'author',
  'review',
  'reviews',
  'creator',
  'contributor',
  'publisher',
  'aggregateRating',
]);

const extractJsonLdPeople = (
  document: Document,
  sourceUrl: string,
): ExtractedPerson[] => {
  const people: ExtractedPerson[] = [];

  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || !node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));

      return;
    }

    const record = node as Record<string, unknown>;

    if (hasType(record, 'person')) {
      const name =
        asText(record.name) ??
        collapse(
          [asText(record.givenName), asText(record.familyName)]
            .filter(Boolean)
            .join(' '),
        );
      const linkedinUrl = [...asArray(record.sameAs), record.url]
        .map((value) =>
          normalizeLinkedinUrl(typeof value === 'string' ? value : undefined),
        )
        .find(Boolean);

      if (name && looksLikePersonName(cleanPersonName(name))) {
        people.push({
          name: cleanPersonName(name),
          jobTitle: asText(record.jobTitle),
          linkedinUrl,
          email:
            typeof record.email === 'string'
              ? safeDecode(record.email)
              : undefined,
          sourceUrl,
          method: 'json-ld',
        });
      }
    }

    for (const [key, value] of Object.entries(record)) {
      if (!SKIPPED_JSON_LD_KEYS.has(key) && typeof value === 'object') {
        visit(value, depth + 1);
      }
    }
  };

  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    const raw = (script.textContent ?? '')
      .replace(/^\s*<!--/, '')
      .replace(/-->\s*$/, '')
      .trim();

    try {
      visit(JSON.parse(raw), 0);
    } catch {
      continue;
    }
  }

  return people;
};

const itemPropValue = (element: Element | null) => {
  if (!element) {
    return undefined;
  }

  return collapse(
    element.getAttribute('content') ??
      element.getAttribute('href') ??
      element.textContent,
  );
};

const extractMicrodataPeople = (
  document: Document,
  sourceUrl: string,
): ExtractedPerson[] =>
  [...document.querySelectorAll('[itemtype*="schema.org/Person" i]')].flatMap(
    (scope) => {
      const name = cleanPersonName(
        itemPropValue(scope.querySelector('[itemprop="name"]')) ?? '',
      );

      if (!looksLikePersonName(name)) {
        return [];
      }

      const linkedin = [...scope.querySelectorAll('a[href]')]
        .map((link) => normalizeLinkedinUrl(link.getAttribute('href')))
        .find(Boolean);

      return [
        {
          name,
          jobTitle:
            itemPropValue(scope.querySelector('[itemprop="jobTitle"]')) ||
            undefined,
          email: safeDecode(
            itemPropValue(scope.querySelector('[itemprop="email"]')) ?? '',
          ),
          linkedinUrl: linkedin,
          sourceUrl,
          method: 'microdata' as const,
        },
      ];
    },
  );

const NAME_SELECTOR =
  'h1, h2, h3, h4, h5, h6, strong, b, [class*="name" i], [itemprop="name"]';

const TITLE_SELECTOR =
  '[class*="title" i], [class*="role" i], [class*="position" i], [class*="job" i], [class*="designation" i], p, span, small, em, div, h3, h4, h5, h6';

// Testimonials and case studies name customers, not staff.
const QUOTE_CONTEXT_SELECTOR =
  'blockquote, q, figure, [class*="testimonial" i], [class*="quote" i], [class*="review" i], [class*="customer" i], [class*="case-stud" i], [class*="success-stor" i]';

const isInQuoteContext = (card: Element) =>
  Boolean(card.closest(QUOTE_CONTEXT_SELECTOR)) ||
  Boolean(card.querySelector('blockquote, q'));

const isNameCandidate = (element: Element) =>
  element.children.length <= 1 &&
  looksLikePersonName(cleanPersonName(element.textContent ?? ''));

const findJobTitle = (card: Element, nameElement: Element) => {
  const name = collapse(nameElement.textContent);

  for (let sibling = nameElement.nextElementSibling; sibling; ) {
    const text = collapse(sibling.textContent);

    if (text && text !== name) {
      if (looksLikeJobTitle(text)) {
        return text;
      }

      break;
    }

    sibling = sibling.nextElementSibling;
  }

  for (const element of card.querySelectorAll(TITLE_SELECTOR)) {
    if (
      element === nameElement ||
      element.contains(nameElement) ||
      element.children.length > 2
    ) {
      continue;
    }

    const text = collapse(element.textContent);

    if (text && text !== name && looksLikeJobTitle(text)) {
      return text;
    }
  }

  return undefined;
};

const extractTeamCards = (
  document: Document,
  sourceUrl: string,
): ExtractedPerson[] => {
  const nameElements = [...document.querySelectorAll(NAME_SELECTOR)].filter(
    (element) =>
      !element.closest('nav, footer, header, script, style, noscript') &&
      isNameCandidate(element),
  );
  const nameSet = new Set(nameElements);
  const people: ExtractedPerson[] = [];

  for (const nameElement of nameElements) {
    if (nameElement.parentElement && nameSet.has(nameElement.parentElement)) {
      continue;
    }

    let card: Element = nameElement.parentElement ?? nameElement;

    // Climb while the container still holds only this one person.
    for (let depth = 0; depth < 4; depth += 1) {
      const parent = card.parentElement;

      if (
        !parent ||
        parent === document.body ||
        [...nameSet].some(
          (other) =>
            other !== nameElement &&
            !other.contains(nameElement) &&
            !nameElement.contains(other) &&
            parent.contains(other),
        )
      ) {
        break;
      }

      card = parent;
    }

    if (isInQuoteContext(card)) {
      continue;
    }

    const jobTitle = findJobTitle(card, nameElement);

    if (!jobTitle) {
      continue;
    }

    const links = [...card.querySelectorAll('a[href]')].map((link) =>
      link.getAttribute('href'),
    );

    people.push({
      name: cleanPersonName(nameElement.textContent ?? ''),
      jobTitle,
      linkedinUrl: links.map(normalizeLinkedinUrl).find(Boolean),
      email: links
        .filter((href) => href?.toLowerCase().startsWith('mailto:'))
        .map((href) => safeDecode(href ?? ''))
        .find(Boolean),
      sourceUrl,
      method: 'team-card',
    });
  }

  return people;
};

const BLOCK_TAGS =
  'p, div, li, tr, td, dd, dt, h1, h2, h3, h4, h5, h6, section, article, address';

const pageLines = (document: Document) => {
  const body = document.body?.cloneNode(true) as HTMLElement | undefined;

  if (!body) {
    return [];
  }

  body
    .querySelectorAll('script, style, noscript, template')
    .forEach((element) => element.remove());
  body
    .querySelectorAll('br')
    .forEach((element) => element.replaceWith(document.createTextNode('\n')));
  body
    .querySelectorAll(BLOCK_TAGS)
    .forEach((element) => element.append(document.createTextNode('\n')));

  return (body.textContent ?? '')
    .split('\n')
    .map((line) => collapse(line))
    .filter(Boolean);
};

const extractImpressumPeople = (
  lines: string[],
  sourceUrl: string,
): ExtractedPerson[] => {
  const people: ExtractedPerson[] = [];

  lines.forEach((line, index) => {
    const match = line.match(IMPRESSUM_LABEL);

    if (!match) {
      return;
    }

    const label = match[1].toLowerCase();
    const value = match[2] || lines[index + 1] || '';
    const title =
      IMPRESSUM_TITLES[label] ??
      match[1].replace(/^vertretungsberechtigte[rn]?\s+/i, '').trim();

    for (const part of value.split(/,|;|\s+und\s+|\s+and\s+|\s+&\s+/i)) {
      const roleInParens = part.match(/\(([^)]+)\)/)?.[1];
      const name = cleanPersonName(part.replace(/\([^)]*\)/g, ''));

      if (looksLikePersonName(name)) {
        people.push({
          name,
          jobTitle:
            collapse(roleInParens) ||
            title.charAt(0).toUpperCase() + title.slice(1),
          sourceUrl,
          method: 'impressum',
        });
      }
    }
  });

  return people;
};

const extractEmails = (document: Document, lines: string[]) => {
  const emails = new Set<string>();

  for (const link of document.querySelectorAll('a[href^="mailto:" i]')) {
    const email = safeDecode(link.getAttribute('href') ?? '');

    if (email) {
      emails.add(email);
    }
  }

  for (const line of lines) {
    // Obfuscated "name [at] domain.com" forms are common on German sites.
    const deobfuscated = line.replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@');

    for (const match of deobfuscated.match(EMAIL_PATTERN) ?? []) {
      const email = safeDecode(match);

      if (email) {
        emails.add(email);
      }
    }
  }

  return [...emails];
};

const extractTeamLinks = (document: Document, pageUrl: string) => {
  const origin = new URL(pageUrl);
  const host = origin.hostname.replace(/^www\./, '');
  const links = new Set<string>();

  for (const link of document.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? '';

    try {
      const url = new URL(href, origin);

      if (
        !/^https?:$/.test(url.protocol) ||
        url.hostname.replace(/^www\./, '') !== host ||
        !(
          TEAM_LINK_PATTERN.test(url.pathname) ||
          TEAM_LINK_PATTERN.test(collapse(link.textContent))
        ) ||
        url.pathname.split('/').filter(Boolean).length > 2
      ) {
        continue;
      }

      url.hash = '';
      url.search = '';
      links.add(url.toString());
    } catch {
      continue;
    }
  }

  return [...links];
};

const squash = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '');

// "CEO, Qwilr" or "Head of Sales at Acme" on another company's site is a
// customer quote, not a member of that company.
export const hasForeignAffiliation = (
  jobTitle: string | undefined,
  domain: string,
): boolean => {
  const match = jobTitle?.match(/(?:,|\bat\b|@)\s*([^,@]+)$/i);

  if (!match) {
    return false;
  }

  const organization = squash(match[1]);
  const label = squash(domain.split('.')[0] ?? '');

  if (!organization || !label || looksLikeJobTitle(match[1])) {
    return false;
  }

  return !organization.includes(label) && !label.includes(organization);
};

export const mergePeople = (people: ExtractedPerson[]): ExtractedPerson[] => {
  const byName = new Map<string, ExtractedPerson>();

  for (const person of people) {
    const key = person.name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}]/gu, '');
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, { ...person });
      continue;
    }

    existing.jobTitle = existing.jobTitle ?? person.jobTitle;
    existing.linkedinUrl = existing.linkedinUrl ?? person.linkedinUrl;
    existing.email = existing.email ?? person.email;
  }

  return [...byName.values()];
};

export const extractPeopleFromHtml = (
  html: string,
  pageUrl: string,
): PageExtraction => {
  const { window } = new JSDOM(html, { url: pageUrl });
  const { document } = window;

  try {
    const lines = pageLines(document);

    return {
      people: mergePeople([
        ...extractJsonLdPeople(document, pageUrl),
        ...extractMicrodataPeople(document, pageUrl),
        ...extractTeamCards(document, pageUrl),
        ...extractImpressumPeople(lines, pageUrl),
      ]).slice(0, MAX_PEOPLE_PER_PAGE),
      emails: extractEmails(document, lines),
      teamLinks: extractTeamLinks(document, pageUrl),
    };
  } finally {
    window.close();
  }
};
