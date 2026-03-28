# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## 资产与行情 — 唯一数据源说明（wealth-tracker）

| 用途 | 位置 |
|------|------|
| **资产类型与字段** | `types/asset.ts`（`SimpleAsset`、`AssetCategory`） |
| **业务「今天」日期** | `lib/date-shanghai.ts`（上海时区 `YYYY-MM-DD`，与 UTC 的 `toISOString` 不同） |
| **东方财富公共参数** | `lib/eastmoney-config.ts` |
| **secid 构造 / QuoteID 推断** | `lib/eastmoney-secid.ts` |
| **添加资产表单校验与组装** | `lib/add-asset-form.ts` |
| **可选资产币种（非场内）** | `lib/asset-currency.ts` |

Dashboard 与 Tab 场景底色采用 **sea** 色板：`#B1D4F8` 雾蓝底、`#98CCF8` 天蓝、`#FAB8B4` 珊瑚、`#5C6390` 靛灰（主文案/强调）、`#B286B3` 灰紫；类别条与 `app/(tabs)/index.tsx` 中 `SEA` 常量一致。

- **`markPrice`**：push2 最新价（盘中）。**`lastClose`**：日 K 结算价。市值优先用 `markPrice`。
- **场外开放式基金**：联想里 `Classify=OTCFUND`，存 `exchange: 'OTC'`；`emSecid` 多为 `150.xxxxxx`。刷新估值时走 `lib/eastmoney-fund-nav.ts`（F10 `lsjz` 单位净值），因 push2 对基金常无有效现价。
- 旧的 `lib/asset-types.ts` 已删除，请勿再引用另一套 `Asset` 类型。

## 工程结构（简要）

| 路径 | 说明 |
|------|------|
| `app/` | Expo Router 页面与路由 |
| `components/` | 可复用 UI（含 `insights/*`、`add-asset/*`） |
| `lib/` | 业务逻辑；`lib/config/endpoints.ts` 集中外部 API 地址（可用 `EXPO_PUBLIC_*` 覆盖） |
| `lib/repositories/asset-repository.ts` | 资产读写薄封装，默认委托 `asset-storage` |
| `lib/errors/app-error.ts` | 统一错误与用户文案（可逐步接入） |
| `types/asset.ts` | 资产数据模型 |

## 脚本

```bash
npm install
npm run lint      # ESLint（Expo）
npm run test      # Vitest（纯函数单测）
npx expo start    # 开发服务
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
