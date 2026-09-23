import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Checkbox } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { LeadsTableRow } from '@/os20-leads/components/LeadsTableRow';
import { LEADS_TABLE_GRID_COLUMNS } from '@/os20-leads/constants/LeadsTableGridColumns';
import { type Os20Lead } from '@/os20-leads/types/Os20Lead';
import { getLeadKey } from '@/os20-leads/utils/getLeadKey';
import { Table } from '@/ui/layout/table/components/Table';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';

const StyledScroll = styled.div`
  overflow-x: auto;
  width: 100%;
`;

const StyledInner = styled.div`
  min-width: 1080px;
`;

type LeadsTableProps = {
  leads: Os20Lead[];
  selectedKeys: Set<string>;
  approvedKeys: Set<string>;
  busyKeys: Set<string>;
  onToggleSelected: (key: string, value: boolean) => void;
  onToggleAll: (value: boolean) => void;
  onApprove: (lead: Os20Lead) => void;
  onReject: (lead: Os20Lead) => void;
};

export const LeadsTable = ({
  leads,
  selectedKeys,
  approvedKeys,
  busyKeys,
  onToggleSelected,
  onToggleAll,
  onApprove,
  onReject,
}: LeadsTableProps) => {
  const { t } = useLingui();
  const selectableCount = leads.filter(
    (lead) => !approvedKeys.has(getLeadKey(lead)),
  ).length;
  const selectedCount = selectedKeys.size;
  const isAllSelected =
    selectableCount > 0 && selectedCount === selectableCount;

  return (
    <StyledScroll>
      <StyledInner>
        <Table>
          <TableRow gridTemplateColumns={LEADS_TABLE_GRID_COLUMNS}>
            <TableHeader padding={`0 ${themeCssVariables.spacing[2]}`}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={selectedCount > 0 && !isAllSelected}
                disabled={selectableCount === 0}
                onCheckedChange={onToggleAll}
                aria-label={t`Select all leads`}
              />
            </TableHeader>
            <TableHeader>{t`Company`}</TableHeader>
            <TableHeader>{t`Website`}</TableHeader>
            <TableHeader>{t`Score`}</TableHeader>
            <TableHeader>{t`Why it fits`}</TableHeader>
            <TableHeader>{t`Source`}</TableHeader>
            <TableHeader>{t`Phone`}</TableHeader>
            <TableHeader>{t`Email`}</TableHeader>
            <TableHeader align="right" />
          </TableRow>
          {leads.map((lead) => {
            const key = getLeadKey(lead);

            return (
              <LeadsTableRow
                key={key}
                lead={lead}
                isSelected={selectedKeys.has(key)}
                isApproved={approvedKeys.has(key)}
                isBusy={busyKeys.has(key)}
                onToggleSelected={(value) => onToggleSelected(key, value)}
                onApprove={() => onApprove(lead)}
                onReject={() => onReject(lead)}
              />
            );
          })}
        </Table>
      </StyledInner>
    </StyledScroll>
  );
};
