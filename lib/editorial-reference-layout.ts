/**
 * 与 design.json「Daybreak Editorial」及 docs/desigh/reference 一致：
 * 从 AppPaletteTheme 派生色块角色，供分屏、masthead、竖条等布局使用。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';

export type MagazineBlockSet = {
  blockA: string;
  blockB: string;
  blockC: string;
  blockD: string;
  blockMuted: string;
  ink: string;
  canvas: string;
};

export function magazineBlocks(t: AppPaletteTheme): MagazineBlockSet {
  const s = t.swatches;
  return {
    blockA: s[0]!,
    blockB: s[1]!,
    blockC: s[2]!,
    blockD: s[3]!,
    blockMuted: rgbaFromHex(t.primary, 0.06),
    ink: t.primary,
    canvas: t.pageBg,
  };
}

/** 色块上的主文字色（深底浅字 / 浅底深字） */
export function magazineStrongOnBlock(bg: string): string {
  const on = pickTextOnAccent(bg);
  return on === '#FFFFFF' ? '#FFFFFF' : '#141414';
}
