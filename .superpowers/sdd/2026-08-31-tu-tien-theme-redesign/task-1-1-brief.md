# Task 1.1 Brief — Theme registry

## Where this fits

This is Task 1.1 of 36 in the Tu Tiên theme redesign plan. We are
building a system of 5 themes (1 default + 4 new artistic styles) with
runtime switching in Settings. This first task creates the type system
and registry that every later task depends on.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `d4ec83b85f2f5a3a3a64ff7b6e2fa6b0243c1a47`

## Global constraints (binding)

- Stack: Vue 3 + TypeScript + Pinia + Phaser 4 (already in project)
- DO NOT use `any` unless absolutely necessary
- DO NOT change architecture outside this task
- DO NOT add new dependencies
- Prefer editing existing code over rewriting
- 5 theme IDs (exact values, copy verbatim):
  - `'default'`
  - `'ink-minimal'`
  - `'landscape-shanshui'`
  - `'xianxia-glow'`
  - `'classical-imperial'`

## Interfaces you must produce (later tasks depend on these exact names)

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
  readonly preview: string  // data:image/svg+xml URL for 160x100 preview card
}
```

```typescript
// game/src/assets/themes/index.ts
export { THEME_REGISTRY, getTheme } from './index'
// THEME_REGISTRY: ReadonlyArray<ThemeDefinition> with 5 entries, 'default' FIRST
```

## Files

**Create:**
- `game/src/assets/themes/types.ts`
- `game/src/assets/themes/index.ts`
- `game/src/assets/themes/index.test.ts`

## Implementation steps

### Step 1: Write failing test (verbatim)

Create `game/src/assets/themes/index.test.ts`:

```typescript
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

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/assets/themes/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

### Step 3: Create `game/src/assets/themes/types.ts` (verbatim)

```typescript
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

### Step 4: Create `game/src/assets/themes/index.ts` (verbatim)

```typescript
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

### Step 5: Verify test passes

Run: `npm.cmd run test -- --run src/assets/themes/index.test.ts`
Expected: PASS (4 tests)

### Step 6: Run typecheck

Run: `npm.cmd run type-check`
Expected: PASS

### Step 7: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/assets/themes/
git commit -m "feat(theme): add theme registry with 5 themes"
```

## Report contract

Write a report to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-1-report.md`

Return to me ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary: "<N> tests passing"
- Any concerns

Do NOT paste the full file contents back — the report file holds them.
