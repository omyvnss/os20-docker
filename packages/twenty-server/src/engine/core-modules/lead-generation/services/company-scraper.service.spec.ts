import { CompanyScraperService } from 'src/engine/core-modules/lead-generation/services/company-scraper.service';
import { type SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';

const scrape = async (html: string, url = 'https://acme.de/') => {
  const secureHttpClientService = {
    createSsrfSafeFetch: () => async () => ({
      ok: true,
      text: async () => html,
    }),
  };

  return new CompanyScraperService(
    secureHttpClientService as unknown as SecureHttpClientService,
  ).scrapeCompany(url);
};

describe('CompanyScraperService phone and email extraction', () => {
  it('never takes dates or ids as the phone', async () => {
    const company = await scrape(`<html><head><title>Acme</title>
      <script>window.__data={"build":"20260410","id":117692280,"ts":6442713809951}</script>
      </head><body><p>Ref 00000040</p></body></html>`);

    expect(company?.phone).toBe('');
  });

  it('reads the phone from a tel: link and stores E.164 using the site country', async () => {
    const company = await scrape(
      '<title>Acme</title><a href="tel:030%201234567">Anrufen</a>',
    );

    expect(company?.phone).toBe('+49301234567');
  });

  it('reads the phone from JSON-LD with addressCountry', async () => {
    const company = await scrape(
      `<title>Acme</title><script type="application/ld+json">{"@type":"Organization","name":"Acme","telephone":"(212) 736-5000","address":{"addressCountry":"US"}}</script>`,
      'https://acme.com/',
    );

    expect(company?.phone).toBe('+12127365000');
  });

  it('drops placeholder, vendor and image-filename emails but keeps role inboxes', async () => {
    const company = await scrape(`<title>Acme</title>
      <p>example@gmail.com your@email.com name@domain.com noreply@acme.de</p>
      <img src="logo@2x.png">
      <script>{"dsn":"https://abc123@o1.ingest.sentry.io/1","wix":"5f1c2a9b0e4d4c7fa3b1d2e3f4a5b6c7@sentry.wixpress.com"}</script>
      <a href="mailto:info@acme.de">info@acme.de</a> sales@acme.de`);

    expect(company?.emails).toEqual(['info@acme.de', 'sales@acme.de']);
  });
});
