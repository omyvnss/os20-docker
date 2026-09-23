import {
  filterLeadEmails,
  isJunkEmail,
} from 'src/engine/core-modules/lead-generation/utils/junk-email.util';

describe('isJunkEmail', () => {
  it.each([
    'example@gmail.com',
    'test@acme.com',
    'noreply@acme.com',
    'no-reply@acme.com',
    'donotreply@acme.com',
    'your@email.com',
    'your@email',
    'name@domain',
    'name@domain.com',
    'john.doe@gmail.com',
    'hello@example.com',
    'info@yourdomain.com',
    'abc123@sentry.io',
    'd41d8cd98f00b204e9800998ecf8427e@sentry.wixpress.com',
    '605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com',
    'logo@2x.png',
    'hero-image@3x.webp',
    'icon@acme.svg',
    'keiko@company.example',
    'sales@acme.test',
    'info@shop.invalid',
    'admin@app.localhost',
    'jane@mail.example.com',
    'jane@example.org',
    'jane@example.net',
  ])('flags %s', (email) => {
    expect(isJunkEmail(email)).toBe(true);
  });

  it.each([
    'info@acme.com',
    'hello@acme.io',
    'sales@acme.de',
    'support@acme.co.uk',
    'jane@acme.com',
    'acme.dental@gmail.com',
    'owner@examplebakery.com',
    'team@testlab.io',
  ])('keeps %s', (email) => {
    expect(isJunkEmail(email)).toBe(false);
  });
});

describe('filterLeadEmails', () => {
  it('normalizes, dedupes and drops junk', () => {
    expect(
      filterLeadEmails([
        'u003einfo@acme.com',
        'INFO@acme.com',
        'mailto:hello@acme.com?subject=Hi',
        'example@gmail.com',
        'noreply@acme.com',
        42,
      ]),
    ).toEqual(['info@acme.com', 'hello@acme.com']);
  });

  it('returns an empty list for non-arrays', () => {
    expect(filterLeadEmails(undefined)).toEqual([]);
  });
});
