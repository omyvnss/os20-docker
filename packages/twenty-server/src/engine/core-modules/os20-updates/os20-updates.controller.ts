import { Controller, Get, UseGuards } from '@nestjs/common';

import {
  type Os20UpdateStatus,
  Os20UpdatesService,
} from 'src/engine/core-modules/os20-updates/services/os20-updates.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('os20-updates')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class Os20UpdatesController {
  constructor(private readonly os20UpdatesService: Os20UpdatesService) {}

  @Get('status')
  async getStatus(): Promise<Os20UpdateStatus> {
    return this.os20UpdatesService.getStatus();
  }
}
