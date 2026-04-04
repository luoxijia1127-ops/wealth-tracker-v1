/** 将 #RRGGBB 转为 rgba()，供主题衍生文案色 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) {
    return { r: 92, g: 99, b: 144 };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** sRGB 相对亮度 0–1，用于判断背景上宜用深字还是浅字 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** 彩色按钮/标签上可读的主文字色（深底白字 / 浅底深字） */
export function pickTextOnAccent(accentHex: string): '#FFFFFF' | '#14161C' {
  return relativeLuminance(accentHex) > 0.52 ? '#14161C' : '#FFFFFF';
}
