import {
  extractPeopleFromHtml,
  hasForeignAffiliation,
  looksLikeJobTitle,
  looksLikePersonName,
} from 'src/engine/core-modules/lead-generation/utils/team-page-extraction.util';

const page = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('team page extraction', () => {
  it('reads people from JSON-LD Organization employees and @graph Person nodes', () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Acme GmbH',
          founder: {
            '@type': 'Person',
            name: 'Jane Doe',
            jobTitle: 'CEO & Founder',
            sameAs: [
              'https://twitter.com/janedoe',
              'https://www.linkedin.com/in/jane-doe/',
            ],
          },
          employee: [
            {
              '@type': 'Person',
              givenName: 'Max',
              familyName: 'Müller',
              jobTitle: 'Head of Sales',
              email: 'mailto:max.mueller@acme.de',
            },
          ],
        },
        {
          '@type': 'Article',
          author: { '@type': 'Person', name: 'Guest Writer' },
        },
      ],
    };

    const result = extractPeopleFromHtml(
      page(
        '<h1>Welcome</h1>',
        `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
      ),
      'https://acme.de/',
    );

    expect(result.people).toEqual([
      expect.objectContaining({
        name: 'Jane Doe',
        jobTitle: 'CEO & Founder',
        linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
        method: 'json-ld',
      }),
      expect.objectContaining({
        name: 'Max Müller',
        jobTitle: 'Head of Sales',
        email: 'max.mueller@acme.de',
      }),
    ]);
  });

  it('ignores malformed JSON-LD', () => {
    const result = extractPeopleFromHtml(
      page('', '<script type="application/ld+json">{ not json</script>'),
      'https://acme.com/',
    );

    expect(result.people).toEqual([]);
  });

  it('reads schema.org microdata Person blocks', () => {
    const result = extractPeopleFromHtml(
      page(`
        <div itemscope itemtype="https://schema.org/Person">
          <span itemprop="name">Dr. Sofia Rossi</span>
          <span itemprop="jobTitle">Chief Medical Officer</span>
          <a itemprop="email" href="mailto:s.rossi@clinic.it">Email</a>
        </div>`),
      'https://clinic.it/team',
    );

    expect(result.people).toEqual([
      expect.objectContaining({
        name: 'Sofia Rossi',
        jobTitle: 'Chief Medical Officer',
        email: 's.rossi@clinic.it',
        method: 'microdata',
      }),
    ]);
  });

  it('reads team cards with heading plus title siblings, LinkedIn and mailto', () => {
    const result = extractPeopleFromHtml(
      page(`
        <nav><a href="/about">About Us</a><a href="/team">Our Team</a><a href="https://other.com/team">x</a></nav>
        <section>
          <h2>Meet Our Team</h2>
          <div class="grid">
            <div class="card">
              <img src="/a.jpg" alt="">
              <h3>Anna Schmidt</h3>
              <p class="role">Co-Founder &amp; CTO</p>
              <a href="https://www.linkedin.com/in/anna-schmidt-123/">LinkedIn</a>
              <a href="mailto:anna@acme.com">Mail</a>
            </div>
            <div class="card">
              <h3>Liam O'Connor</h3>
              <span>Customer Success Manager</span>
              <a href="https://linkedin.com/in/liamoc">in</a>
            </div>
            <div class="card">
              <h3>Customer Stories</h3>
              <p>Read how teams grow with us</p>
            </div>
          </div>
        </section>`),
      'https://www.acme.com/team',
    );

    expect(result.people).toEqual([
      {
        name: 'Anna Schmidt',
        jobTitle: 'Co-Founder & CTO',
        linkedinUrl: 'https://www.linkedin.com/in/anna-schmidt-123',
        email: 'anna@acme.com',
        sourceUrl: 'https://www.acme.com/team',
        method: 'team-card',
      },
      expect.objectContaining({
        name: "Liam O'Connor",
        jobTitle: 'Customer Success Manager',
        linkedinUrl: 'https://www.linkedin.com/in/liamoc',
        email: undefined,
      }),
    ]);
    expect(result.emails).toEqual(['anna@acme.com']);
    expect(result.teamLinks).toEqual([
      'https://www.acme.com/about',
      'https://www.acme.com/team',
    ]);
  });

  it('reads managing directors from a German impressum page', () => {
    const result = extractPeopleFromHtml(
      page(`
        <h1>Impressum</h1>
        <p>Beispiel Software GmbH<br>Musterstraße 1<br>10115 Berlin</p>
        <p>Vertretungsberechtigte Geschäftsführer: Dr. Klaus Becker, Petra Wagner</p>
        <p>Vertreten durch:<br>Jonas Weber (Prokurist)</p>
        <p>Registergericht: Amtsgericht Charlottenburg</p>
        <p>E-Mail: info [at] beispiel-software.de</p>`),
      'https://beispiel-software.de/impressum',
    );

    expect(result.people).toEqual([
      expect.objectContaining({
        name: 'Klaus Becker',
        jobTitle: 'Geschäftsführer',
        method: 'impressum',
      }),
      expect.objectContaining({
        name: 'Petra Wagner',
        jobTitle: 'Geschäftsführer',
      }),
      expect.objectContaining({ name: 'Jonas Weber', jobTitle: 'Prokurist' }),
    ]);
    expect(result.emails).toEqual(['info@beispiel-software.de']);
  });

  it('tells names and titles apart', () => {
    expect(looksLikePersonName('Jean-Luc van der Berg')).toBe(true);
    expect(looksLikePersonName('Our Leadership Team')).toBe(false);
    expect(looksLikePersonName('Head of Sales')).toBe(false);
    expect(looksLikePersonName('ACME GMBH')).toBe(false);
    expect(looksLikeJobTitle('Geschäftsführerin')).toBe(true);
    expect(looksLikeJobTitle('We build great software')).toBe(false);
  });

  it('skips people quoted in testimonials', () => {
    const html = page(`
      <section class="testimonials">
        <div class="card"><p>ChartMogul changed how we report.</p>
          <h4>Mark Tanner</h4><p>Co-Founder & CEO, Qwilr</p></div>
      </section>
      <div><blockquote>Great tool</blockquote><strong>Jane Roe</strong><span>Head of Growth</span></div>
      <section class="team">
        <div class="member"><h3>Nick Franklin</h3><p>Co-Founder & CEO</p></div>
      </section>
    `);

    const { people } = extractPeopleFromHtml(html, 'https://chartmogul.com/');

    expect(people.map((person) => person.name)).toEqual(['Nick Franklin']);
  });

  it('flags job titles that name another company', () => {
    expect(
      hasForeignAffiliation('Co-Founder & CEO, Qwilr', 'chartmogul.com'),
    ).toBe(true);
    expect(
      hasForeignAffiliation('Head of Sales at Acme Corp', 'chartmogul.com'),
    ).toBe(true);
    expect(
      hasForeignAffiliation('Managing Director, ChartMogul', 'chartmogul.com'),
    ).toBe(false);
    expect(hasForeignAffiliation('CTO, Co-Founder', 'chartmogul.com')).toBe(
      false,
    );
    expect(hasForeignAffiliation('Co-Founder & CEO', 'chartmogul.com')).toBe(
      false,
    );
    expect(hasForeignAffiliation(undefined, 'chartmogul.com')).toBe(false);
  });
});
