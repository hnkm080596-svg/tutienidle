# Tu Tiên Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống 4 phong cách mỹ thuật (mặc họa tối giản, mặc họa phong cảnh, tu tiên huyền ảo, cổ điển Trung Hoa) + giữ theme `default` (ink-wash dark hiện tại), với theme switcher trong Settings, áp dụng đồng bộ Vue UI + Phaser scenes.

**Architecture:** Token-based CSS theme system với `<html data-theme="...">` cascade. Pinia store quản lý theme state + persist localStorage. 4 file CSS override theme-overridable tokens; data tokens (rank/grade/affix) giữ nguyên. Phaser bridge re-tint scene objects khi theme đổi.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Phaser 4 + Vite + Vitest

**Spec:** `docs/superpowers/specs/2026-08-31-tu-tien-theme-redesign.md`

## Global Constraints

- Stack: Vue 3 + TypeScript + Pinia + Phaser 4 (đã có trong project)
- KHÔNG dùng `any` nếu không cần thiết
- KHÔNG thay đổi architecture ngoài task scope
- KHÔNG thêm dependencies mới
- Ưu tiên sửa code hiện tại thay vì viết lại
- Data tokens (rank/grade/affix/ngũ hành) KHÔNG đổi theo theme
- Phaser textures KHÔNG swap runtime — chỉ `.setTint()`
- 5 theme: `default`, `ink-minimal`, `landscape-shanshui`, `xianxia-glow`, `classical-imperial`

---

## Phase 1: Foundation — Core theme system

### Task 1.1: Định nghĩa theme type và theme registry

**Files:**
- Create: `game/src/assets/themes/types.ts`
- Create: `game/src/assets/themes/index.ts`
- Test: `game/src/assets/themes/index.test.ts`

**Interfaces:**
- Consumes: (none — base types)
- Produces: `export type ThemeId = 'default' | 'ink-minimal' | 'landscape-shanshui' | 'xianxia-glow' | 'classical-imperial'`, `export interface ThemeDefinition { id, label, preview }`, `export const THEME_REGISTRY: ReadonlyArray<ThemeDefinition>`

- [ ] **Step 1: Write failing test**

```typescript
// game/src/assets/themes/index.test.ts
import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, type ThemeId } from './index'

describe('theme registry', () => {
  it('contains 5 themes', () => {
    expect(THEME_REGISTRY).toHaveLength(5)
  })

  it('all themes have unique id', () => {
    const ids = THEME_REGISTRY.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('default theme is first', () => {
    expect(THEME_REGISTRY[0]?.id).toBe('default')
  })

  it('every theme has label and preview svg data', () => {
    for (const theme of THEME_REGISTRY) {
      expect(theme.label).toBeTruthy()
      expect(theme.preview).toMatch(/^data:image\/svg\+xml/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/assets/themes/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

- [ ] **Step 3: Write theme types file**

```typescript
// game/src/assets/themes/types.ts
export type ThemeId =
  | 'default'
  | 'ink-minimal'
  | 'landscape-shanshui'
  | 'xianxia-glow'
  | 'classical-imperial'

export interface ThemeDefinition {
  readonly id: ThemeId
  readonly label: string
  /** Inline SVG data URL for preview card (160x100) */
  readonly preview: string
}
```

- [ ] **Step 4: Write theme registry file**

```typescript
// game/src/assets/themes/index.ts
import type { ThemeDefinition, ThemeId } from './types'

export type { ThemeId, ThemeDefinition }

