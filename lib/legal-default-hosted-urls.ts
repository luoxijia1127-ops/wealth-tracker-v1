/**
 * 官方 GitHub Pages 法律文档根地址（与 `docs/README.md`、`eas.json` 一致）。
 * 当构建未注入 `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` 时
 *（例如误用无 env 的 EAS profile、本地 Archive），仍打开托管页，避免 TestFlight 仅显示 fallback。
 * 若需覆盖，请在构建环境设置对应 EXPO_PUBLIC_*。
 */
export const DEFAULT_HOSTED_PRIVACY_POLICY_URL =
  'https://luoxijia1127-ops.github.io/wealth-tracker-v1/privacy.html';

export const DEFAULT_HOSTED_TERMS_OF_SERVICE_URL =
  'https://luoxijia1127-ops.github.io/wealth-tracker-v1/terms.html';
