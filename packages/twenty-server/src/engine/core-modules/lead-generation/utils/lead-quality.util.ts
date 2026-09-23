import {
  type IdealCustomerProfile,
  type Lead,
  type LeadCandidateSource,
} from '../interfaces/lead-generation.interface';
import { isUrlLikeName, sanitizeCompanyName } from './company-name.util';
import { filterLeadEmails, isJunkEmail } from './junk-email.util';
import { isNonCompanyLead, normalizeDomain } from './lead-candidate.util';
import { inferCountryCode, normalizeLeadPhone } from './lead-phone.util';

// Places leads without a website have no URL, so key them by place id.
export const getLeadKey = (lead: Lead): string =>
  lead.domain || lead.companyUrl || lead.externalId || lead.id;

const isKnown = (value: string | undefined): value is string =>
  !!value?.trim() && value.trim().toLowerCase() !== 'unknown';

const shortLocation = (location: string) =>
  location
    .split(',')
    .map((part) => part.replace(/\b\d[\d-]*\b/g, '').trim())
    .filter(Boolean)
    .slice(-2)
    .join(', ');

const SOURCE_LABELS: Record<LeadCandidateSource, string> = {
  google_places: 'listed on Google Maps',
  web_search: 'found via web search',
};

// Built only from facts already on the lead, for rows the AI left without a
// reason or that were scored heuristically.
export const buildLeadReason = (
  lead: {
    name?: string;
    industry?: string;
    location?: string;
    description?: string;
    source?: LeadCandidateSource;
  },
  icp: IdealCustomerProfile = {},
): string => {
  const text =
    `${lead.name ?? ''} ${lead.description ?? ''} ${lead.industry ?? ''}`.toLowerCase();
  const matchedTerms = [icp.industry, ...(icp.keywords ?? [])]
    .filter(isKnown)
    .map((term) => term.trim())
    .filter((term) => text.includes(term.toLowerCase()));
  const parts: string[] = [];

  if (matchedTerms.length > 0) {
    parts.push(`matches ${[...new Set(matchedTerms)].slice(0, 3).join(', ')}`);
  } else if (isKnown(lead.industry)) {
    parts.push(`${lead.industry.trim()} business`);
  }

  if (
    isKnown(icp.location) &&
    lead.location?.toLowerCase().includes(icp.location.trim().toLowerCase())
  ) {
    parts.push(`based in ${icp.location.trim()}`);
  } else if (isKnown(lead.location) && shortLocation(lead.location)) {
    parts.push(`located in ${shortLocation(lead.location)}`);
  }

  parts.push(SOURCE_LABELS[lead.source ?? 'web_search']);

  const reason = parts.join('; ');

  return reason.charAt(0).toUpperCase() + reason.slice(1);
};

// Applies the save-time rules to one lead: drops non-companies, fixes the
// name and domain, keeps only real emails and E.164 phones.
export const sanitizeLead = (lead: Lead): Lead | null => {
  if (!lead || typeof lead !== 'object') {
    return null;
  }

  const rawName = typeof lead.company === 'string' ? lead.company.trim() : '';
  const domain =
    normalizeDomain(lead.domain) ??
    normalizeDomain(lead.companyUrl) ??
    (isUrlLikeName(rawName) ? normalizeDomain(rawName) : undefined);
  const company = sanitizeCompanyName(rawName, domain);

  if (!company) {
    return null;
  }

  const source = lead.source ?? 'web_search';
  const identity = { domain, url: lead.companyUrl, source };

  if (
    isNonCompanyLead({ ...identity, name: rawName }) ||
    isNonCompanyLead({ ...identity, name: company })
  ) {
    return null;
  }

  const location = typeof lead.location === 'string' ? lead.location : '';
  const phone = normalizeLeadPhone(
    typeof lead.phone === 'string' ? lead.phone : undefined,
    inferCountryCode({ location, domain }),
  );
  const sanitized: Lead = {
    ...lead,
    company,
    domain,
    source,
    emails: filterLeadEmails(lead.emails),
    phone,
    contacts: Array.isArray(lead.contacts)
      ? lead.contacts.map((contact) =>
          contact?.email && isJunkEmail(contact.email)
            ? { ...contact, email: undefined }
            : contact,
        )
      : [],
  };

  if (lead.verifiedEmails) {
    sanitized.verifiedEmails = filterLeadEmails(lead.verifiedEmails);
  }

  if (lead.possibleEmails) {
    sanitized.possibleEmails = filterLeadEmails(lead.possibleEmails);
  }

  if (!phone) {
    delete sanitized.phone;
  }

  if (!domain) {
    delete sanitized.domain;
  }

  sanitized.reason =
    typeof lead.reason === 'string' && lead.reason.trim()
      ? lead.reason.trim()
      : buildLeadReason({
          name: company,
          industry: lead.industry,
          location,
          description: lead.description,
          source,
        });

  return sanitized;
};

// Sanitizes, drops non-companies and re-dedupes (a fixed domain can collide
// with another row). Keeps the highest-scored row per key.
export const cleanLeads = (
  leads: unknown[],
): { leads: Lead[]; removed: number } => {
  const byKey = new Map<string, Lead>();
  let removed = 0;

  for (const lead of leads) {
    const sanitized = sanitizeLead(lead as Lead);

    if (!sanitized) {
      removed += 1;
      continue;
    }

    const key = getLeadKey(sanitized);
    const existing = byKey.get(key);

    if (existing) {
      removed += 1;
    }

    if (!existing || (sanitized.score ?? 0) > (existing.score ?? 0)) {
      byKey.set(key, sanitized);
    }
  }

  return {
    leads: [...byKey.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    removed,
  };
};
