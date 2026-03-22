// Chicken Saga Market Proxy — Railway edition
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3333;

const ALLOWED_HOSTS = [
  'marketplace-graphql.skymavis.com',
  'api.geckoterminal.com',
  'api.coingecko.com',
];

function fetchUpstream(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const target = parsedUrl.searchParams.get('url');

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    return;
  }

  let targetUrl;
  try { targetUrl = new URL(target); }
  catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Host not allowed: ${targetUrl.hostname}` }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const options = {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; ChickenSagaTracker/1.0)',
          'Origin': 'https://marketplace.roninchain.com',
          'Referer': 'https://marketplace.roninchain.com/',
        },
      };
      if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

      // Log the request body for debugging
      if (body && targetUrl.hostname === 'marketplace-graphql.skymavis.com') {
        try {
          const parsed = JSON.parse(body);
          console.log(`[GQL] op=${parsed.operationName} vars=${JSON.stringify(parsed.variables)}`);
        } catch(_) {}
      }

      const upstream = await fetchUpstream(options, body || null);

      // Log first 300 chars of response for debugging
      console.log(`[${upstream.status}] ${targetUrl.hostname}${targetUrl.pathname} → ${upstream.body.slice(0,300)}`);

      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(upstream.body);
    } catch (err) {
      console.error('Upstream error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🐔 Chicken Saga Proxy running on port ${PORT}`);
});
