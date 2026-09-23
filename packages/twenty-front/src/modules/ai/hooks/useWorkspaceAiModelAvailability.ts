import { isAutoSelectModelId } from 'twenty-shared/utils';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { aiModelsState } from '@/client-config/states/aiModelsState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useWorkspaceAiModelAvailability = () => {
  const aiModels = useAtomStateValue(aiModelsState);

  // BYOK: expose non-deprecated models whose provider has a usable key (server
  // env key, a key saved in Settings > AI Providers, or a keyless local
  // provider). The workspace enabled/recommended settings do not gate the list.
  const enabledModels = aiModels.filter(
    (model) =>
      !isAutoSelectModelId(model.modelId) &&
      !model.isDeprecated &&
      model.isAvailable === true,
  );

  return {
    enabledModels,
    realModels: enabledModels,
    useRecommendedModels: false,
  };
};
