import { buildCompanyDomainFilter } from '@/os20-leads/utils/buildCompanyDomainFilter';

describe('buildCompanyDomainFilter', () => {
  it('matches each domain with and without www and a path', () => {
    const filter = buildCompanyDomainFilter(['acme.com']);

    expect(
      filter.or.map((clause) => clause.domainName.primaryLinkUrl.ilike),
    ).toEqual([
      '%//acme.com',
      '%//acme.com/%',
      '%//www.acme.com',
      '%//www.acme.com/%',
    ]);
  });
});
