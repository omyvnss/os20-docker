import { useEffect, useState } from 'react';

import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { IconCheck } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
import { useAuthenticatedFetch } from '@/auth/hooks/useAuthenticatedFetch';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { Select } from '@/ui/input/components/Select';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  KEYED_AI_PROVIDERS,
  type KeyedAiProviderId,
} from '~/pages/os20-setup/constants/AiProviders';
import { OS20_SETUP_EXAMPLE_PROMPT } from '~/pages/os20-setup/constants/Os20Setup';
import {
  SEARCH_PROVIDERS,
  type SearchProviderId,
} from '~/pages/os20-setup/constants/SearchProviders';
import { dismissOs20Setup } from '~/pages/os20-setup/utils/os20SetupDismissal';
import { testAiProviderKey } from '~/pages/os20-setup/utils/testAiProviderKey';
import { testWebSearchKey } from '~/pages/os20-setup/utils/testWebSearchKey';

type Step = 'ai' | 'search' | 'done';

type Status = { kind: 'busy' | 'ok' | 'error'; text: string } | null;

const StyledStep = styled.div<{ isActive: boolean }>`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  margin-bottom: ${themeCssVariables.spacing[4]};
  opacity: ${({ isActive }) => (isActive ? 1 : 0.6)};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledStepHeader = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledStatus = styled.span<{ kind: 'busy' | 'ok' | 'error' }>`
  color: ${({ kind }) =>
    kind === 'ok'
      ? themeCssVariables.color.green
      : kind === 'error'
        ? themeCssVariables.font.color.danger
        : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledPrompt = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[3]};
