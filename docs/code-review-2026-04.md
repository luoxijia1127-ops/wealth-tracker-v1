# Nest Code Review — 2026-04

> 全面 code review 的汇总结论。按「稳定性 / 架构 / 上架合规 / 业务闭环」四个维度整理，附 iOS App Store 提交前 checklist 和待跟进项。仅作为对内文档，不随 App Store 提审。

## 总体结论

本次 review 覆盖了 Phase 0（基线体检）至 Phase 4（业务闭环）共 5 个阶段。主要结论：

- 工程基线健康：`tsc --noEmit`、`expo lint`、`vitest` 全部通过。
- 上架阻塞点已修复（隐私清单、非豁免加密声明、订阅页法律链接、ATS、隐私政策与真实行为一致性）。
- 稳定性层面补齐了网络超时 / 取消、`market` 页的请求取消、全局 `ErrorBoundary`。
- 架构上消除了 `lib/repositories/asset-repository.ts` 带来的双 API 困扰，翻译覆盖度补到用户可见层面。
- 业务闭环上修复了备份合并模式下现金账户余额与流水不一致的潜在 bug，增加了导入超过免费额度的提示。

---

## Phase 0 · 基线体检

基线命令：

```bash
npx tsc --noEmit
npx expo lint
npx vitest run
```

均通过，未发现 skip 用例。高风险 pattern 扫描结果：

- `setInterval` / `setTimeout` 全部成对 `clearXxx`。
- 新发现两处 `fetch` 无超时：`lib/fx-rates.ts`、`app/market.tsx`（已在 Phase 2 修复）。
- `console.error` 残留在 `app/modal.tsx`（已改为 `__DEV__` 下 `console.warn`，避免 RedBox）。
- 无 `@ts-ignore`、只有少量已记号的 TODO。

---

## Phase 1 · App Store 上架阻塞点

### 已修复

| 项 | 改动 |
| :- | :- |
| iOS 17 隐私清单 | `app.json` 新增 `ios.privacyManifests`：UserDefaults (CA92.1)、FileTimestamp (C617.1)、DiskSpace (E174.1)、SystemBootTime (35F9.1)，`NSPrivacyCollectedDataTypes` 为空数组。 |
| 非豁免加密声明 | `app.json` 新增 `ios.config.usesNonExemptEncryption: false`，避免每次 TestFlight 勾选。 |
| 订阅页合规 | `app/paywall.tsx` 增加「隐私政策」「使用条款」链接（`WebBrowser` / `Linking` 兜底），`paywall.footer` 文案补齐自动续费与订阅管理说明。删除历史冗余的「订阅条款」链接避免重复。 |
| 隐私政策一致性 | `docs/privacy.html` 第 5 节展开列出所有出站第三方域名（Eastmoney、Stooq、Frankfurter、OpenFIGI、CMB、RevenueCat、Google Fonts）及用途；第 9 节明确三种数据删除路径（清空回收站、永久删除归档、卸载 App）。 |
| ATS / HTTP | `WebView`（`app/settings-privacy.tsx`、`app/settings-terms.tsx`）`originWhitelist` 从 `['http://','https://']` 收紧为 `['https://']`。 |
| 数据删除入口 | 通过隐私政策章节文字 + 回收站 / 归档入口共同覆盖。 |

### App Store Connect 待办（只列 TODO）

- 年龄分级（Age Rating）
- Bundle version 递增
- 图标去除 alpha 通道
- Launch screen 资源确认
- 截图中不得包含真人财务数据

---

## Phase 2 · 稳定性 & 性能

### 新增 / 修复

- `lib/net/fetch-with-timeout.ts`：统一超时 + `AbortController`，同时支持外部 `parentSignal`。内置 `withTimeoutNullable` 用于内部任务包装。
- `lib/fx-rates.ts`：`ensureFxUsdRatesForToday` 走 `fetchWithTimeout(8000)`，弱网不再 hang。
- `app/market.tsx`：加入 `refreshAbortRef` + `mountedRef`，组件卸载或触发新刷新时取消旧请求，避免 `setState` on unmounted。
- `lib/market-quotes.ts`：`fetchAllMarketQuotes` 每个 chunk 处理前后检查 `signal?.aborted`，提前退出。
- `components/app-error-boundary.tsx`（新文件）+ `app/_layout.tsx` 导出 `ErrorBoundary`：接入 Expo Router 的全局错误兜底，fallback UI 带「重试」按钮，文案使用轻量 `guessFallbackText`，不依赖 Provider。
- `app/modal.tsx`：生产环境下 `console.error` 收敛为 `__DEV__` `console.warn`。

### 后续建议（非阻塞）

- `lib/asset-daily-snapshots.ts` 最大 730 天 × N 资产的全量读写；若后续用户量提升，考虑按日分片或增量追加。
- `lib/backup-bundle.ts` 的 sha256 在大备份下可考虑 `InteractionManager.runAfterInteractions` 避免主线程卡顿。

---

## Phase 3 · 架构 & 可维护

### Repository 收敛

删除 `lib/repositories/asset-repository.ts`（含目录），其曾作为 `lib/asset-storage.ts` 的极薄封装，实际仅两处使用。已将 `app/modal.tsx`、`app/(tabs)/insights.tsx` 改为直接使用 `getAssets` / `saveAssets`，消除双 API。

### 单一数据源确认

