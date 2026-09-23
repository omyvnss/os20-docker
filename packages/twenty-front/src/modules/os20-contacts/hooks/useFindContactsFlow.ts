import { useCallback, useMemo, useState } from 'react';

import { useSaveCompanyContacts } from '@/os20-contacts/hooks/useSaveCompanyContacts';
import { type Os20ContactsCompanyRef } from '@/os20-contacts/types/Os20ContactsCompanyRef';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

export const useFindContactsFlow = (modalInstanceId: string) => {
  const { openModal, closeModal } = useModal();
  const { saveCompanyContacts, reset, ...state } = useSaveCompanyContacts();
  const [companies, setCompanies] = useState<Os20ContactsCompanyRef[]>([]);
  const isSaving = state.status === 'saving';

  const startFindContacts = useCallback(
    (companiesToSearch: Os20ContactsCompanyRef[]) => {
      openModal(modalInstanceId);

      if (isSaving) return;

      setCompanies(companiesToSearch);
      saveCompanyContacts(companiesToSearch.map((company) => company.id));
    },
    [isSaving, modalInstanceId, openModal, saveCompanyContacts],
  );

  // Closing during a run only hides the dialog; the run keeps going and the
  // dialog shows its progress again when reopened.
  const closeFindContacts = useCallback(() => {
    closeModal(modalInstanceId);

    if (!isSaving) reset();
  }, [closeModal, isSaving, modalInstanceId, reset]);

  const companyNames = useMemo(
    () =>
      Object.fromEntries(
        companies.map((company) => [company.id, company.name]),
      ) as Record<string, string>,
    [companies],
  );

  return {
    isSaving,
    startFindContacts,
    closeFindContacts,
    modalProps: {
      modalInstanceId,
      state,
      companyNames,
      pendingCompanyIds: companies.map((company) => company.id),
      onClose: closeFindContacts,
    },
  };
};
