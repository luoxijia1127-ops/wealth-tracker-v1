/**
 * GET /api/market/ping — 纯 JS、零依赖，用于确认 Vercel 能执行该目录下的函数。
 */
module.exports = function handler(req, res) {
  res.status(200).json({
    pong: true,
    node: process.version,
    ts: Date.now(),
  });
};
