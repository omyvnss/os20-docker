export interface IdealCustomerProfile {
  industry?: string;
  companySize?: string;
  location?: string;
  revenue?: string;
  technology?: string;
  keywords?: string[];
  excludeKeywords?: string[];
  maxResults?: number;
}

export interface Lead {
  id: string;
  company: string;
  companyUrl: string;
  industry: string;
  size: string;
  location: string;
  description: string;
  contacts: Contact[];
  score: number;
  source: string;
  foundAt: Date;
  verifiedEmails?: string[];
  possibleEmails?: string[];
  enrichmentScore?: number;
}

export interface Contact {
  name: string;
  title: string;
  email?: string;
  linkedin?: string;
  phone?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ScrapedCompany {
  name: string;
  url: string;
  description: string;
  industry: string;
  size: string;
  location: string;
  emails: string[];
  phone: string;
  socialLinks: string[];
  employees: string;
  founded: string;
}
