import {
  extractPhoneFromHtml,
  inferCountryCode,
  looksLikePhoneText,
  normalizeLeadPhone,
} from 'src/engine/core-modules/lead-generation/utils/lead-phone.util';

describe('normalizeLeadPhone', () => {
  it.each(['20260410', '00000040', '117692280', '6442713809951'])(
    'drops the id or date "%s" seen on the Leads page',
    (value) => {
      expect(normalizeLeadPhone(value)).toBeUndefined();
      expect(normalizeLeadPhone(value, 'DE')).toBeUndefined();
      expect(normalizeLeadPhone(value, 'US')).toBeUndefined();
    },
  );

  it('drops dates and zero runs even from trusted sources', () => {
    expect(
      normalizeLeadPhone('20260410', 'DE', { trusted: true }),
    ).toBeUndefined();
    expect(
      normalizeLeadPhone('00000040', 'DE', { trusted: true }),
    ).toBeUndefined();
    expect(
      normalizeLeadPhone('2026-04-10', 'DE', { trusted: true }),
    ).toBeUndefined();
  });

  it('stores valid numbers as E.164', () => {
    expect(normalizeLeadPhone('+49 30 1234567')).toBe('+49301234567');
    expect(normalizeLeadPhone('030 1234567', 'DE')).toBe('+49301234567');
    expect(normalizeLeadPhone('(212) 736-5000', 'US')).toBe('+12127365000');
    expect(normalizeLeadPhone('0049 30 1234567')).toBe('+49301234567');
  });

  it('is idempotent on stored E.164 values', () => {
    expect(normalizeLeadPhone('+49301234567')).toBe('+49301234567');
  });

  it('drops national numbers when the country is unknown', () => {
    expect(normalizeLeadPhone('030 1234567')).toBeUndefined();
  });

  it('drops numbers libphonenumber rejects', () => {
    expect(normalizeLeadPhone('+49 1')).toBeUndefined();
    expect(normalizeLeadPhone('+1 000 000 0000')).toBeUndefined();
  });

  it('drops year ranges and bare digit runs from free text', () => {
    expect(normalizeLeadPhone('2019 - 2024', 'DE')).toBeUndefined();
    expect(normalizeLeadPhone('301234567', 'DE')).toBeUndefined();
    expect(looksLikePhoneText('117692280')).toBe(false);
    expect(looksLikePhoneText('+49 30 1234567')).toBe(true);
  });

  it('accepts a bare digit run from a trusted tel: link', () => {
    expect(normalizeLeadPhone('tel:0301234567', 'DE', { trusted: true })).toBe(
      '+49301234567',
    );
  });
});

describe('extractPhoneFromHtml', () => {
  it('prefers tel: links', () => {
    const html =
      '<p>Call 030 7654321</p><a href="tel:+49301234567">Call us</a>';

    expect(extractPhoneFromHtml(html, 'DE')).toBe('+49301234567');
  });

  it('reads JSON-LD telephone', () => {
    const html =
      '<script type="application/ld+json">{"@type":"Organization","telephone":"+44 20 7946 0958"}</script>';

    expect(extractPhoneFromHtml(html)).toBe('+442079460958');
  });

  it('ignores ids and dates in scripts and text', () => {
    const html = `<script>var build = 6442713809951; var id = "117692280";</script>
      <p>Updated 20260410, order 00000040, since 2019 - 2024</p>`;

    expect(extractPhoneFromHtml(html, 'DE')).toBe('');
  });

  it('accepts visible text shaped like a phone', () => {
    expect(
      extractPhoneFromHtml('<footer>Tel: +49 (0)30 123 4567</footer>', 'DE'),
    ).toBe('+49301234567');
    expect(
      extractPhoneFromHtml('<footer>Phone: 030 1234567</footer>', 'DE'),
    ).toBe('+49301234567');
  });
});

describe('inferCountryCode', () => {
  it('uses a structured country, then location text, then the TLD', () => {
    expect(inferCountryCode({ country: 'DE' })).toBe('DE');
    expect(inferCountryCode({ country: 'Germany' })).toBe('DE');
    expect(
      inferCountryCode({ location: 'Hauptstr. 1, 10115 Berlin, Germany' }),
    ).toBe('DE');
    expect(inferCountryCode({ location: 'San Francisco, CA' })).toBe('US');
    expect(inferCountryCode({ domain: 'acme.co.uk' })).toBe('GB');
    expect(inferCountryCode({ domain: 'acme.io' })).toBeUndefined();
  });
});
