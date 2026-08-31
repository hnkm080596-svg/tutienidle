# Task 3.1 Brief — phaserThemeBridge

## Where this fits

Task 3.1 of 36 (Phase 3: Combat HUD). Creates the bridge between Vue theme
system and Phaser scene tinting. Task 1.1 produced `ThemeId` type.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `fbba725` (after Phase 2)

## Global constraints

- Vue 3 + TypeScript + Phaser 4
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies

## Files

**Create:**
- `game/src/game/support/phaserThemeBridge.ts`
- `game/src/game/support/phaserThemeBridge.test.ts`

## Implementation steps

### Step 1: Write failing test

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
    const tint = getTintForTheme('unknown')
    expect(tint).toBe(0xffffff)
  })
})
```

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts`
Expected: FAIL

### Step 3: Write phaserThemeBridge.ts

```typescript
// game/src/game/support/phaserThemeBridge.ts
import type { ThemeId } from '@/assets/themes'

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

### Step 4: Verify test passes

Run: `npm.cmd run test -- --run src/game/support/phaserThemeBridge.test.ts`
Expected: PASS (3 tests)

### Step 5: Run typecheck

Run: `npm.cmd run type-check`
Expected: PASS

### Step 6: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/game/support/phaserThemeBridge.ts game/src/game/support/phaserThemeBridge.test.ts
git commit -m "feat(theme): add phaserThemeBridge with tint map"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-3-1-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.