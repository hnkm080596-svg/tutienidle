# Task 1.2 Brief — Theme CSS files (4 new themes)

## Where this fits

Task 1.2 of 36. Creates 4 CSS files (one per new theme) that override
CSS custom properties when `[data-theme="..."]` matches. Task 1.1 established
the `ThemeId` type — this task builds the CSS that makes theme switching work.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `54634f3` (after Task 1.1)

## Global constraints (binding)

- Stack: Vue 3 + TypeScript + Pinia + Phaser 4
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies
- 5 theme IDs: 'default' | 'ink-minimal' | 'landscape-shanshui' | 'xianxia-glow' | 'classical-imperial'
- Theme-overridable tokens: `--ink-*`, `--paper-*`, `--chrome-*`, `--frame-*`, `--surface-*`, `--font-*`
- Data tokens (DO NOT override): `--rank-*`, `--grade-*`, `--affix-*`, `--el-*`, `--scene-*-*`

## Interfaces produced (later tasks depend on)

CSS selectors: `[data-theme="ink-minimal"]`, `[data-theme="landscape-shanshui"]`,
`[data-theme="xianxia-glow"]`, `[data-theme="classical-imperial"]`

## Files

**Create:**
- `game/src/assets/themes/ink-minimal.css`
- `game/src/assets/themes/landscape-shanshui.css`
- `game/src/assets/themes/xianxia-glow.css`
- `game/src/assets/themes/classical-imperial.css`

**Modify:**
- `game/src/assets/theme.css` (line 10 — add font import for 4 new fonts)

## Implementation steps

### Step 1: Create ink-minimal.css

```css
/* game/src/assets/themes/ink-minimal.css
   Mặc họa tối giản — giấy trắng + mực đen, theo e-ink/paper style */

[data-theme="ink-minimal"] {
  --ink-950: #fdfbf7;
  --ink-900: #f5f0e8;
  --ink-800: #ebe3d2;
  --ink-700: #d9cfbb;
  --ink-line: #2a2924;
  --ink-line-soft: #8f897c;

  --paper-50: #fdfbf7;
  --paper-100: #f5f0e8;
  --paper-200: #ebe3d2;
  --paper-text: #1a1a1a;
  --paper-text-soft: #2a2924;
  --paper-text-muted: #5e5a50;
  --paper-eyebrow: #1a1a1a;
  --paper-line: rgba(26, 26, 26, 0.42);
  --paper-line-soft: rgba(26, 26, 26, 0.22);

  --text-primary: #1a1a1a;
  --text-secondary: #2a2924;
  --text-muted: #5e5a50;

  --chrome-100: #1a1a1a;
  --chrome-300: #2a2924;
  --chrome-500: #5e5a50;
  --chrome-700: #8f897c;

  --cinnabar: #8b1a1a;
  --jade: #4a8c6f;

  --frame-outer: #1a1a1a;
  --frame-inner: #2a2924;
  --frame-corner: #1a1a1a;

  --surface-950: #fdfbf7;
  --surface-900: #f5f0e8;
  --surface-800: #ebe3d2;
  --surface-700: #d9cfbb;
  --surface-600: #c4b89c;
  --surface-500: #b0a48a;
  --surface-line: #2a2924;
  --surface-line-soft: #8f897c;
  --surface-text: #1a1a1a;
  --surface-text-soft: #2a2924;
  --surface-text-muted: #5e5a50;
  --surface-eyebrow: #1a1a1a;
  --surface-drawer-bg:
    linear-gradient(180deg, var(--surface-900) 0%, var(--surface-950) 100%);
  --surface-panel-bg:
    linear-gradient(180deg, var(--surface-50) 0%, var(--surface-100) 100%);

  --font-display: 'Playfair Display', 'Noto Serif', Georgia, serif;
  --font-body: 'Be Vietnam Pro', system-ui, sans-serif;
}
```

### Step 2: Create landscape-shanshui.css

```css
/* game/src/assets/themes/landscape-shanshui.css
   Mặc họa phong cảnh — giấy kem + mực nâu, phong cách sơn thủy */

[data-theme="landscape-shanshui"] {
  --ink-950: #f0ebe0;
  --ink-900: #e6dcc8;
  --ink-800: #d8ccb0;
  --ink-700: #c5b694;
  --ink-line: #2c1810;
  --ink-line-soft: #6b5942;

  --paper-50: #f0ebe0;
  --paper-100: #e6dcc8;
  --paper-200: #d8ccb0;
  --paper-text: #2c1810;
  --paper-text-soft: #4a3424;
  --paper-text-muted: #6b5942;
  --paper-eyebrow: #8b1a1a;
  --paper-line: rgba(44, 24, 16, 0.42);
  --paper-line-soft: rgba(44, 24, 16, 0.22);

  --text-primary: #2c1810;
  --text-secondary: #4a3424;
  --text-muted: #6b5942;

  --chrome-100: #2c1810;
  --chrome-300: #4a3424;
  --chrome-500: #6b5942;
  --chrome-700: #8b6914;

  --cinnabar: #8b1a1a;
  --jade: #6b8e23;

  --frame-outer: #8b6914;
  --frame-inner: #d4a557;
  --frame-corner: #b79653;

  --surface-950: #f0ebe0;
  --surface-900: #e6dcc8;
  --surface-800: #d8ccb0;
  --surface-700: #c5b694;
  --surface-600: #b0a48a;
  --surface-500: #9c9078;
  --surface-line: #6b5942;
  --surface-line-soft: #8b8978;
  --surface-text: #2c1810;
  --surface-text-soft: #4a3424;
  --surface-text-muted: #6b5942;
  --surface-eyebrow: #8b6914;

  --font-display: 'Ma Shan Zheng', 'Noto Serif SC', serif;
  --font-body: 'Noto Sans TC', system-ui, sans-serif;
}
```

