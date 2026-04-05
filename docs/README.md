# GitHub Pages（Nest 隐私政策与用户协议）

本目录为静态页面，用于公开展示隐私政策与用户协议，供 App 内 WebView 与 App Store 填写链接。

## 仓库与地址

| 项目 | 值 |
|------|-----|
| GitHub 用户名 | `luoxijia1127-ops` |
| 仓库名 | `wealth-tracker-v1` |
| 隐私政策页 | <https://luoxijia1127-ops.github.io/wealth-tracker-v1/privacy.html> |
| 用户协议页 | <https://luoxijia1127-ops.github.io/wealth-tracker-v1/terms.html> |
| 站点根（会跳转到隐私页） | <https://luoxijia1127-ops.github.io/wealth-tracker-v1/> |

## 在 GitHub 上开启 Pages

1. 打开仓库：<https://github.com/luoxijia1127-ops/wealth-tracker-v1>
2. **Settings** → 左侧 **Pages**
3. **Build and deployment** → **Source**：**Deploy from a branch**
4. **Branch**：选你推送代码的分支（例如 **`Escape`** 或 **`main`**）→ 文件夹选 **`/docs`**
5. **Save**，等待 1～5 分钟后访问上表链接

若根路径 404，请确认已把包含 `docs/` 的提交推送到 GitHub。

## 应用内配置

项目根目录 `.env.example` 已包含 `EXPO_PUBLIC_PRIVACY_POLICY_URL` 与可选的 `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`。本地复制为 `.env` 后重启 Metro。
