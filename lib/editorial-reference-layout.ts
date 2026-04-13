/**
 * 与 design.json「Daybreak Editorial」及 docs/desigh/reference 一致：
 * 从 AppPaletteTheme 派生色块角色，供分屏、masthead、竖条等布局使用。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';

export type MagazineBlockSet = {
  blockA: string;
  blockB: string;
  blockC: string;
  blockD: string;
  blockMuted: string;
  ink: string;
  inkSoft: string;
  canvas: string;
};

export function magazineBlocks(t: AppPaletteTheme): MagazineBlockSet {
  const s = t.swatches;
  return {
    blockA: rgbaFromHex(s[1] ?? t.categoryAccents.Fund ?? t.primary, 0.35),
    blockB: rgbaFromHex(s[2] ?? t.categoryAccents.ETF ?? t.primary, 0.25),
    blockC: rgbaFromHex(s[3] ?? t.categoryAccents.Cash ?? t.primary, 0.2),
    blockD: rgbaFromHex(s[4] ?? t.categoryAccents.Gold ?? t.primary, 0.3),
    blockMuted: rgbaFromHex(t.primary, 0.05),
    ink: t.primary,
    inkSoft: rgbaFromHex(t.primary, 0.68),
    canvas: t.pageBg,
  };
}

/** 色块上的主文字色（浅色柔和块面上统一用深色 ink） */
export function magazineStrongOnBlock(t: AppPaletteTheme): string {
  return t.primary;
}
