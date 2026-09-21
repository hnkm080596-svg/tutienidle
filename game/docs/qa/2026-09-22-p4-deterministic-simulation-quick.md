# P4 Deterministic Combat Simulation — Adversarial QA (quick)

Date: 2026-09-22 · Scope: `src/core/simulation/**` + `docs/systems/combat-simulation.md` + `docs/architecture/2026-09-22-deterministic-simulation-inventory.md`
Mode: quick · Mapper: `unmappedPaths` (leaf tooling module, zero production consumers — risk bounded by inspection, same class as `CombatTraceExporter`).

## Hypotheses exercised

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| H1 | Cross-run state bleed (batch) | fresh `GameManager` per run + `runBattles` order-stability test (batch == solo fingerprints); P3 teardown audit additionally proved per-cycle freshness | NOT A DEFECT |
| H2 | Wall-clock leak via `persistentTimedEffects` (`expiresAtMs` absolute) | effects stripped before `setActivePlayer`; `tickTimedEffects` iterates an empty list — `Date.now()` default arg evaluated but never consumed → no behavioral effect | NOT A DEFECT (stripped + diagnosed) |
| H3 | `crypto.randomUUID` spawn ids leak into metrics | `roleKey()` normalizes to `enemy:<templateId>:<ordinal>` / `player` / `companion:<defId>`; fingerprint digest contains role keys only | NOT A DEFECT |
| H4 | Frame-rate dependence | `ManualClockSource` quantizes to integer fixed steps; FPS test (0.1/0.033/0.25 chunks → identical fingerprint + steps) green | NOT A DEFECT |
| H5 | `finalize()` double-scan mutating the resource ledger | CONFIRMED then FIXED — memoized `finalizedMetrics`; regression test `metrics and fingerprint derive from the same finalized state` | FIXED |
| H6 | Ward ops double-counted (trace + vitals both emit) | CONFIRMED then FIXED — vitals is ward-complete (every mutator emits); trace lane restricted to raw-write pools (`mana` via `consumeResourceFor`, `the` via `currentThe`); `apply_shield` covered by `ward_grant` vitals | FIXED |
| H7 | Engine-lane ward spend invisible (consume-ward burst, TurnBattleSystem ~2413, no trace record) | CONFIRMED then FIXED — now counted via `ward_spend` vitals; unit test emits the event directly and asserts `wardSpent` | FIXED |
| H8 | `'the'` resource ops silently dropped | CONFIRMED then FIXED — `theSpent`/`theGained` added to the ledger | FIXED |
| H9 | Unbounded drive loop on paused/stalled battle | CONFIRMED risk then FIXED — `STALL_LIMIT` (10k fed-time advances with zero consumed-step growth) → `timeout` | FIXED |
| H10 | Caller-owned input mutated | `structuredClone(player)`; `restore()` deep-clones skills/techniques; enemy `stats` is replace-only (`entity.stats = recomputeEffectiveStats`, no in-place writes — grep-verified); `spawn()` shallow-spreads templates | NOT A DEFECT |
| H11 | Pre-fight subscription gap (entry-buff events missed) | collector constructed BEFORE encounter dispatch | NOT A DEFECT |
| H12 | Timeout leaves a dirty live battle | `abandonBattle()` on timeout → forced terminal + P3-proven teardown | NOT A DEFECT |
| H13 | Uptime denominator includes presentation prelude | `fightingSteps` only; `aliveFightingSteps` per-entity | NOT A DEFECT |

## Recorded gaps (honest, not silent)

- `full_mitigation_unobservable`, `regen_overheal_unobservable` — carried from plan.
- Post-review correction: an earlier draft recorded `cast_resource_cost_unobservable` — external review correctly identified it as FALSE on the production path (routed casts carry costs as `consume_resource` ops via `routeCast`/`commitShell`; `consumeResourceFor` is the engine-unit lane only). Removed; the settled-`applied` lane is now proven by an injected routed op test.

## Boundary checks

- `grep`: no imports of `src/core/simulation/` outside itself — tooling-only holds.
- Harness imports are inward-only (GameManager, catalogs, clock/rng seams) — no upward edges, no new authority, no combat-rule branching.

## Verdict

**PASS WITH EVIDENCE** — 4 real defects found and fixed during adversarial review (H5, H6/H7, H8, H9). All findings verified against source lines cited above. Post-external-review delta: pre-step phase attribution (snapshot `phase` is post-step), hard `maxSteps` feed clamp, pre-abandon metric capture, capped-gain applied-vs-requested oracle, and the cast-cost gap removed as false on the production path.
