import { styled } from '@linaria/react';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Status } from 'twenty-ui/data-display';
import { IconExternalLink, IconTrash } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type LeadSourceProvider } from '@/os20-lead-sources/constants/LeadSourceProviders';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { type WebSearchTestResult } from '~/pages/os20-setup/utils/testWebSearchKey';

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledHeader = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledDescription = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledKeyLink = styled.a`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledMaskedKey = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.code.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledInputContainer = styled.div`
  flex: 1;
  min-width: 200px;
`;

const StyledError = styled.span`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTestResult = styled.span<{ isOk: boolean }>`
  color: ${({ isOk }) =>
    isOk ? themeCssVariables.color.green : themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

type LeadSourceProviderCardProps = {
  provider: LeadSourceProvider;
  maskedKey?: string;
  isSaving: boolean;
  hasError: boolean;
  onSave: (key: string) => Promise<boolean>;
  onDelete: () => void;
  onTest?: () => Promise<WebSearchTestResult>;
};

export const LeadSourceProviderCard = ({
  provider,
  maskedKey,
  isSaving,
  hasError,
  onSave,
  onDelete,
  onTest,
}: LeadSourceProviderCardProps) => {
  const { t } = useLingui();
  const [key, setKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebSearchTestResult | null>(
    null,
  );
  const isConnected = maskedKey !== undefined;

  const handleTest = async () => {
    if (!onTest) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await onTest());
    } finally {
      setIsTesting(false);
    }
  };

  const testResultCount = testResult?.resultCount ?? 0;

  const handleSave = async () => {
    if (!key.trim()) return;

    if (await onSave(key.trim())) {
      setKey('');
      setTestResult(null);
    }
  };

  return (
    <StyledCard>
      <StyledHeader>
        <div>
          <StyledTitle>{provider.label}</StyledTitle>
          <StyledDescription>{t(provider.description)}</StyledDescription>
          <StyledKeyLink
            href={provider.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t`Get a key`}
            <IconExternalLink size={12} />
          </StyledKeyLink>
        </div>
        <Status
          color={isConnected ? 'green' : 'gray'}
          text={isConnected ? t`Connected` : t`Not set`}
        />
      </StyledHeader>

      {isConnected && <StyledMaskedKey>{maskedKey}</StyledMaskedKey>}

      <StyledRow>
        <StyledInputContainer>
          <SettingsTextInput
            instanceId={`lead-source-key-input-${provider.id}`}
            type="password"
            autoComplete="off"
            placeholder={
              isConnected
                ? t`Paste a new key to replace it`
                : t`Paste your API key`
            }
            value={key}
            onChange={setKey}
            onInputEnter={handleSave}
            fullWidth
          />
        </StyledInputContainer>
        <Button
          onClick={handleSave}
          disabled={isSaving || !key.trim()}
          title={
            isSaving ? t`Saving…` : isConnected ? t`Replace key` : t`Save key`
          }
        />
        {isConnected && onTest && (
          <Button
            onClick={handleTest}
            disabled={isSaving || isTesting}
            variant="secondary"
            title={isTesting ? t`Testing…` : t`Test`}
          />
        )}
        {isConnected && (
          <Button
            onClick={onDelete}
            disabled={isSaving}
            variant="secondary"
            accent="danger"
            title={t`Delete`}
            Icon={IconTrash}
          />
        )}
      </StyledRow>

      {testResult && (
        <StyledTestResult role="status" isOk={testResult.ok}>
          {testResult.ok
            ? plural(testResultCount, {
                one: 'Key works. # result returned.',
                other: 'Key works. # results returned.',
              })
            : (testResult.error ?? t`Test failed.`)}
        </StyledTestResult>
      )}

      {hasError && (
        <StyledError role="alert">{t`Something went wrong. Try again.`}</StyledError>
      )}
    </StyledCard>
  );
};
