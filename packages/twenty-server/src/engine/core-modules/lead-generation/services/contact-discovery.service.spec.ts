import {
  ContactDiscoveryService,
  emailMatchesName,
  mapWithConcurrency,
} from 'src/engine/core-modules/lead-generation/services/contact-discovery.service';
import { type LeadEnrichmentService } from 'src/engine/core-modules/lead-generation/services/lead-enrichment.service';
import { type SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';

const htmlResponse = (html: string, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    text: async () => html,
  }) as Response;

const SITE: Record<string, string> = {
  'https://acme.de/': `<html lang="de"><body>
    <a href="/ueber-uns">Über uns</a>
    <p>Kontakt: <a href="mailto:jana.fischer@acme.de">jana.fischer@acme.de</a> or info@acme.de</p>
  </body></html>`,
  'https://acme.de/ueber-uns': `<html><body>
    <div class="member"><h3>Jana Fischer</h3><p>Geschäftsführerin</p></div>
    <div class="member"><h3>Tom Braun</h3><p>Head of Sales</p><a href="https://www.linkedin.com/in/tombraun">in</a></div>
  </body></html>`,
  'https://acme.de/impressum': `<html><body><p>Geschäftsführer: Jana Fischer</p></body></html>`,
};

const buildService = (resolveContactEmails: jest.Mock) => {
  const fetchMock = jest.fn(async (url: string) =>
    SITE[url] ? htmlResponse(SITE[url]) : htmlResponse('Not found', 404),
  );
  const secureHttpClientService = {
    createSsrfSafeFetch: jest.fn(() => fetchMock),
  } as unknown as SecureHttpClientService;
  const leadEnrichmentService = {
    resolveContactEmails,
  } as unknown as LeadEnrichmentService;
  const workspaceOrmManager = {} as WorkspaceOrmManager;

  return {
    fetchMock,
    secureHttpClientService,
    service: new ContactDiscoveryService(
      secureHttpClientService,
      leadEnrichmentService,
      workspaceOrmManager,
    ),
  };
};

describe('ContactDiscoveryService', () => {
  it('fetches likely pages through the SSRF-safe fetch and merges people', async () => {
    const resolveContactEmails = jest.fn().mockResolvedValue({
      domain: 'acme.de',
      pattern: 'first.last',
      patternSource: 'site',
      smtp: 'unavailable',
      people: [
        {
          name: 'Jana Fischer',
          email: 'jana.fischer@acme.de',
          emailStatus: 'found',
          verification: 'not-checked',
          emailSource: 'website',
        },
        {
          name: 'Tom Braun',
          email: 'tom.braun@acme.de',
          emailStatus: 'guessed',
          verification: 'unavailable',
          emailSource: 'pattern:first.last',
        },
      ],
    });
    const { service, fetchMock, secureHttpClientService } =
      buildService(resolveContactEmails);

    const result = await service.discoverCompanyContacts('acme.de');

    expect(secureHttpClientService.createSsrfSafeFetch).toHaveBeenCalled();
    const fetched = fetchMock.mock.calls.map(([url]) => url);

    expect(fetched).toEqual(
      expect.arrayContaining([
        'https://acme.de/',
        'https://acme.de/ueber-uns',
        'https://acme.de/impressum',
        'https://acme.de/team',
        'https://acme.de/about',
      ]),
    );
    expect(result.pagesFetched).toEqual([
      'https://acme.de/',
      'https://acme.de/ueber-uns',
      'https://acme.de/impressum',
    ]);
    expect(resolveContactEmails).toHaveBeenCalledWith({
      domain: 'acme.de',
      siteEmails: ['jana.fischer@acme.de', 'info@acme.de'],
      people: [
        { name: 'Jana Fischer', email: 'jana.fischer@acme.de' },
        { name: 'Tom Braun' },
      ],
    });
    expect(result.people).toEqual([
      expect.objectContaining({
        firstName: 'Jana',
        lastName: 'Fischer',
        jobTitle: 'Geschäftsführerin',
        email: 'jana.fischer@acme.de',
        emailStatus: 'found',
      }),
      expect.objectContaining({
        fullName: 'Tom Braun',
        linkedinUrl: 'https://www.linkedin.com/in/tombraun',
        email: 'tom.braun@acme.de',
        emailStatus: 'guessed',
        emailVerification: 'unavailable',
        emailSource: 'pattern:first.last',
      }),
    ]);
    expect(result.companyEmails).toEqual(['info@acme.de']);
    expect(result.smtp).toBe('unavailable');
    expect(result.notes).toEqual([
      expect.stringContaining('port 25 is blocked'),
    ]);
  });

  it('returns only on-site emails when the lead engine is unreachable', async () => {
    const { service } = buildService(jest.fn().mockResolvedValue(null));

    const result = await service.discoverCompanyContacts('https://acme.de');

    expect(result.people.map((person) => person.emailStatus)).toEqual([
      'found',
      undefined,
    ]);
    expect(result.people[1].email).toBeUndefined();
    expect(result.smtp).toBe('not-run');
    expect(result.notes[0]).toContain('Lead engine unavailable');
  });

  it('rejects non-http websites', async () => {
    const { service } = buildService(jest.fn());

    await expect(
      service.discoverCompanyContacts('ftp://acme.de'),
    ).rejects.toThrow('Not a valid website');
  });

  it('matches site emails to names only on exact patterns', () => {
    expect(emailMatchesName('j.mueller@acme.de', 'Jörg Müller')).toBe(true);
    expect(emailMatchesName('info@acme.de', 'Info Team')).toBe(false);
    expect(emailMatchesName('jane@acme.com', 'Jane Doe')).toBe(false);
  });

  it('limits concurrency', async () => {
    let active = 0;
    let peak = 0;

    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        for (let tick = 0; tick < 5; tick += 1) {
          await Promise.resolve();
        }
        active -= 1;

        return value * 2;
      },
    );

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });
});
