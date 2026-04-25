/**
 * 应用配色主题：默认「雾岛海盐」+ Coolors 扩展套系，ins 风命名。
 */

import type { AssetCategory } from '@/types/asset';

export const PALETTE_IDS = [
  'miami',
  'sea',
  'cotton_candy_romance',
  'monochrome_beach',
  'mountain_twilight',
  'berry_muse',
  'purple_rain_journal',
] as const;

export type AppPaletteId = (typeof PALETTE_IDS)[number];

export const DEFAULT_PALETTE_ID: AppPaletteId = 'miami';

/** 应用配色列表中展示「New!」角标的主题（可按上新节奏增删） */
export const PALETTE_OPTION_NEW_IDS: readonly AppPaletteId[] = [
  'purple_rain_journal',
];

export type AppPaletteTheme = {
  id: AppPaletteId;
  /** ins 风中文名 */
  nameZh: string;
  /** 设置页预览（与 Coolors 条顺序一致） */
  swatches: readonly [string, string, string, string, string];
  pageBg: string;
  /** 主文案 / Tab 选中 / FAB */
  primary: string;
  /** 大类色条与图表 */
  categoryAccents: Record<AssetCategory, string>;
  /** 文件夹下资产列表浅底 */
  folderListBg: string;
  /** 用途行点缀 */
  purposeAccent: string;
  /** 折线主色与面积渐变 */
  chartLine: string;
  chartFillTop: string;
  chartFillBottom: string;
  /** 目标进度环轮换 */
  goalRingColors: readonly string[];
  /** Tab 栏 */
  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  /** Insights 分布图描边/网格感 */
  chartGridStroke: string;
  /** Dashboard 深色舞台背景（顶部区域） */
  dashboardStageBg: string;
  /** 卡片、表单、图表白底（hex） */
  surfaceWhite: string;
  /** 上涨 / 净流入等 */
  statusPositive: string;
  /** 下跌 / 净流出等 */
  statusNegative: string;
  /** Dashboard / Insights 深色区大标题手写字体（如 Pacifico）；未设置则用斜体系统字 */
  dashboardHeroFontFamily?: string | null;
  /** Dashboard 等顶部次要操作按钮背景（参考图右上角色块；其他主题可与 primary 一致） */
  headerActionBg: string;
  /** 对应按钮上图标颜色 */
  headerActionIcon: string;
  /** 设置页等胶囊强调按钮背景 */
  ctaPillBg: string;
  ctaPillText: string;
};

const CATEGORY_ORDER: AssetCategory[] = [
  'Stock',
  'Fund',
  'ETF',
  'Cash',
  'Gold',
  'Custom',
];

function accentsFromSwatches(
  swatches: readonly string[]
): Record<AssetCategory, string> {
  const m = {} as Record<AssetCategory, string>;
  CATEGORY_ORDER.forEach((cat, i) => {
    m[cat] = swatches[i % swatches.length]!;
  });
  return m;
}

