# Blind Audit - AUTHORITY/Scope Write Seams

- Date: 2026-10-01
- Mode: adversarial QA (blind audit, AUTHORITY/scope seams only)
- Scope: devin/qa-fixpoint @ ea406a1f (pin - not latest)
- Audit surface: every write/authority seam the beta scope contract is
  supposed to close - purchase/upgrade/learn/respec/spec-claim, node/tree
  admission, way selection, talent invest, building build/upgrade/worker
  assigns, production cycles, alchemy job starts, quest accept/claim, pill
  craft/consume/dissolve, equipment enhance/socket/dissolve, formation
  edits, devtools/admin paths, migrations, event handlers that write
  state - plus persisted-claim producibility at save boundaries.
- Evidence: tests/architecture/scopeWriteSeamsBlind.qa.test.ts (30
  probes: 24 pass, 6 it.fails defect pins) + the codebase's prior
  betaScope seam suites. Machine findings:
  docs/qa/2026-10-01-scope-seams-blind.findings.json
- Excluded residual class (per task): same-value forged counters where
  an authored writer could produce the value.

## Verdict: PASS WITH GAPS

Every attacked seam fails closed against dormant scope - the codebase's
gate coverage is comprehensive (nearly every public write surface carries
an explicit BETA SCOPE LOCK gate, and flagged saves still LOAD per the
mortal-boundary contract). Three gaps found, all Low: one latent
write-path bypass whose mint precondition is non-producible at pin, one
inert dormant-record writer with no callers, and one dev-only devtools
bypass stripped from production builds.

## Findings

### F-TECH-1 (Low, Confirmed) - TechniqueSystem.grant bypasses betaTechniqueAdmitted

- Surface: `src/core/technique/TechniqueSystem.ts` `grant()` (L58-79);
  public mint path
  `src/core/game/GameManagerRealmAdvanceOps.ts` `grantCanonicalTechnique()`
  (L282-290), exposed as `gameManager.realmAdvanceOps` (public field).
- The defect: `grant()` is the technique holder-creation writer and the
  lone member of its mutator class with no `betaTechniqueAdmitted()`
  check. It refuses only (a) same-id on a non-empty holder and (b) grade
  above `getTechniqueGradeCeiling(realmId)` (= realmIndex). Every sibling
  gates: `gainMastery` (L97), `sealFrozenCycle` (L146), and the ops-level
  `tryAdvanceTechniqueGrade` (explicit `betaTechniqueAdmitted`).
- Repro (deterministic): probe
  `'grantCanonicalTechnique must refuse dormant canonical %s on an empty
  holder'` (it.fails.each x5) - `grantCanonicalTechnique` returns true
  and mints `sword_control_art` / `dao_insight_art` /
  `myriad_swords_art` / `diamond_body_art` / `responsive_body_art` into
  the live holder on an empty-holder qi_refining player.
- Mint path: `realmAdvanceOps.grantCanonicalTechnique(id, player)` ->
  `techniqueSystem.grant(template, player.realmId)` ->
  `techniqueManager.setActive(clone)` (+ techniqueProgress mirror).
- Producibility at pin: NOT producible. The mint requires an empty
  holder at realmIndex>=1; initiation always grants the canonical, save
  ingress rejects `way + techniques:[]` at the shape layer and way-less
  non-mortal saves outright (both pinned by probes). Blast radius if the
  precondition ever becomes producible: the minted dormant canonical is
  suppressed by every downstream reader (band render filter, combat
  modifiers, all mutators) but its save emission then fails
  saveAcceptance's holder contract on next boot - an authored write path
  that could produce an unbootable save.
- Fix direction (not applied - audit only): mirror the sibling pattern,
  `if (!betaTechniqueAdmitted(template.id)) return false` before the
  `setActive` write; the mortal-canonical grant at L66-74 is unaffected
  (mortal ids have no dormant way).

### F-TECH-2 (Low, Confirmed) - setTechniqueQuality ungated on a dormant holder

- Surface: `src/core/technique/TechniqueSystem.ts` L211-219.
- The defect: writes `technique.quality` on the active holder with no
  scope gate - on a flagged save it mutates the dormant-way record that
  should stay frozen.
- Repro (deterministic): probe `'setTechniqueQuality must refuse a
  dormant-way canonical'` (it.fails) - dormant holder seated via
  `restore()`, `setTechniqueQuality('thien')` returns true and mutates
  the record; the identical write on the beta canonical succeeds
  (control).
- Producibility at pin: reachable whenever a dormant holder exists
  (flagged saves load canonicals legitimately); consequence inert -
  quality is display-level with no stat emission and no production
  callers (reserved M5+ axis).
- Fix direction: same `betaTechniqueAdmitted` guard as siblings.

### F-DEV-1 (Low, Confirmed) - enemySpawnDebug dev hooks bypass roster + mint persisted claims

- Surface: `src/core/dev/enemySpawnDebug.ts` (L35-73),
  `window.__tutienEnemySpawnDebug`.
