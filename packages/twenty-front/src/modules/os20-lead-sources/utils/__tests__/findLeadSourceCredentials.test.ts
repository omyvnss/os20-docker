import { findLeadSourceCredentials } from '@/os20-lead-sources/utils/findLeadSourceCredentials';
import { hasWebSearchCredential } from '@/os20-lead-sources/utils/hasWebSearchCredential';

const credential = (id: string, provider: string) => ({
  id,
  provider,
  apiKey: 'sk-...abcd',
  createdAt: '2026-09-17T00:00:00.000Z',
});

describe('findLeadSourceCredentials', () => {
  it('matches providers the way the server normalizes them', () => {
    const credentials = [
      credential('1', 'Brave Search'),
      credential('2', 'google_places'),
      credential('3', 'tavily'),
    ];

    expect(
      findLeadSourceCredentials(credentials, 'brave-search').map(
        (item) => item.id,
      ),
    ).toEqual(['1']);
    expect(
      findLeadSourceCredentials(credentials, 'google_places').map(
        (item) => item.id,
      ),
    ).toEqual(['2']);
    expect(findLeadSourceCredentials(credentials, 'serpapi')).toEqual([]);
  });
});

describe('hasWebSearchCredential', () => {
  it('ignores Google Places, which is not a web search key', () => {
    expect(hasWebSearchCredential([credential('1', 'google_places')])).toBe(
      false,
    );
  });

  it('is true once a web search key is saved', () => {
    expect(hasWebSearchCredential([credential('1', 'firecrawl')])).toBe(true);
  });
});
