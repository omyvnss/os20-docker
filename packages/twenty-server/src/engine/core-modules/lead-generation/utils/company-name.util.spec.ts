import {
  extractCompanyName,
  isSentenceLikeName,
} from 'src/engine/core-modules/lead-generation/utils/company-name.util';

describe('extractCompanyName', () => {
  it('uses the domain label instead of a tagline title', () => {
    const html =
      '<html><head><title>Origami gets customers for you.</title></head></html>';

    expect(extractCompanyName(html, 'https://origami.chat/')).toBe('Origami');
  });

  it('prefers og:site_name', () => {
    const html =
      '<meta property="og:site_name" content="Cledara"><title>Data | SaaS spend</title>';

    expect(extractCompanyName(html, 'https://data.cledara.com/')).toBe(
      'Cledara',
    );
  });

  it('falls back to JSON-LD Organization name', () => {
    const html = `<title>Welcome to the best tools for teams everywhere</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Site"},{"@type":"Organization","name":"Acme Labs"}]}</script>`;

    expect(extractCompanyName(html, 'https://acme.io/')).toBe('Acme Labs');
  });

  it('uses application-name before the title', () => {
    const html =
      '<meta name="application-name" content="Beta Co"><title>Beta</title>';

    expect(extractCompanyName(html, 'https://beta.com/')).toBe('Beta Co');
  });

  it('picks the title segment that matches the domain label', () => {
    expect(
      extractCompanyName(
        '<title>Spend management for SaaS | Clear Bit</title>',
        'https://clearbit.com/',
      ),
    ).toBe('Clear Bit');
    expect(
      extractCompanyName(
        '<title>Acme - Dental care in London</title>',
        'https://www.acme.co.uk/',
      ),
    ).toBe('Acme');
  });

  it('rejects sentence-like og:site_name and title-cases the label', () => {
    const html =
      '<meta property="og:site_name" content="We help teams ship faster today"><title>Ship faster</title>';

    expect(extractCompanyName(html, 'https://acme-dental.com/')).toBe(
      'Acme Dental',
    );
  });
});

describe('isSentenceLikeName', () => {
  it('flags long names and names ending with a period', () => {
    expect(isSentenceLikeName('Origami gets customers for you.')).toBe(true);
    expect(isSentenceLikeName('One two three four five six')).toBe(true);
    expect(isSentenceLikeName('Acme Inc')).toBe(false);
  });
});
