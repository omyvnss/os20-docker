import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { getLogoUrlFromDomainName } from 'twenty-shared/utils';
import { Avatar, Tag } from 'twenty-ui/data-display';
import { IconCheck, IconX } from 'twenty-ui/icon';
import { Checkbox, LightIconButton } from 'twenty-ui/input';
import { OverflowingTextWithTooltip } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { LEADS_TABLE_GRID_COLUMNS } from '@/os20-leads/constants/LeadsTableGridColumns';
import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadDomain } from '@/os20-leads/utils/getLeadDomain';
import { getLeadEmail } from '@/os20-leads/utils/getLeadEmail';
import { getLeadScoreColor } from '@/os20-leads/utils/getLeadScoreColor';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableRow } from '@/ui/layout/table/components/TableRow';

const StyledName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledLink = styled.a`
  color: ${themeCssVariables.font.color.secondary};
  min-width: 0;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const StyledMuted = styled.span`
  color: ${themeCssVariables.font.color.light};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: flex-end;
  width: 100%;
`;

type LeadsTableRowProps = {
  lead: Os20Lead;
  isSelected: boolean;
  isApproved: boolean;
  isBusy: boolean;
  onToggleSelected: (value: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
};

export const LeadsTableRow = ({
  lead,
  isSelected,
  isApproved,
  isBusy,
  onToggleSelected,
  onApprove,
  onReject,
}: LeadsTableRowProps) => {
  const { t } = useLingui();
  const companyName = lead.company;
  const domain = getLeadDomain(lead);
  const email = getLeadEmail(lead);
  const empty = <StyledMuted>{'-'}</StyledMuted>;

  return (
    <TableRow
      gridTemplateColumns={LEADS_TABLE_GRID_COLUMNS}
      isSelected={isSelected}
    >
      <TableCell padding={`0 ${themeCssVariables.spacing[2]}`}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelected}
          disabled={isApproved}
          aria-label={t`Select ${companyName}`}
        />
      </TableCell>
      <TableCell gap={themeCssVariables.spacing[2]} overflow="hidden">
        <Avatar
          avatarUrl={domain ? getLogoUrlFromDomainName(domain) : undefined}
          placeholder={lead.company}
          placeholderColorSeed={lead.company}
          type="squared"
          size="md"
        />
        <StyledName title={lead.company}>{lead.company}</StyledName>
      </TableCell>
      <TableCell overflow="hidden">
        {domain ? (
          <StyledLink
            href={lead.companyUrl || `https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {domain}
          </StyledLink>
        ) : (
          empty
        )}
      </TableCell>
      <TableCell>
        <Tag
          color={getLeadScoreColor(lead.score ?? 0)}
          text={String(Math.round(lead.score ?? 0))}
          weight="medium"
          preventShrink
        />
      </TableCell>
      <TableCell overflow="hidden">
        {lead.reason ? (
          <OverflowingTextWithTooltip text={lead.reason} isTooltipMultiline />
        ) : (
          empty
        )}
      </TableCell>
      <TableCell>
        <Tag
          color="gray"
          variant="outline"
          text={lead.source === 'google_places' ? t`Places` : t`Web`}
          preventShrink
        />
      </TableCell>
      <TableCell overflow="hidden">
        {lead.phone ? (
          <StyledLink href={`tel:${lead.phone}`}>{lead.phone}</StyledLink>
        ) : (
          empty
        )}
      </TableCell>
      <TableCell overflow="hidden">
        {email ? (
          <StyledLink href={`mailto:${email}`}>{email}</StyledLink>
        ) : (
          empty
        )}
      </TableCell>
      <TableCell align="right">
        {isApproved ? (
          <Tag color="green" text={t`Added`} Icon={IconCheck} preventShrink />
        ) : (
          <StyledActions>
            <LightIconButton
              Icon={IconCheck}
              accent="secondary"
              title={t`Approve`}
              aria-label={t`Approve ${companyName}`}
              disabled={isBusy}
              onClick={onApprove}
            />
            <LightIconButton
              Icon={IconX}
              accent="tertiary"
              title={t`Reject`}
              aria-label={t`Reject ${companyName}`}
              disabled={isBusy}
              onClick={onReject}
            />
          </StyledActions>
        )}
      </TableCell>
    </TableRow>
  );
};
