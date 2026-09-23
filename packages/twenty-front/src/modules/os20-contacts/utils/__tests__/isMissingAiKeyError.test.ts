import { isMissingAiKeyError } from '@/os20-contacts/utils/isMissingAiKeyError';

describe('isMissingAiKeyError', () => {
  it('flags 400 responses about AI keys or providers', () => {
    expect(isMissingAiKeyError(400, 'No AI key configured')).toBe(true);
    expect(isMissingAiKeyError(400, 'Add an API key first')).toBe(true);
    expect(isMissingAiKeyError(400, 'No AI provider is set up')).toBe(true);
    expect(isMissingAiKeyError(400, undefined)).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isMissingAiKeyError(400, 'personId must be a UUID')).toBe(false);
    expect(isMissingAiKeyError(500, 'No AI key configured')).toBe(false);
  });
});
