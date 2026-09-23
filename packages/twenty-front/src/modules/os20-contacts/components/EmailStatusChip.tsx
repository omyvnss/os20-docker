import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useId, useState } from 'react';
import { Tag } from 'twenty-ui/data-display';
import { AppTooltip, TooltipDelay, TooltipPosition } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OS20_EMAIL_STATUS_COLORS } from '@/os20-contacts/constants/Os20EmailStatusColors';
import { OS20_EMAIL_STATUS_MESSAGES } from '@/os20-contacts/constants/Os20EmailStatusMessages';
import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';

const StyledAnchor = styled.span`
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: default;
  display: inline-flex;
  flex-shrink: 0;
  outline: none;

  &:focus-visible {
    box-shadow: 0 0 0 1px ${themeCssVariables.color.blue};
  }
`;

const StyledTooltipWrapper = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
`;

type EmailStatusChipProps = {
  status: Os20EmailStatus;
};

export const EmailStatusChip = ({ status }: EmailStatusChipProps) => {
  const { i18n } = useLingui();
  const anchorId = `os20-email-status-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const label = i18n._(OS20_EMAIL_STATUS_MESSAGES[status].label);
  const description = i18n._(OS20_EMAIL_STATUS_MESSAGES[status].description);

  const openTooltip = () => setIsTooltipOpen(true);
  const closeTooltip = () => setIsTooltipOpen(false);

  return (
    <>
      <StyledAnchor
        id={anchorId}
        tabIndex={0}
        role="img"
        aria-label={`${label}. ${description}`}
        data-email-status={status}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
      >
        <Tag
          color={OS20_EMAIL_STATUS_COLORS[status]}
          text={label}
          weight="medium"
          preventShrink
        />
      </StyledAnchor>
      <StyledTooltipWrapper>
        <AppTooltip
          anchorSelect={`#${anchorId}`}
          content={description}
          delay={TooltipDelay.shortDelay}
          place={TooltipPosition.Top}
          isOpen={isTooltipOpen}
          noArrow
        />
      </StyledTooltipWrapper>
    </>
  );
};
