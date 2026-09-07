import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { WebSearchApiService } from './web-search-api.service';

@Controller('web-search-apis')
export class WebSearchApiController {
  constructor(private readonly webSearchApiService: WebSearchApiService) {}

  @Get()
  list() {
    return this.webSearchApiService.list();
  }

  @Post()
  create(@Body() body: { provider: string; apiKey: string }) {
    return this.webSearchApiService.create(body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.webSearchApiService.delete(id);

    return { success: true };
  }
}