import { t } from '@lingui/core/macro';
import { isAutoSelectModelId } from 'twenty-shared/utils';
import { type SelectOption } from 'twenty-ui/input';

import { useIsWorkspaceSetupChat } from '@/ai/hooks/useIsWorkspaceSetupChat';
import { useWorkspaceAiModelAvailability } from '@/ai/hooks/useWorkspaceAiModelAvailability';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { aiModelsState } from '@/client-config/states/aiModelsState';
import { getModelIcon } from '@/settings/ai/utils/getModelIcon';
import { getProviderDisplayName } from '@/settings/ai/utils/getProviderDisplayName';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type UseAiModelOptionsVariant = 'all' | 'pinned-default';

type UseAiModelOptionsOptions = {
  variant?: UseAiModelOptionsVariant;
};

export const useAiModelOptions = ({
  variant = 'all',
}: UseAiModelOptionsOptions = {}): {
  options: SelectOption<string>[];
  pinnedOption?: SelectOption<string>;
} => {
  const aiModels = useAtomStateValue(aiModelsState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { enabledModels } = useWorkspaceAiModelAvailability();
  const isWorkspaceSetupChat = useIsWorkspaceSetupChat();

  const workspaceDefaultModelId = isWorkspaceSetupChat
    ? currentWorkspace?.fastModel
    : currentWorkspace?.smartModel;

  const workspaceDefaultModel = aiModels.find(
    (model) => model.modelId === workspaceDefaultModelId,
  );

  const resolvedDefaultModelId = enabledModels.find(
    (model) =>
      model.label === workspaceDefaultModel?.label &&
      model.providerName === workspaceDefaultModel?.providerName,
  )?.modelId;

  const allOptions = enabledModels
    .map((model) => {
      const providerName = getProviderDisplayName(model.providerName);

      return {
        value: model.modelId,
        label: providerName ? `${providerName} — ${model.label}` : model.label,
        Icon: getModelIcon(model.modelFamily, model.providerName),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const pinnedOption = workspaceDefaultModel
    ? {
        value: resolvedDefaultModelId ?? workspaceDefaultModel.modelId,
        label: (() => {
          const providerName = getProviderDisplayName(
            workspaceDefaultModel.providerName,
          );

          return providerName
            ? `${providerName} — ${workspaceDefaultModel.label}`
            : workspaceDefaultModel.label;
        })(),
        Icon: getModelIcon(
          workspaceDefaultModel.modelFamily,
          workspaceDefaultModel.providerName,
        ),
        contextualText: t`default`,
      }
    : undefined;

  const options =
    variant === 'pinned-default' && resolvedDefaultModelId
      ? allOptions.filter((model) => model.value !== resolvedDefaultModelId)
      : allOptions;

  return {
    options,
    pinnedOption: variant === 'pinned-default' ? pinnedOption : undefined,
  };
};

export const useAiModelLabel = (
  modelId: string | undefined,
  includeProvider = true,
): string => {
  const aiModels = useAtomStateValue(aiModelsState);

  if (!modelId) {
    return '';
  }

  const model = aiModels.find((m) => m.modelId === modelId);

  if (!model) {
    return modelId;
  }

  if (isAutoSelectModelId(model.modelId) || !includeProvider) {
    return model.label;
  }

  const providerName = getProviderDisplayName(model.providerName);

  if (providerName) {
    return `${providerName} — ${model.label}`;
  }

  return model.label;
};
