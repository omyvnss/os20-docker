import { type Os20CompanyContactsResult } from '@/os20-contacts/types/Os20CompanyContactsResult';
import { type Os20ContactsSummary } from '@/os20-contacts/types/Os20ContactsSummary';

export const summarizeContactsResults = (
  results: Os20CompanyContactsResult[],
): Os20ContactsSummary =>
  results.reduce<Os20ContactsSummary>(
    (summary, result) => ({
      companyCount: summary.companyCount + 1,
      failedCompanyCount:
        summary.failedCompanyCount + (result.error !== undefined ? 1 : 0),
      createdCount: summary.createdCount + result.created,
      skippedCount: summary.skippedCount + result.skipped,
    }),
    {
      companyCount: 0,
      failedCompanyCount: 0,
      createdCount: 0,
      skippedCount: 0,
    },
  );
