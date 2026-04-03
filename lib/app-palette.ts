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
];

function accentsFromSwatches(
  swatches: readonly [string, string, string, string, string]
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
    nameZh: '迈阿密落日',
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
    },
    folderListBg: 'rgba(255, 253, 248, 0.9)',
    purposeAccent: '#E07A7E',
    chartLine: '#1DB5A6',
    chartFillTop: 'rgba(29, 181, 166, 0.24)',
    chartFillBottom: 'rgba(255, 255, 255, 0.04)',
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

  sea: {
    id: 'sea',
    nameZh: '雾岛海盐',
    swatches: ['#C8D8F5', '#F7B7C8', '#CFE7A4', '#F6DE78', '#8ECFD8'],
    pageBg: '#F7F3EA',
    primary: '#2F2A4A',
    categoryAccents: {
      Stock: '#7A6ACB',
      Fund: '#F08BB4',
      ETF: '#88C7D6',
      Cash: '#A8D667',
      Gold: '#F0C94E',
    },
    folderListBg: 'rgba(255, 255, 255, 0.82)',
    purposeAccent: '#F08BB4',
    chartLine: '#6F7FD7',
    chartFillTop: 'rgba(111, 127, 215, 0.24)',
    chartFillBottom: 'rgba(255, 255, 255, 0.02)',
    goalRingColors: ['#7A6ACB', '#F08BB4', '#88C7D6', '#F0C94E'],
    tabBarBg: 'rgba(255, 255, 255, 0.92)',
    tabBarBorder: 'rgba(47, 42, 74, 0.08)',
    tabActive: '#2F2A4A',
    tabInactive: 'rgba(47, 42, 74, 0.36)',
    chartGridStroke: 'rgba(47, 42, 74, 0.08)',
    dashboardStageBg: '#2F2A4A',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#2F2A4A',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F6DE78',
    ctaPillText: '#2F2A4A',
  },

  cotton_candy_romance: {
    id: 'cotton_candy_romance',
    nameZh: '糖霜情书',
    swatches: ['#F48DB7', '#F9C9D9', '#9FE0D5', '#F3DB78', '#C6B6F3'],
    pageBg: '#FBF3EE',
    primary: '#402044',
    categoryAccents: accentsFromSwatches([
      '#F08CB5',
      '#F4A7BD',
      '#8CD1C7',
      '#C7DA78',
      '#F3D46A',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.84)',
    purposeAccent: '#F08CB5',
    chartLine: '#D870A0',
    chartFillTop: 'rgba(216, 112, 160, 0.24)',
    chartFillBottom: 'rgba(255, 255, 255, 0.04)',
    goalRingColors: ['#F08CB5', '#8CD1C7', '#F3D46A', '#C6B6F3'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(64, 32, 68, 0.08)',
    tabActive: '#402044',
    tabInactive: 'rgba(64, 32, 68, 0.34)',
    chartGridStroke: 'rgba(64, 32, 68, 0.08)',
    dashboardStageBg: '#402044',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#402044',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F3D46A',
    ctaPillText: '#402044',
  },

  monochrome_beach: {
    id: 'monochrome_beach',
    nameZh: '独白海岸',
    swatches: ['#D8D0C8', '#C9DDD9', '#BFC8D6', '#EADFCB', '#A7B4C7'],
    pageBg: '#F4F0E7',
    primary: '#2E3138',
    categoryAccents: accentsFromSwatches([
      '#6E8197',
      '#7FA7A6',
      '#A39CA5',
      '#C9B8A2',
      '#D8C06E',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.86)',
    purposeAccent: '#7FA7A6',
    chartLine: '#6E8197',
    chartFillTop: 'rgba(110, 129, 151, 0.22)',
    chartFillBottom: 'rgba(255, 255, 255, 0.06)',
    goalRingColors: ['#6E8197', '#7FA7A6', '#C9B8A2', '#D8C06E'],
    tabBarBg: 'rgba(255, 255, 255, 0.95)',
    tabBarBorder: 'rgba(46, 49, 56, 0.08)',
    tabActive: '#2E3138',
    tabInactive: 'rgba(46, 49, 56, 0.34)',
    chartGridStroke: 'rgba(46, 49, 56, 0.08)',
    dashboardStageBg: '#2E3138',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#2E3138',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#EADFCB',
    ctaPillText: '#2E3138',
  },

  mountain_twilight: {
    id: 'mountain_twilight',
    nameZh: '暮色山脊',
    swatches: ['#AFA4D7', '#D6A9BA', '#B7CAE8', '#E8C79E', '#A7D0C3'],
    pageBg: '#F5F0EC',
    primary: '#2D2440',
    categoryAccents: accentsFromSwatches([
      '#7E73B9',
      '#C586A5',
      '#89AFDC',
      '#A3C89D',
      '#E3BB63',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.84)',
    purposeAccent: '#C586A5',
    chartLine: '#7E73B9',
    chartFillTop: 'rgba(126, 115, 185, 0.24)',
    chartFillBottom: 'rgba(255, 255, 255, 0.04)',
    goalRingColors: ['#7E73B9', '#C586A5', '#89AFDC', '#E3BB63'],
    tabBarBg: 'rgba(255, 255, 255, 0.93)',
    tabBarBorder: 'rgba(45, 36, 64, 0.08)',
    tabActive: '#2D2440',
    tabInactive: 'rgba(45, 36, 64, 0.34)',
    chartGridStroke: 'rgba(45, 36, 64, 0.08)',
    dashboardStageBg: '#2D2440',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#2D2440',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#E8C79E',
    ctaPillText: '#2D2440',
  },

  berry_muse: {
    id: 'berry_muse',
    nameZh: '酒渍蔷薇',
    swatches: ['#F195B5', '#EAC1CF', '#F6D87A', '#C5D973', '#CBB6EF'],
    pageBg: '#FAF3ED',
    primary: '#4A273D',
    categoryAccents: accentsFromSwatches([
      '#D96B9C',
      '#EE97BA',
      '#B8D05F',
      '#C49FE2',
      '#F0CB60',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.84)',
    purposeAccent: '#D96B9C',
    chartLine: '#D96B9C',
    chartFillTop: 'rgba(217, 107, 156, 0.24)',
    chartFillBottom: 'rgba(255, 255, 255, 0.06)',
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

  purple_rain_journal: {
    id: 'purple_rain_journal',
    nameZh: '雾紫雨天',
    swatches: ['#C7B7F2', '#E5B3D5', '#B9D8F2', '#BFE8DD', '#F4D97C'],
    pageBg: '#F6F2EC',
    primary: '#433160',
    categoryAccents: accentsFromSwatches([
      '#8E72D4',
      '#D38CBF',
      '#94BFE6',
      '#8ED7C8',
      '#F0CB67',
    ]),
    folderListBg: 'rgba(255, 255, 255, 0.86)',
    purposeAccent: '#8E72D4',
    chartLine: '#8E72D4',
    chartFillTop: 'rgba(142, 114, 212, 0.22)',
    chartFillBottom: 'rgba(255, 255, 255, 0.05)',
    goalRingColors: ['#8E72D4', '#D38CBF', '#94BFE6', '#F0CB67'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(67, 49, 96, 0.08)',
    tabActive: '#433160',
    tabInactive: 'rgba(67, 49, 96, 0.34)',
    chartGridStroke: 'rgba(67, 49, 96, 0.08)',
    dashboardStageBg: '#433160',
    surfaceWhite: '#FFFFFF',
    statusPositive: '#22A06B',
    statusNegative: '#DC2626',
    headerActionBg: '#433160',
    headerActionIcon: '#FFFFFF',
    ctaPillBg: '#F4D97C',
    ctaPillText: '#433160',
  },
};

export function getPaletteTheme(id: AppPaletteId): AppPaletteTheme {
  return APP_PALETTE_THEMES[id] ?? APP_PALETTE_THEMES.sea;
}

export function isPaletteId(s: string): s is AppPaletteId {
  return (PALETTE_IDS as readonly string[]).includes(s);
}
