import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { IconSparkles } from 'twenty-ui/icon';

import { CommandMenuButton } from '@/command-menu/components/CommandMenuButton';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { WriteOutreachModal } from '@/os20-contacts/components/WriteOutreachModal';
import { OS20_WRITE_OUTREACH_MODAL_ID } from '@/os20-contacts/constants/Os20WriteOutreachModalId';
import { getPersonOutreachDetails } from '@/os20-contacts/utils/getPersonOutreachDetails';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

type Os20WriteOutreachCommandButtonProps = {
  personId: string;
};

export const Os20WriteOutreachCommandButton = ({
  personId,
}: Os20WriteOutreachCommandButtonProps) => {
  const { t } = useLingui();
  const { openModal, closeModal } = useModal();
  const [openCount, setOpenCount] = useState(0);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.Person,
  });
  const hasEmailStatusField = objectMetadataItem.fields.some(
    (field) => field.name === 'emailStatus' && field.isActive !== false,
  );

  const { record } = useFindOneRecord({
    objectNameSingular: CoreObjectNameSingular.Person,
    objectRecordId: personId,
    recordGqlFields: {
      id: true,
      name: true,
      emails: true,
      ...(hasEmailStatusField ? { emailStatus: true } : {}),
    },
    skip: openCount === 0,
  });

  const { personName, primaryEmail, emailStatus } =
    getPersonOutreachDetails(record);

  const handleOpen = () => {
    setOpenCount((count) => count + 1);
    openModal(OS20_WRITE_OUTREACH_MODAL_ID);
  };

  const handleClose = () => closeModal(OS20_WRITE_OUTREACH_MODAL_ID);

  return (
    <>
      <CommandMenuButton
        command={{
          key: 'os20-write-outreach',
          label: t`Write an outreach email with AI`,
          shortLabel: t`Write outreach`,
          Icon: IconSparkles,
        }}
        onClick={handleOpen}
      />
      {openCount > 0 && (
        <WriteOutreachModal
          key={personId}
          modalInstanceId={OS20_WRITE_OUTREACH_MODAL_ID}
          personId={personId}
          personName={personName ?? t`this person`}
          primaryEmail={primaryEmail}
          emailStatus={emailStatus}
          onClose={handleClose}
        />
      )}
    </>
  );
};
