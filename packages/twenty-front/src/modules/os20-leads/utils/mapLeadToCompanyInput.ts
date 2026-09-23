import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadDomain } from '@/os20-leads/utils/getLeadDomain';

export type LeadCompanyInput = {
  name: string;
  domainName?: {
    primaryLinkUrl: string;
    primaryLinkLabel: string;
  };
};

export const mapLeadToCompanyInput = (lead: Os20Lead): LeadCompanyInput => {
  const domain = getLeadDomain(lead);
  const name = lead.company.trim() || domain || '';

  return domain
    ? {
        name,
        domainName: {
          primaryLinkUrl: `https://${domain}`,
          primaryLinkLabel: '',
        },
      }
    : { name };
};
