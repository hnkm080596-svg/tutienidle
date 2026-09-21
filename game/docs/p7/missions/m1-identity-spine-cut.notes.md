# P7-M1 — Mission notes (architecture-worker-workflow G0–G5 evidence)

## G0 — Task card

- **Authorized outcome:** migrate the `(cultivationPath, cultivationWay)` identity spine to semantic English with a strict six-way `CultivationWayId` union — values, types, persisted fields, identity-facing names. Zero behavior change (spec `m1-identity-spine-cut.spec.md`, plan `m1-identity-spine-cut.plan.md` — both external-review PASS).
- **Owner:** `CultivationPathKit` (catalog/types) + `CultivationPathSystem` (resolution) — vocabulary change, ownership unchanged.
- **Stop condition:** plan Task 10 gates complete; `npm run verify` green; P5 ≥3 passes clean; external review PASS.

## G1 — Q1–Q12 evidence

| Q | Answer (evidence) |
|---|---|
| Q1 observable behavior | Same gameplay/gating/combat/ritual outcomes; invalid/absent pairs fail closed via `getActiveWayDefinition` + save pair-coherence (`saveShapeValidation.ts:376-431`) |
| Q2 authority | `CULTIVATION_PATH_MODULES` + `applyPathChoice`/`getActiveWayDefinition` — single identity authority, unchanged |
| Q3 state/persistence | `cultivationPath`/`cultivationWay`/`spellPath`/`swordPath` fields; v67→68 reject-old convention (`saveVersion.ts`) |
| Q4 consumers | 236-file census (plan tasks 2–8 file lists); leaf exceptions pinned in T1/T2 tables |
| Q5 timing | Atomic ritual write (`applyPathChoice`); no new timing surface |
| Q6 errors | Fail-closed everywhere: strict union + `ways[way]` membership + module validators |
| Q7 naming | N1 spine-English / N2 leaf-VN / N3 no-mixed — exceptions enumerated in plan tables |
| Q8 security | None — identifiers only |
| Q9 compat | No dual-identity support; old saves rejected by version bump (locked D6/D13) |
| Q10 duplicate/stale/interrupt | Ritual write is atomic; validators reject half-pairs; no retry surface added |
| Q11 old/alternate path | `PathWayId` deleted (no alias); legacy `_an` sentinels retained ONLY as negative test fixtures |
| Q12 scope/finish | File↔invariant map = plan tasks; stop = zero unclassified residue hits + verify green |

## Triggered domain modules (row-by-row at G4/G5)

- **C1–C7** combat/stat pipeline — way stat facets, `StatDomain` migration, delta-deriver keys, capability-gated combat branches.
- **S1–S6** save/persistence — v68 schema, `spellPath`/`swordPath` fields, shape validation, no-migration convention.
- **L1–L4** lifecycle — ritual atomic commit, realm-entry rewards, offer gates.
- **U1–U6** UI/presentation — way-gated panels, bridges, `KiemBarSnapshot.mode`, visual profiles.

## Execution log

(append as tasks complete)