export const APP_PALETTE_THEMES: Record<AppPaletteId, AppPaletteTheme> = {
  miami: {
    id: 'miami',
    nameZh: '夏日余晖',
    /** 参考图左：珊瑚 / 橙 / 金黄 / 青绿 + 金色点缀 */
    swatches: ['#E07A7E', '#F28C28', '#F2C94C', '#1DB5A6', '#D4A843'],
    /** 底部文件框 / 口袋区奶油色 */
    pageBg: '#EDE4D0',
    /** 浅色区主文案（与参考图深蓝舞台对比） */
    primary: '#0C1B2A',
    categoryAccents: {
      Stock: '#E07A7E',
      Fund: '#F28C28',
      ETF: '#1DB5A6',
      Cash: '#F2C94C',
      Gold: '#D4A843',
      Custom: '#9B8FD9',
    },
    folderListBg: 'rgba(255, 253, 248, 0.9)',
    purposeAccent: '#E07A7E',
    chartLine: '#1DB5A6',
    chartFillTop: 'rgba(29, 181, 166, 0.18)',
    chartFillBottom: 'rgba(255, 255, 255, 0.028)',
    goalRingColors: ['#E07A7E', '#F28C28', '#1DB5A6', '#F2C94C'],
    tabBarBg: 'rgba(255, 253, 248, 0.96)',
    tabBarBorder: 'rgba(12, 27, 42, 0.08)',
    tabActive: '#0C1B2A',
    tabInactive: 'rgba(12, 27, 42, 0.34)',
    chartGridStroke: 'rgba(12, 27, 42, 0.08)',
    /** 参考图左上半深色海军舞台 */
    dashboardStageBg: '#001F3F',
    surfaceWhite: '#FFFDF8',
    statusPositive: '#1E8A62',
    statusNegative: '#D64545',
    dashboardHeroFontFamily: 'Pacifico_400Regular',
    /** 参考图右上角邮票感蓝块 */
    headerActionBg: '#1E6FD9',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F2C94C',
    ctaPillText: '#1E1B16',
  },

  /** Coolors「Colorful Daybreak」 */
  sea: {
    id: 'sea',
    nameZh: '午夜幻梦',
    swatches: ['#3D348B', '#7678ED', '#F7B801', '#F18701', '#F35B04'],
    pageBg: '#F5F3FC',
    primary: '#3D348B',
    categoryAccents: {
      Stock: '#7678ED',
      Fund: '#F7B801',
      ETF: '#F18701',
      Cash: '#F35B04',
      Gold: '#3D348B',
      /** 与 Stock 紫蓝区分：同系偏青绿，六类各一色 */
      Custom: '#3AB8A8',
    },
    folderListBg: 'rgba(255, 255, 255, 0.88)',
    purposeAccent: '#F18701',
    chartLine: '#7678ED',
    chartFillTop: 'rgba(118, 120, 237, 0.17)',
    chartFillBottom: 'rgba(255, 255, 255, 0.028)',
    goalRingColors: ['#7678ED', '#F7B801', '#F18701', '#F35B04'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(61, 52, 139, 0.1)',
    tabActive: '#3D348B',
    tabInactive: 'rgba(61, 52, 139, 0.38)',
    chartGridStroke: 'rgba(61, 52, 139, 0.09)',
    dashboardStageBg: '#3D348B',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#0A8F5A',
    statusNegative: '#D9480F',
    headerActionBg: '#7678ED',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F7B801',
    ctaPillText: '#3D348B',
  },

  /** Coolors「Ocean Sunset」 */
  cotton_candy_romance: {
    id: 'cotton_candy_romance',
    nameZh: '深海岛屿',
    swatches: ['#005F73', '#0A9396', '#94D2BD', '#EE9B00', '#CA6702'],
    pageBg: '#F2EDE6',
    primary: '#001219',
    categoryAccents: {
      Stock: '#005F73',
      Fund: '#0A9396',
      ETF: '#94D2BD',
      Cash: '#EE9B00',
      Gold: '#CA6702',
      Custom: '#BB3E03',
    },
    folderListBg: 'rgba(255, 252, 248, 0.9)',
    purposeAccent: '#EE9B00',
    chartLine: '#0A9396',
    chartFillTop: 'rgba(10, 147, 150, 0.15)',
    chartFillBottom: 'rgba(255, 255, 255, 0.036)',
    goalRingColors: ['#005F73', '#0A9396', '#EE9B00', '#CA6702'],
    tabBarBg: 'rgba(255, 252, 248, 0.95)',
    tabBarBorder: 'rgba(0, 18, 25, 0.1)',
    tabActive: '#001219',
    tabInactive: 'rgba(0, 18, 25, 0.38)',
    chartGridStroke: 'rgba(0, 18, 25, 0.08)',
    dashboardStageBg: '#001219',
    surfaceWhite: '#FFFCF8',
    statusPositive: '#0A9396',
    statusNegative: '#AE2012',
    headerActionBg: '#005F73',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#EE9B00',
    ctaPillText: '#001219',
  },

  /** Coolors「Watermelon Sorbet」 */
  monochrome_beach: {
    id: 'monochrome_beach',
    nameZh: '西瓜冰沙',
    swatches: ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'],
    pageBg: '#EEF8F6',
    primary: '#073B4C',
    categoryAccents: {
      Stock: '#118AB2',
      Fund: '#EF476F',
      ETF: '#06D6A0',
      Cash: '#FFD166',
      Gold: '#073B4C',
      /** 与 Stock 青蓝区分：偏紫罗兰，六类各一色 */
      Custom: '#7C6FD6',
    },
    folderListBg: 'rgba(255, 255, 255, 0.9)',
    purposeAccent: '#EF476F',
    chartLine: '#06D6A0',
    chartFillTop: 'rgba(6, 214, 160, 0.17)',
    chartFillBottom: 'rgba(255, 255, 255, 0.036)',
    goalRingColors: ['#EF476F', '#06D6A0', '#FFD166', '#118AB2'],
    tabBarBg: 'rgba(255, 255, 255, 0.95)',
    tabBarBorder: 'rgba(7, 59, 76, 0.1)',
    tabActive: '#073B4C',
    tabInactive: 'rgba(7, 59, 76, 0.36)',
    chartGridStroke: 'rgba(7, 59, 76, 0.08)',
    dashboardStageBg: '#073B4C',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#06D6A0',
    statusNegative: '#EF476F',
    headerActionBg: '#118AB2',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#FFD166',
    ctaPillText: '#073B4C',
  },

  /** Coolors「Rustic Charm」奶油 / 灰褐 / 炭灰 / 近黑 / 锈橙 — 硬朗精英向 */
  mountain_twilight: {
    id: 'mountain_twilight',
    nameZh: '锈岩冷调',
    swatches: ['#FFFCF2', '#CCC5B9', '#403D39', '#252422', '#EB5E28'],
    pageBg: '#FFFCF2',
    primary: '#252422',
    categoryAccents: {
      Stock: '#EB5E28',
      Fund: '#403D39',
      ETF: '#5C5854',
      Cash: '#252422',
      Gold: '#8A8580',
      Custom: '#C2410C',
    },
    folderListBg: 'rgba(255, 252, 242, 0.94)',
    purposeAccent: '#EB5E28',
    chartLine: '#EB5E28',
    chartFillTop: 'rgba(235, 94, 40, 0.18)',
    chartFillBottom: 'rgba(204, 197, 185, 0.22)',
    goalRingColors: ['#EB5E28', '#403D39', '#CCC5B9', '#252422'],
    tabBarBg: 'rgba(255, 252, 242, 0.97)',
    tabBarBorder: 'rgba(37, 36, 34, 0.1)',
    tabActive: '#252422',
    tabInactive: 'rgba(37, 36, 34, 0.4)',
    chartGridStroke: 'rgba(37, 36, 34, 0.08)',
    dashboardStageBg: '#252422',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#4A7C6B',
    statusNegative: '#B42318',
    headerActionBg: '#403D39',
    headerActionIcon: '#FFFCF2',
    ctaPillBg: '#EB5E28',
    ctaPillText: '#FFFCF2',
  },

  berry_muse: {
    id: 'berry_muse',
    nameZh: '莫奈花园',
    swatches: ['#F195B5', '#EAC1CF', '#F6D87A', '#C5D973', '#CBB6EF'],
    pageBg: '#FAF3ED',
    primary: '#4A273D',
    categoryAccents: accentsFromSwatches([
      '#D96B9C',
      '#EE97BA',
      '#B8D05F',
      '#C49FE2',
      '#F0CB60',
      '#B89FD4',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.84)',
    purposeAccent: '#D96B9C',
    chartLine: '#D96B9C',
    chartFillTop: 'rgba(217, 107, 156, 0.18)',
    chartFillBottom: 'rgba(255, 255, 255, 0.042)',
    goalRingColors: ['#D96B9C', '#EE97BA', '#B8D05F', '#F0CB60'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(74, 39, 61, 0.08)',
    tabActive: '#4A273D',
    tabInactive: 'rgba(74, 39, 61, 0.34)',
    chartGridStroke: 'rgba(74, 39, 61, 0.08)',
    dashboardStageBg: '#4A273D',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#4A273D',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F0CB60',
    ctaPillText: '#4A273D',
  },

  /** Coolors「blush」雾粉 → 灰紫 → 炭灰 */
  purple_rain_journal: {
    id: 'purple_rain_journal',
    nameZh: '暮色温柔',
    swatches: ['#F2B5CC', '#D7A3BB', '#C997B1', '#A38EA7', '#5E5E68'],
    pageBg: '#FAF4F7',
    primary: '#5E5E68',
    categoryAccents: accentsFromSwatches([
      '#A38EA7',
      '#C997B1',
      '#D7A3BB',
      '#8B7F95',
      '#5E5E68',
      '#B088A0',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.9)',
    purposeAccent: '#A38EA7',
    chartLine: '#A38EA7',
    chartFillTop: 'rgba(163, 142, 167, 0.22)',
    chartFillBottom: 'rgba(242, 181, 204, 0.14)',
    goalRingColors: ['#A38EA7', '#C997B1', '#D7A3BB', '#5E5E68'],
    tabBarBg: 'rgba(255, 252, 254, 0.96)',
    tabBarBorder: 'rgba(94, 94, 104, 0.1)',
    tabActive: '#5E5E68',
    tabInactive: 'rgba(94, 94, 104, 0.36)',
    chartGridStroke: 'rgba(94, 94, 104, 0.09)',
    dashboardStageBg: '#5E5E68',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#2F6B55',
    statusNegative: '#C41E3A',
    headerActionBg: '#5E5E68',
    headerActionIcon: '#F2B5CC',
    ctaPillBg: '#D7A3BB',
    ctaPillText: '#5E5E68',
  },
};

export function getPaletteTheme(id: AppPaletteId): AppPaletteTheme {
  return APP_PALETTE_THEMES[id] ?? APP_PALETTE_THEMES.sea;
}

export function isPaletteId(s: string): s is AppPaletteId {
  return (PALETTE_IDS as readonly string[]).includes(s);
}