- The defect: two scope-bypassing writers inside the DEV-gated hook:
  (a) `spawnEnemy(enemyId)` spawns ANY registered enemy template into a
  live turn battle - `BETA_ENEMY_ROSTER` admission never consulted
  (hidden beasts `co_thu`/`huyet_mong` enter live combat in a dev
  build); (b) `forcePerfectClear(stageId)` writes
  `perfectClearStageIds`/`perfectClearSeconds` - persisted claims no
  authored writer produced (the only authored writer is a real victory),
  which then emit into every later save and relax the stage idle gate.
- Repro (runtime): probe `'the DEV hook spawns a non-roster hidden
  beast live'` - stubbed `window`, `spawnEnemy('co_thu')` -> `spawned
  Co Thu`, `turnBattle.state === 'intro'`; `forcePerfectClear('
  stage_qi_01')` -> `perfectClearStageIds=['stage_qi_01']`,
  `perfectClearSeconds={stage_qi_01:60}`.
- Producibility: unreachable in production (`import.meta.env.DEV &&
  typeof window` guard strips the block); reachable in every dev/test
  context that provides `window`.
- Fix direction: filter `spawnEnemy` through `isBetaEnemyId` (or accept
  the dev-only risk explicitly); route `forcePerfectClear` through an
  authored claim path or mark the records as debug-sourced.

## Coverage map (verified gated - no defect)

Progression writes: `purchaseNode`/`upgradeNode`/
`purchaseSkillNodePath` (betaNodeWriteAdmitted); `learnSkill`
(betaSkillAdmitted, incl. the `syncTalentCombatPassive` grant path);
`respecNodeTree`/`previewNodeRespec`/`devResetBranch` (dormant-holdings
refusal); `selectSkillSpecialization`/`reconcileSpecClaims` (claimant
ownership + dormant refusal).

Way selection + way-owned writes: `chooseCultivationPath`/
`commitFiveElementInitiation` (isBetaWay + declaresElementAxis);
`applyPathChoice` reachable only via those gated callers;
`grantCultivationPathRealmReward`/`reconcileCultivationPathRealmRewards`/
`reconcileWayGrants`/`syncRealmPassive` (isBetaWay);
`syncRealmStatPassive` (realm-scoped - REALM_PASSIVES defines only beta
realms); `applySwordPathRealmTransition` (isScopeHidden).

Realm/breakthrough: `getBreakthroughRequirements`/
`canTriggerBreakthrough` close when `isRealmTransitionEnabled` is off
(TC->KD authored but disabled); `TribulationOutcomeService` re-derives
hiddenDormant + transition-enabled at settle; hidden lineage / Quan The
diversion / Nghich Chu Tian / hidden beasts all gated on
`isBetaFeature('hiddenContent')`.

Talent invest: `createTalentEntitlement`/`resolveTalentEntitlement`/
`collectTalentEffects` (isBetaTalentId + isBreakthroughAcquisitionEnabled).

Economy/building: `canBuildBuilding`/`buildBuilding`/`upgradeBuilding`
(isBetaBuildingSurface); `assignWorkers` +
`ProductionSystem.setWorkerAssignment` (manualWorkforce); alchemy
`startAlchemyJob` ops + domain `startJob` (betaRecipeFamilyOfId) +
settle/offline-settle (scopeHiddenPillFamilyOfId); pill consume
(scopeHiddenPillFamilyOfId); equipment enhance/dissolve in scope, all
wash/refine/ore-decompose entry points gated.

Formation: `setFormationLoadout` -> `commitFormationLoadout`
(isFormationUnlocked -> isBetaFeature); CombatBuild falls back to
DEFAULT_PARTY_FORMATION and suppresses Tran Phap buff/companions/aura
on scope-hidden domains.

Companion/artifact: `pullCompanion`/`exchangeCompanion`/
`claimCompanionGift` (isCompanionDomainUnlocked); `issueCompanionGifts`
(isScopeHidden); companion EXP/pull-token/domain-scoped/artifact-EXP
loot channels all gated; `setArtifactPath`/`tryUpgradeArtifactGrade`
(isArtifactDomainUnlocked).

Quest: `isUnlocked` activation seam + inverse reconcile + claim
(isBetaQuestEnabled); no dormant quest content exists in authored data
at pin (daily cadence fully retired).

Character creation: mortal precursor pick enforces linh_bao +
three-channel write at `saveAcceptance` + `MortalPrecursors`;
`EarlyGameBootstrap` starter refuses committed saves.

Save boundaries: `importSaveRaw`, cloud pull, restore preflight all run
`validateGameSaveShape` + `isSaveAcceptable`;
`resolvePlayerStatAssembly` rebuilds persisted modifiers against writer
witnesses (realm markers, meridian openedIds, loi_kiep ownership,
hiddenRealmIds suppression); node channel filtered via
`admittedNodeModifiers` (betaNodeWriteAdmitted). Migrations: none -
exact-version match. EventBus write subscribers: all gated or
presentation-only.

## Notes

- Prior QA rounds already hardened this surface - the surviving gaps
  are inside one file (`TechniqueSystem.ts`), i.e. the seam class that
  predates the scope-lock convention.
- `it.fails` probes are intentional defect pins: they document the
  current (defective) behavior deterministically and go red when a fix
  lands.
