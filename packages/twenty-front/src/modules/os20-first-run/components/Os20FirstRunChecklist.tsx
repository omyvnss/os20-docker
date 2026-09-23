import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { IconCheck, IconCircleDashed } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOs20FirstRunStatus } from '@/os20-first-run/hooks/useOs20FirstRunStatus';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { isSidePanelOpenedState } from '@/side-panel/states/isSidePanelOpenedState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledContainer = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSteps = styled.ol`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[6]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledStep = styled.li<{ isDone: boolean }>`
  align-items: center;
  color: ${({ isDone }) =>
    isDone
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  text-decoration: ${({ isDone }) => (isDone ? 'line-through' : 'none')};
`;

const StyledDoneIcon = styled.span`
  color: ${themeCssVariables.color.green};
  display: flex;
`;

export const Os20FirstRunChecklist = () => {
  const { t } = useLingui();
  const { status, refresh } = useOs20FirstRunStatus();
  const navigateSettings = useNavigateSettings();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const isSidePanelOpened = useAtomStateValue(isSidePanelOpenedState);

  useEffect(() => {
    if (!isSidePanelOpened) {
      refresh();
    }
  }, [isSidePanelOpened, refresh]);

  const steps = [
    {
      id: 'ai-key',
      label: t`Add an AI key`,
      actionLabel: t`Add key`,
      isDone: status.hasAiKey,
      onClick: () => navigateSettings(SettingsPath.AIProviders),
    },
    {
      id: 'search-key',
      label: t`Add a search key`,
      actionLabel: t`Add key`,
      isDone: status.hasSearchKey,
      onClick: () => navigateSettings(SettingsPath.WebSearchApis),
    },
    {
      id: 'lead-search',
      label: t`Run your first lead search`,
      actionLabel: t`Open Ask AI`,
      isDone: status.hasRunLeadSearch,
      onClick: () => openAskAiPage(),
    },
  ];

  if (!status.isLoaded || steps.every((step) => step.isDone)) {
    return null;
  }

  return (
    <StyledContainer data-testid="os20-first-run-checklist">
      <StyledTitle>{t`Get started with OS20`}</StyledTitle>
      <StyledSteps>
        {steps.map((step) => (
          <StyledStep key={step.id} isDone={step.isDone}>
            {step.isDone ? (
              <StyledDoneIcon>
                <IconCheck size={16} />
              </StyledDoneIcon>
            ) : (
              <IconCircleDashed size={16} />
            )}
            {step.label}
            {!step.isDone && (
              <Button
                size="small"
                variant="secondary"
                title={step.actionLabel}
                onClick={step.onClick}
              />
            )}
          </StyledStep>
        ))}
      </StyledSteps>
    </StyledContainer>
  );
};
