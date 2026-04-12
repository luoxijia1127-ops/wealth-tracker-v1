# High-End Editorial Design System: The Digital Curator

## 1. Overview & Creative North Star
The "Creative North Star" of this design system is **The Digital Curator**. This system moves away from the clinical, modular feel of standard SaaS products and into the realm of high-fashion editorial. It treats every screen as a curated gallery piece, where the "Colorful Daybreak" palette serves as bold, structural art within a deep, immersive dark-mode canvas.

By leveraging **intentional asymmetry**, we break the rigid 12-column grid. Large "Bento-Box" layouts are used to group information not just for utility, but for visual impact, utilizing overlapping typography and "glass" surfaces to create a sense of three-dimensional depth. The goal is to make the user feel they are flipping through a premium digital magazine, where every interaction is deliberate and every transition is fluid.

---

## 2. Colors
The palette transitions from the deep, nocturnal void of the background into the vibrant, energetic hues of a morning horizon.

### The Palette (Material Design Tokens)
- **Background (`#0e004f`):** A deep, midnight purple that provides more soul than pure black.
- **Primary / Lavender (`#c1c1ff`):** Used for primary actions and high-level focus.
- **Secondary / Golden Yellow (`#ffd88a` / `#f5b700`):** Reserved for highlights, critical callouts, and premium accents.
- **Tertiary / Warm & Vibrant Orange (`#ffb599` / `#f35b04`):** Used to inject heat and energy into large bento blocks.

### Core Visual Principles
- **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined through background color shifts. For example, a `surface-container-low` section sits directly on the `surface` background to create a "soft edge."
- **Surface Hierarchy & Nesting:** Treat the UI as stacked sheets of frosted glass. Use `surface-container-lowest` to `highest` to create nested depth. An inner card should always be one tier "higher" (brighter/more translucent) than its parent container to define its importance.
- **Signature Textures:** Avoid flat color blocks. Use subtle linear gradients (e.g., `primary` to `primary-container`) on large bento elements to provide a "chromatic" glow that mimics the refraction of light through glass.

---

## 3. Typography
The system uses a high-contrast pairing to balance heritage with modernity.

- **Display & Headlines (Newsreader):** This serif font is our editorial voice. It should be used with tight letter-spacing and varied weights to create an "authoritative" feel. Use `display-lg` (3.5rem) for hero statements to command attention.
- **Body & Labels (Manrope):** A clean, geometric sans-serif that ensures high readability against dark, vibrant backgrounds.
- **The Hierarchy Strategy:** Headlines should feel "oversized" compared to body text. This dramatic scale shift is what creates the high-fashion editorial aesthetic.

---

## 4. Elevation & Depth
Elevation is communicated through **Tonal Layering** and light physics, not drop-shadows.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift.
- **Glassmorphism:** For floating elements (menus, tooltips, or top-tier bento blocks), use `backdrop-blur: 20px` combined with a semi-transparent surface color. This allows the "Colorful Daybreak" accents to bleed through the UI, softening the edges.
- **Ambient Shadows:** If a shadow is required for a high-floating element, it must be extra-diffused. Use a 40px–60px blur at 6% opacity. The shadow color should be a tinted version of the background (`#0e004f`), never pure black.
- **The "Ghost Border":** For accessibility on interactive inputs, use the `outline-variant` token at 15% opacity. High-contrast, 100% opaque borders are forbidden.

---

## 5. Components

### Large Bento-Box Blocks
These are the signature of the system. Each block should use one of the "Daybreak" accent colors (`Deep Purple`, `Lavender`, `Golden Yellow`, or `Vibrant Orange`) as a subtle background glow or a high-contrast header. Blocks should have a `xl` (1.5rem) corner radius to feel approachable yet modern.

### Buttons
- **Primary:** High-gloss `primary` color with `on-primary` (dark) text. No borders.
- **Secondary:** Glassmorphic fill (low-opacity white/lavender) with `backdrop-blur`.
- **Tertiary:** Newsreader serif text with a `secondary_container` underline that expands on hover.

### Inputs & Fields
Forbid standard boxes. Use a "bottom-line only" approach or a very subtle `surface-container-high` fill with no border. Errors are shown using the `error` (`#ffb4ab`) token as a soft outer glow rather than a harsh red box.

### Cards & Lists
Vertical whitespace (from the spacing scale) is the primary separator. Forbid the use of divider lines. If a separation is required, shift the background color of alternating list items by one `surface-container` tier.

### Signature Component: The Curator Chip
Small, high-contrast chips using `secondary` (Golden Yellow) backgrounds with `on-secondary` (Dark) text. These should be used for categories or tags, floating slightly above bento content.

---

## 6. Do's and Don'ts

### Do:
- **Do** overlap elements. Let a Newsreader headline spill slightly over the edge of a bento-box to create depth.
- **Do** use the "Daybreak" colors as light sources. Treat them as if they are glowing from behind the UI.
- **Do** embrace negative space. In editorial design, what you leave out is as important as what you put in.

### Don't:
- **Don't** use 1px solid dividers or high-contrast borders. It breaks the "glass and light" illusion.
- **Don't** use pure black or pure white. Use the `surface` and `on-surface` tokens to maintain the deep purple tonal depth.
- **Don't** crowd the bento blocks. If a block feels full, move content to a new layer or use a glassmorphic modal.

---

## 7. 与本 App「应用配色」的对应（实现说明）

设计稿中的固定 hex（如 `#0e004f`）在代码中**不单独写死为全局背景**，而是映射到用户可选的 `AppPaletteTheme`：

| 设计概念 | 代码侧来源 |
|----------|------------|
| 深底画布 / 页面底 | `pageBg` |
| 主文字与强调 | `primary` |
| 大色块 / Bento 点缀 | `swatches[]`、`categoryAccents`、`goalRingColors` |
| 玻璃卡片上的「白区」 | `surfaceWhite`（经 `editorialSurfaceFill()` 做透明度） |
| 主按钮 / 胶囊 CTA | `ctaPillBg` / `ctaPillText`（与设置页「会员」等一致） |
| 装饰色圆形 blob | `editorialDecorBlobs(theme)`，取自当前主题的 `swatches` |

新增辅助模块：`lib/editorial-theme.ts`。标题展示字体：**Newsreader**（`AppFont.displayBold` / `displaySemiBold`）；正文仍为 **Inter**。

`GlassSurface` 支持 `variant="editorial"`：去掉 1px 描边，仅靠模糊 + 柔和阴影分层。

---

## 8. 未单独出稿的页面

凡无参考图的 Stack / 设置子页 / 市场等，沿用同一套：**pageBg + 淡主色氛围层 + 大圆角玻璃/色块 + 无实线分割列表**（表格用行交替底色代替分割线）。