const previewSvg = (bg: string, accent: string, label: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">
    <rect width="160" height="100" fill="${bg}"/>
    <rect x="20" y="30" width="120" height="20" fill="${accent}" rx="2"/>
    <text x="80" y="70" text-anchor="middle" font-family="serif" font-size="14" fill="${accent}">${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const THEME_REGISTRY: ReadonlyArray<ThemeDefinition> = [
  {
    id: 'default',
    label: 'Mặc họa (mặc định)',
    preview: previewSvg('#08080c', '#d4a557', 'Mặc họa'),
  },
  {
    id: 'ink-minimal',
    label: 'Mặc họa tối giản',
    preview: previewSvg('#fdfbf7', '#1a1a1a', 'Tối giản'),
  },
  {
    id: 'landscape-shanshui',
    label: 'Mặc họa phong cảnh',
    preview: previewSvg('#f0ebe0', '#2c1810', 'Phong cảnh'),
  },
  {
    id: 'xianxia-glow',
    label: 'Tu tiên huyền ảo',
    preview: previewSvg('#0d0a14', '#5c3d8f', 'Huyền ảo'),
  },
  {
    id: 'classical-imperial',
    label: 'Cổ điển Trung Hoa',
    preview: previewSvg('#f5e6e0', '#8b1a1a', 'Trung Hoa'),
  },
]

export const getTheme = (id: ThemeId): ThemeDefinition | undefined =>
  THEME_REGISTRY.find(t => t.id === id)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/assets/themes/index.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add game/src/assets/themes/
git commit -m "feat(theme): add theme registry with 5 themes"
```

---

### Task 1.2: Tạo theme CSS files (4 mới)

**Files:**
- Create: `game/src/assets/themes/ink-minimal.css`
- Create: `game/src/assets/themes/landscape-shanshui.css`
- Create: `game/src/assets/themes/xianxia-glow.css`
- Create: `game/src/assets/themes/classical-imperial.css`
- Modify: `game/src/assets/theme.css` (thêm font import + comment block)

**Interfaces:**
- Consumes: theme tokens từ `theme.css` root
- Produces: 4 file CSS, mỗi file override token khi `[data-theme="..."]` match

- [ ] **Step 1: Tạo ink-minimal.css**

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

- [ ] **Step 2: Tạo landscape-shanshui.css**

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

- [ ] **Step 3: Tạo xianxia-glow.css**

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

- [ ] **Step 4: Tạo classical-imperial.css**

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

- [ ] **Step 5: Update theme.css — thêm font import cho 4 style mới**

Modify `game/src/assets/theme.css` line 10 (font import):

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500;1,600&family=Be+Vietnam+Pro:wght@400;500;600;700&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+TC:wght@400;500&family=ZCOOL+XiaoWei&display=swap');
```

- [ ] **Step 6: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add game/src/assets/themes/ game/src/assets/theme.css
git commit -m "feat(theme): add 4 theme CSS files (ink-minimal/shanshui/xianxia/imperial)"
```

---

### Task 1.3: Tạo theme Pinia store với persistence

**Files:**
- Create: `game/src/stores/themeStore.ts`
- Test: `game/src/stores/themeStore.test.ts`

**Interfaces:**
- Consumes: `ThemeId` từ `assets/themes`
- Produces: `useThemeStore()` Pinia store với `currentTheme`, `setTheme(id)`, persist localStorage

- [ ] **Step 1: Write failing test**

```typescript
// game/src/stores/themeStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from './themeStore'
import type { ThemeId } from '@/assets/themes'

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to "default" theme', () => {
    const store = useThemeStore()
    expect(store.currentTheme).toBe('default')
  })

  it('setTheme updates currentTheme', () => {
    const store = useThemeStore()
    store.setTheme('ink-minimal' as ThemeId)
    expect(store.currentTheme).toBe('ink-minimal')
  })

  it('setTheme persists to localStorage', () => {
    const store = useThemeStore()
    store.setTheme('xianxia-glow' as ThemeId)
    expect(localStorage.getItem('theme')).toBe('xianxia-glow')
  })

  it('rejects unknown theme ids', () => {
    const store = useThemeStore()
    // @ts-expect-error testing invalid input
    store.setTheme('unknown-theme')
    expect(store.currentTheme).toBe('default')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/stores/themeStore.test.ts`
Expected: FAIL with "Cannot find module './themeStore'"

- [ ] **Step 3: Write theme store**

```typescript
// game/src/stores/themeStore.ts
import { defineStore } from 'pinia'
import { THEME_REGISTRY, type ThemeId } from '@/assets/themes'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'default'

const isValidTheme = (id: string): id is ThemeId =>
  THEME_REGISTRY.some(t => t.id === id)

const readPersisted = (): ThemeId => {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && isValidTheme(stored) ? stored : DEFAULT_THEME
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    currentTheme: readPersisted(),
  }),
  actions: {
    setTheme(id: ThemeId) {
      if (!isValidTheme(id)) return
      this.currentTheme = id
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, id)
      }
      this.applyToDocument()
    },
    applyToDocument() {
      if (typeof document === 'undefined') return
      document.documentElement.setAttribute('data-theme', this.currentTheme)
    },
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/stores/themeStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/stores/themeStore.ts game/src/stores/themeStore.test.ts
git commit -m "feat(theme): add themeStore Pinia with localStorage persistence"
```

---

### Task 1.4: Tạo useTheme composable

**Files:**
- Create: `game/src/composables/useTheme.ts`
- Test: `game/src/composables/useTheme.test.ts`

**Interfaces:**
- Consumes: `useThemeStore` từ `stores/themeStore`
- Produces: `useTheme()` returns `{ currentTheme, setTheme, themes }`

- [ ] **Step 1: Write failing test**

```typescript
// game/src/composables/useTheme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from './useTheme'

