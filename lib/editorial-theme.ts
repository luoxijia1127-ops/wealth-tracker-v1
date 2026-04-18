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
    rgbaFromHex(s[0]!, 0.55),
    rgbaFromHex(s[1]!, 0.45),
    rgbaFromHex(s[2]!, 0.35),
  ];
}

/** 铺在 pageBg 上的极淡主色 wash */
export function editorialAmbientWash(t: AppPaletteTheme): string {
  return rgbaFromHex(t.primary, 0.12);
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

/**
 * 大类折叠头整行底色（三列同色，无列缝）：收起为 accent 淡染，展开为纯色 accent。
 */
export function dashboardFolderHeaderBg(
  accentHex: string,
  expanded: boolean
): string {
  if (expanded) return accentHex;
  return rgbaFromHex(accentHex, 0.12);
}

/** 资产明细行整行底色（与列表区叠化）；accent 来自当前大类主题色 */
export function dashboardAssetRowBg(accentHex: string): string {
  return rgbaFromHex(accentHex, 0.1);
}
