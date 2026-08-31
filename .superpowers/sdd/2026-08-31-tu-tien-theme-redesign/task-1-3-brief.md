# Task 1.3 Brief — themeStore Pinia + persistence

## Where this fits

Task 1.3 of 36. Creates the Pinia store that owns the current theme
and persists user choice to localStorage. Task 1.1 produced the
`ThemeId` type — Task 1.4 will wrap this store in a composable.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `d416a2f` (after Task 1.2)

## Global constraints

- Vue 3 + TypeScript + Pinia + Phaser 4
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies
- 5 theme IDs: 'default' | 'ink-minimal' | 'landscape-shanshui' | 'xianxia-glow' | 'classical-imperial'

## Files

**Create:**
- `game/src/stores/themeStore.ts`
- `game/src/stores/themeStore.test.ts`

## Implementation steps

### Step 1: Write failing test (verbatim)

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

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/stores/themeStore.test.ts`
Expected: FAIL with "Cannot find module './themeStore'"

### Step 3: Write themeStore.ts (verbatim)

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

### Step 4: Verify test passes

Run: `npm.cmd run test -- --run src/stores/themeStore.test.ts`
Expected: PASS (4 tests)

### Step 5: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/stores/themeStore.ts game/src/stores/themeStore.test.ts
git commit -m "feat(theme): add themeStore Pinia with localStorage persistence"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-3-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.