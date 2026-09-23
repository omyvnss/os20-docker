import { Injectable, Logger } from '@nestjs/common';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { TWENTY_CURRENT_VERSION } from 'src/engine/core-modules/upgrade/constants/twenty-current-version.constant';
import {
  isNewerOs20Version,
  normalizeOs20Version,
} from 'src/engine/core-modules/os20-updates/utils/os20-version.util';

export const OS20_UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const OS20_UPDATE_CHECK_TIMEOUT_MS = 5000;
export const OS20_DEFAULT_UPDATE_REPO = 'omyvnss/os20';

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type Os20UpdateStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotesUrl: string | null;
  checkedAt: string | null;
  checkEnabled: boolean;
};

type LatestRelease = {
  latestVersion: string | null;
  releaseNotesUrl: string | null;
  checkedAt: number;
};

@Injectable()
export class Os20UpdatesService {
  private readonly logger = new Logger(Os20UpdatesService.name);
  private cachedRelease: LatestRelease | null = null;
  private pendingRelease: Promise<LatestRelease> | null = null;

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly secureHttpClientService: SecureHttpClientService,
  ) {}

  async getStatus(): Promise<Os20UpdateStatus> {
    const currentVersion = this.getCurrentVersion();

    if (!this.isCheckEnabled()) {
      return {
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseNotesUrl: null,
        checkedAt: null,
        checkEnabled: false,
      };
    }

    const release = await this.getLatestRelease();

    return {
      currentVersion,
      latestVersion: release.latestVersion,
      updateAvailable: isNewerOs20Version(
        release.latestVersion,
        currentVersion,
      ),
      releaseNotesUrl: release.releaseNotesUrl,
      checkedAt: new Date(release.checkedAt).toISOString(),
      checkEnabled: true,
    };
  }

  getCurrentVersion(): string | null {
    return (
      normalizeOs20Version(this.twentyConfigService.get('APP_VERSION')) ??
      normalizeOs20Version(TWENTY_CURRENT_VERSION)
    );
  }

  isCheckEnabled(): boolean {
    return process.env.OS20_UPDATE_CHECK?.trim().toLowerCase() !== 'false';
  }

  getUpdateRepo(): string {
    const repo = process.env.OS20_UPDATE_REPO?.trim();

    return repo && REPO_PATTERN.test(repo) ? repo : OS20_DEFAULT_UPDATE_REPO;
  }

  private async getLatestRelease(): Promise<LatestRelease> {
    const now = Date.now();

    if (
      this.cachedRelease &&
      now - this.cachedRelease.checkedAt < OS20_UPDATE_CHECK_INTERVAL_MS
    ) {
      return this.cachedRelease;
    }

    if (!this.pendingRelease) {
      this.pendingRelease = this.fetchLatestRelease(now).finally(() => {
        this.pendingRelease = null;
      });
    }

    const release = await this.pendingRelease;

    this.cachedRelease = release;

    return release;
  }

  private async fetchLatestRelease(now: number): Promise<LatestRelease> {
    const repo = this.getUpdateRepo();
    const fallbackUrl = `https://github.com/${repo}/releases/latest`;

    try {
      const safeFetch = this.secureHttpClientService.createSsrfSafeFetch({
        timeout: OS20_UPDATE_CHECK_TIMEOUT_MS,
      });

      const response = await safeFetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'OS20-update-check',
          },
          signal: AbortSignal.timeout(OS20_UPDATE_CHECK_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        throw new Error(`GitHub responded ${response.status}`);
      }

      const body = (await response.json()) as {
        tag_name?: unknown;
        html_url?: unknown;
      };

      const latestVersion = normalizeOs20Version(
        typeof body.tag_name === 'string' ? body.tag_name : null,
      );

      const releaseNotesUrl =
        typeof body.html_url === 'string' &&
        body.html_url.startsWith('https://github.com/')
          ? body.html_url
          : fallbackUrl;

      return { latestVersion, releaseNotesUrl, checkedAt: now };
    } catch (error) {
      this.logger.debug(
        `OS20 update check skipped: ${error instanceof Error ? error.message : String(error)}`,
      );

      return { latestVersion: null, releaseNotesUrl: null, checkedAt: now };
    }
  }
}
