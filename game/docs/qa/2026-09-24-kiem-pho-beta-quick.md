# Adversarial QA — KIEM PHO BETA (quick)

Date: 2026-09-24 · Mode: quick · Scope: `devin/1790269261-kiem-pho-beta` vs `origin/master` (be1bdf8d)
Worker: KIEM PHỔ BETA implementation session (child of coordinator devin-5bf2143f50154f09bbdb6b8a1f7cb508)

## Task-owned paths

Production (15): CombatAction.ts, TurnSkillAction.ts, KiemPhoNodeModifiers.ts, KiemPhoProvider.ts, KiemPhoSystem.ts, CultivationPathRegistry.ts, ProgressionNode.ts, BalanceBaselines.ts, EarlyGameLoop.ts, SkillEffect.ts, LegacySkillAdapter.ts, KiemTuNodes.ts, KiemPhoCombos.ts, KiemPhoOrbs.ts, CombatVfxPresets.ts.
Tests/docs (13): KiemPhoBeta.test.ts (new), 11 edited test files, kiem-pho-beta-spec.md.
Excluded: none — all dirty paths are task-owned.

## Risk map

Mapper: domains `combat-and-tribulation`, `economy-and-progression`; `deepAuditCandidate: true` (cross-system: 2 domains). One-hop consumers: unlock/affordability UI, combat presentation, loot/progression persistence, save/offline.

Bounding decision (quick kept, per workflow rule "code inspection determines materiality"):
- No save schema, clock/offline, Vue/Pinia/Phaser lifecycle, or persistence-owner change — all edits are combat-side data + generic seams inside existing owners.
- The economy/progression touch is one `nodeId` literal in the scripted CANONICAL_EARLY_LOOP (`orb_dam_1`→`thich_can`) — same cost/gate shape, covered by MortalChapterJourney/QrProbe seams.
- New node->def channel (`skillDefinitionModifiers`) rides the existing way-gated collector pattern (mirrors `turnSkillResourceModifiers`/`bodyKitModifiers`); it cannot bypass NodeSystem purchase authority.

## Invariant ledger

| ID | Transition | Invariant | Result |
| --- | --- | --- | --- |
| QA-KPB-1 | combo fire -> ailmentInteractions on derived combo | Ordering (sec.8 pin: stacks->mods->triggers) | PASS — applyModifiers stable phase-sort; asserted `[extend, trigger, trigger]` on diep_ngan + nodes |
| QA-KPB-2 | liet_ngan/khai_ngan add_stacks | Boundedness + exactly-once (clamp at def maxStacks; never create instance; never re-roll apply) | PASS — 3 stacks post-CCC, 2 post-DDC, real TurnRuntime lane |
| QA-KPB-3 | thau_ngan scalesWithAilmentStacks | No consume; same-source own-scope scaling | PASS — stacks retained; scaleBuff{kiem_thuong,0.5,own} on hit op |
| QA-KPB-4 | diep_ngan/lien_tram trigger_periodic | One manual periodic tick via canonical BuffSystem | PASS — orb+combo+tick = 3 damage events on fire turn |
| QA-KPB-5 | nodeLevels mid-battle / folded def cache | Determinism, INV-13 identity parity | PASS — memoized per provider instance; no-matching-modifier fold returns the same object |
| QA-KPB-6 | armorPierceFraction sum | Boundedness | PASS — Math.min(1, existing+sum) clamp in applySkillDefinitionModifiers |
| QA-KPB-7 | canonical combo/obe def mutation via node apply | Immutability of canonical data | PASS — derived-copy semantics asserted in tests |
| QA-KPB-8 | way boundary (ngu player holding hien nodes) | Node inertness across ways | PASS — collectors gate on nodeWayApplies; tested both ways |
| QA-KPB-9 | save with deleted node ids (orb_dam_1, *_capstone) | Recoverability | PASS — collectors/aggregates iterate the catalog; orphan keys are inert, no fault. Insight spend not refunded — content-rework consequence, design-sanctioned (same as prior tree generations). |
| QA-KPB-10 | combo-id leakage into node/UI surfaces | K11 discovery contract | PASS — node descriptions predicate-generic; INV-7 literal scan green; zero stale id references repo-wide |
| QA-KPB-11 | repeat fire / double modifier application | Idempotency | PASS — applyModifiers derives fresh per fire; modifiers iterate once |
| QA-KPB-12 | resisted finishing Chem + ungated add_stacks/trigger | Correct target binding | PASS (by design) — add_stacks has no apply-gate lane (documented in SkillEffect.ts); identity same-source selector binds only the caster's instance; resisted apply => no instance => no-op. Design-sanctioned. |

## Findings

None confirmed Medium+. Two Low/coverage items recorded:

1. **Low** — `add_stacks` compiles to `add_buff_stacks` which has no `gateOnApplyResult` lane, unlike the other interaction kinds. Consequence bounded (identity same-source selector can only hit the caster's own instance; a resisted finisher simply no-ops). Documented inline; no action.
2. **Coverage gap** — no UI-level verification that SkillPathPanel renders the new `skillDefinitionModifiers`/`ailmentInteractions` effect fields gracefully (data-driven rendering expected to show description text only). Combat-side contracts are fully pinned; panel polish is presentation scope.

## Evidence

- `npm run type-check` — clean.
- `npx vitest run` scoped (15 files) — 187/187 green incl. new `KiemPhoBeta.test.ts` (17 tests) covering spec §8 invariants 1-18.
- `npx eslint` on all changed files — 0 errors on task-owned lines; 5 pre-existing unused-import errors in CultivationPathRegistry.ts identical on master (verified via master-file eslint).
- INV-7 combo-literal scan — green; `rg` sweep for retired ids/presets — zero hits outside the guard test.

## Verdict

**PASS WITH EVIDENCE** (per-operation label for the protocol ledger). deepAuditCandidate advisory discharged by bounding above; escalation to deep audit remains the coordinator's call — no evidence requires it.
