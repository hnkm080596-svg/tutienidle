# Ngự Kiếm beta redesign — balance re-baseline — 2026-09-25

`BalanceMatrix.test.ts` committed fingerprints for the 5 `kiem_tu_ngu/*`
rows were re-baselined in the same review cycle as the evolution redesign
worker commit `7e6ccab0` (plus follow-on hygiene fixes).

## What changed mechanically

- The hidden way's basic `ngu_kiem_thuat` now resolves through the Khoi
  evolution: every committed Kiem Dao spawns one ordered `phi kiem` damage
  instance on the standard hit/miss/crit/armor pipeline (no guaranteedHit,
  no Roll Cascade privilege) — sequential, one locked target, no retarget.
- The Lien evolution (foundation_establishment) adds cast-local Kiem The
  momentum: each landed sword stacks +1 and later swords in the same cast
  scale `1 + 0.15 * stacks`. Cast-local only — never persisted, never a
  buff/stat.
- Removed legacy surface: guaranteedHit provider, Roll Cascade
  (EXECUTE_MULT/crit/armor privilege), Cuu Cung 3x3 tree, kiemYGrant /
  kiemDaoGrant / cascadeUnlock / kiemDaoBelowCap fields, emblem slots.

## Delta

Only the 5 `kiem_tu_ngu/*` rows moved — all other recipe fingerprints are
unchanged, which matches the design boundary (the redesign is confined to
`hidden_sword_pathway`). New outcomes follow from real per-instance damage
semantics replacing the old privileged cascade.

## Gate verdicts

`gates.dominance.pass`, `gates.strengths.pass`, zero stalemates, zero
deadlocks — the redesign did not collapse the oracle. Absolute tuning
(LIEN_MOMENTUM_RATE = 0.15, forge costs, cap ladder) is explicitly deferred
to the user's BETA-BALANCE pass (design sec.56).

## Delta 2 (F-NK-COR-2 fingerprint update)

The hidden_n Gu foundation recipe shipped with `kiemDaoCount=1`, so every
cast emitted a single instance and the Lien momentum factor
`(1 + 0.15 * landedPriors)` was pinned at 1 — the benchmark claimed to
exercise the momentum lane but never did. The recipe now snapshots a
forged second sword (`kiemDaoCount=2`), so casts emit 2 ordered instances
and the second carries the 1.15 factor. All 5 `kiem_tu_ngu/*`
fingerprints updated to match; other recipes unchanged.
