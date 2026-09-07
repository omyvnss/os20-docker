import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { WebAgentService } from './web-agent.service';

@Controller('web-agents')
export class WebAgentController {
  constructor(private readonly webAgentService: WebAgentService) {}

  @Get()
  list() {
    return this.webAgentService.list();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      baseUrl: string;
      apiKey: string;
      allowPrivateNetwork?: boolean;
    },
  ) {
    return this.webAgentService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      allowPrivateNetwork?: boolean;
      enabled?: boolean;
    },
  ) {
    return this.webAgentService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.webAgentService.delete(id);

    return { success: true };
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.webAgentService.test(id);
  }
}