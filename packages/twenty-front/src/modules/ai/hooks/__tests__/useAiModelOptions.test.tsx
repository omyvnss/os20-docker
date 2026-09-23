import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import {
  AUTO_SELECT_FAST_MODEL_ID,
  AUTO_SELECT_SMART_MODEL_ID,
} from 'twenty-shared/constants';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { useAiModelOptions } from '@/ai/hooks/useAiModelOptions';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { aiModelsState } from '@/client-config/states/aiModelsState';
import { shouldOpenAiChatAfterOnboardingState } from '@/onboarding/states/shouldOpenAiChatAfterOnboardingState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

const AI_MODELS = [
  {
    modelId: AUTO_SELECT_SMART_MODEL_ID,
    label: 'GPT-5.2',
    providerName: 'openai',
    isAvailable: true,
  },
  {
    modelId: AUTO_SELECT_FAST_MODEL_ID,
    label: 'GPT-5.6 Luna',
    providerName: 'openai',
    isAvailable: true,
  },
  {
    modelId: 'openai/gpt-5.2',
    label: 'GPT-5.2',
    providerName: 'openai',
    isAvailable: true,
  },
  {
    modelId: 'anthropic/claude-opus',
    label: 'Claude Opus',
    providerName: 'anthropic',
    isAvailable: false,
  },
];

const getWrapper =
  (pathname: string) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>
      <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
    </MemoryRouter>
  );

const renderHooks = (
  pathname: string,
  {
    variant = 'pinned-default',
    smartModel = AUTO_SELECT_SMART_MODEL_ID,
  }: { variant?: 'all' | 'pinned-default'; smartModel?: string } = {},
) => {
  const { result } = renderHook(
    () => {
      const setCurrentWorkspace = useSetAtomState(currentWorkspaceState);
      const setAiModels = useSetAtomState(aiModelsState);

      return {
        setCurrentWorkspace,
        setAiModels,
        ...useAiModelOptions({ variant }),
      };
    },
    { wrapper: getWrapper(pathname) },
  );

  act(() => {
    result.current.setCurrentWorkspace({
      fastModel: AUTO_SELECT_FAST_MODEL_ID,
      smartModel,
      useRecommendedModels: true,
    } as never);
    result.current.setAiModels(AI_MODELS as never);
  });

  return result;
};

describe('useAiModelOptions', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetJotaiStore();
  });

  it('should pin the workspace fast model during the onboarding chat', () => {
    jotaiStore.set(shouldOpenAiChatAfterOnboardingState.atom, true);

    const result = renderHooks(getAppPath(AppPath.AiChat, { threadId: null }));

    expect(result.current.pinnedOption?.label).toBe('OpenAI — GPT-5.6 Luna');
  });

  it('should pin the workspace smart model on a plain chat page', () => {
    const result = renderHooks(getAppPath(AppPath.AiChat, { threadId: null }));

    expect(result.current.pinnedOption?.label).toBe('OpenAI — GPT-5.2');
  });

  it('should pin the workspace smart model elsewhere', () => {
    const result = renderHooks('/objects/companies');

    expect(result.current.pinnedOption?.label).toBe('OpenAI — GPT-5.2');
  });

  it('should only list models whose provider has a usable key', () => {
    const result = renderHooks('/objects/companies', { variant: 'all' });

    expect(result.current.options.map((option) => option.value)).toEqual([
      'openai/gpt-5.2',
    ]);
  });

  it('should pin auto-select when the workspace smart model is unavailable', () => {
    const result = renderHooks('/objects/companies', {
      smartModel: 'anthropic/claude-opus',
    });

    expect(result.current.pinnedOption?.value).toBe('openai/gpt-5.2');
    expect(result.current.pinnedOption?.label).toBe('OpenAI — GPT-5.2');
  });
});
