# Task 1.4 Brief — useTheme composable

## Where this fits

Task 1.4 of 36. Creates a thin Vue composable wrapping the Pinia store from
Task 1.3. Components use the composable (not the store directly) so the
contract is stable even if the store implementation changes.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `8c6704c` (after Task 1.3)

## Global constraints

- Vue 3 + TypeScript + Pinia
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies

## Files

**Create:**
- `game/src/composables/useTheme.ts`
- `game/src/composables/useTheme.test.ts`

## Implementation steps

### Step 1: Write failing test (verbatim)

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

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/composables/useTheme.test.ts`
Expected: FAIL with "Cannot find module './useTheme'"

### Step 3: Write useTheme.ts (verbatim)

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

### Step 4: Verify test passes

Run: `npm.cmd run test -- --run src/composables/useTheme.test.ts`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/composables/useTheme.ts game/src/composables/useTheme.test.ts
git commit -m "feat(theme): add useTheme composable"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-4-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.