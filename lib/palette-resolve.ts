/**
 * 结合用户选择的 palette id 与系统浅色/深色，解析最终 `AppPaletteTheme`。
 */

import { APP_PALETTE_THEMES_DARK } from '@/lib/app-palette-dark';
import {
  APP_PALETTE_THEMES,
  type AppPaletteId,
  type AppPaletteTheme,
} from '@/lib/app-palette';

export function resolvePaletteTheme(
  id: AppPaletteId,
  appearance: 'light' | 'dark'
): AppPaletteTheme {
  const light = APP_PALETTE_THEMES[id] ?? APP_PALETTE_THEMES.sea;
  if (appearance === 'dark') {
    return APP_PALETTE_THEMES_DARK[id] ?? light;
  }
  return light;
}

/** `useColorScheme()` 可能为 null，统一视为浅色 */
export function appearanceFromColorScheme(
  scheme: string | null | undefined
): 'light' | 'dark' {
  return scheme === 'dark' ? 'dark' : 'light';
}
