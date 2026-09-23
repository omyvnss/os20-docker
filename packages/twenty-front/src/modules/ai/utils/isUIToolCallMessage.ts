import { isUIToolCallPart } from '@/ai/utils/extractUIToolCallParts';
import { type ExtendedUIMessage } from 'twenty-shared/ai';

export const isUIToolCallMessage = (message: ExtendedUIMessage) =>
  message.parts.some(isUIToolCallPart);
