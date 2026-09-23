import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import {
  IconCheck,
  IconTargetArrow,
  IconUserPlus,
  IconX,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { FindContactsModal } from '@/os20-contacts/components/FindContactsModal';
import { OS20_FIND_CONTACTS_MODAL_ID } from '@/os20-contacts/constants/Os20FindContactsModalId';
import { OS20_MAX_FIND_CONTACTS_COMPANIES } from '@/os20-contacts/constants/Os20MaxFindContactsCompanies';
import { useFindContactsFlow } from '@/os20-contacts/hooks/useFindContactsFlow';
import { type Os20ContactsCompanyRef } from '@/os20-contacts/types/Os20ContactsCompanyRef';
import { useOs20FirstRunStatus } from '@/os20-first-run/hooks/useOs20FirstRunStatus';
import { LeadsSearchBar } from '@/os20-leads/components/LeadsSearchBar';
import { LeadsSearchProgress } from '@/os20-leads/components/LeadsSearchProgress';
import { LeadsTable } from '@/os20-leads/components/LeadsTable';
import { useApproveLeads } from '@/os20-leads/hooks/useApproveLeads';
import {
  type FindLeadsInput,
  useLeadsApi,
} from '@/os20-leads/hooks/useLeadsApi';
import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadKey } from '@/os20-leads/utils/getLeadKey';
import { mergeLeads } from '@/os20-leads/utils/mergeLeads';
import { sortLeadsByScore } from '@/os20-leads/utils/sortLeadsByScore';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageCardHeader } from '@/ui/layout/page/components/PageCardHeader';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';

const StyledBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]};
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSectionHeader = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMessage = styled.div<{ isError?: boolean }>`
  color: ${({ isError }) =>
    isError
      ? themeCssVariables.font.color.danger
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledEmpty = styled.div`
  border: 1px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

const StyledContactsCallout = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledContactsCalloutText = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing['0.5']};
  min-width: 0;
