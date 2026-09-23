import { Injectable } from '@nestjs/common';

import { type VersionInfoDTO } from 'src/engine/core-modules/admin-panel/dtos/version-info.dto';
import { Os20UpdatesService } from 'src/engine/core-modules/os20-updates/services/os20-updates.service';

@Injectable()
export class AdminPanelVersionService {
  constructor(private readonly os20UpdatesService: Os20UpdatesService) {}

  async getVersionInfo(): Promise<VersionInfoDTO> {
    const { currentVersion, latestVersion } =
      await this.os20UpdatesService.getStatus();

    return { currentVersion: currentVersion ?? undefined, latestVersion };
  }
}