`;

const StepStatus = ({ status }: { status: Status }) =>
  status ? (
    <StyledStatus kind={status.kind} role="status">
      {status.text}
    </StyledStatus>
  ) : null;

export const Os20Setup = () => {
  const navigate = useNavigate();
  const authFetch = useAuthenticatedFetch();
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();

  const [isChecking, setIsChecking] = useState(true);
  const [step, setStep] = useState<Step>('ai');

  const [aiProvider, setAiProvider] = useState<KeyedAiProviderId>('openrouter');
  const [aiKey, setAiKey] = useState('');
  const [aiStatus, setAiStatus] = useState<Status>(null);

  const [searchProvider, setSearchProvider] =
    useState<SearchProviderId>('tavily');
  const [searchKey, setSearchKey] = useState('');
  const [searchStatus, setSearchStatus] = useState<Status>(null);

  // Users who already have an AI key never see this screen.
  useEffect(() => {
    const checkExistingKeys = async () => {
      try {
        const response = await authFetch(
          `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys`,
        );
        const keys: { hasKey: boolean }[] = response.ok
          ? await response.json()
          : [];

        if (Array.isArray(keys) && keys.some((key) => key.hasKey)) {
          dismissOs20Setup();
          navigate(AppPath.Index, { replace: true });

          return;
        }
      } catch {
        // Show the setup; saving a key will surface any server problem.
      }

      setIsChecking(false);
    };

    checkExistingKeys();
  }, [authFetch, navigate]);

  const leaveSetup = () => {
    dismissOs20Setup();
    navigate(AppPath.Index);
  };

  const handleSaveAiKey = async () => {
    setAiStatus({ kind: 'busy', text: 'Saving…' });

    try {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/keys/${aiProvider}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: aiKey.trim() }),
        },
      );

      if (!response.ok) {
        setAiStatus({
          kind: 'error',
          text: `Couldn't save the key (${response.status}).`,
        });

        return;
      }
    } catch {
      setAiStatus({ kind: 'error', text: "Can't reach the OS20 server." });

      return;
    }

    setAiKey('');
    setAiStatus({ kind: 'busy', text: 'Saved. Testing…' });

    const error = await testAiProviderKey(authFetch, aiProvider);

    if (error) {
      setAiStatus({ kind: 'error', text: `Key saved. ${error}` });

      return;
    }

    setAiStatus({ kind: 'ok', text: 'Connected.' });
    setStep('search');
  };

  const handleUseOllama = async () => {
    setAiStatus({ kind: 'busy', text: 'Looking for Ollama…' });

    try {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/ai-provider/providers`,
      );
      const providers: { id: string; available: boolean }[] = response.ok
        ? await response.json()
        : [];
      const isOllamaRunning =
        Array.isArray(providers) &&
        providers.some(
          (provider) => provider.id === 'ollama' && provider.available,
        );

      if (!isOllamaRunning) {
        setAiStatus({
          kind: 'error',
          text: "Ollama isn't reachable on this machine (port 11434). Start Ollama and try again.",
        });

        return;
      }
    } catch {
      setAiStatus({ kind: 'error', text: "Can't reach the OS20 server." });

      return;
    }

    setAiStatus({ kind: 'ok', text: 'Using local Ollama.' });
    setStep('search');
  };

  const handleSaveSearchKey = async () => {
    setSearchStatus({ kind: 'busy', text: 'Saving…' });

    try {
      const response = await authFetch(
        `${REACT_APP_SERVER_BASE_URL}/web-search-apis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: searchProvider,
            apiKey: searchKey.trim(),
          }),
        },
      );

      if (!response.ok) {
        setSearchStatus({
          kind: 'error',
          text: `Couldn't save the key (${response.status}).`,
        });

        return;
      }
    } catch {
      setSearchStatus({ kind: 'error', text: "Can't reach the OS20 server." });

      return;
    }

    setSearchKey('');
    setSearchStatus({ kind: 'busy', text: 'Saved. Testing…' });

    const result = await testWebSearchKey(authFetch);

    if (!result.ok) {
      setSearchStatus({
        kind: 'error',
        text: `Key saved. ${result.error ?? 'Test failed.'}`,
      });

      return;
    }

    setSearchStatus({ kind: 'ok', text: 'Search works.' });
    setStep('done');
  };

  const handleStart = () => {
    dismissOs20Setup();
    navigate(AppPath.Index);
    // The Ask AI side panel stays open across navigation.
    openAskAiPageWithPreprompt({ text: OS20_SETUP_EXAMPLE_PROMPT });
  };

  if (isChecking) {
    return null;
  }

  return (
    <SettingsPageLayout
      title="Set up OS20"
      links={[{ children: 'Setup' }]}
      actionButton={
        <Button
          title="Skip setup"
          variant="secondary"
          size="small"
          onClick={leaveSetup}
        />
      }
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title="Get ready to find leads"
            description="Add an AI provider, optionally a web search key, then ask the AI. You can change these later in Settings."
          />

          <StyledStep isActive={step === 'ai'}>
            <StyledStepHeader>
              {step !== 'ai' && <IconCheck size={16} />}
              1. AI provider
            </StyledStepHeader>
            {step === 'ai' && (
              <>
                <Select
                  dropdownId="os20-setup-ai-provider"
                  value={aiProvider}
                  onChange={(value) => {
                    setAiProvider(value);
                    setAiStatus(null);
                  }}
                  options={KEYED_AI_PROVIDERS}
                  fullWidth
                />
                <SettingsTextInput
                  instanceId="os20-setup-ai-key"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste your API key"
                  value={aiKey}
                  onChange={setAiKey}
                  onInputEnter={handleSaveAiKey}
                  fullWidth
                />
                <StyledActions>
                  <Button
                    title="Save and test"
                    variant="primary"
                    accent="blue"
                    disabled={!aiKey.trim() || aiStatus?.kind === 'busy'}
                    onClick={handleSaveAiKey}
                  />
                  <Button
                    title="Use local Ollama"
                    variant="secondary"
                    disabled={aiStatus?.kind === 'busy'}
                    onClick={handleUseOllama}
                  />
                </StyledActions>
              </>
            )}
            <StepStatus status={aiStatus} />
          </StyledStep>

          <StyledStep isActive={step === 'search'}>
            <StyledStepHeader>
              {step === 'done' && <IconCheck size={16} />}
              2. Web search (optional)
            </StyledStepHeader>
            {step === 'search' && (
              <>
                <StyledHint>
                  Lets the AI look up companies on the web.
                </StyledHint>
                <Select
                  dropdownId="os20-setup-search-provider"
                  value={searchProvider}
                  onChange={(value) => {
                    setSearchProvider(value);
                    setSearchStatus(null);
                  }}
                  options={SEARCH_PROVIDERS}
                  fullWidth
                />
                <SettingsTextInput
                  instanceId="os20-setup-search-key"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste your API key"
                  value={searchKey}
                  onChange={setSearchKey}
                  onInputEnter={handleSaveSearchKey}
                  fullWidth
                />
                <StyledActions>
                  <Button
                    title="Save and test"
                    variant="primary"
                    accent="blue"
                    disabled={
                      !searchKey.trim() || searchStatus?.kind === 'busy'
                    }
                    onClick={handleSaveSearchKey}
                  />
                  <Button
                    title="Skip"
                    variant="secondary"
                    disabled={searchStatus?.kind === 'busy'}
                    onClick={() => setStep('done')}
                  />
                </StyledActions>
                <StepStatus status={searchStatus} />
              </>
            )}
          </StyledStep>

          <StyledStep isActive={step === 'done'}>
            <StyledStepHeader>3. Find leads</StyledStepHeader>
            {step === 'done' && (
              <>
                <StyledHint>Ask AI will open with this prompt:</StyledHint>
                <StyledPrompt>{OS20_SETUP_EXAMPLE_PROMPT}</StyledPrompt>
                <StyledActions>
                  <Button
                    title="Start finding leads"
                    variant="primary"
                    accent="blue"
                    onClick={handleStart}
                  />
                </StyledActions>
              </>
            )}
          </StyledStep>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