`;

const StyledContactsCalloutTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledContactsCalloutHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const COMPANIES_PATH = getAppPath(AppPath.RecordIndexPage, {
  objectNamePlural: 'companies',
});

const addKeys = (current: Set<string>, keys: string[]) =>
  new Set([...current, ...keys]);

const removeKeys = (current: Set<string>, keys: string[]) => {
  const next = new Set(current);

  keys.forEach((key) => next.delete(key));

  return next;
};

export const LeadsPage = () => {
  const { t } = useLingui();
  const { status } = useOs20FirstRunStatus();
  const { loadSavedLeads, findLeads, removeSavedLead } = useLeadsApi();
  const { approveLeads } = useApproveLeads();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [leads, setLeads] = useState<Os20Lead[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [contactsCompanies, setContactsCompanies] = useState<
    Os20ContactsCompanyRef[]
  >([]);
  const {
    isSaving: isFindingContacts,
    startFindContacts,
    modalProps: findContactsModalProps,
  } = useFindContactsFlow(OS20_FIND_CONTACTS_MODAL_ID);

  const applyLeads = useCallback((nextLeads: Os20Lead[]) => {
    setLeads(sortLeadsByScore(nextLeads));
    setApprovedKeys((current) =>
      addKeys(
        current,
        nextLeads.filter((lead) => lead.crmCompanyId).map(getLeadKey),
      ),
    );
  }, []);

  useEffect(() => {
    let isCancelled = false;

    loadSavedLeads()
      .then((saved) => {
        if (!isCancelled) applyLeads(saved);
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [applyLeads, loadSavedLeads]);

  const handleSearch = async (input: FindLeadsInput) => {
    setIsSearching(true);
    setSearchError(null);
    setHints([]);

    try {
      const result = await findLeads(input);

      setLeads((current) =>
        sortLeadsByScore(mergeLeads(current, result.leads)),
      );
      setHints(result.hints);

      if (result.leads.length === 0) {
        setSearchError(
          t`No leads matched. Try broader keywords or a larger area.`,
        );
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSearching(false);
    }
  };

  const handleApprove = async (leadsToApprove: Os20Lead[]) => {
    const keys = leadsToApprove.map(getLeadKey);

    if (keys.length === 0) return;

    setBusyKeys((current) => addKeys(current, keys));

    try {
      const { created, duplicates, companies } =
        await approveLeads(leadsToApprove);
      const createdCount = created.length;
      const duplicateCount = duplicates.length;

      setApprovedKeys((current) => addKeys(current, keys));
      setSelectedKeys((current) => removeKeys(current, keys));
      setContactsCompanies((current) => [
        ...current,
        ...companies.filter(
          (company) => !current.some((item) => item.id === company.id),
        ),
      ]);

      enqueueSuccessSnackBar({
        message:
          duplicateCount > 0
            ? t`${createdCount} added to Companies, ${duplicateCount} already there`
            : t`${createdCount} added to Companies`,
        options: {
          buttonLabel: t`Open Companies`,
          buttonTo: COMPANIES_PATH,
        },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Could not add companies.`,
      });
    } finally {
      setBusyKeys((current) => removeKeys(current, keys));
    }
  };

  const handleReject = async (lead: Os20Lead) => {
    const key = getLeadKey(lead);

    setBusyKeys((current) => addKeys(current, [key]));

    try {
      await removeSavedLead(key);
      setLeads((current) => current.filter((item) => getLeadKey(item) !== key));
      setSelectedKeys((current) => removeKeys(current, [key]));
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Could not remove lead.`,
      });
    } finally {
      setBusyKeys((current) => removeKeys(current, [key]));
    }
  };

  const handleToggleSelected = (key: string, value: boolean) =>
    setSelectedKeys((current) =>
      value ? addKeys(current, [key]) : removeKeys(current, [key]),
    );

  const handleToggleAll = (value: boolean) =>
    setSelectedKeys(
      value
        ? new Set(leads.map(getLeadKey).filter((key) => !approvedKeys.has(key)))
        : new Set(),
    );

  const selectedLeads = leads.filter((lead) =>
    selectedKeys.has(getLeadKey(lead)),
  );
  const selectedCount = selectedLeads.length;
  const leadCount = leads.length;
  const isBulkBusy = selectedLeads.some((lead) =>
    busyKeys.has(getLeadKey(lead)),
  );
  const contactsCompanyCount = contactsCompanies.length;
  const maxContactsCompanies = OS20_MAX_FIND_CONTACTS_COMPANIES;
  const companiesToSearch = contactsCompanies.slice(0, maxContactsCompanies);

  const handleFindContacts = () => {
    startFindContacts(companiesToSearch);
    setContactsCompanies((current) => current.slice(maxContactsCompanies));
  };

  return (
    <>
      <PageTitle title={t`Leads`} />
      <PageCardLayout
        header={
          <PageCardHeader
            icon={<IconTargetArrow size={16} />}
            title={t`Leads`}
            actionButton={
              selectedCount > 0 && (
                <Button
                  size="small"
                  Icon={IconCheck}
                  accent="blue"
                  title={t`Approve ${selectedCount} selected`}
                  disabled={isBulkBusy}
                  onClick={() => handleApprove(selectedLeads)}
                />
              )
            }
          />
        }
      >
        <StyledBody>
          {contactsCompanyCount > 0 && (
            <StyledContactsCallout role="status">
              <StyledContactsCalloutText>
                <StyledContactsCalloutTitle>
                  {contactsCompanyCount === 1
                    ? t`${contactsCompanyCount} company is ready for contacts`
                    : t`${contactsCompanyCount} companies are ready for contacts`}
                </StyledContactsCalloutTitle>
                <StyledContactsCalloutHint>
                  {contactsCompanyCount > maxContactsCompanies
                    ? t`OS20 finds people on up to ${maxContactsCompanies} companies at a time, starting with the first ${maxContactsCompanies}.`
                    : t`OS20 reads their websites for people and checks each email.`}
                </StyledContactsCalloutHint>
              </StyledContactsCalloutText>
              <Button
                size="small"
                variant="primary"
                accent="blue"
                Icon={IconUserPlus}
                title={t`Find contacts`}
                onClick={handleFindContacts}
                disabled={isFindingContacts}
              />
              <IconButton
                Icon={IconX}
                size="small"
                variant="tertiary"
                ariaLabel={t`Dismiss`}
                onClick={() => setContactsCompanies([])}
              />
            </StyledContactsCallout>
          )}
          <StyledSection>
            <LeadsSearchBar
              isSearching={isSearching}
              missingAiKey={status.isLoaded && !status.hasAiKey}
              missingSourceKey={
                status.isLoaded && !status.hasSearchKey && !status.hasPlacesKey
              }
              onSearch={handleSearch}
            />
            {isSearching && <LeadsSearchProgress />}
            {searchError && (
              <StyledMessage role="alert" isError>
                {searchError}
              </StyledMessage>
            )}
            {hints.map((hint) => (
              <StyledMessage key={hint}>{hint}</StyledMessage>
            ))}
          </StyledSection>

          <StyledSection>
            <StyledSectionHeader>
              <StyledSectionTitle>{t`Saved leads`}</StyledSectionTitle>
              {leadCount > 0 && <StyledCount>{leadCount}</StyledCount>}
            </StyledSectionHeader>
            {loadError && (
              <StyledMessage role="alert" isError>
                {loadError}
              </StyledMessage>
            )}
            {isLoaded && leadCount === 0 && !loadError && (
              <StyledEmpty>
                {t`No leads yet. Describe who you sell to and find your first batch.`}
              </StyledEmpty>
            )}
            {leadCount > 0 && (
              <LeadsTable
                leads={leads}
                selectedKeys={selectedKeys}
                approvedKeys={approvedKeys}
                busyKeys={busyKeys}
                onToggleSelected={handleToggleSelected}
                onToggleAll={handleToggleAll}
                onApprove={(lead) => handleApprove([lead])}
                onReject={handleReject}
              />
            )}
          </StyledSection>
        </StyledBody>
      </PageCardLayout>
      <FindContactsModal
        modalInstanceId={findContactsModalProps.modalInstanceId}
        state={findContactsModalProps.state}
        companyNames={findContactsModalProps.companyNames}
        pendingCompanyIds={findContactsModalProps.pendingCompanyIds}
        onClose={findContactsModalProps.onClose}
      />
    </>
  );
};
