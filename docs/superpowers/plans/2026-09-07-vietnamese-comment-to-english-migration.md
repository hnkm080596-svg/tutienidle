# Vietnamese Comment → English Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: this project's convention
> is **Inline Execution** (`superpowers:executing-plans`), not
> Subagent-Driven Development — execute task-by-task in the current
> session, with checkpoints for review. Steps use checkbox (`- [ ]`)
> syntax for tracking. This plan runs on a **separate agent, in parallel**
> with `docs/superpowers/plans/2026-09-07-standing-slot-unified-battlefield.md`
> — read the exclusion list in Global Constraints before touching any file.

**Goal:** Translate every existing Vietnamese-language code comment in
`game/src/**` (and `game/scripts/**`/`game/tests/**` if applicable) to
English, preserving meaning and reasoning, fixing any mojibake corruption
encountered along the way, with zero behavior change.

**Architecture:** This is a scan-then-sweep migration, not a scripted
find-and-replace — a blind regex cannot safely tell a comment from a
string literal, nor preserve meaning while translating. Work batch by
batch (one top-level directory at a time), each batch its own commit, so
the diff stays reviewable and a stuck batch doesn't block the rest.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest (source root `game/`).

**Spec:** `docs/superpowers/specs/2026-09-07-vietnamese-comment-to-english-migration-design.md`

## Global Constraints

- Comments only — no logic changes, no identifier renames, no UI string changes, no `data/**` content-string changes.
- **Do not touch these 8 files (owned by the parallel Standing Slot plan):**
  - `game/src/game/scenes/combat/combat-grid-view.ts`
  - `game/src/game/scenes/CombatScene.ts`
  - `game/src/game/scenes/TranPhapCombatPreviewScene.ts`
  - `game/src/components/panels/TranPhapPanel.vue`
  - `game/src/core/battle/BattlefieldRegions.ts`
  - `game/src/core/game/FormationPlacement.ts`
  - `game/src/core/battle/EnemySpawnPlacement.ts`
  - `game/src/data/formation/TranPhap.ts`
- Do not touch `.md` files, locale JSON (`game/src/locales/**`), or any UI-facing string/`t('...')` call.
- Every edited file saved as UTF-8, no BOM.
- Follow P15 (English, plain ASCII) for the translated style; P7 governs commit/push authorization.
- Run `npm.cmd run type-check` and `npx.cmd vitest run` after every batch — a failure means a comment edit accidentally touched code; investigate, don't blind-revert.

---

### Task 1: Enumerate the sweep surface

**Files:**
- Create: `.superpowers/vietnamese-comment-sweep/file-list.txt` (scratch artifact, git-ignored working file — not part of the shipped diff, but keep it for the duration of this plan so later tasks can reference it)

**Interfaces:**
- Produces: a file list with per-file Vietnamese-comment-line counts, grouped by top-level directory, that Tasks 2+ consume as their batch definitions.

- [ ] **Step 1: Run the enumeration grep**

```bash
cd game
grep -rlP '[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ]' \
  --include='*.ts' --include='*.vue' src scripts tests \
  > ../.superpowers/vietnamese-comment-sweep/file-list.txt
wc -l ../.superpowers/vietnamese-comment-sweep/file-list.txt
```

- [ ] **Step 2: Remove excluded files from the list**

Manually strip the 8 files listed in Global Constraints from
`file-list.txt` if the grep picked them up (it will — they still have
Vietnamese comments until the parallel plan finishes).

- [ ] **Step 3: Group by top-level directory**

Split `file-list.txt` into per-directory buckets (e.g. `core/`, `game/`
(scenes/support/etc., excluding the 8 excluded files), `components/`,
`composables/`, `stores/`, `services/`, `data/`, `scripts/`, `tests/` —
whatever the actual `src/` layout produces). Save each bucket as
`.superpowers/vietnamese-comment-sweep/batch-<dirname>.txt`. This becomes
the concrete file list each of Tasks 2+ works through — Task 2 onward in
this plan template one batch per bucket; add or remove batch tasks to
match however many buckets Step 3 actually produces (this plan's Task 2
below is the repeatable template, not a claim that exactly one batch
exists).

