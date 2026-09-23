// Same URL shapes the server's find_leads tool matches on.
export const buildCompanyDomainFilter = (domains: string[]) => ({
  or: domains.flatMap((domain) =>
    [
      `%//${domain}`,
      `%//${domain}/%`,
      `%//www.${domain}`,
      `%//www.${domain}/%`,
    ].map((pattern) => ({
      domainName: { primaryLinkUrl: { ilike: pattern } },
    })),
  ),
});
