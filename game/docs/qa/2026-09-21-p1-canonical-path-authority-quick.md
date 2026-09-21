# QA Review: P1 Canonical Path Authority

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/player/CultivationPathKit.ts`, `CultivationPathSystem.ts`, `CultivationPathRegistry.ts` (+ 3 test files), `game/src/core/game/GameManager.ts`, `GameManagerProgressionOps.ts`, `GameManagerRealmAdvanceOps.ts`, `game/src/core/kiem-tu/KiemTuPath.ts`, `game/src/core/phap-tu/PhapTuPath.ts` (+ way test), `game/src/core/the-tu/TheTuPath.ts` (+ way test), `game/src/core/pill/PillSystem.ts`, `game/src/core/progression/NodeSystem.ts`, `game/src/core/tribulation/BreakthroughOutcomeService.ts`, `game/src/presentation/bridges/kiemBarBridge.ts` (+ test), `theBarBridge.ts` (+ test), `game/src/services/save/saveShapeValidation.ts` (+ test), `game/src/components/game/combat/hud/TurnCombatSkillBar.vue` (+ display test), `game/src/components/panels/{CharacterPanel,QuanKhiPanel,SkillPathPanel}.vue`, `loadout-sections/NodeTreePanel.vue`, `game/tests/architecture/cultivationPathIsolation.test.ts`, plus docs (`AGENTS.md`, `docs/systems/cultivation-paths.md`, `docs/architecture/2026-09-20-path-capability-inventory.md`, plan doc).

## Scope and Risk Map

Mapper output: 6 domains, `deepAuditCandidate: true` (save-and-cloud critical boundary, time-and-offline adjacency via `GameManager.ts`, 10 unmapped paths). **Escalation declined — risk confidently bounded by code inspection:** every unmapped path is either the new authority (`core/player/*`) or a module definition file reviewed line-by-line in the P18 OCR pass; all migrated call sites resolve to identical truth values on every reachable state (each swap maps a concrete predicate to the capability the same way declares). Time-and-offline is a false adjacency — no timed logic touched; `GameManager.ts` only gains a bound facade. The save boundary change keeps the same payload, same function, same ordering — rules moved verbatim into module hooks dispatched generically.

Exclusions: none. All task-owned paths reviewed.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-P1-1 | `(cultivationPath, cultivationWay)` pair / CultivationPathSystem | Corrupt or mismatched pair (e.g. `('phap_tu','ung_the')`, way-less `kiem_tu`) | Recoverability — fail closed, zero capabilities | Value mutation | `resolvePathCapabilities` returns empty set; all gates false | `CultivationPathSystem.test.ts` | High — corrupt saves reachable via hand-edit/migration |
| INV-P1-2 | `player.phapTu.element` / PhapTuPath module | `('phap_tu','ngo_dao')` pair with stale `element='fire'` | Synchronization — no element machinery under ngo_dao | Stale state | `getActiveElement` undefined; save validator rejects element outside ngu_hanh | `CultivationPathSystem.test.ts`, `saveShapeValidation.test.ts` | High — cross-system leak into route stats |
| INV-P1-3 | `phap_tu.reaction_aura` conditional / way facet | `hasStaticPathCapability` on a conditional cap | Boundedness — static read cannot prove conditional | Reorder | Returns `false` (fail closed); runtime path uses `hasPathCapability` with `hasSkill` dep | `CultivationPathSystem.test.ts` | Medium — wrong facade choice would grant aura unconditionally |
| INV-P1-4 | `GameManager.activePlayer` vs bridge `getPlayer()` | `theBarBridge` empowered flag via facade | Synchronization — both read the same object | Cross-system chain | `setActivePlayer(player.$state)`; bridges read `usePlayerStore()` — same underlying object | `theBarBridge.test.ts` (fake binds real resolver to same player) | Medium |
| INV-P1-5 | Way `stats.deltaDerivers` / StatCalculator registry | Stats recompute order: registration before deriver invocation | Lifecycle — lazy registration precedes consumption | Timing boundary | `collectActiveWayStatModifiers` + `resolveActiveWayStatDomains` both call `ensureModuleDeltaDeriversRegistered()` before any `calculateStats` consults derivers; `activeDomains` stamping goes through the resolver | INV-10 suite in `CultivationPathSystem.test.ts` | High — a missed registration silently drops phap_tu attunement deltas mid-battle |
| INV-P1-6 | `ngo_dao_hon_don` skill membership / SkillManager | Combat emblem gate change: `isPhapTuNgoDao` → `hasPathCapability('phap_tu.reaction_aura')` | Synchronization — emblem iff aura active | Stale state | Skill is `innateSkillId` on `ngo_dao_chan_quyet`, auto-learned at ritual equip; unlearnable passive → equivalence on all reachable states | `TurnCombatSkillBar.display.test.ts` | Medium — deliberate semantic change (emblem = aura indicator), not a defect |
| INV-P1-7 | `kiemTu` slice + `ung_the` pair (both slices present) | kiemBarReader bar selection order | Recoverability — committed pair owns the bar | Value mutation | `the_tu.the_economy` checked first → The bar for the committed pair; stray slice ignored | `kiemBarBridge.test.ts` | Low — corrupt-only state; capability-first is the intended semantic |
| INV-P1-8 | `usesTheResource` field retirement | Any residual consumer | Conservation — no orphaned reads | Repeat | Zero production references remain; `the_tu.the_economy` cap replaces the single reader | `CultivationPathKit.test.ts`, `kiemBarBridge.test.ts` | Resolved — no code refs |
| INV-P1-9 | Save boundary module iteration | `validatePersistedState(playerPayload, emit)` per module | Atomicity — same checks, same boundary, generic dispatch | Value mutation | `phapTu` required on every save incl. mortal; `kiemTu` shape-checked wherever present; the_tu owns no slice (optional hook) | `saveShapeValidation.test.ts` (55 new lines) | High — regression-pinned |
| INV-P1-10 | Isolation guard check 4 | `player.kiemTu`/`player.phapTu` reads outside owners | Monotonicity — guard ratchets, never weakens | Repeat | Synthetic violation file proved red→green; allowlist = the 4 legitimate owners | `cultivationPathIsolation.test.ts` | Medium — guard gap is false-negative-only (comment-strip regex could eat `//` inside string literals; bounded) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (type-check + build + full vitest) | 688 files / 6004 tests passed, 4 expected-fail, build + vue-tsc green | Second run after TurnCombatSkillBar mock fix; clean |
| `npx playwright test tests/e2e/cultivation-path-ritual.spec.ts` | 7/7 passed (4.2m) | All 6 ways incl. both hidden paths; run in worktree |
| Guard red→green proof | Synthetic `player.kiemTu` read in a component flagged; removed → green | Check 4 fires correctly |
| `usesTheResource` grep | One comment remains, zero code refs | Full retirement confirmed |
| `hasStaticPathCapability` on conditional caps | Zero call sites | No misuse possible |
| `activePlayer` identity | `setActivePlayer(player.$state)` — same object as `usePlayerStore()` | No facade/bridge desync |

## Findings

No Confirmed or Suspected findings. INV-P1-6 is a deliberate, plan-approved semantic change (the emblem is the aura indicator; the skill is an innate ritual grant), not a defect.

## New or Changed QA Tests

None added by this QA run — the implementation already carries regression coverage for every high-priority hypothesis (fail-closed pairs, stale slice rejection, conditional-cap deps, module-validator dispatch on all save shapes).

## Post-review state (external implementation review — CHANGES round 1)

Three reviewer findings were addressed in the final state:

- `PathSubpathAxis.read` callbacks removed — axes are now data-only `{requiresCapability, state}` metadata; concrete reads moved into `CultivationPathSystem`. `the_tu` ways declare `root` as an ownership record (`player.nodeLevels`, no reader).
- `Kit -> SkillSystem` import cycle severed: `CAST_LEVELING_THRESHOLDS`/`getCastLeveledSkillLevel`/`HUY_*_L3_CASTS` extracted to leaf `core/skill/CastLeveling.ts` (SkillSystem re-exports). Eager deriver registration restored; `hasStaticPathCapability` now routes through `resolvePathCapabilities` (`'static'` mode) — one derivation authority.
- E2E coverage added: `cultivation-path-ritual.spec.ts` now asserts the Kiem Pho provider attaches on `players[0].dynamicBasic` after ritual→combat (hien) and `van_phap_than_hoa` reaches `getBattleBuffs(players[0].entity.id)` at battle entry (ngo_dao).

## Gaps and Residual Risk

- Aura HUD visibility has no DOM oracle (no buff display channel in the HUD DOM); the E2E asserts the runtime grant through `getBattleBuffs`, which is the same read the combat UI uses. Engine-level coverage (`GameManager.ngoDaoReaction.test.ts`) exercises both grant seams.
- Guard check 4's comment-stripping regex could theoretically mask a slice read inside a string containing `//`; false-negative only, no current violation. Nit.
- `kiemBarBridge` corrupt dual-slice state now prefers the committed pair's capability over slice-presence (INV-P1-7) — intended fail-toward-authority behavior, recorded for awareness.

## Pre-existing Failures

None observed. The 4 `expected fail` entries in the vitest run are pre-existing `it.fails` markers unrelated to this change.
