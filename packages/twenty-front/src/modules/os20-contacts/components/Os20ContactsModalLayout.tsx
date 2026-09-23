import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode } from 'react';
import { IconX } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { ModalFooter, ModalHeader } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ModalStatefulWrapper } from '@/ui/layout/modal/components/ModalStatefulWrapper';

const StyledHeading = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-height: 60vh;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[5]};
`;

const StyledFooterStart = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
`;

type Os20ContactsModalLayoutProps = {
  modalInstanceId: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  footerStart?: ReactNode;
  onClose: () => void;
};

export const Os20ContactsModalLayout = ({
  modalInstanceId,
  title,
  subtitle,
  children,
  footer,
  footerStart,
  onClose,
}: Os20ContactsModalLayoutProps) => {
  const { t } = useLingui();

  return (
    <ModalStatefulWrapper
      modalInstanceId={modalInstanceId}
      size="medium"
      padding="none"
      isClosable
      onClose={onClose}
      renderInDocumentBody
      autoHeight
    >
      <ModalHeader hasBorderBottom autoHeight>
        <StyledHeading>
          <StyledTitle>{title}</StyledTitle>
          {subtitle && <StyledSubtitle>{subtitle}</StyledSubtitle>}
        </StyledHeading>
        <IconButton
          Icon={IconX}
          size="small"
          variant="tertiary"
          onClick={onClose}
          ariaLabel={t`Close`}
        />
      </ModalHeader>
      <StyledBody>{children}</StyledBody>
      <ModalFooter autoHeight>
        <StyledFooterStart>{footerStart}</StyledFooterStart>
        {footer}
      </ModalFooter>
    </ModalStatefulWrapper>
  );
};