- `types/asset.ts` 的 `SimpleAsset`、`ASSET_CATEGORY_ORDER` 唯一。
- `lib/asset-currency.ts` 的 `ASSET_CURRENCY_OPTIONS` 唯一。
- `lib/market-quotes.ts` 的 `MARKET_SECTIONS` 唯一。
- 过期迁移 `lib/legacy-test-snapshot-purge.ts`、`lib/nest-storage-migration.ts` 均已有 `MIGRATION_KEY` guard，一次性执行。

### 翻译覆盖补齐

新增约 40 个翻译键，覆盖以下模块：

- `settings-import.tsx`：导入汇总表头与行标签（项目 / 之前 / 之后 / 资产 / 每日净值 / 每日逐资产 / 归档 / 回收站）。
- `settings-cashflow-colors.tsx`：整段说明文字与按钮。
- `settings-about.tsx`：tagline、版本号、版权声明。
- `cash-ledger-edit.tsx`：所有 `Alert` 文案、表单 label、按钮文字。
- `recycle-records-table.tsx`：表格列头。
- `add-asset/funding-source-picker.tsx`：Modal 取消按钮。
- `common.saving` / `common.restore` 作为公共键加入。

### 测试补充

- `lib/fx-rates.test.ts`（新）：`convertDisplayValueToCny`、`convertDisplayValueToCurrency`、`hasUsdAnchoredFxTable`，覆盖主路径 + 缺失汇率 / 非法输入兜底。
- `lib/cash-ledger.test.ts`（新）：`replayCashLedger`、`appendCashMovement`、`updateCashLedgerEntry`、`deleteCashLedgerEntry` 基线行为与越支错误。

### 未改动的样式 / 主题（follow-up）

`lib/settings-screen-styles.ts` 内 `mastheadBlockHub` / `mastheadBlockHubNarrow` 仅 `paddingHorizontal` 不同（24 vs 4），语义差异明确，不合并。若后续需要再统一 API，可让调用方传 `narrow` 布尔参。

---

## Phase 4 · 业务闭环

### 四条核心链路走查

- **链路 A（资产 → 快照 → 净值 → 洞察）**：`lib/date-shanghai.ts` 所有日期统一走上海时区，洞察页和 scatter 页的数据源均通过 `computeAllReturnMetrics` + `ensureFxUsdRatesForToday` 生成；缺行情 / 缺 FX / 缺快照时有 `reason` 字段标记。未见回归。
- **链路 B（成交 → 持仓 → 回报）**：`computeInvestmentReturnMetric` 已对 `buyCost > 0` 做守卫，卖出后 `sellProceeds` 回填为正值而非改分母，`cumulativeReturn` / `annualizedReturn` 逻辑正确。
- **链路 C（现金流水 & 资金来源）**：`appendCashMovement` / `updateCashLedgerEntry` / `deleteCashLedgerEntry` 全部经过 `applyCashLedgerReplay` 保持一致。**已修复**：`lib/backup-bundle.ts` 的 `mergeAsset` 在合并 `cashLedger` 后未重算 `value`，现在对 `usesCashAmountLedger` 资产会 `applyCashLedgerReplay`，确保合并导入后余额与流水一致。
- **链路 D（归档 / 回收站 / 备份 / 订阅限额）**：`canAddAnotherAsset` 只看主列表，归档 / 回收站不挤占额度，符合预期。**新增**：`settings-import.tsx` 导入后若最终资产数 > `FREE_ASSET_LIMIT` 且用户非 pro，弹窗提示；文案在双语字典中均已补齐。

### 产品决策（待你确认，不在本轮改动范围内）

- **回收站自动清理**：当前仅通过 `MAX_TRASH = 50` 限量，无 30 天过期自动清理。是否需要在启动时对回收站按 `at` 字段清理 > 30 天的项？（风险：误伤；优势：符合移动端常见心智。）
- **免费额度超出后行为**：目前导入后仅弹提示，超额资产仍保留在主列表。是否更严：超额资产自动移入回收站，或禁止新增快照？
- **备份加密**：现为明文 zip，用户可选。若未来需要端到端加密备份，需增加密码输入流程与密钥派生（PBKDF2 / Argon2id）。

---

## iOS App Store 提交前 Checklist

- [ ] `app.json` 的 `version` / `ios.buildNumber` 已更新。
- [ ] RevenueCat 控制台已配置 `nest_pro` Entitlement 并关联订阅商品。
- [ ] App Store Connect 年龄分级、图标（去除 alpha）、Launch Screen 已填写。
- [ ] 截图中不得包含真人财务数据。
- [ ] 隐私政策与使用条款 URL 在 `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` 已配置。
- [ ] Sandbox 账号已完成订阅购买 → 恢复购买 → 取消的全链路验证。
- [ ] 真机回归：添加资产 → 市场行情刷新 → 洞察 → 备份导出 → 导入合并 → 导入覆盖 → 回退 rollback。
- [ ] TestFlight 提交后检查是否仍有 ITMS-91053 / ITSAppUsesNonExemptEncryption 警告。

---

## Follow-up 清单（按优先级）

1. 大备份 sha256 迁移到后台线程，评估 `expo-crypto` 支持情况。
2. `lib/asset-daily-snapshots.ts` 分片 / 增量写方案调研（数据量到某阈值后）。
3. 回收站 30 天清理策略产品决策。
4. 翻译键覆盖剩余边角：`lib/asset-recycle.ts` 抛错文案、`formatRecycleTransactionSummary` 等非用户直接可见但可能通过 Alert 漏出的字符串。
5. Android 专属审查（内购、分享、权限清单）：iOS 上架稳定后启动。
