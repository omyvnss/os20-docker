import { useCallback } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { type Os20ContactsCompanyRef } from '@/os20-contacts/types/Os20ContactsCompanyRef';
import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { buildCompanyDomainFilter } from '@/os20-leads/utils/buildCompanyDomainFilter';
import { getLeadDomain } from '@/os20-leads/utils/getLeadDomain';
import { mapLeadToCompanyInput } from '@/os20-leads/utils/mapLeadToCompanyInput';
import { normalizeDomain } from '@/os20-leads/utils/normalizeDomain';
import { splitLeadsByExistingDomains } from '@/os20-leads/utils/splitLeadsByExistingDomains';

const DOMAIN_LOOKUP_CHUNK_SIZE = 25;

type CompanyDomainNode = {
  id: string;
  domainName?: { primaryLinkUrl?: string | null } | null;
};

type ExistingCompany = {
  id: string;
  url: string;
};

export type ApproveLeadsResult = {
  created: Os20Lead[];
  duplicates: Os20Lead[];
  companies: Os20ContactsCompanyRef[];
};

export const useApproveLeads = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { findManyRecordsQuery } = useFindManyRecordsQuery({
    objectNameSingular: CoreObjectNameSingular.Company,
    recordGqlFields: { id: true, domainName: true },
  });
  const { createManyRecords } = useCreateManyRecords({
    objectNameSingular: CoreObjectNameSingular.Company,
  });

  const findExistingCompanies = useCallback(
    async (domains: string[]): Promise<ExistingCompany[]> => {
      const companies: ExistingCompany[] = [];

      for (let i = 0; i < domains.length; i += DOMAIN_LOOKUP_CHUNK_SIZE) {
        const chunk = domains.slice(i, i + DOMAIN_LOOKUP_CHUNK_SIZE);
        const { data } = await apolloCoreClient.query<
          Record<string, { edges: { node: CompanyDomainNode }[] }>
        >({
          query: findManyRecordsQuery,
          variables: {
            filter: buildCompanyDomainFilter(chunk),
            limit: chunk.length * 4,
          },
          fetchPolicy: 'network-only',
        });

        for (const edge of data?.companies?.edges ?? []) {
          const url = edge.node.domainName?.primaryLinkUrl;

          if (url) companies.push({ id: edge.node.id, url });
        }
      }

      return companies;
    },
    [apolloCoreClient, findManyRecordsQuery],
  );

  const approveLeads = useCallback(
    async (leads: Os20Lead[]): Promise<ApproveLeadsResult> => {
      const domains = Array.from(
        new Set(
          leads
            .map(getLeadDomain)
            .filter((domain): domain is string => domain !== undefined),
        ),
      );
      const existingCompanies =
        domains.length > 0 ? await findExistingCompanies(domains) : [];
      const { toCreate, duplicates } = splitLeadsByExistingDomains(
        leads,
        existingCompanies.map((company) => company.url),
      );

      const createdRecords =
        toCreate.length > 0
          ? await createManyRecords({
              recordsToCreate: toCreate.map(mapLeadToCompanyInput),
            })
          : [];

      const existingIdByDomain = new Map(
        existingCompanies.map((company) => [
          normalizeDomain(company.url),
          company.id,
        ]),
      );
      const duplicateCompanies = duplicates.flatMap((lead) => {
        const id =
          lead.crmCompanyId ?? existingIdByDomain.get(getLeadDomain(lead));

        return id ? [{ id, name: lead.company }] : [];
      });
      const createdCompanies = createdRecords.map((record, index) => ({
        id: record.id,
        name:
          typeof record.name === 'string'
            ? record.name
            : (toCreate[index]?.company ?? ''),
      }));
      const companies = Array.from(
        new Map(
          [...createdCompanies, ...duplicateCompanies].map((company) => [
            company.id,
            company,
          ]),
        ).values(),
      );

      return { created: toCreate, duplicates, companies };
    },
    [createManyRecords, findExistingCompanies],
  );

  return { approveLeads };
};
