# Task 1.5 Brief — Mount theme on app startup

## Where this fits

Task 1.5 of 36. When the app mounts, the `<html data-theme>` attribute must
already be set BEFORE the first render so there's no flash of unstyled content.
Task 1.3 created `applyToDocument()` in the store — this task wires it up.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `e2ee685` (after Task 1.4)

## Global constraints

- Vue 3 + TypeScript + Pinia
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies

## Files

**Modify:**
- `game/src/App.vue` (or `game/src/main.ts` — find which file mounts the app)

## Implementation steps

### Step 1: Find the app root file

In the worktree at `E:\tutienidle\.agent-worktrees\tu-tien-redesign`, run:

```
Get-ChildItem game/src -Filter "App.vue"
Get-ChildItem game/src -Filter "main.ts"
```

Check which one has `createApp` or `<script setup>` — that is the mount point.

### Step 2: Read App.vue (or main.ts)

Read the file that mounts the app. Find the `<script setup>` block.

### Step 3: Add theme store initialization

In the `<script setup>` block, add:

```typescript
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()
onMounted(() => themeStore.applyToDocument())
```

OR if using `main.ts`, add the same at the end of the file before the mount.

### Step 4: Verify typecheck

Run: `npm.cmd run type-check`
Expected: PASS

### Step 5: Manual verify

Run: `npm.cmd run dev`
Open DevTools, run: `document.documentElement.getAttribute('data-theme')`
Expected: `"default"` (or whatever the persisted theme is)

### Step 6: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/App.vue (or main.ts)
git commit -m "feat(theme): apply theme to document on app mount"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-5-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns (note which file you modified: App.vue or main.ts)

Do NOT paste file contents. Do NOT dispatch subagents. Begin.