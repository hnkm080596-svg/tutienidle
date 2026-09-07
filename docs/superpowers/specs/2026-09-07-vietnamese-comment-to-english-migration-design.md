# Vietnamese Comment → English Migration (codebase-wide) Design

> Split out per user request 2026-09-07 so this can run as its own agent,
> in parallel with `2026-09-07-standing-slot-unified-battlefield-design.md`
> / its implementation plan. See **Coordination with the parallel Standing
> Slot plan** below before starting — there is real file overlap.

## Problem

`AGENTS.md` now carries **P15 (Code Comments in English Only)** and
**P16 (Vietnamese Text Confined to the i18n Gateway)**, both enforced
going forward for new/edited code. Neither rule retroactively fixes the
existing backlog: the codebase (`game/src/**`) has thousands of
Vietnamese-language code comments accumulated over months of
development, written in a Windows environment where several tools have
already corrupted Vietnamese diacritics into mojibake (UTF-8 misread as
Latin-1/CP1252, re-saved) — confirmed concretely in `CombatScene.ts`
(347 instances) and `combat-grid-view.ts` (27 instances from one
refactor commit). More files almost certainly carry the same corruption;
those two are only the ones found so far by targeted review, not an
exhaustive scan.

The user wants the entire existing backlog converted to English now,
rather than left to erode gradually as P15 only governs new edits.

## Goals

1. Every existing **code comment** in `game/src/**` (and any other TS/Vue
   source directories in the repo, e.g. `game/scripts/**`, `game/tests/**`
   if they carry doc-style comments) that is written in Vietnamese is
   translated to English, preserving the original **meaning and reasoning**
   — not a literal word-for-word pass. Many of these comments explain a
   non-obvious *why* (a past incident, a workaround, a design decision, a
   spec/task reference like "Task 19", "2026-08-24") — that context must
   survive translation, not just the surface words.
2. Any comment recovered from an already-corrupted (mojibake) state is
   fixed as part of the same edit — translating naturally produces clean
   ASCII English, so this retires the corruption permanently instead of
   re-encoding broken Vietnamese.
3. Zero behavior change. This is a comments-only sweep — no logic,
   formatting-of-code, or identifier renames.
4. Coverage is verifiable: after the sweep, a grep for Vietnamese
   diacritic characters restricted to comment lines returns (as close to
   as mechanically achievable) zero hits in the swept directories.

## Non-Goals

- **UI-facing strings are NOT touched by this migration.** Any Vietnamese
  visible to the player (panel titles, button labels, toasts, item/skill/
  zone names, lore/flavor text, error messages shown in the UI) is
  explicitly out of scope here — those stay Vietnamese, governed
  separately by **P16** (must go through the i18n gateway, not translated
  to English). Do not "helpfully" translate a `t('...')`-wrapped string,
  a locale resource file, or a hardcoded UI literal you encounter while
  sweeping comments — leave UI content exactly as-is.
- **Data-content Vietnamese is NOT touched.** Item names, skill names,
  zone names, lore text, and other `data/**` content strings are a
  pre-existing, intentional convention (this is a Vietnamese-language
  idle game) — not part of this migration.
- **No identifier renames.** Function/variable/constant names that are
  Vietnamese-derived but written in plain ASCII (e.g. `investThongMachDan`,
  `THONG_MACH_DAN_MATERIAL_ID`, `applyKhongAreaSlow`) carry no mojibake
  risk (no diacritics to corrupt) and are a much larger, much riskier
  rename surface (every call site, every test, every string-based
  lookup). Out of scope entirely.
- **No `.md` documentation files.** Docs stay Vietnamese per existing
  project convention (P2 already exempts doc edits from other
  constraints); this migration is code comments only.
- **No commit/push/merge without the user's explicit go-ahead** — normal
  project policy (P7) applies to whichever agent executes this.

## Approach

Because "is this Vietnamese?" and "does this string matter for UI vs. is
it a comment" require reading and understanding each file (a blind regex
cannot safely distinguish a comment from a string literal, nor preserve
meaning while translating), this must be an agent-driven pass, file by
file or directory by directory — not a scripted find-and-replace.

