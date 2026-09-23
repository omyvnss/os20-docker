import { type Lead } from 'src/engine/core-modules/lead-generation/interfaces/lead-generation.interface';
import { sanitizeCompanyName } from 'src/engine/core-modules/lead-generation/utils/company-name.util';
import { isNonCompanyLead } from 'src/engine/core-modules/lead-generation/utils/lead-candidate.util';
import {
  buildLeadReason,
  cleanLeads,
  sanitizeLead,
} from 'src/engine/core-modules/lead-generation/utils/lead-quality.util';

const makeLead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  company: 'Acme',
  companyUrl: 'https://acme.com/',
  domain: 'acme.com',
  industry: 'Software',
  size: 'Unknown',
  location: 'Berlin, Germany',
  description: 'Acme builds SaaS billing software.',
  contacts: [],
  score: 70,
  source: 'web_search',
  foundAt: new Date('2026-09-01T00:00:00Z'),
  reason: 'SaaS in Berlin',
  ...overrides,
});

describe('isNonCompanyLead', () => {
  it.each([
    ['Berlin SaaS Week', 'https://berlinsaasweek.com/', 'berlinsaasweek.com'],
    [
      'Berlin Startup Jobs',
      'https://berlinstartupjobs.com/',
      'berlinstartupjobs.com',
    ],
    ['Startup Map Berlin', 'https://startup-map.berlin/', 'startup-map.berlin'],
    ['startup-map.berlin', 'https://startup-map.berlin/', 'startup-map.berlin'],
    [
      'Trailblazer Community',
      'https://trailblazer.salesforce.com/',
      'salesforce.com',
    ],
    ['Top 10 SaaS companies in Berlin', 'https://listy.io/', 'listy.io'],
    ['Crunchbase', 'https://www.crunchbase.com/', 'crunchbase.com'],
    ['Acme', 'https://jobs.acme.com/', 'acme.com'],
    ['SaaStr Annual Summit', 'https://saastr.com/', 'saastr.com'],
  ])('flags %s', (name, url, domain) => {
    expect(isNonCompanyLead({ name, url, domain })).toBe(true);
  });

  it.each([
    ['Acme Dental', 'https://acme-dental.com/'],
    ['Cledara', 'https://cledara.com/'],
    ['Community Dental Care', 'https://communitydental.com/'],
  ])('keeps %s', (name, url) => {
    expect(isNonCompanyLead({ name, url })).toBe(false);
  });

  it('checks only the host of Places businesses', () => {
    expect(
      isNonCompanyLead({
        name: 'Neighbourhood Community',
        source: 'google_places',
      }),
    ).toBe(false);
    expect(isNonCompanyLead({ name: 'Acme', source: 'google_places' })).toBe(
      false,
    );
  });
});

describe('sanitizeCompanyName', () => {
  it('replaces sentence-like names and URLs with the domain label', () => {
    expect(
      sanitizeCompanyName('Origami gets customers for you.', 'origami.chat'),
    ).toBe('Origami');
    expect(sanitizeCompanyName('https://s2-labs.com/', 's2-labs.com')).toBe(
      'S2 Labs',
    );
    expect(sanitizeCompanyName('www.acme.com', 'acme.com')).toBe('Acme');
    expect(sanitizeCompanyName('Home', 'acme.com')).toBe('Acme');
  });

  it('keeps real names', () => {
    expect(sanitizeCompanyName('Cledara', 'cledara.com')).toBe('Cledara');
    expect(sanitizeCompanyName('Acme &amp; Co', 'acme.com')).toBe('Acme & Co');
  });
});

