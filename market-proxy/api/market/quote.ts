/**
 * GET /api/market/quote?symbol=AAPL&mic=XNAS
 * GET /api/market/quote?symbol=AAPL&mic=XNAS&asOf=2026-04-15
 * 不依赖 @vercel/node。
 */

const BASE = 'https://api.twelvedata.com';

function headerVal(req: any, name: string): string | undefined {
  const h = req.headers?.[name];
  if (Array.isArray(h)) return h[0];
  return typeof h === 'string' ? h : undefined;
}

function checkSecret(req: any): boolean {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret) return true;
  return headerVal(req, 'x-assetup-proxy-secret') === secret;
}

type TwelveQuoteJson = {
  symbol?: string;
  mic_code?: string;
  currency?: string;
  close?: string | number;
  datetime?: string;
  is_market_open?: boolean;
};

type TwelveTsJson = {
  values?: { datetime?: string; close?: string }[];
};

type UpstreamResponse = {
  response: Response;
  text: string;
  /** Twelve 能按交易所精确查到数据时为 true；404 回退到 ticker 时为 false。 */
  matchedMic: boolean;
};

/**
 * Twelve 的 MIC 映射会随其数据源调整。先精确查 symbol + MIC；若上游明确返回
 * 404，则仅以 symbol 重试一次，避免 AAPL 等唯一 ticker 因历史 MIC 映射失效而
 * 整条行情链路中断。其它 HTTP 状态（额度、权限、密钥等）不重试。
 */
async function fetchTwelveWithMicFallback(
  path: '/quote' | '/time_series',
  symbol: string,
  mic: string,
  apikey: string,
  signal: AbortSignal,
  extra?: Record<string, string>
): Promise<UpstreamResponse> {
  const request = async (includeMic: boolean): Promise<UpstreamResponse> => {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set('symbol', symbol);
    if (includeMic) url.searchParams.set('mic_code', mic);
    url.searchParams.set('apikey', apikey);
    for (const [key, value] of Object.entries(extra ?? {})) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), { signal });
    return { response, text: await response.text(), matchedMic: includeMic };
  };

  const exact = await request(true);
  if (exact.response.status !== 404) return exact;
  return request(false);
}

export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    if (!checkSecret(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const symbol = String(req.query?.symbol ?? '').trim();
    const mic = String(req.query?.mic ?? '').trim();
    const asOf = String(req.query?.asOf ?? '').trim();

    if (!symbol || symbol.length > 32 || !mic || mic.length > 16) {
      res.status(400).json({ error: 'Invalid symbol or mic' });
      return;
    }

    const apikey = process.env.TWELVE_DATA_API_KEY;
    if (!apikey) {
      res.status(500).json({ error: 'TWELVE_DATA_API_KEY missing' });
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);

    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        const upstream = await fetchTwelveWithMicFallback(
          '/quote',
          symbol,
          mic,
          apikey,
          ac.signal
        );
        if (!upstream.response.ok) {
          res
            .status(502)
            .json({ error: 'Upstream quote error', status: upstream.response.status });
          return;
        }
        const json = JSON.parse(upstream.text) as TwelveQuoteJson & { status?: string };
        if (json.status && json.status !== 'ok') {
          res.status(200).json({ ok: false, reason: json.status });
          return;
        }
        const closeRaw = json.close;
        const close =
          typeof closeRaw === 'number'
            ? closeRaw
            : parseFloat(String(closeRaw ?? ''));
        if (!Number.isFinite(close) || close <= 0) {
          res.status(200).json({ ok: false, reason: 'no_close' });
          return;
        }
        const dt =
          typeof json.datetime === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(json.datetime)
            ? json.datetime.slice(0, 10)
            : '';
        res.setHeader(
          'Cache-Control',
          'public, s-maxage=15, stale-while-revalidate=60'
        );
        res.status(200).json({
          ok: true,
          close,
          tradeDate: dt || null,
          currency: typeof json.currency === 'string' ? json.currency : null,
          symbol,
          mic_code: mic,
          source: upstream.matchedMic
            ? 'twelve_quote'
            : 'twelve_quote_symbol_fallback',
        });
        return;
      }

      const upstream = await fetchTwelveWithMicFallback(
        '/time_series',
        symbol,
        mic,
        apikey,
        ac.signal,
        { interval: '1day', outputsize: '120', end_date: asOf }
      );
      if (!upstream.response.ok) {
        res
          .status(502)
          .json({ error: 'Upstream time_series error', status: upstream.response.status });
        return;
      }
      const json = JSON.parse(upstream.text) as TwelveTsJson & { status?: string };
      if (json.status && json.status !== 'ok') {
        res.status(200).json({ ok: false, reason: json.status });
        return;
      }
      const vals = Array.isArray(json.values) ? json.values : [];
      let best: { d: string; c: number } | null = null;
      for (const v of vals) {
        const d = typeof v.datetime === 'string' ? v.datetime.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > asOf) continue;
        const c = parseFloat(String(v.close ?? ''));
        if (!Number.isFinite(c) || c <= 0) continue;
        if (!best || d.localeCompare(best.d) >= 0) best = { d, c };
      }
      if (!best) {
        res.status(200).json({ ok: false, reason: 'no_bar' });
        return;
      }
      res.setHeader(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=3600'
      );
      res.status(200).json({
        ok: true,
        close: best.c,
        tradeDate: best.d,
        currency: null,
        symbol,
        mic_code: mic,
        source: upstream.matchedMic
          ? 'twelve_time_series'
          : 'twelve_time_series_symbol_fallback',
      });
    } catch {
      res.status(502).json({ error: 'Upstream timeout or network error' });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error('[api/market/quote]', e);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
