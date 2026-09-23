import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { ProgressBar } from 'twenty-ui/feedback';
import { IconUsers } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ShimmeringText } from '@/ai/components/ShimmeringText';
import { CoreObjectNamePlural } from '@/object-metadata/types/CoreObjectNamePlural';
import { FindContactsCompanyResult } from '@/os20-contacts/components/FindContactsCompanyResult';
import { Os20ContactsModalLayout } from '@/os20-contacts/components/Os20ContactsModalLayout';
import { type SaveCompanyContactsState } from '@/os20-contacts/hooks/useSaveCompanyContacts';
import { summarizeContactsResults } from '@/os20-contacts/utils/summarizeContactsResults';

const PEOPLE_PATH = getAppPath(AppPath.RecordIndexPage, {
  objectNamePlural: CoreObjectNamePlural.Person,
});

const StyledProgress = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledProgressLabel = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledSummary = styled.p`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  margin: 0;
`;

const StyledError = styled.p`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.md};
  margin: 0;
`;

type FindContactsModalProps = {
  modalInstanceId: string;
  state: SaveCompanyContactsState;
  companyNames?: Record<string, string>;
  pendingCompanyIds?: string[];
  onClose: () => void;
};

export const FindContactsModal = ({
  modalInstanceId,
  state,
  companyNames = {},
  pendingCompanyIds = [],
  onClose,
}: FindContactsModalProps) => {
  const { t } = useLingui();
  const { status, total, completed, results, error } = state;
  const isSaving = status === 'saving';
  const summary = summarizeContactsResults(results);
  const createdCount = summary.createdCount;
  const skippedCount = summary.skippedCount;
  const current = Math.min(completed + 1, total);
  const currentCompanyName = companyNames[pendingCompanyIds[completed] ?? ''];
  const progressValue = total > 0 ? (completed / total) * 100 : 0;

  const subtitle = isSaving
    ? t`Reading company websites and checking emails. This can take a minute.`
    : t`People are saved to the company, with the email and how sure we are.`;

  return (
    <Os20ContactsModalLayout
      modalInstanceId={modalInstanceId}
      title={t`Find contacts`}
      subtitle={subtitle}
      onClose={onClose}
      footerStart={
        status === 'done' || status === 'error'
          ? skippedCount > 0
            ? t`${createdCount} people added, ${skippedCount} skipped`
            : t`${createdCount} people added`
          : undefined
      }
      footer={
        <>
          <Button
            size="small"
            variant="secondary"
            title={isSaving ? t`Hide` : t`Close`}
            onClick={onClose}
          />
          <Button
            size="small"
            variant="primary"
            accent="blue"
            Icon={IconUsers}
            title={t`Open People`}
            to={PEOPLE_PATH}
            disabled={isSaving || createdCount === 0}
            onClick={onClose}
          />
        </>
      }
    >
      {isSaving && (
        <StyledProgress role="status" aria-live="polite">
          <StyledProgressLabel>
            <ShimmeringText>
              {currentCompanyName
                ? t`Looking for people at ${currentCompanyName} (${current} of ${total})`
                : t`Looking for people at company ${current} of ${total}`}
            </ShimmeringText>
          </StyledProgressLabel>
          <ProgressBar
            value={progressValue}
            backgroundColor={themeCssVariables.background.tertiary}
            barColor={themeCssVariables.color.blue}
            withBorderRadius
            ariaLabel={t`Progress`}
          />
        </StyledProgress>
      )}
      {status === 'error' && error && (
        <StyledError role="alert">{error}</StyledError>
      )}
      {status === 'done' && results.length > 0 && createdCount === 0 && (
        <StyledSummary>
          {t`No new people were added. They may already be in People, or the sites did not list anyone.`}
        </StyledSummary>
      )}
      {results.map((result) => (
        <FindContactsCompanyResult
          key={result.companyId}
          result={result}
          fallbackName={companyNames[result.companyId]}
        />
      ))}
    </Os20ContactsModalLayout>
  );
};