describe('buildLeadReason', () => {
  it('uses keyword, location and source facts', () => {
    expect(
      buildLeadReason(
        {
          name: 'Acme',
          description: 'SaaS billing for startups',
          industry: 'Software',
          location: 'Hauptstr. 1, 10115 Berlin, Germany',
          source: 'web_search',
        },
        { keywords: ['saas', 'crm'], location: 'Berlin' },
      ),
    ).toBe('Matches saas; based in Berlin; found via web search');
  });

  it('falls back to known industry and location without an ICP', () => {
    expect(
      buildLeadReason({
        name: 'Acme Dental',
        industry: 'Dentist',
        location: 'Hauptstr. 1, 10115 Berlin, Germany',
        source: 'google_places',
      }),
    ).toBe(
      'Dentist business; located in Berlin, Germany; listed on Google Maps',
    );
  });

  it('never invents facts when nothing is known', () => {
    expect(
      buildLeadReason({
        name: 'Acme',
        industry: 'Unknown',
        location: 'Unknown',
      }),
    ).toBe('Found via web search');
  });
});

describe('sanitizeLead', () => {
  it('fixes names, domains, phones and emails of an old saved lead', () => {
    const lead = sanitizeLead(
      makeLead({
        company: 'https://s2-labs.com/',
        companyUrl: 'https://s2-labs.com/',
        domain: undefined,
        phone: '20260410',
        emails: [
          'example@gmail.com',
          'info@s2-labs.com',
          'noreply@s2-labs.com',
        ],
        reason: '',
      }),
    );

    expect(lead).toMatchObject({
      company: 'S2 Labs',
      domain: 's2-labs.com',
      emails: ['info@s2-labs.com'],
    });
    expect(lead?.phone).toBeUndefined();
    expect(lead?.reason).toBe(
      'Software business; located in Berlin, Germany; found via web search',
    );
  });

  it('collapses data.cledara.com to the root domain', () => {
    const lead = sanitizeLead(
      makeLead({
        company: 'Cledara',
        companyUrl: 'https://data.cledara.com/',
        domain: 'data.cledara.com',
      }),
    );

    expect(lead?.domain).toBe('cledara.com');
  });

  it('uses the domain label for tagline names', () => {
    const lead = sanitizeLead(
      makeLead({
        company: 'Origami gets customers for you.',
        companyUrl: 'https://origami.chat/',
        domain: 'origami.chat',
      }),
    );

    expect(lead?.company).toBe('Origami');
  });

  it('keeps valid phones as E.164 using the lead location', () => {
    expect(sanitizeLead(makeLead({ phone: '030 1234567' }))?.phone).toBe(
      '+49301234567',
    );
    expect(
      sanitizeLead(makeLead({ phone: '117692280' }))?.phone,
    ).toBeUndefined();
  });

  it('drops junk contact emails', () => {
    const lead = sanitizeLead(
      makeLead({
        contacts: [{ name: 'Jane', title: 'CEO', email: 'your@email.com' }],
      }),
    );

    expect(lead?.contacts[0].email).toBeUndefined();
  });

  it('returns null for events, job boards, directories and communities', () => {
    expect(
      sanitizeLead(
        makeLead({
          company: 'Berlin SaaS Week',
          companyUrl: 'https://berlinsaasweek.com/',
          domain: 'berlinsaasweek.com',
          score: 80,
        }),
      ),
    ).toBeNull();
    expect(
      sanitizeLead(
        makeLead({
          company: 'Trailblazer Community',
          companyUrl: 'https://trailblazer.me/',
          domain: 'trailblazer.me',
          score: 65,
        }),
      ),
    ).toBeNull();
  });
});

describe('cleanLeads', () => {
  it('removes junk rows and dedupes rows whose domain was fixed', () => {
    const { leads, removed } = cleanLeads([
      makeLead({
        id: 'a',
        company: 'Cledara',
        domain: 'cledara.com',
        score: 60,
      }),
      makeLead({
        id: 'b',
        company: 'Cledara',
        companyUrl: 'https://data.cledara.com/',
        domain: 'data.cledara.com',
        score: 75,
      }),
      makeLead({
        id: 'c',
        company: 'Berlin Startup Jobs',
        companyUrl: 'https://berlinstartupjobs.com/',
        domain: 'berlinstartupjobs.com',
      }),
      null,
    ]);

    expect(leads.map((lead) => lead.id)).toEqual(['b']);
    expect(removed).toBe(3);
  });
});
