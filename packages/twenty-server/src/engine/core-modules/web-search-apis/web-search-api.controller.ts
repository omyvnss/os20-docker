import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { WebSearchApiService } from './web-search-api.service';
import { WebSearchToolService } from './services/web-search-tool.service';
import { GooglePlacesService } from './services/google-places.service';
import {
  GOOGLE_PLACES_PROVIDER_ID,
  normalizeProvider,
} from './constants/web-search-api-providers.constant';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

export type WebSearchApiTestResult = {
  ok: boolean;
  resultCount: number;
  error?: string;
};

// WebSearchToolService throws "<Provider> search failed: <status>".
const describeSearchError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^(\w+) search failed: (\d{3})$/);

  if (!match) {
    return "Couldn't reach the search provider. Check your network and try again.";
  }

  const [, provider, status] = match;

  if (status === '401' || status === '403') {
    return `${provider} rejected the key (${status}). Check that it is correct and active.`;
  }

  if (status === '402' || status === '429') {
    return `${provider} refused the request (${status}): out of credits or rate limited.`;
  }

  return `${provider} returned an error (${status}). Try again later.`;
};

@Controller('web-search-apis')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class WebSearchApiController {
  constructor(
    private readonly webSearchApiService: WebSearchApiService,
    private readonly webSearchToolService: WebSearchToolService,
    private readonly googlePlacesService: GooglePlacesService,
  ) {}

  @Get()
  list() {
    return this.webSearchApiService.list();
  }

  @Post()
  create(@Body() body: { provider: string; apiKey: string }) {
    return this.webSearchApiService.create(body);
  }

  // Runs one tiny search with the key the search tool would pick, or with the
  // Places key when body.provider is google_places.
  @Post('test')
  async test(
    @Body() body?: { provider?: string },
  ): Promise<WebSearchApiTestResult> {
    const isPlaces =
      normalizeProvider(body?.provider ?? '') ===
      normalizeProvider(GOOGLE_PLACES_PROVIDER_ID);

    if (isPlaces) {
      try {
        const places = await this.googlePlacesService.searchWithWorkspaceKey(
          'coffee shop',
          1,
        );

        return places === null
          ? {
              ok: false,
              resultCount: 0,
              error: 'No Google Places key saved yet.',
            }
          : { ok: true, resultCount: places.length };
      } catch (error) {
        return { ok: false, resultCount: 0, error: describeSearchError(error) };
      }
    }

    const credentials = (await this.webSearchApiService.list()).filter(
      (credential) =>
        normalizeProvider(credential.provider) !==
        normalizeProvider(GOOGLE_PLACES_PROVIDER_ID),
    );

    if (credentials.length === 0) {
      return { ok: false, resultCount: 0, error: 'No search key saved yet.' };
    }

    try {
      const results = await this.webSearchToolService.search('OS20 CRM', 1);

      return { ok: true, resultCount: results.length };
    } catch (error) {
      return { ok: false, resultCount: 0, error: describeSearchError(error) };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.webSearchApiService.delete(id);

    return { success: true };
  }
}
