import { i18n } from '@lingui/core';
import { act, renderHook } from '@testing-library/react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { useSaveCompanyContacts } from '@/os20-contacts/hooks/useSaveCompanyContacts';
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

const companyResult = (companyId: string, created: number) => ({
  success: true,
  results: [
    {
      companyId,
      companyName: companyId.toUpperCase(),
      created,
      skipped: 0,
      people: [
        {
          id: `${companyId}-p`,
          name: 'Jane Doe',
          jobTitle: 'CEO',
          email: `jane@${companyId}.com`,
          emailStatus: 'FOUND',
          saved: true,
        },
      ],
    },
  ],
});

describe('useSaveCompanyContacts', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  it('saves one company per request and tracks progress', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(jsonResponse(200, companyResult('a', 1)))
      .mockResolvedValueOnce(jsonResponse(200, companyResult('b', 2)));

    const { result } = renderHook(() => useSaveCompanyContacts());

    await act(async () => {
      await result.current.saveCompanyContacts(['a', 'b', 'a']);
    });

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    expect(mockAuthFetch.mock.calls[0][0]).toMatch(
      /\/lead-generation\/contacts\/save$/,
    );
    expect(JSON.parse(mockAuthFetch.mock.calls[1][1].body)).toEqual({
      companyIds: ['b'],
    });
    expect(result.current.status).toBe('done');
    expect(result.current.total).toBe(2);
    expect(result.current.completed).toBe(2);
    expect(result.current.results.map((item) => item.created)).toEqual([1, 2]);
  });

  it('records a 400 against the company and keeps going', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(
        jsonResponse(400, { message: 'Company has no website' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, companyResult('b', 1)));

    const { result } = renderHook(() => useSaveCompanyContacts());

    await act(async () => {
      await result.current.saveCompanyContacts(['a', 'b']);
    });

    expect(result.current.status).toBe('done');
    expect(result.current.results[0]).toMatchObject({
      companyId: 'a',
      error: 'Company has no website',
    });
    expect(result.current.results[1].companyId).toBe('b');
  });

  it('stops on server errors and keeps finished results', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(jsonResponse(200, companyResult('a', 1)))
      .mockResolvedValueOnce(
        jsonResponse(503, { message: 'Lead engine is not running' }),
      );

    const { result } = renderHook(() => useSaveCompanyContacts());

    await act(async () => {
      await result.current.saveCompanyContacts(['a', 'b', 'c']);
    });

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Lead engine is not running');
    expect(result.current.results).toHaveLength(1);
  });

  it('caps a run at ten companies', async () => {
    mockAuthFetch.mockImplementation(async () =>
      jsonResponse(200, { success: true, results: [] }),
    );

    const { result } = renderHook(() => useSaveCompanyContacts());
    const ids = Array.from({ length: 12 }, (_, index) => `c${index}`);

    await act(async () => {
      await result.current.saveCompanyContacts(ids);
    });

    expect(mockAuthFetch).toHaveBeenCalledTimes(10);
    expect(result.current.results).toHaveLength(10);
  });
});