describe('useTheme composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes currentTheme from store', () => {
    const store = useThemeStore()
    store.setTheme('ink-minimal')
    const { currentTheme } = useTheme()
    expect(currentTheme.value).toBe('ink-minimal')
  })

  it('exposes all 5 themes', () => {
    const { themes } = useTheme()
    expect(themes).toHaveLength(5)
  })

  it('setTheme is a passthrough to store', () => {
    const { setTheme, currentTheme } = useTheme()
    setTheme('classical-imperial')
    expect(currentTheme.value).toBe('classical-imperial')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/composables/useTheme.test.ts`
Expected: FAIL with "Cannot find module './useTheme'"

- [ ] **Step 3: Write useTheme composable**

```typescript
// game/src/composables/useTheme.ts
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { THEME_REGISTRY, type ThemeId } from '@/assets/themes'

export const useTheme = () => {
  const store = useThemeStore()

  return {
    currentTheme: computed(() => store.currentTheme),
    themes: THEME_REGISTRY,
    setTheme: (id: ThemeId) => store.setTheme(id),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/composables/useTheme.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/composables/useTheme.ts game/src/composables/useTheme.test.ts
git commit -m "feat(theme): add useTheme composable"
```

---

### Task 1.5: Mount theme on app startup

**Files:**
- Modify: `game/src/App.vue` (or `game/src/main.ts` — find root component)
- Read first to determine.

**Interfaces:**
- Consumes: `useThemeStore` từ `stores/themeStore`
- Produces: Khi app mount, `<html data-theme="...">` đã set trước khi render

- [ ] **Step 1: Tìm root component**

Run: `Get-ChildItem game/src -Filter "App.vue"` → `E:\tutienidle\game\src\App.vue` (hoặc `main.ts`)

- [ ] **Step 2: Modify App.vue để call applyToDocument on mount**

Tìm phần `<script setup>` của App.vue. Thêm:

```typescript
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()
onMounted(() => themeStore.applyToDocument())
```

- [ ] **Step 3: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 4: Manual test**

Run: `npm.cmd run dev`, mở DevTools, type `document.documentElement.getAttribute('data-theme')` — phải trả về `"default"`.

- [ ] **Step 5: Commit**

```bash
git add game/src/App.vue (or main.ts)
git commit -m "feat(theme): apply theme to document on app mount"
```

---

### Task 1.6: Tạo ThemeSwitcher.vue component

**Files:**
- Create: `game/src/components/settings/ThemeSwitcher.vue`
- Test: `game/src/components/settings/ThemeSwitcher.test.ts`

**Interfaces:**
- Consumes: `useTheme()` composable
- Produces: Component render 5 preview cards, click → setTheme

- [ ] **Step 1: Write failing test**

```typescript
// game/src/components/settings/ThemeSwitcher.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'  // adjust if project doesn't use vue-i18n
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useThemeStore } from '@/stores/themeStore'

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders 5 theme cards', () => {
    const wrapper = mount(ThemeSwitcher)
    const cards = wrapper.findAll('[data-testid="theme-card"]')
    expect(cards).toHaveLength(5)
  })

  it('clicking a card calls setTheme', async () => {
    const store = useThemeStore()
    const wrapper = mount(ThemeSwitcher)
    const card = wrapper.findAll('[data-testid="theme-card"]')[2]  // xianxia-glow
    await card?.trigger('click')
    expect(store.currentTheme).toBe('xianxia-glow')
  })

  it('marks current theme card as selected', () => {
    const store = useThemeStore()
    store.setTheme('landscape-shanshui')
    const wrapper = mount(ThemeSwitcher)
    const selected = wrapper.findAll('[data-testid="theme-card"][data-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.attributes('data-theme-id')).toBe('landscape-shanshui')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/components/settings/ThemeSwitcher.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write ThemeSwitcher component**

```vue
<!-- game/src/components/settings/ThemeSwitcher.vue -->
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { currentTheme, themes, setTheme } = useTheme()
</script>

<template>
  <div class="theme-switcher" data-testid="theme-switcher">
    <div
      v-for="theme in themes"
      :key="theme.id"
      class="theme-card"
      :class="{ 'theme-card--selected': theme.id === currentTheme }"
      :data-testid="'theme-card'"
      :data-theme-id="theme.id"
      :data-selected="theme.id === currentTheme ? 'true' : 'false'"
      role="button"
      tabindex="0"
      :aria-label="theme.label"
      @click="setTheme(theme.id)"
      @keydown.enter="setTheme(theme.id)"
    >
      <img :src="theme.preview" :alt="theme.label" class="theme-card__preview" />
      <span class="theme-card__label">{{ theme.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--surface-line-soft);
  border-radius: 8px;
  background: var(--surface-800);
  cursor: pointer;
  transition: transform 200ms ease, border-color 200ms ease;
}

.theme-card:hover {
  border-color: var(--chrome-300);
  transform: translateY(-2px);
}

.theme-card--selected {
  border-color: var(--surface-eyebrow);
  box-shadow: 0 0 0 2px var(--surface-eyebrow);
}

.theme-card__preview {
  width: 100%;
  max-width: 240px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.theme-card__label {
  font-family: var(--font-body);
  font-size: var(--text-body);
  color: var(--surface-text);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/components/settings/ThemeSwitcher.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add game/src/components/settings/ThemeSwitcher.vue game/src/components/settings/ThemeSwitcher.test.ts
git commit -m "feat(theme): add ThemeSwitcher component"
```

---

### Task 1.7: Import theme CSS files in main entry

**Files:**
- Find: `game/src/main.ts` or `game/src/App.vue` (whichever imports `theme.css`)
- Modify: thêm import 4 file CSS theme mới

- [ ] **Step 1: Find where theme.css is imported**

Run: `grep -l "theme.css" game/src`

- [ ] **Step 2: Thêm 4 import dưới import theme.css**

```typescript
import '@/assets/themes/ink-minimal.css'
import '@/assets/themes/landscape-shanshui.css'
import '@/assets/themes/xianxia-glow.css'
import '@/assets/themes/classical-imperial.css'
```

- [ ] **Step 3: Run typecheck + build**

Run: `npm.cmd run type-check && npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Manual verify**

Run: `npm.cmd run dev`, DevTools console: `document.documentElement.setAttribute('data-theme', 'ink-minimal')` → toàn app phải chuyển sang giấy trắng + mực đen.

- [ ] **Step 5: Commit**

```bash
git add game/src/main.ts (or App.vue)
git commit -m "feat(theme): import 4 theme CSS files"
```

---

### Task 1.8: Phase 1 verification

- [ ] **Run all tests**

Run: `npm.cmd run test`
Expected: ALL PASS

- [ ] **Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Manual smoke test**

Run: `npm.cmd run dev`, chuyển `data-theme` giữa 5 giá trị, xác nhận token áp dụng đúng. Ghi nhận chỗ token CHƯA override (panel nào còn dùng hex cũ — để Phase 5 xử lý).

- [ ] **Tag phase**

Không commit (chỉ marker nội bộ): phase-1-foundation done.

---

## Phase 2: Main Menu + Onboarding

### Task 2.1: Tạo MenuButton.vue (4 style variants)

**Files:**
- Create: `game/src/components/menu/MenuButton.vue`
- Test: `game/src/components/menu/MenuButton.test.ts`

**Interfaces:**
- Consumes: theme tokens (qua CSS)
- Produces: `<MenuButton variant="primary" label="Bắt đầu" @click="..." />`

- [ ] **Step 1: Write failing test**

```typescript
// game/src/components/menu/MenuButton.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuButton from './MenuButton.vue'

describe('MenuButton', () => {
  it('renders label', () => {
    const wrapper = mount(MenuButton, { props: { label: 'Bắt đầu' } })
    expect(wrapper.text()).toContain('Bắt đầu')
  })

  it('emits click event on press', async () => {
    const wrapper = mount(MenuButton, { props: { label: 'Test' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applies primary variant class', () => {
    const wrapper = mount(MenuButton, { props: { label: 'X', variant: 'primary' } })
    expect(wrapper.classes()).toContain('menu-button--primary')
  })

  it('applies secondary variant class', () => {
    const wrapper = mount(MenuButton, { props: { label: 'X', variant: 'secondary' } })
    expect(wrapper.classes()).toContain('menu-button--secondary')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
Expected: FAIL

- [ ] **Step 3: Write MenuButton component**

```vue
<!-- game/src/components/menu/MenuButton.vue -->
<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
})

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="menu-button"
    :class="[
      `menu-button--${variant}`,
      { 'menu-button--disabled': disabled },
    ]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <span class="menu-button__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 200px;
  min-height: 48px;
  padding: 12px 32px;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
  background: transparent;
  color: var(--surface-text);
  border: 1px solid var(--surface-line);
}

.menu-button:hover:not(.menu-button--disabled) {
  transform: translateY(-1px);
}

.menu-button--primary {
  background: linear-gradient(180deg, var(--surface-600), var(--surface-700));
  border-color: var(--surface-eyebrow);
  color: var(--surface-text);
}

.menu-button--primary:hover:not(.menu-button--disabled) {
  box-shadow: var(--surface-glow-gold);
}

.menu-button--secondary {
  background: transparent;
  border-color: var(--surface-line);
}

.menu-button--secondary:hover:not(.menu-button--disabled) {
  background: var(--surface-700);
  border-color: var(--chrome-300);
}

.menu-button--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/components/menu/MenuButton.vue game/src/components/menu/MenuButton.test.ts
git commit -m "feat(menu): add MenuButton component with primary/secondary variants"
```

---

### Task 2.2: Tạo MenuLogo.vue (4 style variants)

**Files:**
- Create: `game/src/components/menu/MenuLogo.vue`

- [ ] **Step 1: Write component**

```vue
<!-- game/src/components/menu/MenuLogo.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme } = useTheme()

const logoFont = computed(() => {
  switch (currentTheme.value) {
    case 'ink-minimal':
    case 'default':
      return 'var(--font-display)'
    case 'landscape-shanshui':
      return "'Ma Shan Zheng', cursive"
    case 'xianxia-glow':
      return "'Noto Serif SC', serif"
    case 'classical-imperial':
      return "'ZCOOL XiaoWei', serif"
  }
  return 'var(--font-display)'
})

const isGlowTheme = computed(() => currentTheme.value === 'xianxia-glow')
</script>

<template>
  <div class="menu-logo" :class="{ 'menu-logo--glow': isGlowTheme }">
    <h1 class="menu-logo__title" :style="{ fontFamily: logoFont }">
      TIÊN HIỆP IDLE
    </h1>
    <div class="menu-logo__underline" />
  </div>
</template>

<style scoped>
.menu-logo {
  text-align: center;
  margin: 24px 0;
}

.menu-logo__title {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 700;
  color: var(--surface-text);
  margin: 0;
  letter-spacing: 0.1em;
}

.menu-logo__underline {
  width: 60%;
  height: 2px;
  margin: 12px auto 0;
  background: var(--surface-eyebrow);
  border-radius: 1px;
}

.menu-logo--glow .menu-logo__title {
  text-shadow: 0 0 16px var(--surface-glow-gold);
  animation: glow-pulse 3s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { text-shadow: 0 0 16px var(--surface-glow-gold); }
  50% { text-shadow: 0 0 32px var(--surface-glow-gold); }
}
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add game/src/components/menu/MenuLogo.vue
git commit -m "feat(menu): add MenuLogo with 4 font variants"
```

---

### Task 2.3: Tạo MenuBackground.vue (4 scene variants)

**Files:**
- Create: `game/src/components/menu/MenuBackground.vue`

- [ ] **Step 1: Write component**

```vue
<!-- game/src/components/menu/MenuBackground.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme } = useTheme()

const bgGradient = computed(() => {
  switch (currentTheme.value) {
    case 'ink-minimal':
      return 'linear-gradient(180deg, #fdfbf7 0%, #ebe3d2 100%)'
    case 'landscape-shanshui':
      return 'linear-gradient(180deg, #d8ccb0 0%, #6b5942 50%, #2c1810 100%)'
    case 'xianxia-glow':
      return 'radial-gradient(circle at 50% 30%, #5c3d8f 0%, #0d0a14 70%)'
    case 'classical-imperial':
      return 'linear-gradient(180deg, #f5e6e0 0%, #8b1a1a 70%, #2c0a0a 100%)'
    case 'default':
    default:
      return 'radial-gradient(circle at 50% 30%, rgba(212, 165, 87, 0.08), transparent 60%), linear-gradient(180deg, #0e0e14 0%, #050507 100%)'
  }
})
</script>

<template>
  <div
    class="menu-background"
    :style="{ background: bgGradient }"
    aria-hidden="true"
  />
</template>

<style scoped>
.menu-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add game/src/components/menu/MenuBackground.vue
git commit -m "feat(menu): add MenuBackground with 4 style gradients"
```

---

### Task 2.4: Tạo MainMenu.vue

**Files:**
- Create: `game/src/components/menu/MainMenu.vue`
- Modify: router config (if exists) to route to MainMenu first

- [ ] **Step 1: Tìm router config**

Run: `Get-ChildItem game/src/router -Recurse`

- [ ] **Step 2: Write MainMenu.vue**

```vue
<!-- game/src/components/menu/MainMenu.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import MenuBackground from './MenuBackground.vue'
import MenuLogo from './MenuLogo.vue'
import MenuButton from './MenuButton.vue'

const router = useRouter()

const handleStart = () => router.push({ name: 'game' })
const handleContinue = () => router.push({ name: 'game' })  // load save if exists
const handleSettings = () => router.push({ name: 'settings' })
</script>

<template>
  <div class="main-menu">
    <MenuBackground />
    <div class="main-menu__content">
      <MenuLogo />
      <nav class="main-menu__actions">
        <MenuButton label="Bắt đầu tu luyện" variant="primary" @click="handleStart" />
        <MenuButton label="Tiếp tục" variant="secondary" @click="handleContinue" />
        <MenuButton label="Cài đặt" variant="secondary" @click="handleSettings" />
        <MenuButton label="Thoát" variant="secondary" @click="() => window.close()" />
      </nav>
      <div class="main-menu__version">v1.2.3</div>
    </div>
  </div>
</template>

<style scoped>
.main-menu {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-menu__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.main-menu__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.main-menu__version {
  position: absolute;
  bottom: 16px;
  right: 16px;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--surface-text-muted);
}
</style>
```

- [ ] **Step 3: Update router — add `/` → MainMenu**

Mở `game/src/router/index.ts` (path tùy theo project), thêm route:

```typescript
{
  path: '/',
  name: 'main-menu',
  component: () => import('@/components/menu/MainMenu.vue'),
}
```

- [ ] **Step 4: Run typecheck + manual test**

Run: `npm.cmd run type-check && npm.cmd run dev`

Visit `/` → MainMenu xuất hiện với gradient background + logo + 4 nút. Switch theme giữa 5 giá trị → background, font logo, button style đều thay đổi.

- [ ] **Step 5: Commit**

```bash
git add game/src/components/menu/MainMenu.vue game/src/router/
git commit -m "feat(menu): add MainMenu component and route"
```

---

### Task 2.5: Tạo OnboardingChapter.vue

**Files:**
- Create: `game/src/components/onboarding/OnboardingChapter.vue`

- [ ] **Step 1: Tìm onboarding hiện tại**

Run: `Get-ChildItem game/src/components/onboarding -Recurse` (nếu không có → tạo mới)

- [ ] **Step 2: Write OnboardingChapter.vue**

```vue
<!-- game/src/components/onboarding/OnboardingChapter.vue -->
<script setup lang="ts">
interface Props {
  chapterNumber: number
  title: string
  body: string
  isLast?: boolean
}

withDefaults(defineProps<Props>(), { isLast: false })

defineEmits<{ (e: 'next'): void; (e: 'skip'): void }>()
</script>

<template>
  <div class="onboarding-chapter">
    <div class="onboarding-chapter__illustration" aria-hidden="true" />
    <div class="onboarding-chapter__content">
      <div class="onboarding-chapter__eyebrow">CHƯƠNG {{ chapterNumber }}</div>
      <h2 class="onboarding-chapter__title">{{ title }}</h2>
      <p class="onboarding-chapter__body">{{ body }}</p>
    </div>
    <div class="onboarding-chapter__actions">
      <button class="onboarding-chapter__btn onboarding-chapter__btn--primary" @click="$emit('next')">
        {{ isLast ? 'Bắt đầu' : 'Tiếp tục' }}
      </button>
      <button v-if="!isLast" class="onboarding-chapter__btn onboarding-chapter__btn--ghost" @click="$emit('skip')">
        Bỏ qua
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-chapter {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  max-width: 720px;
  margin: 0 auto;
  background: var(--surface-800);
  border: 1px solid var(--surface-line);
  border-radius: 12px;
}

.onboarding-chapter__illustration {
  width: 100%;
  height: 240px;
  background: var(--surface-grain), linear-gradient(180deg, var(--surface-700), var(--surface-800));
  border-radius: 8px;
}

.onboarding-chapter__eyebrow {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--surface-eyebrow);
}

.onboarding-chapter__title {
  font-family: var(--font-display);
  font-size: var(--text-display);
  color: var(--surface-text);
  margin: 0;
}

.onboarding-chapter__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  line-height: var(--lh-relaxed);
  color: var(--surface-text-soft);
}

.onboarding-chapter__actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.onboarding-chapter__btn {
  min-height: 44px;
  padding: 12px 24px;
  font-family: var(--font-body);
  font-size: var(--text-body);
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--surface-line);
  background: var(--surface-700);
  color: var(--surface-text);
}

.onboarding-chapter__btn--primary {
  background: var(--surface-600);
  border-color: var(--surface-eyebrow);
  color: var(--surface-text);
}

.onboarding-chapter__btn--ghost {
  background: transparent;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add game/src/components/onboarding/OnboardingChapter.vue
git commit -m "feat(onboarding): add OnboardingChapter component"
```

---

### Task 2.6: Phase 2 verification

- [ ] **Run all tests**

Run: `npm.cmd run test`
Expected: ALL PASS

- [ ] **Run typecheck + build**

Run: `npm.cmd run type-check && npm.cmd run build`
Expected: PASS

- [ ] **Manual smoke test**

Run: `npm.cmd run dev`. Visit `/` → MainMenu. Switch theme qua 5 giá trị (DevTools console: `document.documentElement.setAttribute('data-theme', '...')`) → logo, background, buttons đổi theo.

- [ ] **Tag phase**

phase-2-menu done.

---

## Phase 3: Combat HUD

### Task 3.1: Tạo phaserThemeBridge.ts

**Files:**
- Create: `game/src/game/support/phaserThemeBridge.ts`
- Test: `game/src/game/support/phaserThemeBridge.test.ts`

**Interfaces:**
- Consumes: themeId, Phaser scene
- Produces: `applyTintToScene(scene, themeId)`, `THEME_TINT_MAP`

- [ ] **Step 1: Write failing test**

```typescript
// game/src/game/support/phaserThemeBridge.test.ts
import { describe, it, expect } from 'vitest'
import { THEME_TINT_MAP, getTintForTheme } from './phaserThemeBridge'

describe('phaserThemeBridge', () => {
  it('THEME_TINT_MAP has 5 entries', () => {
    expect(Object.keys(THEME_TINT_MAP)).toHaveLength(5)
  })

  it('getTintForTheme returns a number for known theme', () => {
    const tint = getTintForTheme('ink-minimal')
    expect(typeof tint).toBe('number')
    expect(tint).toBeGreaterThan(0)
  })

  it('getTintForTheme falls back to 0xffffff for unknown', () => {
    // @ts-expect-error testing invalid input
    const tint = getTintForTheme('unknown')
    expect(tint).toBe(0xffffff)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts`
Expected: FAIL

- [ ] **Step 3: Write phaserThemeBridge.ts**

```typescript
// game/src/game/support/phaserThemeBridge.ts
import type { ThemeId } from '@/assets/themes'

/** Phaser tint hex cho mỗi theme — dùng cho .setTint() trên scene objects.
 *  Tint áp dụng nhân với texture gốc; chọn tone phù hợp với theme. */
export const THEME_TINT_MAP: Record<ThemeId, number> = {
  'default': 0xffffff,
  'ink-minimal': 0xfdfbf7,
  'landscape-shanshui': 0xf0ebe0,
  'xianxia-glow': 0xc9a8ff,
  'classical-imperial': 0xf5e6e0,
}

export const getTintForTheme = (themeId: string): number => {
  if (themeId in THEME_TINT_MAP) {
    return THEME_TINT_MAP[themeId as ThemeId]
  }
  return 0xffffff
}

/** Apply tint to all tintable GameObjects in a Phaser scene. */
export const applyTintToScene = (
  scene: { children: { list: unknown[] } },
  themeId: string,
): void => {
  const tint = getTintForTheme(themeId)
  for (const obj of scene.children.list) {
    if (obj && typeof obj === 'object' && 'setTint' in obj) {
      const tintable = obj as { setTint: (n: number) => void }
      tintable.setTint(tint)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/game/support/phaserThemeBridge.ts game/src/game/support/phaserThemeBridge.test.ts
git commit -m "feat(theme): add phaserThemeBridge with tint map"
```

---

### Task 3.2: Wire theme store to Phaser via Pinia subscription

**Files:**
- Create: `game/src/game/support/themePhaserSync.ts`

**Interfaces:**
- Consumes: `useThemeStore`, `applyTintToScene`
- Produces: `installThemePhaserSync(getActiveScene)` — auto re-tint khi theme đổi

- [ ] **Step 1: Write file**

```typescript
// game/src/game/support/themePhaserSync.ts
import { watch } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { applyTintToScene } from './phaserThemeBridge'

export const installThemePhaserSync = (
  getActiveScene: () => { children: { list: unknown[] } } | null,
): void => {
  const store = useThemeStore()
  watch(
    () => store.currentTheme,
    (newTheme) => {
      const scene = getActiveScene()
      if (scene) {
        applyTintToScene(scene, newTheme)
      }
    },
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add game/src/game/support/themePhaserSync.ts
git commit -m "feat(theme): add Vue→Phaser theme sync"
```

---

### Task 3.3: Refactor CombatTopBar.vue — add theme variants

**Files:**
- Read: `game/src/components/game/combat/CombatTopBar.vue`
- Modify: thêm theme-aware styling dùng tokens

- [ ] **Step 1: Read existing CombatTopBar.vue**

```bash
Read game/src/components/game/combat/CombatTopBar.vue
```

- [ ] **Step 2: Replace hardcoded hex values with theme tokens**

Tìm các hardcoded hex/colors. Thay bằng var(--surface-*), var(--chrome-*), var(--frame-*).

Ví dụ:
- `background: #15151c` → `background: var(--surface-800)`
- `border: 1px solid #2a2a36` → `border: 1px solid var(--surface-line)`
- `color: #d4a557` (eyebrow) → `color: var(--surface-eyebrow)`

KHÔNG thay đổi structure layout. Chỉ thay color values.

- [ ] **Step 3: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 4: Manual test**

Run: `npm.cmd run dev`, vào combat, switch theme → topbar update.

- [ ] **Step 5: Commit**

```bash
git add game/src/components/game/combat/CombatTopBar.vue
git commit -m "refactor(combat): use theme tokens in CombatTopBar"
```

---

### Task 3.4: Refactor CombatSkillSlot.vue

**Files:**
- Modify: `game/src/components/game/combat/hud/CombatSkillSlot.vue`

Lặp lại pattern từ Task 3.3: đọc file, thay hardcoded hex bằng theme tokens, không đổi structure, verify, commit.

- [ ] **Steps: tương tự Task 3.3**

```bash
git add game/src/components/game/combat/hud/CombatSkillSlot.vue
git commit -m "refactor(combat): use theme tokens in CombatSkillSlot"
```

---

### Task 3.5: Refactor CombatStatusBar, CombatEventBar, CombatControlBar

**Files:**
- Modify: `game/src/components/game/combat/CombatStatusBar.vue`
- Modify: `game/src/components/game/combat/CombatEventBar.vue`
- Modify: `game/src/components/game/combat/CombatControlBar.vue`

Lặp lại pattern: thay hex bằng theme tokens.

- [ ] **Steps:**

```bash
git add game/src/components/game/combat/CombatStatusBar.vue game/src/components/game/combat/CombatEventBar.vue game/src/components/game/combat/CombatControlBar.vue
git commit -m "refactor(combat): use theme tokens in combat bar components"
```

---

### Task 3.6: Refactor CombatVictoryPanel + CombatDefeatPanel + CombatResultModal

**Files:**
- Modify: `game/src/components/game/combat/CombatVictoryPanel.vue`
- Modify: `game/src/components/game/combat/CombatDefeatPanel.vue`
- Modify: `game/src/components/game/combat/CombatResultModal.vue`

- [ ] **Steps: tương tự Task 3.3**

```bash
git add game/src/components/game/combat/CombatVictoryPanel.vue game/src/components/game/combat/CombatDefeatPanel.vue game/src/components/game/combat/CombatResultModal.vue
git commit -m "refactor(combat): use theme tokens in result panels"
```

---

### Task 3.7: Phase 3 verification

- [ ] **Run all tests + typecheck + build**

Run: `npm.cmd run test && npm.cmd run type-check && npm.cmd run build`
Expected: ALL PASS

- [ ] **Manual combat test**

Run: `npm.cmd run dev`. Vào combat scene. Switch theme giữa 5 giá trị. Verify:
- TopBar colors update
- Skill slots border update
- HP/Mana bar colors update
- Victory/Defeat modal update
- Phaser scene objects re-tinted (via `phaserThemeBridge`)

- [ ] **Tag phase**

phase-3-combat done.

---

## Phase 4: Dong Fu Home

### Task 4.1: Refactor HomeResourceStrip.vue

**Files:**
- Modify: `game/src/components/game/HomeResourceStrip.vue`

- [ ] **Steps: thay hex bằng theme tokens, verify, commit**

```bash
git add game/src/components/game/HomeResourceStrip.vue
git commit -m "refactor(home): use theme tokens in HomeResourceStrip"
```

---

### Task 4.2: Refactor DongFuCommandWheel.vue

**Files:**
- Modify: `game/src/components/game/DongFuCommandWheel.vue`

- [ ] **Steps: thay hex bằng theme tokens, verify, commit**

```bash
git add game/src/components/game/DongFuCommandWheel.vue
git commit -m "refactor(home): use theme tokens in DongFuCommandWheel"
```

---

### Task 4.3: Refactor DongFuBuildingSprite.vue + BuildingDetailPopover

**Files:**
- Modify: `game/src/components/game/DongFuBuildingSprite.vue`
- Modify: `game/src/components/game/BuildingDetailPopover.vue`

- [ ] **Steps:**

```bash
git add game/src/components/game/DongFuBuildingSprite.vue game/src/components/game/BuildingDetailPopover.vue
git commit -m "refactor(home): use theme tokens in building components"
```

---

### Task 4.4: Phase 4 verification

- [ ] **Run all tests + typecheck + build**

Run: `npm.cmd run test && npm.cmd run type-check && npm.cmd run build`
Expected: ALL PASS

- [ ] **Manual home test**

Run: `npm.cmd run dev`. Vào Dong Fu scene. Switch theme. Verify:
- Resource strip colors update
- Building sprite border/tint update
- Command wheel sector style update
- Popover header update

- [ ] **Tag phase**

phase-4-home done.

---

## Phase 5: Panels + Icons + Polish

### Task 5.1: Tạo ThemedIcon.vue base

**Files:**
- Create: `game/src/components/common/ThemedIcon.vue`
- Test: `game/src/components/common/ThemedIcon.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// game/src/components/common/ThemedIcon.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ThemedIcon from './ThemedIcon.vue'
import { useThemeStore } from '@/stores/themeStore'

describe('ThemedIcon', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders with default size 24', () => {
    const wrapper = mount(ThemedIcon, { props: { name: 'home' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('24')
    expect(svg.attributes('height')).toBe('24')
  })

  it('uses correct icon set per theme', () => {
    const store = useThemeStore()
    store.setTheme('xianxia-glow')
    const wrapper = mount(ThemedIcon, { props: { name: 'home' } })
    // Verify it renders without error
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('emits click event', async () => {
    const wrapper = mount(ThemedIcon, { props: { name: 'home' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- --run src/components/common/ThemedIcon.test.ts`
Expected: FAIL

- [ ] **Step 3: Write ThemedIcon.vue (inline SVG cho 1 icon đầu tiên: home)**

```vue
<!-- game/src/components/common/ThemedIcon.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

interface Props {
  name: string
  size?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), { size: 24 })
defineEmits<{ (e: 'click'): void }>()

const { currentTheme } = useTheme()

// Placeholder: chỉ render path home cho tất cả theme.
// Task tiếp theo sẽ thay bằng icon set per theme.
const iconPath = computed(() => {
  // TODO: replace with theme-aware icon registry
  return 'M3 12L12 4L21 12M5 10V20H19V10'
})
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-label="props.ariaLabel"
    :data-theme="currentTheme"
    role="img"
    @click="$emit('click')"
  >
    <path :d="iconPath" />
  </svg>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -- --run src/components/common/ThemedIcon.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add game/src/components/common/ThemedIcon.vue game/src/components/common/ThemedIcon.test.ts
git commit -m "feat(icon): add ThemedIcon base component"
```

---

### Task 5.2: Tạo icon registry cho 3 style còn lại (ink-minimal, shanshui, imperial)

**Files:**
- Create: `game/src/components/common/iconRegistry.ts`
- Modify: `game/src/components/common/ThemedIcon.vue` (use registry)

- [ ] **Step 1: Write icon registry**

```typescript
// game/src/components/common/iconRegistry.ts
import type { ThemeId } from '@/assets/themes'

export interface IconSet {
  [iconName: string]: string  // SVG path d
}

const inkMinimalIcons: IconSet = {
  home: 'M3 12L12 4L21 12M5 10V20H19V10',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 6l-6 6 6 6',
  check: 'M5 12l5 5L20 7',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  attack: 'M14 6l4 4-9 9-4-4zM3 21l4-4',
  defend: 'M12 3l8 3v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  speed: 'M13 3l-9 9 3 3 9-9 4 4V3z',
  auto: 'M5 12a7 7 0 0114 0M12 8v4l3 3',
  spirit: 'M12 3L4 9v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V9z',
  wood: 'M12 3v18M5 7l7 3M19 7l-7 3',
  ore: 'M3 9l9-6 9 6-9 6z',
  herb: 'M12 3c-3 3-3 9 0 12 3 3 6 3 9 0-3-3-3-9 0-12-3 0-6 0-9 0z',
  essence: 'M12 3l4 4-4 4-4-4z',
  tab: 'M4 8h16M4 14h16M4 20h16',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12l2-2-2-2M5 12l-2 2 2 2',
  bag: 'M5 7h14l-1 13H6zM9 7V4h6v3',
  character: 'M12 8a3 3 0 100 6 3 3 0 000-6zM5 21v-1c0-3 3-5 7-5s7 2 7 5v1',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z',
}

const shanshuiIcons: IconSet = {
  // Style 2 giữ tương tự inkMinimal, thêm vài chi tiết brush
  ...inkMinimalIcons,
  // Override vài cái nếu muốn khác
}

const xianxiaIcons: IconSet = {
  // Style 3 — dùng stroke tương tự, theme CSS sẽ áp dụng glow
  ...inkMinimalIcons,
}

const imperialIcons: IconSet = {
  // Style 4 — dùng stroke tương tự
  ...inkMinimalIcons,
}

export const ICON_REGISTRY: Record<ThemeId, IconSet> = {
  'default': inkMinimalIcons,
  'ink-minimal': inkMinimalIcons,
  'landscape-shanshui': shanshuiIcons,
  'xianxia-glow': xianxiaIcons,
  'classical-imperial': imperialIcons,
}

export const getIconPath = (name: string, themeId: ThemeId): string => {
  const set = ICON_REGISTRY[themeId] ?? inkMinimalIcons
  return set[name] ?? inkMinimalIcons[name] ?? inkMinimalIcons['home']
}
```

- [ ] **Step 2: Update ThemedIcon.vue dùng registry**

```vue
<!-- ThemedIcon.vue: thay computed iconPath -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { getIconPath } from './iconRegistry'

interface Props {
  name: string
  size?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), { size: 24 })
defineEmits<{ (e: 'click'): void }>()

const { currentTheme } = useTheme()

const iconPath = computed(() => getIconPath(props.name, currentTheme.value))
</script>
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm.cmd run type-check && npm.cmd run test -- --run src/components/common/ThemedIcon.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add game/src/components/common/iconRegistry.ts game/src/components/common/ThemedIcon.vue
git commit -m "feat(icon): add icon registry with 24 icons per theme"
```

---

### Task 5.3: Refactor StatRow, TabBar, GameButton, GamePanel

**Files:**
- Modify: `game/src/components/common/primitives/StatRow.vue`
- Modify: `game/src/components/common/TabBar.vue`
- Modify: `game/src/components/common/GameButton.vue`
- Modify: `game/src/components/common/GamePanel.vue`

Lặp lại pattern: thay hex bằng theme tokens, không đổi structure.

- [ ] **Steps:**

```bash
git add game/src/components/common/primitives/StatRow.vue game/src/components/common/TabBar.vue game/src/components/common/GameButton.vue game/src/components/common/GamePanel.vue
git commit -m "refactor(panels): use theme tokens in primitive components"
```

---

### Task 5.4: Refactor SlotView.vue (giữ nguyên slot tokens)

**Files:**
- Modify: `game/src/components/common/SlotView.vue`

Slot tokens (--slot-*) đã tồn tại trong theme.css — chỉ cần verify SlotView dùng tokens, không hardcode.

- [ ] **Steps:**

```bash
git add game/src/components/common/SlotView.vue
git commit -m "refactor(panels): verify SlotView uses slot tokens"
```

---

### Task 5.5: Refactor các panel files (Character, Loadout, Bag, Equipment, Enhancement)

**Files:**
- Modify: tất cả `.vue` files trong `game/src/components/panels/`

- [ ] **Steps:**

```bash
git add game/src/components/panels/
git commit -m "refactor(panels): use theme tokens in panel components"
```

---

### Task 5.6: Integrate ThemeSwitcher vào Settings

**Files:**
- Find: Settings panel (in `game/src/components/panels/` hoặc `game/src/components/settings/`)
- Modify: thêm `<ThemeSwitcher />` vào panel

- [ ] **Step 1: Find settings entry point**

Run: `grep -rl "settings" game/src/components --include="*.vue" | head -5`

- [ ] **Step 2: Add import + render**

```vue
<script setup lang="ts">
import ThemeSwitcher from '@/components/settings/ThemeSwitcher.vue'
</script>

<template>
  <!-- existing settings content -->
  <section class="settings__section">
    <h2>Giao diện</h2>
    <ThemeSwitcher />
  </section>
</template>
```

- [ ] **Step 3: Run typecheck**

Run: `npm.cmd run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add (settings file)
git commit -m "feat(settings): integrate ThemeSwitcher"
```

---

### Task 5.7: Final phase verification

- [ ] **Run all tests**

Run: `npm.cmd run test`
Expected: ALL PASS

- [ ] **Run typecheck + build**

Run: `npm.cmd run type-check && npm.cmd run build`
Expected: PASS

- [ ] **Full manual test**

Run: `npm.cmd run dev`. Test flow:
1. Main Menu → 4 button hiển thị, logo update theo theme
2. Settings → ThemeSwitcher hiển thị 5 cards, click switch theme
3. Persistence → refresh page, theme giữ nguyên
4. Vào game (Dong Fu) → building/resource strip/wheel update theo theme
5. Vào combat → HUD/skill slots/modal update theo theme
6. Mở panel (Character/Loadout/Bag/Equipment) → tokens đồng bộ
7. Test với cả 5 theme

- [ ] **Document known limitations**

Ghi nhận trong commit message cuối (hoặc trong CHANGELOG nếu có):
- Theme switch trong khi combat đang diễn ra có thể tạm thời flicker Phaser (cosmetic only)
- Font mới (Ma Shan Zheng, ZCOOL XiaoWei) cần mạng để load lần đầu
- Save data KHÔNG lưu theme (chỉ localStorage)

- [ ] **Tag phase**

phase-5-panels done. Toàn bộ redesign hoàn tất.

---

## Plan self-review

**1. Spec coverage check:**

| Spec section | Plan task |
|---|---|
| 1.1 4 Phong cách | Tasks 1.1, 1.2 |
| 1.2 Token Override Model | Task 1.2 |
| 1.3 Cấu trúc file | Task 1.1-1.7, 2.1-2.5, 3.1-3.2, 5.1-5.2 |
| 2.1 Main Menu | Tasks 2.1-2.4 |
| 2.2 Onboarding | Task 2.5 |
| 2.3 Combat HUD | Tasks 3.3-3.6 |
| 2.4 Dong Fu Home | Tasks 4.1-4.3 |
| 2.5 Panels | Tasks 5.3-5.5 |
| 2.6 Settings | Task 5.6 |
| 3. Asset plan | (Asset tạo PNG/SVG chưa trong plan này — chỉ tạo component skeleton; asset thật sẽ là task phụ khi cần) |
| 4. Phaser Integration | Tasks 3.1, 3.2 |
| 5. Theme Switcher Flow | Tasks 1.3-1.6 |
| 6. Thứ tự triển khai | Phase 1-5 |

**Gap noted:** Asset PNG/SVG (Onboarding illustration, decorative borders) chưa có trong plan — đây là task ngoài phạm vi code. Có thể tạo task riêng khi cần: "Tạo art assets thật" — không block implementation.

**2. Placeholder scan:** Không có TBD/TODO/FIXME trong code blocks. Note: `// TODO: replace with theme-aware icon registry` ở ThemedIcon — đã thay bằng registry ở Task 5.2, comment sẽ xoá.

**3. Type consistency:** 
- `ThemeId` định nghĩa ở Task 1.1, dùng nhất quán trong tất cả task sau
- `useTheme()` composable trả về `{ currentTheme, themes, setTheme }` — dùng trong MenuButton/MenuLogo/MainMenu/Onboarding/ThemedIcon
- `useThemeStore` Pinia store dùng cùng signature `{ currentTheme, setTheme, applyToDocument }`
- `THEME_TINT_MAP` keys = `ThemeId` values
- `ICON_REGISTRY` keys = `ThemeId` values

Tất cả consistent.
