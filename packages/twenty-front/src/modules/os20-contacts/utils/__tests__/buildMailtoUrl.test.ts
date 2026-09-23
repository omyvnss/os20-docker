import { buildMailtoUrl } from '@/os20-contacts/utils/buildMailtoUrl';

describe('buildMailtoUrl', () => {
  it('encodes recipient, subject and body without plus signs', () => {
    expect(
      buildMailtoUrl({
        to: 'jane@acme.com',
        subject: 'Quick idea & question',
        body: 'Hi Jane,\nShort note.',
      }),
    ).toBe(
      'mailto:jane%40acme.com?subject=Quick%20idea%20%26%20question&body=Hi%20Jane%2C%0D%0AShort%20note.',
    );
  });

  it('works without a recipient or empty parts', () => {
    expect(buildMailtoUrl({ to: null, subject: ' ', body: '' })).toBe(
      'mailto:',
    );
    expect(buildMailtoUrl({ subject: 'Hello', body: '' })).toBe(
      'mailto:?subject=Hello',
    );
  });
});