### Step 3: Create xianxia-glow.css

```css
/* game/src/assets/themes/xianxia-glow.css
   Tu tiên huyền ảo — nền tối tím + lam lục glow, rune particle */

[data-theme="xianxia-glow"] {
  --ink-950: #0d0a14;
  --ink-900: #14101e;
  --ink-800: #1c1626;
  --ink-700: #241c30;
  --ink-line: #5c3d8f;
  --ink-line-soft: #3a2858;

  --paper-50: #0d0a14;
  --paper-100: #14101e;
  --paper-200: #1c1626;
  --paper-text: #e8e0ff;
  --paper-text-soft: #b8a8e0;
  --paper-text-muted: #8878b0;
  --paper-eyebrow: #4a7b9d;
  --paper-line: rgba(92, 61, 143, 0.42);
  --paper-line-soft: rgba(92, 61, 143, 0.22);

  --text-primary: #e8e0ff;
  --text-secondary: #b8a8e0;
  --text-muted: #8878b0;

  --chrome-100: #e8e0ff;
  --chrome-300: #b8a8e0;
  --chrome-500: #8878b0;
  --chrome-700: #5c3d8f;

  --cinnabar: #c95e7a;
  --jade: #4ade80;

  --frame-outer: #5c3d8f;
  --frame-inner: #9b7de3;
  --frame-corner: #c9a8ff;

  --surface-950: #0d0a14;
  --surface-900: #14101e;
  --surface-800: #1c1626;
  --surface-700: #241c30;
  --surface-600: #2e2440;
  --surface-500: #382e50;
  --surface-line: #5c3d8f;
  --surface-line-soft: #3a2858;
  --surface-text: #e8e0ff;
  --surface-text-soft: #b8a8e0;
  --surface-text-muted: #8878b0;
  --surface-eyebrow: #4a7b9d;
  --surface-glow-gold: 0 0 18px rgba(155, 125, 227, 0.42);
  --surface-glow-jade: 0 0 16px rgba(74, 222, 128, 0.32);
  --surface-glow-crimson: 0 0 16px rgba(201, 94, 122, 0.42);

  --font-display: 'Noto Serif SC', 'Playfair Display', serif;
  --font-body: 'Noto Sans SC', system-ui, sans-serif;
}
```

### Step 4: Create classical-imperial.css

```css
/* game/src/assets/themes/classical-imperial.css
   Cổ điển Trung Hoa — đỏ son + vàng kim, hoa văn long phượng */

[data-theme="classical-imperial"] {
  --ink-950: #f5e6e0;
  --ink-900: #ecd6cc;
  --ink-800: #dec0b0;
  --ink-700: #c8a294;
  --ink-line: #8b1a1a;
  --ink-line-soft: #a6796a;

  --paper-50: #f5e6e0;
  --paper-100: #ecd6cc;
  --paper-200: #dec0b0;
  --paper-text: #2c0a0a;
  --paper-text-soft: #5c2a2a;
  --paper-text-muted: #8b4a4a;
  --paper-eyebrow: #8b1a1a;
  --paper-line: rgba(139, 26, 26, 0.42);
  --paper-line-soft: rgba(139, 26, 26, 0.22);

  --text-primary: #2c0a0a;
  --text-secondary: #5c2a2a;
  --text-muted: #8b4a4a;

  --chrome-100: #d4a017;
  --chrome-300: #b8860b;
  --chrome-500: #8b6914;
  --chrome-700: #5c4a0a;

  --cinnabar: #8b1a1a;
  --jade: #6b8e23;

  --frame-outer: #8b1a1a;
  --frame-inner: #d4a017;
  --frame-corner: #ffd54f;

  --surface-950: #f5e6e0;
  --surface-900: #ecd6cc;
  --surface-800: #dec0b0;
  --surface-700: #c8a294;
  --surface-600: #b08878;
  --surface-500: #987060;
  --surface-line: #8b1a1a;
  --surface-line-soft: #a6796a;
  --surface-text: #2c0a0a;
  --surface-text-soft: #5c2a2a;
  --surface-text-muted: #8b4a4a;
  --surface-eyebrow: #8b1a1a;

  --font-display: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  --font-body: 'Noto Sans TC', system-ui, sans-serif;
}
```

### Step 5: Update theme.css font import

Read `game/src/assets/theme.css`, find the existing `@import` line (line ~10), and
REPLACE the font import with the expanded version that includes the 4 new fonts.

The existing line is:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500;1,600&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
```

Replace it with:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500;1,600&family=Be+Vietnam+Pro:wght@400;500;600;700&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+TC:wght@400;500&family=ZCOOL+XiaoWei&display=swap');
```

### Step 6: Run typecheck

Run: `npm.cmd run type-check`
Expected: PASS

### Step 7: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/assets/themes/ game/src/assets/theme.css
git commit -m "feat(theme): add 4 theme CSS files (ink-minimal/shanshui/xianxia/imperial)"
```

## Report contract

Write a report to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-2-report.md`

Return to me ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Any concerns

Do NOT paste the full file contents back. Do NOT dispatch any subagents. Begin.