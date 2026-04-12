/**
 * 杂志风 / Bento 视觉辅助：从当前 AppPaletteTheme 派生色块与氛围，
 * 不固定为 design.md 中的单套 hex，以保留「应用配色」切换。
 */

import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';

/** 背景装饰色块（与 swatches 顺序对应，透明度略不同） */
export function editorialDecorBlobs(t: AppPaletteTheme): string[] {
  const s = t.swatches;
  return [
    rgbaFromHex(s[0]!, 0.42),
    rgbaFromHex(s[1]!, 0.34),
    rgbaFromHex(s[2]!, 0.28),
  ];
}

/** 铺在 pageBg 上的极淡主色 wash */
export function editorialAmbientWash(t: AppPaletteTheme): string {
  return rgbaFromHex(t.primary, 0.055);
}

/** 表单/列表「无描边」表面：由 surfaceWhite 派生 */
export function editorialSurfaceFill(
  t: AppPaletteTheme,
  alpha: number
): string {
  return rgbaFromHex(t.surfaceWhite, alpha);
}

/** 主 CTA：与设置里胶囊一致，随主题变 */
export function editorialPrimaryButtonBg(t: AppPaletteTheme): string {
  return t.ctaPillBg;
}

export function editorialPrimaryButtonText(t: AppPaletteTheme): string {
  return t.ctaPillText;
}

/** 表格行交替底色 */
export function editorialTableRowAlt(t: AppPaletteTheme): string {
  return rgbaFromHex(t.primary, 0.045);
}