1. **Enumerate the surface.** Grep `game/src/**/*.{ts,vue}` (extend to
   `game/scripts/**`, `game/tests/**` if they carry Vietnamese comments)
   for lines containing Vietnamese diacritic characters
   (`[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]`,
   case-insensitive) to build a file list and rough comment count per file.
   Cross-check against the two already-known mojibake carriers
   (`CombatScene.ts`, `combat-grid-view.ts`) plus any others the grep
   surfaces via mojibake byte sequences (`Ã¡`, `Ã¢`, `â€`, etc.).
2. **Batch by directory**, not by file count, so the diff stays reviewable
   and each batch is one commit: e.g. `core/battle/**`, `core/game/**`,
   `game/scenes/**`, `game/support/**`, `components/**`, `composables/**`,
   `stores/**`, etc. — whatever directory structure the enumeration step
   reveals as the natural grouping.
3. **Per file:** read the comment in full context (the code it documents),
   translate preserving intent/reasoning/references (dates, task numbers,
   spec section numbers, "why" callouts), verify the file still parses
   /type-checks after the edit (no accidental code touched).
4. **Recovering already-corrupted comments:** where a comment is mojibake
   and the original Vietnamese is not decipherable from the corrupted
   text alone, check `git log -p`/`git blame` for a pre-corruption
   revision of that line (the two known cases in this codebase are both
   recoverable this way — see the standing-slot spec's Problem §3 for the
   `combat-grid-view.ts` example). If no clean revision exists and the
   corrupted text is not decipherable, leave a short English placeholder
   describing what the surrounding code does (inferred from the code
   itself) rather than guessing at lost original meaning, and flag it in
   the batch's summary as "reconstructed, not translated" for a human
   spot-check.
5. **File encoding:** save every edited file as UTF-8 without BOM (the
   `combat-grid-view.ts` corruption also introduced a stray BOM marker —
   avoid reintroducing one). Use the project's normal file-edit tooling
   (which already round-trips UTF-8 correctly) rather than any
   shell-based find/replace that goes through a non-UTF-8-safe codepage
   (the likely original cause of the corruption, per the standing-slot
   spec's root-cause note).

## Coordination with the parallel Standing Slot plan

The user is running this migration on a **separate agent in parallel**
with `2026-09-07-standing-slot-unified-battlefield-design.md`'s
implementation plan. The following files are touched by **both**:

- `game/src/game/scenes/combat/combat-grid-view.ts`
- `game/src/game/scenes/CombatScene.ts`
- `game/src/game/scenes/TranPhapCombatPreviewScene.ts`
- `game/src/components/panels/TranPhapPanel.vue`
- `game/src/core/battle/BattlefieldRegions.ts`
- `game/src/core/game/FormationPlacement.ts`
- `game/src/core/battle/EnemySpawnPlacement.ts`
- `game/src/data/formation/TranPhap.ts`

**Recommendation: exclude these 8 files from this migration's scope.**
The Standing Slot plan already writes English comments (per P15) on every
line it touches in these files as a matter of course, and it is already
fixing the two confirmed mojibake spots in `combat-grid-view.ts`. Having
two agents edit the same files concurrently risks conflicting diffs or
one agent's translation being clobbered by the other's feature edit.
Sweep every other Vietnamese-comment-bearing file in the codebase; treat
these 8 as "already being handled" and skip them here. If the Standing
Slot plan finishes first, a follow-up pass can re-check these 8 files for
any Vietnamese comments the feature work didn't happen to touch.

## Testing

- `npm.cmd run type-check` — comments-only change must not affect this;
  any failure means a comment edit accidentally touched code (investigate,
  don't just revert-and-retry blindly).
- `npx.cmd vitest run` (full suite) — same reasoning; must stay green.
- Re-run the enumeration grep (Goal 4) after each batch to confirm the
  swept directory's Vietnamese-comment count trends to zero, and to catch
  any batch that missed files.
- No `npm.cmd run build` requirement per se (comments don't affect the
  bundle), but running it once at the end is a cheap extra safety check
  given the scale of files touched.

## Global Constraints

- This is a comments-only migration — no logic changes, no renames, no
  UI string changes, no data content changes (see Non-Goals).
- Follow P15 for the target style (English, plain ASCII) and P7 for
  commit/push authorization.
- Do not touch the 8 files listed under **Coordination** above.
