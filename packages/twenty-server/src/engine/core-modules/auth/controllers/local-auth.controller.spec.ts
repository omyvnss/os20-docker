import { type Request } from 'express';

import { isSameOriginLocalRequest } from 'src/engine/core-modules/auth/controllers/local-auth.controller';

const request = (headers: Record<string, string>): Request =>
  ({
    protocol: 'http',
    headers: { host: 'localhost:3010', ...headers },
  }) as unknown as Request;

describe('isSameOriginLocalRequest', () => {
  it('allows the OS20 front-end on the same origin', () => {
    expect(
      isSameOriginLocalRequest(
        request({
          'x-os20-local': '1',
          'sec-fetch-site': 'same-origin',
          origin: 'http://localhost:3010',
        }),
      ),
    ).toBe(true);
  });

  it('allows local non-browser clients that send the header', () => {
    expect(isSameOriginLocalRequest(request({ 'x-os20-local': '1' }))).toBe(
      true,
    );
  });

  it('rejects requests without the OS20 header', () => {
    expect(
      isSameOriginLocalRequest(request({ origin: 'http://localhost:3010' })),
    ).toBe(false);
  });

  it('rejects another website open in the same browser', () => {
    expect(
      isSameOriginLocalRequest(
        request({
          'x-os20-local': '1',
          'sec-fetch-site': 'cross-site',
          origin: 'https://evil.example',
        }),
      ),
    ).toBe(false);
  });

  it('rejects a foreign Origin even without fetch metadata', () => {
    expect(
      isSameOriginLocalRequest(
        request({ 'x-os20-local': '1', origin: 'https://evil.example' }),
      ),
    ).toBe(false);
  });

  it('rejects same-site subdomains', () => {
    expect(
      isSameOriginLocalRequest(
        request({
          'x-os20-local': '1',
          'sec-fetch-site': 'same-site',
          origin: 'http://attacker.localhost:3010',
        }),
      ),
    ).toBe(false);
  });
});
