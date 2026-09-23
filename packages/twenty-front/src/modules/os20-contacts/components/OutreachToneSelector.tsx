import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useId } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OS20_OUTREACH_TONE_MESSAGES } from '@/os20-contacts/constants/Os20OutreachToneMessages';
import { OS20_OUTREACH_TONES } from '@/os20-contacts/constants/Os20OutreachTones';
import { type Os20OutreachTone } from '@/os20-contacts/types/Os20OutreachTone';

const StyledFieldset = styled.fieldset`
  border: none;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin: 0;
  padding: 0;
`;

const StyledLegend = styled.legend`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-bottom: ${themeCssVariables.spacing[1]};
  padding: 0;
`;

const StyledOptions = styled.div`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: inline-flex;
  gap: ${themeCssVariables.spacing['0.5']};
  padding: ${themeCssVariables.spacing['0.5']};
  width: fit-content;
`;

const StyledInput = styled.input`
  height: 1px;
  margin: -1px;
  opacity: 0;
  overflow: hidden;
  position: absolute;
  width: 1px;
`;

const StyledOption = styled.label<{ isSelected: boolean; isDisabled: boolean }>`
  background-color: ${({ isSelected }) =>
    isSelected ? themeCssVariables.background.primary : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${({ isSelected }) =>
    isSelected ? themeCssVariables.boxShadow.light : 'none'};
  color: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
  transition: background-color 0.1s ease;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }

  &:focus-within {
    outline: 1px solid ${themeCssVariables.color.blue};
    outline-offset: 1px;
  }
`;

type OutreachToneSelectorProps = {
  value: Os20OutreachTone;
  onChange: (tone: Os20OutreachTone) => void;
  disabled?: boolean;
};

export const OutreachToneSelector = ({
  value,
  onChange,
  disabled = false,
}: OutreachToneSelectorProps) => {
  const { t, i18n } = useLingui();
  const groupName = `os20-outreach-tone-${useId()}`;

  return (
    <StyledFieldset disabled={disabled}>
      <StyledLegend>{t`Tone`}</StyledLegend>
      <StyledOptions>
        {OS20_OUTREACH_TONES.map((tone) => (
          <StyledOption
            key={tone}
            isSelected={tone === value}
            isDisabled={disabled}
          >
            <StyledInput
              type="radio"
              name={groupName}
              value={tone}
              checked={tone === value}
              onChange={() => onChange(tone)}
            />
            {i18n._(OS20_OUTREACH_TONE_MESSAGES[tone])}
          </StyledOption>
        ))}
      </StyledOptions>
    </StyledFieldset>
  );
};
