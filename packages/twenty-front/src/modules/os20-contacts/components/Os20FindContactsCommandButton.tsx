import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconUserPlus } from 'twenty-ui/icon';
import { AppTooltip, TooltipDelay, TooltipPosition } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CommandMenuButton } from '@/command-menu/components/CommandMenuButton';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { useFindManyRecordsSelectedInContextStore } from '@/context-store/hooks/useFindManyRecordsSelectedInContextStore';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { FindContactsModal } from '@/os20-contacts/components/FindContactsModal';
import { OS20_FIND_CONTACTS_MODAL_ID } from '@/os20-contacts/constants/Os20FindContactsModalId';
import { OS20_MAX_FIND_CONTACTS_COMPANIES } from '@/os20-contacts/constants/Os20MaxFindContactsCompanies';
import { useFindContactsFlow } from '@/os20-contacts/hooks/useFindContactsFlow';
import { type Os20ContactsCompanyRef } from '@/os20-contacts/types/Os20ContactsCompanyRef';
import { getFindContactsAvailability } from '@/os20-contacts/utils/getFindContactsAvailability';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

const COMMAND_KEY = 'os20-find-contacts';
const HINT_ANCHOR_ID = 'os20-find-contacts-hint';

const StyledTooltipWrapper = styled.div`
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledHintAnchor = styled.div`
  display: flex;
`;

type FindContactsForSelectionProps = {
  isSaving: boolean;
  onStart: (companies: Os20ContactsCompanyRef[]) => void;
};

const FindContactsForSelection = ({
  isSaving,
  onStart,
}: FindContactsForSelectionProps) => {
  const { t } = useLingui();
  const { records, loading } = useFindManyRecordsSelectedInContextStore({
    instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID,
    limit: OS20_MAX_FIND_CONTACTS_COMPANIES,
  });

  const handleClick = () =>
    onStart(
      records.map((record) => ({
        id: record.id,
        name: typeof record.name === 'string' ? record.name : '',
      })),
    );

  return (
    <CommandMenuButton
      command={{
        key: COMMAND_KEY,
        label: t`Find contacts for the selected companies`,
        shortLabel: isSaving ? t`Finding contacts` : t`Find contacts`,
        Icon: IconUserPlus,
      }}
      onClick={handleClick}
      disabled={loading || records.length === 0}
    />
  );
};

const FindContactsTooManySelected = () => {
  const { t } = useLingui();
  const maxCount = OS20_MAX_FIND_CONTACTS_COMPANIES;
  const hint = t`Select up to ${maxCount} companies to find contacts`;

  return (
    <StyledHintAnchor id={HINT_ANCHOR_ID} aria-label={hint}>
      <CommandMenuButton
        command={{
          key: COMMAND_KEY,
          label: hint,
          shortLabel: t`Find contacts`,
          Icon: IconUserPlus,
        }}
        disabled
      />
      <StyledTooltipWrapper>
        <AppTooltip
          anchorSelect={`#${HINT_ANCHOR_ID}`}
          content={hint}
          delay={TooltipDelay.shortDelay}
          place={TooltipPosition.Bottom}
          offset={5}
          noArrow
        />
      </StyledTooltipWrapper>
    </StyledHintAnchor>
  );
};

export const Os20FindContactsCommandButton = () => {
  const contextStoreNumberOfSelectedRecords = useAtomComponentStateValue(
    contextStoreNumberOfSelectedRecordsComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const availability = getFindContactsAvailability(
    contextStoreNumberOfSelectedRecords,
  );
  const { isSaving, startFindContacts, modalProps } = useFindContactsFlow(
    OS20_FIND_CONTACTS_MODAL_ID,
  );

  return (
    <>
      {availability === 'too-many' && <FindContactsTooManySelected />}
      {availability === 'available' && (
        <FindContactsForSelection
          isSaving={isSaving}
          onStart={startFindContacts}
        />
      )}
      <FindContactsModal
        modalInstanceId={modalProps.modalInstanceId}
        state={modalProps.state}
        companyNames={modalProps.companyNames}
        pendingCompanyIds={modalProps.pendingCompanyIds}
        onClose={modalProps.onClose}
      />
    </>
  );
};
