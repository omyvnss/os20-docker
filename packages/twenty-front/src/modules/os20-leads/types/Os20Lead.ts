export type Os20LeadSource = 'google_places' | 'web_search';

export type Os20Lead = {
  id: string;
  company: string;
  companyUrl: string;
  domain?: string;
  description?: string;
  location?: string;
  score: number;
  reason?: string;
  source: Os20LeadSource;
  externalId?: string;
  phone?: string;
  emails?: string[];
  verifiedEmails?: string[];
  possibleEmails?: string[];
  crmCompanyId?: string;
};
