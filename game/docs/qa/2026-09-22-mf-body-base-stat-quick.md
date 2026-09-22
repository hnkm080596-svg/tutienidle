# QA — M-F Body Base-Stat Re-emit (D1) — quick

Scope: `feat/mf-body-base-stat` worktree diff — BodyRefinement.ts data, BodyChapter union split, BodyRefinementChapter (base-stat), MeridianChapter (kind tag), BodyProgressionSystem dispatch + collector, Player.ts assembly seam, BodyRefinementSection.vue labels, SaveRestore comment + tests.

Risk map: `economy-and-progression` + `ui-input-lifecycle`; `deepAuditCandidate: true` (2 domains); unmapped: `Player.ts` (routed to economy-and-progression — it is the stat-assembly seam), `GameManagerSaveRestore.ts` (comment-only). **Not escalating**: save shape/version untouched; restore scrub verified by boundary test + live runtime; the only runtime contract change is where body gains enter the pipeline (one seam, one consumer).

## Invariant ledger

1. `player.baseStats` never mutated by body progression (saves/perfection/pill caps unaffected).
2. Body gains derived from `bodyProgression.body_refinement` only — recomputed per resolution, never persisted, never emitted as modifiers.
3. `luyen-the:*` never re-emitted; stale slices scrubbed at invest/restore.
4. `bat-mach:*` (meridian) unchanged.
5. Mortal perfection + attribute/pill caps read persisted raw baseStats — body gains excluded.
6. Attribute-reactive channels (deriveAttributeModifiers, way facets) see the body-boosted totals.
7. UI labels track `baseGains` keys; row states track chapter state.

## Hypotheses → evidence

- **H1 bypassed assembly path** — swept: no `calculateStats(player.baseStats, …)` outside `resolvePlayerStatAssembly`; every effective-stat consumer (store `finalStats`, GameManager ambient, CombatBuild, battle ops) routes through it. Closed.
- **H2 double-count (deltas persisted OR emitted as modifiers)** — runtime-verified: seeded `completedTiers=5` → `finalStats` shows flat gains, `modifiers` has 0 `luyen-the:*`, `baseStats` unchanged (baseVit 6, baseDef 5). Tests pin the same in `BodyBaseStatAssembly.test.ts`. Closed.
- **H3/H4 attribute-reactive consistency** — all way facets take `totals` param (`CultivationPathKit.PathWayStatFacet.collectModifiers(player, totals)`); no facet reads `player.baseStats`. Runtime: vitality 6→8 yields +16 derived maxHp / +0.2 regen exactly. Closed.
- **H5 tick-order atomicity** — scrub inside `investBodyChapterState`, same synchronous op as the chapter mutation; no interleaving read possible. Closed.
- **H6 pill permanent merge** — `PillSystem` reads `baseStats + existing.flat`; body emits no flat modifiers, pill writes remain authored-base. Closed.
- **H10 journey suite** — 479-test widened scope incl. journey/save-boundary green; fixture updated to assert scrub semantics. Closed.
- **H14 store reactivity** — `finalStats` getter reads `state.bodyProgression` via the assembly; live-verified `finalStats` updated immediately after `$state` mutation. Closed.
- **H15 ledger QA-2026-09-14-001 (legacy modifier on restore)** — persisted `luyen-the:*` is scrubbed at restore (not recomputed through the gate), same "chapter state wins" invariant. Closed.
- **Ledger QA-2026-09-09-RR7 cardinality** — call sites unchanged (1 per invest, 1 per chapter per restore). Closed.

## Runtime evidence (P14, worktree dev server)

Fresh mortal (5 pts into Thể Chất): baseline `finalStats` vit 6 / def 5.4 / might 10.6 / hp 148 / regen 0.6 → seeded `completedTiers=5` → vit 8 (+2 tạng), def 9.4 ((5+4)+0.4 str-derived), might 15.6, hp 204 (140 + 8×8), regen 2.3 (1.5 + 8×0.1). `luyen-the:*` = 0, `baseStats` raw. Panel: 5 rows `done`, Mạch `realm_locked`, labels from `baseGains` keys. 0 console errors.

## Findings

None — 0 confirmed defects, 0 suspected. Notes:
- `baseGains` magnitudes are marked `P7-M-F PLACEHOLDER` pending the dedicated balance phase (per mission spec — not a QA defect).
- `BodyChapterShared` unexported while its derived interfaces are exported — valid TS here (no declaration emit); Nit.

## Verdict: PASS WITH EVIDENCE
