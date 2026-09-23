import { type AgentChatMessageUIToolCallPart } from '@/ai/types/AgentChatMessageUIToolCallPart';
import { type UIDataTypes, type UIMessagePart, type UITools } from 'ai';

// Tools that save records: once they succeed, the matching list view is opened
// so the user watches the new records instead of reading them in the chat.
export const RECORD_SAVING_TOOL_OBJECTS: Record<string, string> = {
  find_leads: 'company',
  save_contacts: 'person',
};

type ExecuteToolPart = {
  type: string;
  toolCallId: string;
  state: string;
  input?: { toolName?: string };
  output?: {
    success?: boolean;
    message?: string;
    recordReferences?: unknown[];
  };
};

// Preloaded tools arrive as `tool-<name>`; others go through `execute_tool`.
const getToolName = (part: UIMessagePart<UIDataTypes, UITools>) => {
  if (part.type !== 'tool-execute_tool') {
    return part.type.startsWith('tool-') ? part.type.slice(5) : undefined;
  }

  const input = (part as ExecuteToolPart).input;

  return typeof input === 'object' && input !== null
    ? input.toolName
    : undefined;
};

export const isUIToolCallPart = (
  part: UIMessagePart<UIDataTypes, UITools>,
): boolean => {
  const toolName = getToolName(part);

  return (
    toolName === 'navigate_app' ||
    (toolName !== undefined && toolName in RECORD_SAVING_TOOL_OBJECTS)
  );
};

export const extractUIToolCallParts = (
  messageParts: UIMessagePart<UIDataTypes, UITools>[],
): AgentChatMessageUIToolCallPart[] =>
  messageParts.filter(isUIToolCallPart).flatMap((part) => {
    const toolName = getToolName(part) as string;

    if (toolName === 'navigate_app') {
      return [part as unknown as AgentChatMessageUIToolCallPart];
    }

    const { output, toolCallId, state } = part as ExecuteToolPart;

    if (!output || (output.recordReferences?.length ?? 0) === 0) {
      return [];
    }

    return [
      {
        type: 'tool-execute_tool',
        toolCallId,
        state,
        output: {
          success: output.success === true,
          message: output.message ?? '',
          result: {
            action: 'navigateToObject',
            objectNameSingular: RECORD_SAVING_TOOL_OBJECTS[toolName],
          },
        },
      } as AgentChatMessageUIToolCallPart,
    ];
  });
