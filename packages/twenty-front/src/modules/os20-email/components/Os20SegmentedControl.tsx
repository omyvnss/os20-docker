import { styled } from '@linaria/react';
import { useId } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFieldset = styled.fieldset`
  border: none;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin: 0;
  min-width: 0;
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
  flex-wrap: wrap;
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

type Os20SegmentedControlProps<Value extends string> = {
  label: string;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
};

export const Os20SegmentedControl = <Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: Os20SegmentedControlProps<Value>) => {
  const groupName = `os20-segmented-${useId()}`;

  return (
    <StyledFieldset disabled={disabled}>
      <StyledLegend>{label}</StyledLegend>
      <StyledOptions>
        {options.map((option) => (
          <StyledOption
            key={option.value}
            isSelected={option.value === value}
            isDisabled={disabled}
          >
            <StyledInput
              type="radio"
              name={groupName}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </StyledOption>
        ))}
      </StyledOptions>
    </StyledFieldset>
  );
};
