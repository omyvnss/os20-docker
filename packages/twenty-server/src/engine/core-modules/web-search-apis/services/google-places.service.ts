import { Injectable } from '@nestjs/common';

import { WebSearchApiService } from '../web-search-api.service';
import { GOOGLE_PLACES_PROVIDER_ID } from '../constants/web-search-api-providers.constant';

export const GOOGLE_PLACES_TEXT_SEARCH_URL =
  'https://places.googleapis.com/v1/places:searchText';

// Text Search (New): pageSize is capped at 20 and at most 60 results come back
// across all pages.
export const GOOGLE_PLACES_MAX_PAGE_SIZE = 20;
export const GOOGLE_PLACES_MAX_RESULTS = 60;

export const GOOGLE_PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.formattedAddress',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',');

const GOOGLE_PLACES_TIMEOUT_MS = 15_000;

export type GooglePlace = {
  id: string;
  displayName?: { text?: string; languageCode?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
};

type TextSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

@Injectable()
export class GooglePlacesService {
  constructor(private readonly credentialService: WebSearchApiService) {}

  async hasKey(): Promise<boolean> {
    return !!(await this.credentialService.getApiKey(
      GOOGLE_PLACES_PROVIDER_ID,
    ));
  }

  // Null when the workspace has no Places key, so callers can skip the source.
  async searchWithWorkspaceKey(
    textQuery: string,
    maxResults: number,
  ): Promise<GooglePlace[] | null> {
    const apiKey = await this.credentialService.getApiKey(
      GOOGLE_PLACES_PROVIDER_ID,
    );

    return apiKey ? this.searchText(apiKey, textQuery, maxResults) : null;
  }

  async searchText(
    apiKey: string,
    textQuery: string,
    maxResults: number,
  ): Promise<GooglePlace[]> {
    const limit = Math.min(
      Math.max(1, Math.floor(maxResults)),
      GOOGLE_PLACES_MAX_RESULTS,
    );
    const places: GooglePlace[] = [];
    let pageToken: string | undefined;

    do {
      const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          pageSize: Math.min(GOOGLE_PLACES_MAX_PAGE_SIZE, limit),
          ...(pageToken && { pageToken }),
        }),
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Places search failed: ${response.status}`);
      }

      const data = (await response.json()) as TextSearchResponse;

      places.push(...(data.places ?? []));
      pageToken = data.nextPageToken || undefined;
    } while (pageToken && places.length < limit);

    return places.slice(0, limit);
  }
}
