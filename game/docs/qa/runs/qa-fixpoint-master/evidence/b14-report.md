# Adversarial QA — Beta Scope Consumer Seams (blind)

- Date: 2026-10-01
- Scope: INTEGRATION/CONSUMER seams of the beta scope contract (dormant-content leakage, read-model lies, gate bypasses, fabricated claims minting live effects). Authority modules (betaScope.ts verdict math itself, validator internals) treated as trusted unless a consumer reaches around them.
- Mode: adversarial / hostile-save
- Pin: branch `devin/qa-fixpoint`, commit `120cba78`
- Evidence: `game/tests/lab/betaScopeSeams.test.ts` — 41 probes, run with `npx vitest run --config vitest.lab.config.mts tests/lab/betaScopeSeams.test.ts` (tests/lab has its own vitest config; the default gate's include list does not cover tests/lab).
- Result: 40 pass; the single failure is the intended expected-fail documenting F-1's executed breach.

## Seam census (all driven through real consumers)

| Surface | Consumer probed | Verdict |
|---|---|---|
| Way flag / kit / stat facets | getActiveWay, resolveCultivationPathRuntime, collectActiveWayStatModifiers, resolveCombatBuild | gated |
| Node channels (sword tree, off-element spell) | effectOps.getBattleBaseChannels, progressionOps.purchase/upgradeNode | gated |
| Skill restore + emissions | skillManager.restore, skillSystem.getScaledPassiveModifiers, getEffectiveSkill | gated (restore carries records; every emission seam re-checks) |
| Technique mastery/seal | techniqueSystem.gainMastery, sealFrozenCycle | gated |
| Way selection | realmAdvanceOps.chooseCultivationPath | fails closed |
| Hidden lineage | stat cap, writers (record/discover/close), read-model record, great_dao passive | gated |
| Realm passives | syncRealmPassive / resolvePlayerStatAssembly rebuild | gated + rebuild-don't-trust |
| Combat build | kits/survive/entry buffs/reactions/formation/companions | gated; F-2 latent |
| Combat loot | processDefeatedEnemies: material/pull-token/domain gates, EXP | gated; F-1 breach on pill branch |
| Alchemy jobs | alchemySystem.restoreJobs + tick (direct and lab live-tick) | parked inert, job persists loadable |
| Decompose | decomposeSystem.restore + tick + getSettings | inert, workers reported 0 |
| Worker capacity | betaEffectiveWorkerCapacity | gated |
| Tribulation settle | director.restoreRuntime + TribulationOutcomeService.settleOutcome | gated; forged claims parked |
| Talents | collectTalentEffects, upgrade pool, entitlement reconcile/resolve/offers | gated |
| Auto-farm / offline | reconcileAutoFarmRuntime, settleAutoFarmOffline | gated; dead leases grant nothing |
| Panels/popovers | isBetaStandalonePanel, isBetaLeftPanelMode, betaAdmittedBuildingPopoverId, betaRealmLadderNodes | gated |
| Save validation | validateGameSaveShape on hostile saves | flagged saves LOAD (inert-but-loadable contract); dormant-pill and unresolvable/unbounded timed claims rejected |
| Combat-role / skill-tree read models | betaCombatRolesFor, betaSkillTreeFor, activeElementTreeFor | tri-state correct, nothing half-renders |
| unsupportedReleaseReason | flag derivation across carried states | deterministic, precedence-ordered |

## Findings

### F-1 — Loot pill-drop branch bypasses the dormant-family scope gate — LOW (latent channel breach)

- Attack class: consumer seam missing a scope gate (channel breach; fabricated/carried drop line)
- Surface: `BattleLootSystem.grantResolvedDrops`, `case 'pill'` (src/core/game/BattleLootSystem.ts ~642-681)
- Evidence (executed): probe "SLEEPER: a pill-kind drop of a dormant family mints the dormant pill" FAILS — a registered enemy template with signature drop `{kind:'pill', itemId:'phi_van_dan_qi_refining', chance:1}` driven through `enemySystem.spawn` + `lootSystem.setSession` + `processDefeatedEnemies` lands `phi_van_dan_qi_refining` in the live `pillBag` (`expected ['phi_van_dan_qi_refining'] to not include ...`).
- Mechanism: the material branch applies three independent gates (breakthrough realm ~L570, `isCompanionPullTokenSourceSuppressed` ~L577, domain-scoped ~L586); the pill branch applies only `isBreakthroughAcquisitionEnabled(pill.breakthroughRealmId)`. Dormant-family tiered pills (`phi_van_dan_*`, `hoi_xuan_dan_*`, `to_cot_dan_*`, `thoi_the_dan_*`, `duong_than_dan_*`) carry no `breakthroughRealmId` (only `truc_co_dan` in SPECIAL_PILLS does), and `isBreakthroughAcquisitionEnabled(undefined)` returns `true` — so every dormant pill passes.
- Latency: `grep kind: 'pill' src/data/` — zero authored pill drops at the pinned commit; no live loot path reaches the branch. A minted dormant pill is further double-defended downstream (bag surfaces filter via `scopeHiddenPillFamilyOfId`, `usePill` rejects dormant families), but the mint itself — including the loot-toast notification — is ungated. Low severity: real gate hole on a dead channel; becomes live the day any drop table emits `kind:'pill'`.
- Repro: `cd game && npx vitest run --config vitest.lab.config.mts tests/lab/betaScopeSeams.test.ts -t "SLEEPER"`.

### F-2 — `survive.extraSources` binds the ungated runtime — NIT (dead binding, no implementation)

- Attack class: latent consumer bypass (future seam)
- Surface: `resolveCombatBuild` (src/core/game/CombatBuild.ts:385-387)
- Evidence (static): `extraSources` is bound from `runtime?.buildSurviveSources` — the pre-gate `runtime`, not `gatedRuntime` — while every other runtime-dependent emit (kits, entry buffs, reactions, aura at L347) flows through `gatedRuntime` (undefined when `!wayAdmitted`). A runtime that implements `buildSurviveSources` on a dormant way would emit survival modifiers through a scope-hidden way. Latent: CultivationPathRegistry.ts:495 comments "Beta: no buildSurviveSources" — no runtime implements the facet at this commit, so nothing is emitted today.

### F-3 — Dead scope predicates — NIT (dead code)

- `betaActOfEnemy` (src/core/betaScope.ts:332): zero production consumers (only its own architecture test in tests/architecture/betaScopeLockV2.test.ts).
- `betaActiveWayAdmitted` (src/core/betaScopeSkillDomain.ts:380): zero production consumers.
- `betaSupportedFor` / `betaPrecursorSurfaceVerdictFor` family is consumed by UI adapters; the two above have no live caller at the pinned commit.

## Holds (verified, no finding)

- Flagged saves (`unsupportedReleaseReason != null`) still load — verified for hidden progression, dormant alchemy, dormant decompose, dormant talents, companion/artifact/formation records. Dormant records are inert but loadable per contract.
- `resolvePlayerStatAssembly` is rebuild-don't-trust: shaped realm-source claims (forged marker above realm index, real sourceId + unauthored modifier id, non-realm sourceTypes) never reach computed stats; persisted records are not scrubbed (save fidelity preserved).
- `validateGameSaveShape` is max-authority on timed-effect claims: rejects dormant-family sources outright, rejects `appliedAtMs > lastSavedAt`, bounds regen `flat` to `mpPerSecond × 1.5`, whitelists the stat to `manaRegenPerTurn`, pins `effectGroup`/`durationStackable` to authored values.
- `settleAutoFarmOffline` refuses dead leases before reconcile (comment documents the ordering contract); ghost-stage leases pay nothing and reconcile drops them.
- Committed tribulation outcomes re-derive the verdict at settle: dormant-type/realm claims and realm-flag mismatches park inert; only a coherent beta admit settles.
- `grantRealmPassive` is internally ungated but unreachable for out-of-scope grants: REALM_PASSIVES only authors qi_refining/foundation_establishment entries, and realm-order + marker checks in the assembly cover forgery.
- `skillManager.restore` carries dormant skill records loadable; every emission channel (battle channels, scaled passives, resolveBasic/special, kit resolution, combat build) re-checks admission — defense-in-depth by design.
- Mortal basic pick guards to the precursor family + learned membership and falls back read-only — a carried `mortalBasicSkillId` naming a dormant skill resolves to the default rather than minting it.

## Coverage limits

- Probes drive the consumer entrypoints directly (managers/ops/systems), matching how the real code paths call them; Vue mount components were audited at their read-model boundary (panel/verdict functions) rather than rendered.
- `pham_nhan_chi_cot`/`pham_cot`/`kd_*`/`hoa_hau_thong_than` cover the dormant-talent classes; remaining dormant ids share the same admission predicate.
