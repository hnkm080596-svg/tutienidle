# Task 1.7 Brief — Import 4 theme CSS files

## Where this fits

Task 1.7 of 36. Imports the 4 new theme CSS files in the app entry so
the theme cascade works. Task 1.2 created the files; this task wires them in.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `81ff8fa` (after Task 1.6 fix)

## Global constraints

- DO NOT add dependencies
- DO NOT use `any`

## Files

**Modify:** Find where `theme.css` is imported in the app entry (main.ts or App.vue)

## Implementation steps

### Step 1: Find where theme.css is imported

Run in the worktree:
```
grep -rn "theme.css" game/src
```

Find which file imports `theme.css`.

### Step 2: Read that file

### Step 3: Add 4 imports after the theme.css import

Add these 4 imports AFTER the existing `theme.css` import:

```typescript
import '@/assets/themes/ink-minimal.css'
import '@/assets/themes/landscape-shanshui.css'
import '@/assets/themes/xianxia-glow.css'
import '@/assets/themes/classical-imperial.css'
```

### Step 4: Run typecheck + build

Run: `npm.cmd run type-check && npm.cmd run build`
Expected: PASS

### Step 5: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add (the file you modified)
git commit -m "feat(theme): import 4 theme CSS files"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-7-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- Which file was modified
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.