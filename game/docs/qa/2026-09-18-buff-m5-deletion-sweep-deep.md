# QA Review: Buff M5 — legacy deletion sweep + residual consumer migration

- Date: 2026-09-18
- Mode: deep
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/core/buff/` (deleted, 11 files), `src/core/artifact/ArtifactSystem.ts` + `src/core/battle/Battle.ts` (deleted dormant cluster), `src/core/battle/ActionTargetingSystem.ts` (`selectRankedTarget` removal), `src/core/buff2/BuffNames.ts` + `BuffNames.test.ts` + `BuffAcceptance.test.ts` (new), `src/core/reaction/ReactionGate.production.test.ts` (new), `src/components/game/combat/TurnOrderStrip.vue`, `src/core/battle/turn/TurnStatusPresentationEvents.ts`, `src/core/enemy/{EnemyStatInput,EnemyStatInput.test,TribulationPhase}.ts`, `src/data/enemy/FoundationEnemies.ts`, `src/core/game/GameManager.mvpLoop.test.ts`, `tests/architecture/vitalsWriteAuthority.test.ts`, `docs/systems/buffs.md`, `docs/roadmap.md`

## Scope and Risk Map

Buff M5 executes the megaplan deletion list: the legacy `core/buff/` package and its dormant consumers retire; every remaining production/test consumer re-points to `core/buff2/` (canonical authority since M4, deep-QA'd at `docs/qa/2026-09-18-buff-m4-cutover-deep.md`). One-hop consumers: `TurnOrderStrip` buff badges (display), `TurnStatusPresentationEvents` polarity (status VFX diff), `EnemyStatInput` validator (D21 enemy-path gate), `FoundationEnemies`/`GameManager.mvpLoop` buff literals, save layer (persistent buffs). Escalation: deletion of a production authority + cross-boundary validator rewrite → deep audit. Exclusions: `data/buff/**` imports of `data/buff/` catalog (canonical, untouched), `core/artifact/{Artifact,ArtifactProgression,ArtifactRuntime}.ts` (self-contained remnant, zero refs to deleted files).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-M5-01 | Deleted `core/buff/` + `ArtifactSystem`/`Battle.ts`/`selectRankedTarget` | Any import of removed module | Recoverability — no dangling static/dynamic import | Reorder (stale path in unrelated file) | Zero live refs; type-check + build + full suite green | vitest+build | High: import failure would break boot |
| INV-M5-02 | `EnemyStatInput.assertEnemyDamageSurface` | Embedded enemy buff (tribulation/enrage/bossTrigger) authored with gated stat or reaction id | Boundedness — D21 reaction exclusivity preserved | Value mutation (reaction id in `convertsToId`, `appliesBuffId`, `appliesDefinitionId`) | Throws with named violation; `EnemyStatInput.test.ts` green | unit | High: enemy-path reaction leak |
| INV-M5-03 | `FoundationEnemies` tribulation/enrage literals | buff2-shape literals validated | Compatibility — validated-but-inert config parity | Stale state (fields orphaned by retired realtime BattleSystem) | `assertEnemyDamageSurface` passes production data; no live consumer regressed | unit | Medium: dead-lane literals could desync silently |
| INV-M5-04 | `TurnOrderStrip` buff badges | buff2 read-port snapshot → display name/tooltip | Synchronization — UI reflects authority | Missing/unknown def id | `buffDisplayName` throws-safe fallback; `tryGet` polarity default | component | Medium: display crash or mislabel |
| INV-M5-05 | `TurnStatusPresentationEvents` polarity | snapshot entry polarity for VFX diff | Correctness — same derivation as `sourceTypeOf` | Def without declared `polarity` | Derivation `kind==='debuff'\|'ailment' → 'debuff'` identical to `BuffQuery.sourceTypeOf` | unit | Medium: debuff mislabeled as buff in VFX |
| INV-M5-06 | `BuffPersistence` (persistent pool) | `kiep_thuong` applied at tribulation defeat → survives reload? | Recoverability — persisted result parity | Interruption (reload with active debuff) | Legacy `buffPool` never in save shape (`git log -S` empty) — non-persistence is pre-existing parity, not regression | inspection | Medium: duration loss on reload |
| INV-M5-07 | Dormant cluster removal | `ArtifactSystem`/`Battle.ts`/`selectRankedTarget` deleted | Atomicity — dormant subsystem removed whole, no half-references | Cross-system chain (who calls targeting/artifact) | Zero callers pre-deletion; `core/artifact/` remnant has zero refs; suite green | unit+build | High: half-deleted subsystem |
| INV-M5-08 | `vitalsWriteAuthority` allowlist | `ArtifactSystem.ts` entry stale after deletion | Exactly-once — allowlist hygiene | Stale state | Entry removed; guard re-green | unit | Medium: stale allowlist hides future violations |
| INV-M5-09 | Reaction production boundary | M-INT inertness after M5 | Lifecycle — no dispatcher/grant in production runtime | Hidden coupling (wiring re-added during sweep) | `ReactionGate.production.test.ts` (2 tests) locks: no `ReactionDispatcher`, no `elemental_reaction_enabled` grant, elemental infrastructure live | unit | High: premature reaction activation |
| INV-M5-10 | Orphan `TurnBuff*` test files | `TurnBuffIdentity.test.ts`, `TurnBuffSystem.reactiveTrigger.test.ts` retained | Compatibility — historical filenames drive live buff2/TBS paths | False-positive deletion | Both exercise real `TurnBattleSystem`+buff2 registry; green in full suite | unit | Low: mis-deleting live coverage |
| INV-M5-11 | `GameManager.mvpLoop` + `FoundationEnemies` literals | buff2 fields (`instanceScope`/`stacking`/`lifetime`) | Compatibility — literal shape parity | Malformed partial migration | Registry validates all defs at load; suite green | unit | Medium |
| INV-M5-12 | `docs/systems/buffs.md` rewrite | Doc vs code drift | — | Stale doc (old doc named deleted files as live) | Rewritten for buff2/`BuffStore`/`BuffPersistence`/capability homes; ailment table matches `LegacyBuffs.ts`/`buffs.ts` ids | inspection | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (in `npm run verify`) | PASS | vue-tsc clean post-deletion |
| `npm run build` (in `npm run verify`) | PASS | vite build, 1764 modules |
| `npx vitest run` (full, post-fix re-run) | PASS | 657 files / 5548 tests / 4 expected-fail, 0 failures |
| `npm run test:e2e` (Playwright, worktree) | PASS | 27/27 incl. `turn-combat-hud`, `tribulation-flow`, `wave-vfx-capture` |
| `vitest run tests/architecture/{vitalsWriteAuthority,eslintCoreSeverity}` | PASS | 5/5 — eslint probe 1.2s standalone (first-run 60s timeout = parallel flake, resolved) |
| Residual-ref grep `core/buff['"/]` + deleted symbols across `src/` | CLEAN | Only comments + `data/buff/` catalog imports |
| Dynamic-import grep `import(` over battle/game/save | CLEAN | No lazy buff/artifact lane |
| `git log -S buffPool -- src/services/save/` | EMPTY | Persistent buffs were never serialized — parity |

## Findings

### QA-2026-09-18-M5-1: Stale vitals-write allowlist entry after ArtifactSystem deletion
- Severity: Medium
- Status: Confirmed → FIXED during QA (allowlist test edit only — inside QA write boundary for `tests/`; the fix removed the entry, not production code)
- Invariant: allowlist hygiene (stale entries hide future violations)
- Reproduction: `vitalsWriteAuthority.test.ts` failed — `ArtifactSystem.ts no longer writes vitals`
- Expected/Actual: allowlist must track live writers; deletion left a stale entry
- Evidence: test failure output; entry removed; guard re-green (3/3)
- Test file: `tests/architecture/vitalsWriteAuthority.test.ts`
- Owner subsystem: architecture guards
- Blast radius: none — guard metadata only

### QA-2026-09-18-M5-2: `tribulationPhases`/`enrage` are validated-but-inert content fields
- Severity: Low
- Status: Coverage gap (pre-existing, not task-caused)
- Invariant: — (informational)
- Evidence: realtime `BattleSystem.updateTribulationPhases`/`updateEnrage` consumers were retired before M5; `BossTurnTriggers` (live turn path) uses `bossTrigger`, not these fields. M5 kept literals valid for `EnemyStatInput` parity — correct scope; reviving the lane is a future turn-side port, out of scope.
- Owner subsystem: enemy data / turn combat
- Blast radius: none — fields documented inert in `TribulationPhase.ts` comments

### QA-2026-09-18-M5-3: `kiep_thuong` duration does not persist across reload
- Severity: Low
- Status: Coverage gap (pre-existing — legacy `buffPool` was equally unsaved; `git log -S buffPool` on `src/services/save/` is empty)
- Invariant: Recoverability — but parity, not regression
- Evidence: no serialize/hydrate on `BuffPersistence`/`BuffStore`; save layer has no buff fields
- Owner subsystem: `BuffPersistence` + save shape (future owner decision needed if persistence is desired)
- Blast radius: one 60s debuff refreshed on re-application

## New or Changed QA Tests

- `tests/architecture/vitalsWriteAuthority.test.ts` — removed stale `ArtifactSystem.ts` allowlist entry (test-metadata fix within QA write boundary; the guard itself demanded removal).

## Gaps and Residual Risk

- Polarity derivation duplicated inline in `TurnStatusPresentationEvents.ts:48-50` vs `BuffQuery.sourceTypeOf` — same logic, cosmetic duplication; Low, safe to defer (importing `sourceTypeOf` would create a heavier dependency edge into a presentation file for one line).
- `eslintCoreSeverity` first full-run timeout: `Flaky`-adjacent evidence — passed deterministically on isolated re-run (1.2s) and in the post-fix full re-run; environment parallelism, not code.

## Pre-existing Failures

None task-relevant. `tribulationPhases`/`enrage` inertness and `kiep_thuong` non-persistence predate this task (recorded above as gaps, not findings).
