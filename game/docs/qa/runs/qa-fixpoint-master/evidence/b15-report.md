# Beta Scope Consumer-Seam Audit — 77aecae0

**Repo:** hnkm080596-svg/tutienidle @ `77aecae05b282910b1c7a5d8d690ba05a49704c3` (branch `devin/qa-fixpoint`, pinned — no later commits)
**Scope:** consumer/integration seams only — every place persisted/restored state is consumed downstream of the betaScope boundary, plus tri-state verdict honesty.
**Probe:** `game/tests/architecture/betaConsumerSeamsQa.qa.test.ts` — 12 tests, 9 pass (controls), 3 fail on the pinned commit (repro evidence).
**Verification:** `npm run type-check` clean; probe file ASCII-only; worktree diff = the one new test file.

## Verdict

**FAIL WITH REASON** — 1 confirmed consumer-seam leak (Low), 2 latent open seams with no live mint today. Everything else swept is closed: after many prior QA waves, nearly every consumer carries an explicit fail-closed `BETA SCOPE LOCK` gate, and the flagged-save contract (load intact + flag explicitly) is verified end-to-end.

## Findings

### F-QA-CONS-BADGE-1 — CONFIRMED (Low)

- **Surface:** `src/composables/useBuildingNavigation.ts:97` — `getBuildingStatus('pill_room')` renders on `HomeBuildingIcons.vue:81` nameplates.
- **Defect:** the badge counts `gameManager.alchemyOps.getAlchemyJobs().length` — the UNFILTERED job list. Parked dormant-family jobs (restored from a carried save; `AlchemySystem.tick` parks them forever at :370-374, never settle, never render in the panel) mint a permanent `active` badge, and since `active` outranks `upgradeable` in the priority order (`locked > ready > active > upgradeable`), the upgrade signal is masked forever.
- **Sibling consumers do filter:** `getBetaAlchemyRecipeModels().activeJobs` filters `betaRecipeFamilyOfId !== null` (:401-403); `AlchemyView` filters job rows (:195). The badge is the only consumer that doesn't — tri-state honesty violation: a scope-hidden record renders as live work.
- **Repro:** two failing assertions in the probe — `expect(badgeStatus('pill_room')).not.toBe('active')` gets `'active'`; `expect(...).toBe('upgradeable')` gets `'active'`.
- **Mint path:** none — cosmetic badge only; the upgrade command still works via the popover. The leak is a visible surface state, matching the contract's "dormant scope leaking into visible play through a consumer path" clause.
- **Fix hint:** `getAlchemyJobs().some(job => betaRecipeFamilyOfId(job.recipeId) !== null)`.

### F-QA-CONS-SURVIVE — COVERAGE GAP / latent (Low)

- **Surface:** `src/core/game/CombatBuild.ts:385` — `resolveCombatBuild` binds `survive.extraSources` off the **raw** `runtime` param, not `gatedRuntime`. Every other runtime channel (roles, statDomains, buildDynamicBasic, resolveMaxThe) routes through the `wayAdmitted` gate; this one does not.
- **Repro:** failing probe — a hidden_spell save + a runtime stub implementing `buildSurviveSources` binds the function where the contract expects `undefined`.
- **Mint path:** none today — no runtime implements `buildSurviveSources` (`CultivationPathRegistry.ts:495` marks it parked). The first dormant runtime to implement it leaks survive sources into battle on a carried save.

### F-QA-CONS-COLLECT — COVERAGE GAP / latent (Low)

- **Surface:** `GameManagerBuildingOps.collectBuilding` (:289) / `getBuildingStoredAmount` (:330) carry no `isBetaBuildingSurface` gate (unlike `buildBuilding`/`upgradeBuilding` at :65/:78/:269).
- **Mint path:** none today — `chi_hien_quan` (the only scope-hidden building) authors no `producesMaterialId`, so collect resolves nothing (probe passes: returns 0). If a hidden building ever produces, these accessors mint materials/`ready` badges ungated.

### F-QA-CONS-LOCALE-NIT — noted (Nit)

- EN tutorial step 4 says "forge and **refine**" while `equipmentRefine` is scope-hidden; the VI source ("chế tạo và cường hóa" = craft/enhance) matches the live tab. Wording only.

## Seams verified closed (probed where noted)

| Seam | Evidence |
|---|---|
| `resolveCombatBuild` | wayAdmitted gate covers kit/roles/domains/maxThe; formation → `DEFAULT_PARTY_FORMATION`; companions → `[]`; tran-phap buff + hidden aura gated. Carried hidden_spell save probe: all pass. |
| `resolvePlayerStatAssembly` | rebuild-don't-trust — forged realm/talent/meridian claims drop (grant-marker + realm-order + authored-shape checks); dormant way facet emits nothing. Probe passes. |
| Alchemy settle/park/start/preview/models | dormant job parks without event or pill (probe: 0 events, 0 pills, job retained); `usePillDetailed` → `scope_hidden`; `startAlchemyJob` → `scope_hidden`. |
| Vendor | dormant material ids carry no profession meta → unsellable. |
| Quest claim/settle | `isUnlocked` = isBetaQuestEnabled && realm && !tokenOnly; reconcile deactivates stale; drops filtered per-item. |
| Production worker settle | `getWorkerAssignments` → empty map under lock; `getWorkforceView` censors `assignedWorkers` (probe passes). |
| Offline settle | bounded persisted CPS; autoFarm reconcile drops ineligible farms; worker settle uses the gated assignments path. |
| Decompose | `isScopeHidden('equipmentOreDecompose')` at every seam; getSettings masks workers → 0. |
| Notifications/toasts | all emitters sit downstream of gated writers; parked jobs emit nothing. |
| Tutorial | 9 static steps, both locales clean (EN 'refine' nit noted). |
| Save migrations | every version bump rejects old saves outright — no migration path exists to mint dormant state. |
| Devtools | `import.meta.env.DEV`-gated, disabled under supabase mode. |
| Character/SkillPath/Realm/Equipment panels, wheel slots, left panels, popovers | all filtered through isBetaTalentId / isBetaWay / betaSkillAdmitted / isBetaEquipmentTab / isBetaBuildingSurface / betaWheelSlots. SkillRoleStrip rail filters `betaCombatRolesFor` scope-hidden roles. |
| Companion ops / artifact / hidden realm rows / hidden beasts / tribulation hiddenType | all fail closed on `isBetaFeature`/`isScopeHidden`; flagged `*_owned`/`*_out_of_scope` reasons fire. |
| Flagged-save contract | `validateGameSaveShape` accepts a fully-dormant save (ok:true) AND `unsupportedReleaseReason` flags it — loads intact + flags explicitly. Probe passes. |

## Attachments

- `findings.json` — machine-readable findings
- `game/tests/architecture/betaConsumerSeamsQa.qa.test.ts` — probe file (failing assertions = repro evidence)
