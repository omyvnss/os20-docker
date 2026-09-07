import { isAutoSelectModelId } from 'twenty-shared/utils';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { aiModelsState } from '@/client-config/states/aiModelsState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useWorkspaceAiModelAvailability = () => {
  const aiModels = useAtomStateValue(aiModelsState);

  // BYOK: expose all non-deprecated real models. Users add provider keys in
  // Settings → AI Providers and then pick any model; we do not gate the list
  // behind the workspace "enabled/recommended" settings.
  const enabledModels = aiModels.filter(
    (model) => !isAutoSelectModelId(model.modelId) && !model.isDeprecated,
  );

  return {
    enabledModels,
    realModels: enabledModels,
    useRecommendedModels: false,
  };
};
