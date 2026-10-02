# QA Review: consumer/integration bind (Clean Round 7 — blind)

- Date: 2026-10-02
- Mode: deep (blind consumer/integration seam census)
- Base: `devin/qa-fixpoint` @ 80a1cbf2
- Verdict: **CLEAN — no new consumer leaks.** Every persisted
  way/hidden/dormant-state claim that can reach a live surface routes
  through a canonical `betaScope*` verdict or a resolver that is itself
  gated. 19 regression probes pin the closed boundaries
  (`src/core/betaConsumerBind.round7.qa.test.ts`, all green).

## Findings

None.

## Still-present covered finding (not counted, for the ledger)

F-B-CONS-3 persists: `WorkerLodgePanel.vue:15` still imports
`isCompanionDomainUnlocked` from `@/core/companion/CompanionAvailability`
(the §F banned import) instead of consuming `getWorkerLodgeSurfaceModel()`,
which remains an unconsumed read model. Still fails closed under the lock
(`isCompanionDomainUnlocked` composes `isBetaFeature('companion')`), so no
live leak — reported in Round B, not re-counted here.

## Boundary evidence (what the probes pin)

Probe file: `src/core/betaConsumerBind.round7.qa.test.ts` (19 tests). All
probes construct a *carried* save — a player whose dormant-domain claims
arrive from a pre-lock snapshot — and assert the live surfaces emit
nothing. Locks re-pinned via `lockBetaFeaturesForTests` /
`lockBetaWaysForTests` / `lockBetaTalentsForTests` (the global vitest
setup unlocks everything).

| Probe block | Claim pinned |
| --- | --- |
| A. Way capabilities | `resolvePathCapabilities` (CultivationPathSystem.ts:189-192) fails closed for carried `sword_pathway`, `hidden_sword_pathway`, `body_pathway`, `hidden_body_pathway`, `hidden_spell_pathway`; `spell_pathway` stays live (`spell.elemental_casting`, `spell.essence_pool`). One root gate closes the whole combat-HUD capability class (kiemBar/theBar/isAnPath/realm rewards). |
| B. Hidden domain | Carried Nghịch save (`zhou_tian.completed = ZHOU_TIAN_DAI_STEP`, discovered + completed mechanic): `isNghichChuTianRevealed` false, `attemptNghichChuTian` returns `ineligible` with zero writes (JSON snapshot equal), `isNghichChuTianEligible` / `isAncientBeastTrialEligible` false on carried mortal lineage. Root gate: `canProgressHiddenBody` → `isBetaFeature('hiddenContent')` (HiddenLineage.ts:136). |
| C. Companion pulls | `pullCompanion` rejects `realm_locked` on a Tru Cơ save with pulled tokens; token count, `duyenPhan`, and `pulls` history preserved untouched. |
| D. Building surface | Carried `chi_hien_quan` instance + live `thanh_van_go_s1`: `upgradeBuilding` false, `assignWorkers` false, `productionSystem.setWorkerAssignment` false; `isBetaBuildingSurface` / `betaAdmittedBuildingPopoverId` null. |
| E. Talent entitlement | Every member of every enabled `BREAKTHROUGH_TALENT_POOLS` entry is `isBetaTalentId` + legal offer; a carried `golden_core` entitlement is inactionable (`isTalentEntitlementActionable` false) and `resolveTalentEntitlement` kind `new` rejects — nothing lands in `selectedTalentIds`. Gate: `isBreakthroughAcquisitionEnabled` (ReleasePolicy). |
| F. Quest surface | A stale `daily_`-family quest that still resolves from the catalog deactivates under the lock at every seam: `getActiveQuests` empty, `canClaim` false, `claim` false (reward receiver untouched), `reconcileQuestLifecycle` removes it. |

## Census notes (surfaces inspected, no leak)

- **Mount seams** — `GameRoot`/`FunctionOverlayPanel`/`BuildingDetailPopover`:
  all gated (`isBetaLeftPanelMode` in `ui.ts` mutators +
  `isBetaStandalonePanel` watcher + `betaAdmittedBuildingPopoverId`).
  Round-B fixes verified landed.
- **UI persistence** — `stores/ui.ts` persists only
  `battleRunMode`/`combatInputMode` (live features); `leftPanelMode` is
  session state and every mutator is gated — a carried save cannot smuggle
  a scope-hidden mode.
- **Luyện thể (body path) LIVE check** — `BETA_PLAYABLE_WAYS` contains only
  `spell_pathway`; `body_pathway` is a dormant way. Its *live* half is the
  static `body.essence_economy` capability and hidden-body realm records —
  capability reads are closed (probe A) and `betaHiddenRealmRecordFor`
  suppresses dormant realm records (probe B chain). Only hidden
  breakthrough is gated, matching the contract.
- **Combat HUD** — `TurnCombatSkillBar` (`betaCombatRolesFor`),
  `pollKiemBar`/`pollTheBar`/`isAnPath` all reach `hasStaticPathCapability`
  → gated resolver (probe A).
- **Quest/Alchemy/Material/Skill/Technique/Realm/Character panels** —
  activation, projection, and claim seams each re-apply their domain
  verdict (QuestSystem.ts:153/182, AlchemyView `betaRecipeFamilyOfId`,
  MaterialBagSection companion-token suppress + `isDomainScopedAcquisitionEnabled`,
  SkillPathPanel/`betaSkillAdmitted`, TechniqueBand `betaTechniqueAdmitted`,
  RealmPanel `betaNextRealmSurfaceFor`, CharacterPanel
  `isBetaWay`+`isBetaTalentId`+`isScopeHidden`).
- **Companion currency HUD** — `CurrencyHud` composes
  `isBetaFeature('companion')`; `DongFuCommandWheel` domain-unlock reads +
  `betaWheelSlots`.
- **Presentation/replay layer** — `getCultivateTexture` is the only way
  read and is gated; `resumeSession`/`useBootFlow` carry no dormant reads.

## Latent seams (not live leaks, no report)

- `TechniqueSlotCard` ungated `techniqueManager.getActive()` — reachable
  only through gated `TechniqueBand`.
- `getBetaAlchemyRecipeModels` / `getBetaQuestSurfaceModels`-style read
  models exist but are unconsumed (same class as F-B-CONS-3); `AlchemyView`
  re-derives with equivalent `betaRecipeFamilyOfId` filters.
- `GameManagerCompanionOps.test.ts` mocks `betaScope` open — test-side
  only.

## Access limitations

None — full repo, vitest, catalogs, and lock fixtures available.
