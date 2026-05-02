/**
 * GET /api/market/search?q=AAPL&limit=14
 * 转发 Twelve Data symbol_search，不在响应中暴露 apikey。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM = 'https://api.twelvedata.com/symbol_search';

function checkSecret(req: VercelRequest): boolean {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret) return true;
  return req.headers['x-assetup-proxy-secret'] === secret;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const q = String(req.query.q ?? '').trim();
  if (q.length < 1 || q.length > 64) {
    res.status(400).json({ error: 'Invalid q' });
    return;
  }

  const limRaw = parseInt(String(req.query.limit ?? '14'), 10);
  const outputsize = Number.isFinite(limRaw)
    ? Math.min(120, Math.max(1, limRaw))
    : 14;

  const apikey = process.env.TWELVE_DATA_API_KEY;
  if (!apikey) {
    res.status(500).json({ error: 'TWELVE_DATA_API_KEY missing' });
    return;
  }

  const url = new URL(UPSTREAM);
  url.searchParams.set('symbol', q);
  url.searchParams.set('apikey', apikey);
  url.searchParams.set('outputsize', String(outputsize));

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url.toString(), { signal: ac.signal });
    const text = await r.text();
    if (!r.ok) {
      res.status(502).json({ error: 'Upstream error', status: r.status });
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      res.status(502).json({ error: 'Invalid upstream JSON' });
      return;
    }
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=120'
    );
    res.status(200).json(json);
  } catch {
    res.status(502).json({ error: 'Upstream timeout or network error' });
  } finally {
    clearTimeout(timer);
  }
}
