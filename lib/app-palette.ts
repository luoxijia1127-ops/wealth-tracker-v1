/**
 * 应用配色主题：默认「雾岛海盐」+ Coolors 扩展套系，ins 风命名。
 */

import type { AssetCategory } from '@/types/asset';

export const PALETTE_IDS = [
  'sea',
  'cotton_candy_romance',
  'monochrome_beach',
  'mountain_twilight',
  'berry_muse',
  'purple_rain_journal',
] as const;

export type AppPaletteId = (typeof PALETTE_IDS)[number];

export const DEFAULT_PALETTE_ID: AppPaletteId = 'sea';

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
  sea: {
    id: 'sea',
    nameZh: '雾岛海盐',
    swatches: ['#B1D4F8', '#98CCF8', '#5C6390', '#FAB8B4', '#B286B3'],
    pageBg: '#B1D4F8',
    primary: '#5C6390',
    categoryAccents: {
      Stock: '#5C6390',
      Fund: '#FAB8B4',
      ETF: '#98CCF8',
      Cash: '#B286B3',
      Gold: '#FAB8B4',
    },
    folderListBg: 'rgba(177, 212, 248, 0.45)',
    purposeAccent: '#B286B3',
    chartLine: '#5B8FE8',
    chartFillTop: 'rgba(91, 143, 232, 0.4)',
    chartFillBottom: 'rgba(255, 255, 255, 0.02)',
    goalRingColors: ['#5C6390', '#B286B3', '#98CCF8', '#FAB8B4'],
    tabBarBg: 'rgba(255, 255, 255, 0.92)',
    tabBarBorder: 'rgba(92, 99, 144, 0.12)',
    tabActive: '#5C6390',
    tabInactive: 'rgba(92, 99, 144, 0.45)',
    chartGridStroke: 'rgba(92, 99, 144, 0.12)',
  },

  cotton_candy_romance: {
    id: 'cotton_candy_romance',
    nameZh: '糖霜情书',
    swatches: ['#301A4B', '#6DB1BF', '#FFEAEC', '#F39A9D', '#3F6C51'],
    pageBg: '#FFEAEC',
    primary: '#301A4B',
    categoryAccents: accentsFromSwatches([
      '#301A4B',
      '#F39A9D',
      '#6DB1BF',
      '#3F6C51',
      '#F39A9D',
    ]),
    folderListBg: 'rgba(109, 177, 191, 0.28)',
    purposeAccent: '#6DB1BF',
    chartLine: '#6DB1BF',
    chartFillTop: 'rgba(109, 177, 191, 0.42)',
    chartFillBottom: 'rgba(255, 255, 255, 0.04)',
    goalRingColors: ['#301A4B', '#3F6C51', '#6DB1BF', '#F39A9D'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(48, 26, 75, 0.1)',
    tabActive: '#301A4B',
    tabInactive: 'rgba(48, 26, 75, 0.42)',
    chartGridStroke: 'rgba(48, 26, 75, 0.12)',
  },

  monochrome_beach: {
    id: 'monochrome_beach',
    nameZh: '独白海岸',
    swatches: ['#353535', '#3C6E71', '#FFFFFF', '#D9D9D9', '#284B63'],
    pageBg: '#E8EAEA',
    primary: '#284B63',
    categoryAccents: accentsFromSwatches([
      '#284B63',
      '#3C6E71',
      '#353535',
      '#3C6E71',
      '#284B63',
    ]),
    folderListBg: 'rgba(217, 217, 217, 0.65)',
    purposeAccent: '#3C6E71',
    chartLine: '#3C6E71',
    chartFillTop: 'rgba(60, 110, 113, 0.35)',
    chartFillBottom: 'rgba(255, 255, 255, 0.06)',
    goalRingColors: ['#284B63', '#3C6E71', '#353535', '#284B63'],
    tabBarBg: 'rgba(255, 255, 255, 0.95)',
    tabBarBorder: 'rgba(40, 75, 99, 0.14)',
    tabActive: '#284B63',
    tabInactive: 'rgba(40, 75, 99, 0.4)',
    chartGridStroke: 'rgba(40, 75, 99, 0.12)',
  },

  mountain_twilight: {
    id: 'mountain_twilight',
    nameZh: '暮色山脊',
    swatches: ['#3F477A', '#422B35', '#1E2243', '#755C75', '#3C1F21'],
    pageBg: '#ECEAEF',
    primary: '#1E2243',
    categoryAccents: accentsFromSwatches([
      '#3F477A',
      '#422B35',
      '#755C75',
      '#3C1F21',
      '#3F477A',
    ]),
    folderListBg: 'rgba(117, 92, 117, 0.22)',
    purposeAccent: '#755C75',
    chartLine: '#3F477A',
    chartFillTop: 'rgba(63, 71, 122, 0.38)',
    chartFillBottom: 'rgba(255, 255, 255, 0.04)',
    goalRingColors: ['#1E2243', '#3F477A', '#755C75', '#422B35'],
    tabBarBg: 'rgba(255, 255, 255, 0.93)',
    tabBarBorder: 'rgba(30, 34, 67, 0.12)',
    tabActive: '#1E2243',
    tabInactive: 'rgba(30, 34, 67, 0.38)',
    chartGridStroke: 'rgba(30, 34, 67, 0.12)',
  },

  berry_muse: {
    id: 'berry_muse',
    nameZh: '酒渍蔷薇',
    swatches: ['#861388', '#E15A97', '#EEABC4', '#C799A6', '#4B2840'],
    pageBg: '#FDF2F6',
    primary: '#4B2840',
    categoryAccents: accentsFromSwatches([
      '#861388',
      '#E15A97',
      '#C799A6',
      '#4B2840',
      '#E15A97',
    ]),
    folderListBg: 'rgba(238, 171, 196, 0.4)',
    purposeAccent: '#861388',
    chartLine: '#E15A97',
    chartFillTop: 'rgba(225, 90, 151, 0.38)',
    chartFillBottom: 'rgba(255, 255, 255, 0.06)',
    goalRingColors: ['#4B2840', '#861388', '#E15A97', '#C799A6'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(75, 40, 64, 0.12)',
    tabActive: '#4B2840',
    tabInactive: 'rgba(75, 40, 64, 0.4)',
    chartGridStroke: 'rgba(75, 40, 64, 0.11)',
  },

  purple_rain_journal: {
    id: 'purple_rain_journal',
    nameZh: '雾紫雨天',
    swatches: ['#6F2DBD', '#A663CC', '#B298DC', '#B8D0EB', '#B9FAF8'],
    pageBg: '#E8F4FA',
    primary: '#6F2DBD',
    categoryAccents: accentsFromSwatches([
      '#6F2DBD',
      '#A663CC',
      '#B298DC',
      '#B8D0EB',
      '#B9FAF8',
    ]),
    folderListBg: 'rgba(184, 208, 235, 0.55)',
    purposeAccent: '#A663CC',
    chartLine: '#6F2DBD',
    chartFillTop: 'rgba(111, 45, 189, 0.32)',
    chartFillBottom: 'rgba(255, 255, 255, 0.05)',
    goalRingColors: ['#6F2DBD', '#A663CC', '#B298DC', '#6F2DBD'],
    tabBarBg: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(111, 45, 189, 0.14)',
    tabActive: '#6F2DBD',
    tabInactive: 'rgba(111, 45, 189, 0.4)',
    chartGridStroke: 'rgba(111, 45, 189, 0.11)',
  },
};

export function getPaletteTheme(id: AppPaletteId): AppPaletteTheme {
  return APP_PALETTE_THEMES[id] ?? APP_PALETTE_THEMES.sea;
}

export function isPaletteId(s: string): s is AppPaletteId {
  return (PALETTE_IDS as readonly string[]).includes(s);
}
