import { type SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import {
  OS20_UPDATE_CHECK_INTERVAL_MS,
  Os20UpdatesService,
} from 'src/engine/core-modules/os20-updates/services/os20-updates.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('Os20UpdatesService', () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let appVersion: string | undefined;
  let service: Os20UpdatesService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-22T00:00:00.000Z') });
    delete process.env.OS20_UPDATE_CHECK;
    delete process.env.OS20_UPDATE_REPO;
    appVersion = '2.37.0';
    fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        tag_name: 'v2.38.0',
        html_url: 'https://github.com/omyvnss/os20/releases/tag/v2.38.0',
      }),
    );

    const twentyConfigService = {
      get: jest.fn(() => appVersion),
    } as unknown as TwentyConfigService;

    const secureHttpClientService = {
      createSsrfSafeFetch: jest.fn(() => fetchMock),
    } as unknown as SecureHttpClientService;

    service = new Os20UpdatesService(
      twentyConfigService,
      secureHttpClientService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
  });

  it('reports an available update from the latest GitHub release', async () => {
    const status = await service.getStatus();

    expect(status).toEqual({
      currentVersion: '2.37.0',
      latestVersion: '2.38.0',
      updateAvailable: true,
      releaseNotesUrl: 'https://github.com/omyvnss/os20/releases/tag/v2.38.0',
      checkedAt: '2026-09-22T00:00:00.000Z',
      checkEnabled: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/omyvnss/os20/releases/latest',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    );
  });

  it('caches the result for 12 hours', async () => {
    await service.getStatus();
    jest.advanceTimersByTime(OS20_UPDATE_CHECK_INTERVAL_MS - 1000);
    await service.getStatus();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2000);
    await service.getStatus();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    await Promise.all([service.getStatus(), service.getStatus()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when OS20_UPDATE_CHECK=false', async () => {
    process.env.OS20_UPDATE_CHECK = 'false';

    const status = await service.getStatus();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      currentVersion: '2.37.0',
      latestVersion: null,
      updateAvailable: false,
      checkEnabled: false,
    });
  });

  it('uses OS20_UPDATE_REPO and ignores invalid values', async () => {
    process.env.OS20_UPDATE_REPO = 'acme/os20-fork';
    await service.getStatus();

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.github.com/repos/acme/os20-fork/releases/latest',
      expect.anything(),
    );

    process.env.OS20_UPDATE_REPO = '../../evil';

    expect(service.getUpdateRepo()).toBe('omyvnss/os20');
  });

  it('returns no update silently when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));

    const status = await service.getStatus();

    expect(status).toMatchObject({
      latestVersion: null,
      updateAvailable: false,
      releaseNotesUrl: null,
      checkEnabled: true,
    });
  });

  it('returns no update on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'rate limited' }, 403),
    );

    const status = await service.getStatus();

    expect(status.updateAvailable).toBe(false);
    expect(status.latestVersion).toBeNull();
  });

  it('treats a prerelease tag as not an update', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ tag_name: 'v2.38.0-beta.1' }),
    );

    const status = await service.getStatus();

    expect(status.updateAvailable).toBe(false);
    expect(status.releaseNotesUrl).toBe(
      'https://github.com/omyvnss/os20/releases/latest',
    );
  });

  it('falls back to the built-in version when APP_VERSION is unset', async () => {
    appVersion = undefined;

    expect(service.getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
