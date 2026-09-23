import http from 'node:http';

const PORT = process.env.PORT || 8000;

const LEADS = [
  { companyName: 'Brew & Co', industry: 'Coffee', location: 'Mumbai', website: 'https://brewandco.example', email: 'hello@brewandco.example', phone: '+91 98200 10001' },
  { companyName: 'PixelForge Studio', industry: 'Design agency', location: 'Bangalore', website: 'https://pixelforge.example', email: 'hire@pixelforge.example', phone: '+91 99000 20002' },
];

const readJson = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });

const send = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const auth = req.headers.authorization;

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, { name: 'scraper-bot', lead_fetch: true });
    }

    if (req.method === 'POST' && url.pathname === '/lead-fetch') {
      if (auth !== 'Bearer stub-key') {
        return send(res, 401, { error: 'invalid api key' });
      }

      const { icp } = await readJson(req);

      return send(res, 200, {
        count: LEADS.length,
        meta: { matched: icp?.industry ?? 'any', requestedAt: new Date().toISOString() },
        leads: LEADS.map((lead) => ({
          id: crypto.randomUUID(),
          title: `${lead.companyName} — ${lead.industry}`,
          ...lead,
          snippet: `A ${lead.industry} business in ${lead.location}.`,
        })),
      });
    }

    send(res, 404, { error: 'not found' });
  })
  .listen(PORT, () => console.log(`web-agent stub on http://localhost:${PORT}`));