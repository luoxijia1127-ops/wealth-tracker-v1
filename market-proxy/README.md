# Assetup · Twelve Data 行情代理（Vercel）

将 Twelve Data API Key **仅**保存在 Vercel 环境变量中；Expo App 通过 `EXPO_PUBLIC_MARKET_PROXY_ORIGIN` 请求本服务。

## 部署前检查清单（Twelve Data / 合规）

1. 在 [Twelve Data](https://twelvedata.com/) 注册并完成套餐选择，确保套餐包含：
   - `symbol_search`（联想）
   - `quote` 与 `time_series`（报价与历史收盘）
2. 在控制台生成 **API Key**，写入 Vercel 变量 `TWELVE_DATA_API_KEY`（勿提交到 Git）。
3. 阅读 Twelve Data 服务条款中关于 **缓存、再分发、移动端** 的约束；在 App 隐私政策中披露数据流向（见主仓库 `docs/privacy.html`）。
4. （推荐）设置 `PROXY_SHARED_SECRET`，并在 App 的 `.env` 中配置 `EXPO_PUBLIC_MARKET_PROXY_SECRET`，请求头携带 `x-assetup-proxy-secret`，降低被扫接口盗刷额度的风险。

## Vercel 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TWELVE_DATA_API_KEY` | 是 | Twelve Data 控制台 API Key |
| `PROXY_SHARED_SECRET` | 否 | 若设置，请求必须带请求头 `x-assetup-proxy-secret: <同值>` |

## 本地开发

```bash
cd market-proxy
npm install
npx vercel dev
```

## 路由

- `GET /api/market/health` → 自检（不调用 Twelve）；与 `search` 同目录，部署后应先能打开此地址
- `GET /api/health` → 同上（根级副本）；若仅有 `market/health` 能开、此 404，说明旧部署未含根级文件，以 `market/health` 为准即可
- `GET /api/market/search?q=AAPL&limit=14` → 转发 `symbol_search`
- `GET /api/market/quote?symbol=AAPL&mic=XNAS` → 转发 `quote`
- `GET /api/market/quote?symbol=AAPL&mic=XNAS&asOf=2026-04-15` → 转发 `time_series`（`end_date=asOf`，取 `<= asOf` 的最近一根）

## 上线后监控

- Vercel：Functions invocations、错误率、p95 延迟
- Twelve Data：API credits 用量与配额告警
