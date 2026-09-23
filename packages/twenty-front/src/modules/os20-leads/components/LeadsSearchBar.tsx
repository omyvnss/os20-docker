import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { IconSearch } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { LEAD_SEARCH_DEFAULT_COUNT } from '@/os20-leads/constants/LeadSearchDefaultCount';
import { LEAD_SEARCH_MAX_COUNT } from '@/os20-leads/constants/LeadSearchMaxCount';
import { type FindLeadsInput } from '@/os20-leads/hooks/useLeadsApi';
import { clampLeadCount } from '@/os20-leads/utils/clampLeadCount';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledForm = styled.form`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledQuery = styled.div`
  flex: 2;
  min-width: 220px;
`;

const StyledLocation = styled.div`
  flex: 1;
  min-width: 160px;
`;

const StyledCount = styled.div`
  width: 72px;
`;

const StyledMissingKeys = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

type LeadsSearchBarProps = {
  isSearching: boolean;
  missingAiKey: boolean;
  missingSourceKey: boolean;
  onSearch: (input: FindLeadsInput) => void;
};

export const LeadsSearchBar = ({
  isSearching,
  missingAiKey,
  missingSourceKey,
  onSearch,
}: LeadsSearchBarProps) => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(String(LEAD_SEARCH_DEFAULT_COUNT));

  const isMissingKeys = missingAiKey || missingSourceKey;
  const isDisabled = isSearching || isMissingKeys || !query.trim();

  const handleSubmit = () => {
    if (isDisabled) return;

    const clampedCount = clampLeadCount(count);

    setCount(String(clampedCount));
    onSearch({ query, location, count: clampedCount });
  };

  return (
    <div>
      <StyledForm
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <StyledQuery>
          <SettingsTextInput
            instanceId="os20-leads-query"
            label={t`Industry or keywords`}
            placeholder={t`Dental clinics, B2B SaaS, roofing contractors`}
            value={query}
            onChange={setQuery}
            onInputEnter={handleSubmit}
            fullWidth
          />
        </StyledQuery>
        <StyledLocation>
          <SettingsTextInput
            instanceId="os20-leads-location"
            label={t`Location`}
            placeholder={t`Austin, TX`}
            value={location}
            onChange={setLocation}
            onInputEnter={handleSubmit}
            fullWidth
          />
        </StyledLocation>
        <StyledCount>
          <SettingsTextInput
            instanceId="os20-leads-count"
            label={t`Count`}
            type="number"
            min={1}
            max={LEAD_SEARCH_MAX_COUNT}
            value={count}
            onChange={setCount}
            onInputEnter={handleSubmit}
            fullWidth
          />
        </StyledCount>
        <Button
          type="submit"
          Icon={IconSearch}
          title={isSearching ? t`Finding…` : t`Find leads`}
          accent="blue"
          disabled={isDisabled}
        />
      </StyledForm>
      {isMissingKeys && (
        <StyledMissingKeys role="note">
          {missingAiKey && missingSourceKey
            ? t`Add an AI provider key and a lead source key to search.`
            : missingAiKey
              ? t`Add an AI provider key to search.`
              : t`Add a lead source key to search.`}
          {missingAiKey && (
            <Button
              size="small"
              variant="secondary"
              title={t`AI Providers`}
              onClick={() => navigateSettings(SettingsPath.AIProviders)}
            />
          )}
          {missingSourceKey && (
            <Button
              size="small"
              variant="secondary"
              title={t`Lead Sources`}
              onClick={() => navigateSettings(SettingsPath.WebSearchApis)}
            />
          )}
        </StyledMissingKeys>
      )}
    </div>
  );
};
