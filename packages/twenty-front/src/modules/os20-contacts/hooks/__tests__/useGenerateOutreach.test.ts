import { i18n } from '@lingui/core';
import { act, renderHook } from '@testing-library/react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { useGenerateOutreach } from '@/os20-contacts/hooks/useGenerateOutreach';
import { messages } from '~/locales/generated/en';

i18n.load({ [SOURCE_LOCALE]: messages });
i18n.activate(SOURCE_LOCALE);

const mockAuthFetch = jest.fn();

jest.mock('@/auth/hooks/useAuthenticatedFetch', () => ({
  useAuthenticatedFetch: () => mockAuthFetch,
}));

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('useGenerateOutreach', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  it('posts the person and tone and returns the draft', async () => {
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse(200, { subject: 'Hello', body: 'Hi Jane' }),
    );

    const { result } = renderHook(() => useGenerateOutreach());
    let draft: unknown;

    await act(async () => {
      draft = await result.current.generateOutreach({
        personId: 'p1',
        tone: 'formal',
      });
    });

    expect(draft).toEqual({ subject: 'Hello', body: 'Hi Jane' });
    expect(mockAuthFetch.mock.calls[0][0]).toMatch(
      /\/lead-generation\/outreach$/,
    );
    expect(JSON.parse(mockAuthFetch.mock.calls[0][1].body)).toEqual({
      personId: 'p1',
      tone: 'formal',
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it('flags a missing AI key', async () => {
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse(400, { message: 'No AI key configured for this workspace' }),
    );

    const { result } = renderHook(() => useGenerateOutreach());

    await act(async () => {
      await result.current.generateOutreach({ personId: 'p1' });
    });

    expect(JSON.parse(mockAuthFetch.mock.calls[0][1].body)).toEqual({
      personId: 'p1',
    });
    expect(result.current.error).toEqual({
      message: 'No AI key configured for this workspace',
      isMissingAiKey: true,
    });
  });

  it('reports other failures without the AI key flag', async () => {
    mockAuthFetch.mockResolvedValueOnce(jsonResponse(500, null));

    const { result } = renderHook(() => useGenerateOutreach());

    await act(async () => {
      await result.current.generateOutreach({ personId: 'p1' });
    });

    expect(result.current.error?.isMissingAiKey).toBe(false);
    expect(result.current.error?.message).toContain('500');
  });
});
