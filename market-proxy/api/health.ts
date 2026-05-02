/**
 * GET /api/health — 不访问 Twelve、不读密钥；用于确认 Vercel 函数能跑通。
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
    node: process.version,
    hasTwelveKey: Boolean(process.env.TWELVE_DATA_API_KEY?.trim()),
    hasProxySecret: Boolean(process.env.PROXY_SHARED_SECRET),
  });
}
