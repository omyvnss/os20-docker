export type LeadSourceCategory =
  | 'Business directories'
  | 'Web & local search'
  | 'App stores & marketplaces'
  | 'Developer & startup communities'
  | 'Public company data'
  | 'Web Agents';

export type LeadSourceAccess = 'FREE' | 'FREE_LIMITED' | 'SCRAPE';

export type LeadSourceCriteriaFieldType =
  | 'text'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'toggle';

export type LeadSourceCriteriaFieldOption = {
  value: string;
  label: string;
};

export type LeadSourceCriteriaField = {
  key: string;
  label: string;
  type: LeadSourceCriteriaFieldType;
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean;
  options?: LeadSourceCriteriaFieldOption[];
};

export type LeadSource = {
  id: string;
  name: string;
  description: string;
  category: LeadSourceCategory;
  access: LeadSourceAccess;
  note?: string;
  criteriaFields: LeadSourceCriteriaField[];
};

export type LeadSourceCriteria = Record<string, string | number | boolean>;

export type SourceLeadCandidate = {
  id: string;
  sourceId: string;
  platform: string;
  title: string;
  companyName: string;
  industry?: string;
  location?: string;
  website?: string;
  phone?: string;
  email?: string;
  rating?: number;
  snippet?: string;
  url?: string;
};

export type LeadSourceSearchResult = {
  sourceId: string;
  candidates: SourceLeadCandidate[];
  truncated: boolean;
  note?: string;
};