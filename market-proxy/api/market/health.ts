/**
 * GET /api/market/health — 不访问 Twelve；与 search 同目录，便于确认该函数包已部署。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.status(200).json({
    ok: true,
    route: '/api/market/health',
    node: process.version,
    hasTwelveKey: Boolean(process.env.TWELVE_DATA_API_KEY?.trim()),
    hasProxySecret: Boolean(process.env.PROXY_SHARED_SECRET),
  });
}
