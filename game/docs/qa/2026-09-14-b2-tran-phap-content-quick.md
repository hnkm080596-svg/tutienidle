# QA Quick — B2 Tran Phap production content (2026-09-14)

## Scope

B2 replaces the TEST-ONLY `hon_don_tran` formation (+ its `hon_don_tran_test_buff`)
with the first production roster in `src/data/formation/TranPhap.ts` +
`src/data/buff/buffs.ts`. Mechanism unchanged — content only (spec
2026-09-05, standing-slot rework 2026-09-07).

## Product-contract conflict resolved (evidence, not decision-by-fiat)

`future-talisman-formation-system-plan.md` (committed 2026-08-27/28)
locks the *equipment-socket* Tran (`src/data/formation/formations.ts`,
`formation_altar`/Tran Dai building) and reserves the name for a future
Nguyen Anh battle aura. The placement Tran Phap mechanism was spec'd
AFTER that lock (2026-09-05: "all formations available from the start —
no unlock gating", "content pass follows") and shipped 2026-09-06.
Roadmap 0.11 queues B2 explicitly and the beta content gate forbids
required test-only content — so B2 = production content for the shipped
placement mechanism. The aura product remains a hau-ky surface (Nguyen
Anh is beyond the beta cap Truc Co). Naming collision recorded in
roadmap.

## Shipped roster (headcount-strength ladder, spec 2026-09-05 §2.5)

| id | cells | buff |
|---|---|---|
| `doc_hanh_tran` | 1 (front-center) | +12% attack, +12% defense |
| `luong_nghi_tran` | 2 (front+back pole) | +10% attack |
| `tam_tai_tran` | 3 (tip + back wings) | +6% attack, +6% speed |
| `ngu_hanh_tran` | 5 (quincunx) | +4% attack, +6% defense |
| `cuu_cung_tran` | 9 (all) | +2% attack, +2% defense |

All buffs: `polarity: 'buff'`, `duration: Infinity`, `stackMode:
'refresh'`, authored in `buffs.ts` so they reach `TURN_BUFF_REGISTRY`
through the existing `toTurnBuffDefinition` converter.

## Adversarial hypotheses → evidence

- **H1 stale save (`formationId: 'hon_don_tran'`)**: `TRAN_PHAP_FORMATIONS.find`
  → undefined → buff skipped; assignments still resolve to absolute
  positions (`resolvePartyFormation` ignores `formationId`). Already
  pinned by `GameManager.partyFormation.test.ts` using the nonexistent
  `test_formation` id. Panel shows nothing selected until the player
  picks a real formation — cosmetic degradation, no crash. RESOLVED.
- **H2 removed `hon_don_tran_test_buff` referenced from a save**: buff
  pools are battle-scoped, applied at `buildTurnBattle()`, never
  persisted — a removed definition cannot dangle in save data. RESOLVED.
- **H3 double-apply across auto-refight / re-enter**: participants and
  buff pools are rebuilt per battle; the grant runs once per
  `buildTurnBattle()`. `stackMode: 'refresh'` is a further guard.
  RESOLVED.
- **H4 headcount tradeoff is degenerate** (pick `doc_hanh_tran`, field
  more than 1): impossible — companions without a valid cell in
  `cellPattern` are skipped in `buildTurnBattle()` (companion flatMap
  requires `slot` from the resolved formation). Headcount cap is real.
  RESOLVED.
- **H5 buff lands mid-intro and never emits status icon**: covered by
  the #7 persistent-snapshot contract; `GameManager.turnStatusVfx.test.ts`
  now drives `cuu_cung_tran` + `tran_phap_cuu_cung_buff` through exactly
  this path (attach on first observation, `permanent: true`). RESOLVED.
- **H6 percent units wrong** (`percent: 1` in the removed test buff was
  actually +100%, not "+1%" as its comment claimed): new values authored
  as fractions (0.02–0.12), matching registry norms (0.02–0.5 range).
  RESOLVED — also removed the misleading magnitude.

## Verification

- `npm run type-check` — clean.
- `npm run build` — clean (pre-existing chunk-size warning only).
- `npx vitest run` — **523 files / 3501 tests** all pass (+5 vs master:
  `TranPhap.test.ts` grew 2→7 pins: bounds, unique ids, unique cells,
  registry resolution, Infinity+polarity, headcount ladder, 9-cell
  coverage of `cuu_cung_tran`).
- `buffs.test.ts` count pin updated 52 → 56.

## Gaps / follow-ups

- **P14 deferred to main checkout**: live panel check (open Tran Phap
  panel, select a real formation, lit cells + drag/confirm) per the
  isolated-worktree browser exception — verify after merge.
- **Balance**: magnitudes follow the spec's fewer-slots-stronger-buff
  guideline and stay within existing registry norms; real tuning belongs
  to the beta-gate balance pass, not this content pass.
- `TEST_COMPANIONS` remain (B3 scope) — comment updated to reflect the
  9-cell `cuu_cung_tran` grid.
- Legacy saves holding `formationId: 'hon_don_tran'` keep their
  positions but lose the buff until the player re-confirms a real
  formation — acceptable degradation, no migration added (formation
  loadout is cosmetic-choice state, not paid/progression state).
- Naming: `TranPhap*` (placement) vs `formations.ts`/`core/formation/`
  (locked equipment-socket Tran) vs the future Nguyen Anh aura share one
  product name — recorded in roadmap §0.11; a rename/spec-reconcile is a
  separate product decision.

## Verdict

PASS WITH EVIDENCE (P14 live check deferred to main checkout per
worktree exception).
