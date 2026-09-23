import {
  getCompanyHomepageHost,
  getCompanyRootDomain,
  getRegistrableDomain,
} from 'src/engine/core-modules/lead-generation/utils/registrable-domain.util';
import {
  dedupeCompaniesByDomain,
  normalizeDomain,
} from 'src/engine/core-modules/lead-generation/utils/lead-candidate.util';
import { type ScrapedCompany } from 'src/engine/core-modules/lead-generation/interfaces/lead-generation.interface';

const company = (url: string, name = 'Cledara'): ScrapedCompany => ({
  name,
  url,
  description: '',
  industry: '',
  size: '',
  location: '',
  emails: [],
  phone: '',
  socialLinks: [],
  employees: '',
  founded: '',
});

describe('getRegistrableDomain', () => {
  it('handles multi-part TLDs', () => {
    expect(getRegistrableDomain('blog.acme.co.uk')).toBe('acme.co.uk');
    expect(getRegistrableDomain('shop.acme.com.au')).toBe('acme.com.au');
    expect(getRegistrableDomain('www.acme.co.in')).toBe('acme.co.in');
    expect(getRegistrableDomain('acme.co.uk')).toBe('acme.co.uk');
  });
});

describe('getCompanyRootDomain', () => {
  it('strips non-brand subdomains down to the registrable domain', () => {
    expect(getCompanyRootDomain('data.cledara.com')).toBe('cledara.com');
    expect(getCompanyRootDomain('www.app.acme.io')).toBe('acme.io');
    expect(getCompanyRootDomain('developers.acme.co.uk')).toBe('acme.co.uk');
    expect(getCompanyRootDomain('origami.chat')).toBe('origami.chat');
  });

  it('points non-brand subdomain search hits at the homepage host', () => {
    expect(getCompanyHomepageHost('data.cledara.com')).toBe('cledara.com');
    expect(getCompanyHomepageHost('www.acme.com')).toBe('www.acme.com');
    expect(getCompanyHomepageHost('acme.com')).toBe('acme.com');
  });
});

describe('normalizeDomain', () => {
  it('saves the registrable root of the company site', () => {
    expect(normalizeDomain('https://data.cledara.com')).toBe('cledara.com');
    expect(normalizeDomain('https://help.acme.com.au/path')).toBe(
      'acme.com.au',
    );
  });

  it('dedupes subdomain and root hits of the same company', () => {
    const result = dedupeCompaniesByDomain([
      company('https://data.cledara.com'),
      company('https://www.cledara.com/'),
      company('https://acme.co.uk', 'Acme'),
    ]);

    expect(result.map((item) => item.url)).toEqual([
      'https://data.cledara.com',
      'https://acme.co.uk',
    ]);
  });
});
