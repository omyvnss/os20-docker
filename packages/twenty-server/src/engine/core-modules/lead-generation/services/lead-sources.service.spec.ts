import { type SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { type WebAgentService } from 'src/engine/core-modules/web-agent/web-agent.service';

import {
  LeadSourcesService,
  TRUSTPILOT_SUBDOMAIN,
} from './lead-sources.service';

describe('LeadSourcesService outbound requests', () => {
  const requestedUrls: string[] = [];
  const safeFetch = jest.fn(async (url: string) => {
    requestedUrls.push(url);

    return new Response('<html></html>', { status: 200 });
  });
  const secureHttpClientService = {
    createSsrfSafeFetch: jest.fn(() => safeFetch),
  } as unknown as SecureHttpClientService;
  const service = new LeadSourcesService(
    {} as WebAgentService,
    secureHttpClientService,
  );

  beforeEach(() => {
    requestedUrls.length = 0;
    safeFetch.mockClear();
  });

  it('accepts only Trustpilot country subdomains', () => {
    expect(TRUSTPILOT_SUBDOMAIN.test('uk')).toBe(true);
    expect(TRUSTPILOT_SUBDOMAIN.test('www')).toBe(true);
    expect(TRUSTPILOT_SUBDOMAIN.test('169.254.169.254/')).toBe(false);
    expect(TRUSTPILOT_SUBDOMAIN.test('evil.example#')).toBe(false);
    expect(TRUSTPILOT_SUBDOMAIN.test('localhost:8120/x?')).toBe(false);
  });

  it('never builds a hostname from a malicious domain value', async () => {
    await (
      service as unknown as {
        fetchTrustpilot: (
          criteria: Record<string, unknown>,
        ) => Promise<unknown>;
      }
    ).fetchTrustpilot({ keyword: 'dentist', domain: 'evil.example#' });

    expect(requestedUrls).toHaveLength(1);
    expect(new URL(requestedUrls[0]).hostname).toBe('uk.trustpilot.com');
  });

  it('sends lead source requests through the SSRF-safe client', async () => {
    await (
      service as unknown as {
        fetchTrustpilot: (
          criteria: Record<string, unknown>,
        ) => Promise<unknown>;
      }
    ).fetchTrustpilot({ keyword: 'dentist', domain: 'de' });

    expect(secureHttpClientService.createSsrfSafeFetch).toHaveBeenCalled();
    expect(new URL(requestedUrls[0]).hostname).toBe('de.trustpilot.com');
  });
});
