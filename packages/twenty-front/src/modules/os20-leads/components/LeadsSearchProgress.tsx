import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { IconCheck, IconCircleDashed } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ShimmeringText } from '@/ai/components/ShimmeringText';
import { LEAD_SEARCH_STEPS } from '@/os20-leads/constants/LeadSearchSteps';
import { getActiveLeadSearchStep } from '@/os20-leads/utils/getActiveLeadSearchStep';

const TICK_MS = 500;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledRow = styled.div<{ isDone: boolean }>`
  align-items: center;
  color: ${({ isDone }) =>
    isDone
      ? themeCssVariables.font.color.secondary
      : themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[2]};
  line-height: ${themeCssVariables.text.lineHeight.md};
  min-height: 24px;
`;

const StyledIconContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.light};
  display: flex;
`;

export const LeadsSearchProgress = () => {
  const { t } = useLingui();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      TICK_MS,
    );

    return () => clearInterval(interval);
  }, []);

  const activeIndex = getActiveLeadSearchStep(LEAD_SEARCH_STEPS, elapsedMs);

  return (
    <StyledContainer role="status" aria-live="polite">
      {LEAD_SEARCH_STEPS.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <StyledRow key={step.label.id} isDone={isDone}>
            <StyledIconContainer>
              {isDone ? (
                <IconCheck size={16} />
              ) : (
                <IconCircleDashed size={16} />
              )}
            </StyledIconContainer>
            {isActive ? (
              <ShimmeringText>{t(step.label)}</ShimmeringText>
            ) : (
              <span>{t(step.label)}</span>
            )}
          </StyledRow>
        );
      })}
    </StyledContainer>
  );
};
