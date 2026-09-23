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

export type LeadCandidateSource = 'google_places' | 'web_search';

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
  source: LeadCandidateSource;
  externalId?: string;
  rating?: number;
  reviewCount?: number;
  foundAt: Date;
  verifiedEmails?: string[];
  possibleEmails?: string[];
  enrichmentScore?: number;
  domain?: string;
  reason?: string;
  emails?: string[];
  phone?: string;
  crmCompanyId?: string;
}

export interface LeadSearchStats {
  searchSource: 'search-api' | 'duckduckgo' | 'none';
  searchBlocked: boolean;
  searchResults: number;
  placesResults: number;
  candidates: number;
  fetched: number;
  aiScored: boolean;
  durationMs: number;
}

export interface LeadSearchResult {
  leads: Lead[];
  searchQuery: string;
  stats: LeadSearchStats;
  hints: string[];
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
  domain?: string;
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
  source?: LeadCandidateSource;
  externalId?: string;
  rating?: number;
  reviewCount?: number;
}
