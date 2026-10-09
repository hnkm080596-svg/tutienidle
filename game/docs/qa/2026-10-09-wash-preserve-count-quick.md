# Quick QA — Tẩy Luyện count-preserving reroll (PR #162)

- Scope: `git diff origin/master...devin/wash-preserve-count` — `EquipmentWash.ts` roll rewrite, `WashTab.vue` `canWash` guard, 5 test files.
- Request: owner ruling 2026-10-09 — wash rerolls LOẠI dòng + chỉ số per line, KHÔNG đổi số dòng; item 0 dòng chặn ở validation; preview/Giữ/Bỏ contract giữ nguyên.
- Risk map: domains `inventory-equipment` + `ui-input-lifecycle`; `deepAuditCandidate: true` (2 domains) — **not escalated**: the UI change is a single boolean in `canWash()` (no lifecycle/ownership change), the domain change is confined to `rollWashAffixes` with unchanged payment/ticket/snapshot contracts, and 148 scoped tests pin the transitions. Bounded confidently.
- unmappedPaths: `WashTab.test.ts`, `GameManager.washTransaction.test.ts` — test files, inspected directly (no production risk).

## Invariant ledger & verdicts

| # | Invariant | Evidence | Verdict |
|---|---|---|---|
| 1 | Count preservation: `affixes.length` unchanged on success | `rolled.length === normalLineCount` + exalted = lineCount; pinned `preserves the line count at every roll value` ×5 qualities (roll 0..0.999999) | PASS WITH EVIDENCE |
| 2 | Each line changes affix id | `isNewAffix` excludes `current.affixId` per line; pinned `a line bearing a registered affix id cannot reroll back onto itself` | PASS WITH EVIDENCE |
| 3 | Stat uniqueness across output lines | `excludeStats` seeded with mainStat + exalted stat, accumulates per rolled line; pinned in `%s: giữ nguyên số dòng` Set-size assert | PASS WITH EVIDENCE |
| 4 | Conservation: failures charge nothing | `no_affixes` guard placed after `favorite`, before `no_forge_uses`/costs (refine precedent); pinned `item 0 dòng phụ → no_affixes, không trừ gì` + module-level `nothing is charged` | PASS WITH EVIDENCE |
| 5 | Tien exalted occupies last slot, never restates replaced line | `exaltedExcludeStats` = mainStat + replaced-line stat; `normalLineCount = lineCount - 1`; pinned boundary 0.149999/0.15 | PASS WITH EVIDENCE |
| 6 | Kind preservation with opposite-kind fallback | kind resolved via registry (dead id → 'prefix'); candidates same-kind → fallback opposite; pinned `falls back to the opposite kind` + `preserves the line count` (3 dead lines → prefix/suffix mix) | PASS WITH EVIDENCE |
| 7 | Preview/commit/discard contract unchanged | pending-slot accessor, snapshot, membershipGeneration untouched; `EquipmentWash.pending.test.ts` suite green (mutation→reject, generation bump→reject, single-commit) | PASS WITH EVIDENCE |
| 8 | UI: 0-affix item cannot arm a paid preview | `canWash()` requires `row.affixCount > 0` (field exists at `useEquippedRows.ts:32,89`); pinned `item không có dòng phụ → nút Tẩy Luyện bị disabled` | PASS WITH EVIDENCE |
| 9 | `no_affixes` reaches a real user message | `ACTION_FAILURE_KEYS` already maps it → `actionFailure.no_affixes`; locales vi/en exist (refine precedent) | PASS WITH EVIDENCE |
| 10 | All-zero tier weights still fail-closed | `rollWeightedIndex` -1 → break → `rolled.length !== normalLineCount` → `no_eligible_affix` before payment (unchanged mechanism) | PASS WITH EVIDENCE |

## Hypotheses attacked and discharged

- **Swapped lines**: line A may land line B's current affix — then B rerolls off that stat (stat exclusion); per-line freshness + uniqueness still hold. Discharged, by design.
- **1-line tien + exalted hit**: `normalLineCount=0`, output = exalted only → count 1 preserved. Covered in code + boundary test.
- **Item with more lines than eligible stats** (e.g. save-edited 4-line hoang weapon, only ~4 valid stats): may exhaust pool mid-loop → `no_eligible_affix`, no charge. Fail-closed, same vocabulary as old code. Acceptable — ruling says reroll each line; impossible → reject.
- **Dead affixId lines** (old saves): `.has()` guard → kind 'prefix' → rerolls normally. Covered.
- **Supreme-pool line as normal line**: excluded by `hasEligibleTier` (tiers 4–5 > cap 3) for non-exalted lines — unchanged pool/tier gating.
- **UI dead branches** (`dòng mới`/`đã mất`/`chưa roll` in compare rows): unreachable now that before/after counts are always equal — harmless dead markup paths, not a defect.

## External review

2 blind reviewer sessions spawned (domain logic + contract/test angles); findings adjudicated below when they settle.

## Verification run

- `vitest run` scoped (equipment, equipment-hall, game, save, panels): 3329 pass; 4 fail — `spawnSync .bin/vitest ENOENT` fixpoint child-probe tests, Windows-env failures identical on master (unrelated).
- `vue-tsc --build`: only known 'decompose' errors (BagGrid.vue, stores/ui.ts — PR #160 scope).
- `asciiComments` ratchet: fails identically on master (34 pre-existing violations, 0 new).

**Round-1 self-review verdict: PASS WITH EVIDENCE** — no confirmed defects; blind-reviewer findings pending adjudication.