- [ ] **Step 4: Report the surface**

State the total file count and per-bucket counts before starting Task 2,
so the scale of the remaining work is visible up front.

---

### Task 2 (repeat per batch/directory): Sweep one directory's Vietnamese comments

Duplicate this task once per bucket produced in Task 1 Step 3 (e.g.
"Task 2a: core/", "Task 2b: components/", ...). Each duplicate is
identical in procedure, scoped to its own file list.

**Files:**
- Modify: every file listed in `.superpowers/vietnamese-comment-sweep/batch-<dirname>.txt`

**Interfaces:** none (comments only, no signature changes).

- [ ] **Step 1: For each file in the batch, read it in full**

Read the whole file, not just the grep-matched lines — a comment's
meaning often depends on the code immediately below it, and a
multi-line comment block may only partially match the grep pattern.

- [ ] **Step 2: Translate each Vietnamese comment to English**

Preserve: the *why* (a past incident, a workaround, a design decision), dates, spec/task references (e.g. "2026-08-24", "Task 19", "§7.5"), and any warning/gotcha the comment calls out. Do not produce a literal word-for-word translation if that loses the reasoning — rephrase naturally in English while keeping every fact.

If a comment is mojibake (garbled, e.g. `Ã¡`, `Ã¢`, `â€` sequences) and decipherable from context, translate the inferred original meaning. If it is mojibake and NOT decipherable, check `git log -p -- <file>` / `git blame` for a pre-corruption revision of that line; if a clean revision exists, translate from that. If no clean revision exists and the text is truly undecipherable, write a short English comment describing what the adjacent code does (inferred from the code itself), and note the file in this batch's summary as "reconstructed, not translated — verify against intent."

- [ ] **Step 3: Verify no code was touched**

```bash
git diff --stat -- <file>
```

Confirm only comment lines changed (spot-check the diff — a translation edit should never touch a non-comment line except where a comment shares a line with code, e.g. a trailing `// ...` comment).

- [ ] **Step 4: Type-check and test this batch**

Run: `npm.cmd run type-check`
Run: `npx.cmd vitest run` (or scope to affected test files if the batch is large, then a full run at the very end of the plan)
Expected: no new failures.

- [ ] **Step 5: Re-run the enumeration grep scoped to this batch's directory**

```bash
grep -rlP '<same Vietnamese-diacritic pattern as Task 1>' --include='*.ts' --include='*.vue' game/src/<directory>
```

Expected: no matches remaining in this directory (excluding the 8
Global-Constraints files, which are untouched by design and will still
match until the parallel plan finishes them).

- [ ] **Step 6: Commit this batch**

```bash
git add <files in this batch>
git commit -m "chore(i18n-comments): translate <directory> comments to English"
```

---

### Task N (final): Full-suite verification and closeout

**Files:** none (verification only).

- [ ] **Step 1: Full verification**

Run: `npm.cmd run type-check`
Run: `npm.cmd run build`
Run: `npx.cmd vitest run`

Expected: all green, matching the pre-migration baseline test count exactly (comments-only change must not add, remove, or break any test).

- [ ] **Step 2: Final enumeration re-check**

```bash
cd game
grep -rlP '<same Vietnamese-diacritic pattern as Task 1>' --include='*.ts' --include='*.vue' src scripts tests
```

Expected: only the 8 Global-Constraints files remain (if the parallel
Standing Slot plan hasn't finished yet) — everything else swept.

- [ ] **Step 3: Clean up scratch artifacts**

```bash
rm -rf .superpowers/vietnamese-comment-sweep
```

- [ ] **Step 4: Summarize**

State: total files swept, total batches, any "reconstructed, not
translated" files flagged in Task 2 Step 2 that need a human spot-check,
and confirmation that the 8 excluded files were left untouched for the
parallel plan.
