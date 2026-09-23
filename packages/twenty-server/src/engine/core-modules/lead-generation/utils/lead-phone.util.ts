import {
  type CountryCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

import { decodeHtmlEntities } from './company-name.util';

const COUNTRY_NAMES: Record<string, CountryCode> = {
  australia: 'AU',
  austria: 'AT',
  österreich: 'AT',
  belgium: 'BE',
  brazil: 'BR',
  brasil: 'BR',
  canada: 'CA',
  denmark: 'DK',
  england: 'GB',
  finland: 'FI',
  france: 'FR',
  germany: 'DE',
  deutschland: 'DE',
  india: 'IN',
  ireland: 'IE',
  italy: 'IT',
  italia: 'IT',
  japan: 'JP',
  mexico: 'MX',
  netherlands: 'NL',
  nederland: 'NL',
  'new zealand': 'NZ',
  norway: 'NO',
  poland: 'PL',
  polska: 'PL',
  portugal: 'PT',
  singapore: 'SG',
  'south africa': 'ZA',
  spain: 'ES',
  españa: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  schweiz: 'CH',
  'united arab emirates': 'AE',
  uae: 'AE',
  'united kingdom': 'GB',
  uk: 'GB',
  'united states': 'US',
  usa: 'US',
  berlin: 'DE',
  munich: 'DE',
  münchen: 'DE',
  hamburg: 'DE',
  cologne: 'DE',
  köln: 'DE',
  frankfurt: 'DE',
  vienna: 'AT',
  wien: 'AT',
  zurich: 'CH',
  zürich: 'CH',
  london: 'GB',
  manchester: 'GB',
  paris: 'FR',
  madrid: 'ES',
  barcelona: 'ES',
  amsterdam: 'NL',
  dublin: 'IE',
  stockholm: 'SE',
  bangalore: 'IN',
  bengaluru: 'IN',
  mumbai: 'IN',
  delhi: 'IN',
  'new delhi': 'IN',
  hyderabad: 'IN',
  pune: 'IN',
  chennai: 'IN',
  'new york': 'US',
  'san francisco': 'US',
  'los angeles': 'US',
  toronto: 'CA',
  sydney: 'AU',
  melbourne: 'AU',
};

const COUNTRY_TLDS: Record<string, CountryCode> = {
  ae: 'AE',
  at: 'AT',
  au: 'AU',
  be: 'BE',
  br: 'BR',
  ca: 'CA',
  ch: 'CH',
  de: 'DE',
  dk: 'DK',
  es: 'ES',
  fi: 'FI',
  fr: 'FR',
  ie: 'IE',
  in: 'IN',
  it: 'IT',
  jp: 'JP',
  mx: 'MX',
  nl: 'NL',
  no: 'NO',
  nz: 'NZ',
  pl: 'PL',
  pt: 'PT',
  se: 'SE',
  sg: 'SG',
  uk: 'GB',
  za: 'ZA',
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COUNTRY_NAME_PATTERN = new RegExp(
  `(^|[^\\p{L}])(${Object.keys(COUNTRY_NAMES)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?=$|[^\\p{L}])`,
  'iu',
);

const findCountryName = (text: string | undefined) => {
  const name = text?.trim().match(COUNTRY_NAME_PATTERN)?.[2]?.toLowerCase();

  return name ? COUNTRY_NAMES[name] : undefined;
};

// A structured country (JSON-LD addressCountry) first, then location text
// ("Berlin, Germany"), then a country-code TLD.
export const inferCountryCode = ({
  country,
  location,
  domain,
}: {
  country?: string;
  location?: string;
  domain?: string;
}): CountryCode | undefined => {
  const code = country?.trim().toUpperCase();

  if (code === 'UK') {
    return 'GB';
  }

  if (code && /^[A-Z]{2}$/.test(code) && isSupportedCountry(code)) {
    return code;
  }

  const named = findCountryName(country) ?? findCountryName(location);

  if (named) {
    return named;
  }

  const tld = domain?.trim().toLowerCase().split('.').pop();

  return tld ? COUNTRY_TLDS[tld] : undefined;
};

const DATE_DIGITS =
  /^(?:(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])|(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])(?:19|20)\d{2})$/;

const hasJunkDigits = (digits: string) =>
  DATE_DIGITS.test(digits) || /0{5,}/.test(digits) || /^(\d)\1+$/.test(digits);

// "+49 30 1234567", "(030) 123-4567", "030 1234567". A bare digit run such
// as "117692280" is an id, never a phone, when it comes from free text.
export const looksLikePhoneText = (value: string): boolean => {
  const text = value.trim();

  if (!/^[+(]?\d[\d\s().\-/]*\d$/.test(text)) {
    return false;
  }

  const digits = text.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return false;
  }

  return text.startsWith('+') || /[\s().\-/]/.test(text);
};

const NANP_NATIONAL = /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

// National numbers in free text start with the trunk prefix ("030 ...") or
// follow the North American 3-3-4 shape, which rules out ranges and ids.
const hasNationalShape = (text: string, country: CountryCode) =>
  country === 'US' || country === 'CA'
    ? NANP_NATIONAL.test(text)
    : /^\(?0/.test(text);

// Returns E.164 when libphonenumber accepts the number, otherwise undefined.
// `trusted` values come from tel: links or JSON-LD, where a bare digit run is
// still a phone.
export const normalizeLeadPhone = (
  value: string | undefined,
  country?: CountryCode,
  { trusted = false }: { trusted?: boolean } = {},
): string | undefined => {
  const text = decodeHtmlEntities(value ?? '')
    .replace(/^tel:/i, '')
    .replace(/%20/g, ' ')
    .replace(/^00(?=[1-9])/, '+')
    .trim();

  if (!text) {
    return undefined;
  }

  const digits = text.replace(/\D/g, '');

  if (hasJunkDigits(digits)) {
    return undefined;
  }

  if (trusted) {
    if (!/^[+(]?\d[\d\s().\-/]*\d$/.test(text)) {
      return undefined;
    }
  } else if (
    !looksLikePhoneText(text) ||
    (!text.startsWith('+') && country && !hasNationalShape(text, country))
  ) {
    return undefined;
  }

  if (!text.startsWith('+') && !country) {
    return undefined;
  }

  const parsed = parsePhoneNumberFromString(text, country);

  return parsed?.isValid() ? parsed.number : undefined;
};

const stripToText = (html: string) =>
  decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );

const getTelLinks = (html: string) =>
  [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(([, value]) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  });

const getJsonLdTelephones = (html: string) =>
  [...html.matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)].map(([, value]) => value);

const TEXT_PHONE_CANDIDATE = /\+?\(?\d[\d\s().\-/]{5,20}\d/g;

// Order of trust: tel: links, JSON-LD telephone, then visible text shaped
// like a phone. Script and style bodies are never read.
export const extractPhoneFromHtml = (
  html: string,
  country?: CountryCode,
): string => {
  for (const value of [...getTelLinks(html), ...getJsonLdTelephones(html)]) {
    const phone = normalizeLeadPhone(value, country, { trusted: true });

    if (phone) {
      return phone;
    }
  }

  for (const [candidate] of stripToText(html).matchAll(TEXT_PHONE_CANDIDATE)) {
    const phone = normalizeLeadPhone(candidate, country);

    if (phone) {
      return phone;
    }
  }

  return '';
};
