# BETA SCOPE LOCK v2 — Phase-5: economy prune + census + dormant-domain faucet shutdown

Work order: spec contracts §11–§17 + Phase-4 fallout. Backend/read-model only,
no styling. Branch `devin/1790790727-beta-scope-v2-economy` off
`origin/devin/beta-scope-v2` tip `3ff4b826` (betaScope.ts authority + skill
read-models + stage roster already merged).

## G0 — TASK CARD

- **Intent:** turn the merged Phase-1 authority (`core/betaScope.ts`),
  Phase-3 read-models, and Phase-4 stage roster into the effective beta
  economy: gate hidden equipment/production surfaces at the DOMAIN level,
  shut down dormant-domain faucets (companion/formation/artifact/hidden),
  retire daily + off-roster kill quests from the beta lifecycle, re-source
  orphaned equipment bases, and pin §17 census invariants.
- **Owns:** this phase owns the WIRING of already-authored flags into the
  economy seams + the census tests. It does NOT delete systems, does NOT
  migrate saves, does NOT touch `.vue`/styling.
- **Reads (authorities consulted):**
  - `core/betaScope.ts` — BETA_FEATURES / isBetaFeature / isScopeHidden /
    BETA_ENEMY_ROSTER / isBetaEnemyId / isBetaRecipeFamily /
    betaRecipeFamilyOfId / BETA_EQUIPMENT_TABS / isBetaQuestEnabled.
  - `core/realm/ReleasePolicy.ts` — ceiling, domain/pool suppression
    predicates (isBreakthroughAcquisitionEnabled,
    isCompanionPullTokenSourceSuppressed, isDomainScopedAcquisitionEnabled).
- **Done when:** all §11–§17 contracts hold behind tests; direct-API bypass
  tests fail closed; census test fails on orphan source/sink; draft PR into
  `devin/beta-scope-v2`.

## G1 — Audit (current state vs contract)

### A. Equipment (§11)

Surfaces found:
- `EquipmentOpsSystem` (`gameManager.equipmentOps`) — washItem /
  previewWashItem / getWashPreviewAffixes / discardWashTicket /
  commitWashItem / getWashCost / refineItem / previewRefineItem /
  commitRefineItem / discardRefinePreview / getRefineCost. All are thin
  delegates to `equipmentSystem` (the domain authority).
- **BYPASS:** `gameManager.equipmentSystem` is a public readonly field —
  ops-level gating alone would be bypassable. The gate must live in
  `EquipmentSystem` itself.
- `gameManager.decomposeSystem` (public field; ore -> luyen_khi_tinh_hoa
  engine): tick via `GameManagerTickOps:245`, `drainOutput` :247,
  `updateCapacity` :153, restore `GameManagerSaveRestore:397`,
  `settleOffline` :438. `getSettings().workers` feeds the
  resolveProductionWorkerCapacity split (tick :154 and saveRestore :429).

Decision: gate inside `EquipmentSystem` (wash/refine mutating + preview +
commit + ticket-read → `{ ok:false, reason:'scope_hidden' }` / `undefined`)
and inside `DecomposeSystem` (tick/settleOffline no-op, setSetting no-op,
listMatchingOres → [], getSettings → `{...settings, workers:0}` so the
worker split yields the full pool to production while getSaveState still
persists the real authored settings). Cost quotes stay pure (constant
lookups; they cannot "fail" meaningfully without signature churn that would
break Vue call sites — the deferred frontend swap consumes the read-model).

### B. Alchemy (§12)

- Recipes: `alchemy_<family>_<realm>` generated grid + two special recipes
  (`alchemy_thong_mach_dan`, `alchemy_truc_co_dan`).
- `gameManager.alchemySystem` is public — the family gate belongs in
  `AlchemySystem.startJob` (reject `scope_hidden` when
  `betaRecipeFamilyOfId(recipe.id) === null`); ops-level
  `startAlchemyJob` gets it free; `previewAlchemyOutcome` returns null for
  dormant families.
- NEW read-model `getBetaAlchemyRecipeModels(player)` on
  `GameManagerAlchemyOps`: only enabled families, per-variant herb + same-age
  fuel-wood sufficiency, spirit-stone + special-ingredient sufficiency,
  per-recipe active job, `craftable` verdict, scaled costs (Hoa Hau Thong
  Than multiplier applied like previewAlchemyOutcome).

### C. Production (§13)

- Auto allocation ALREADY exists: `ProductionSystem.tickWorkers` →
  `allocateWorkerSlots(activeSiteIds, assignments, capacity)` round-robins
  unassigned sites; decompose claims first via the shared split.
- Manual surface: `buildingOps.assignWorkers` →
  `productionSystem.setWorkerAssignment` (public system — bypass possible).
  Gate inside `setWorkerAssignment` (return false) when `manualWorkforce`
  scope-hidden; `assignWorkers` early-returns.
- Hidden grotto channels: `ProductionSystem.rollHiddenChannelRewards` —
  zero authored grotto channels today, but the mechanism is a live faucet
  seam → gate on `hiddenContent` (counter/emission frozen).
- NEW read-model `getWorkerLodgeSurfaceModel()` on `GameManagerBuildingOps`:
  `{ tabs: [{id:'nhan_cong', verdict:'available', manualAssignOffered}, ...companion tabs 'scope-hidden'] }`
  so the panel stops importing CompanionAvailability (frontend swap deferred).

### D. Companion / Formation / Artifact (§14)

Domain unlock predicates are the single seam every consumer already
consults (ops gates, UI, drop delivery, gift claims):
- `isCompanionDomainUnlocked` (CompanionAvailability.ts) — pullCompanion /
  exchangeCompanion / claimCompanionGift / feedCompanion / WorkerLodgePanel /
  BattleRewardSystemOps all compose it → add `isBetaFeature('companion')`.
- `isFormationUnlocked` (FormationPlacement.ts) — commitFormationLoadout →
  add `isBetaFeature('formation')`.
- `isArtifactDomainUnlocked` (ArtifactProgression.ts) — wheel slot,
  grantArtifactExperience, awakening gate → add `isBetaFeature('artifact')`.
- `CompanionGifts.issueCompanionGifts` (realm_entered/stage_completed mail
  grants) → early-return when companion scope-hidden: NO mailbox grants.
- Persistence untouched: `normalizeArtifactProgress` keeps owned artifacts;
  companion roster persisted; quests/gifts resume post-beta by flag flip.

### E. Quests + Phase-4 fallout (§15)

12 authored quests (`data/quest/quests.ts` — actually 11 records):
- Beta-enabled after wiring (6): collect_tu_linh_thao_1,
  collect_qi_refining_ore_decade_1, kill_wild_wolf_10,
  kill_foundation_floor_10_boss_1, collect_foundation_ore_30,
  kill_foundation_any_50.
- Scope-hidden (5): daily_collect_hoi_xuan_thao, daily_kill_bandit_15,
  daily_chieu_hien_lenh (cadence), kill_foundation_stone_fungus_15,
  kill_foundation_flood_dragon_whelp_10 (off-roster `enemyId`).

Decisions:
- Off-roster `once` quests are REMOVED from the enabled set (scope-hidden),
  NOT retargeted — retargeting rewrites authored species intent; the boss
  quest already covers `foundation_ferocious_flood_dragon_whelp`
  (note: `foundation_flood_dragon_whelp` is a different identity than the
  roster's ferocious variant — the plain whelp never spawns in beta).
- Wiring: `QuestSystem.isUnlocked` += `isBetaQuestEnabled` (activation +
  reconcile deactivation in one sweep); `resolveClaimable` += the same check
  (fail closed on stale claimable progress / direct call). `checkAndResetDaily`
  inherits through isUnlocked → no enabled daily path.
- Rewards: all enabled quests pay spiritStone/skillInsight/cultivation only —
  beta sinks exist. No itemDrop faucets on enabled quests.

Equipment bases (3 orphans):
- `base_quan` (helmet) was magma_boar-family exclusive; `base_hai` (boots)
  rock_bear; `base_gioi` (ring) metal_beetle — all three are the SOLE base
  of their slot, so removal from beta-visible output is not viable (would
  leave a slot unobtainable; `equipment_any` keeps them reachable anyway).
- Re-source to roster families: `base_quan` → `boar` (mortal_wild_boar —
  same species root), `base_hai` → `earthworm` (giant_earthworm — the
  earth heavy-creature of the roster), `base_gioi` → `sand_scorpion`
  (arthropod sibling of metal_beetle; requires forwarding `family` on the
  roster scorpion — `defineEnemy` already accepts the field, foundationBeast
  simply never passed it). Source families (magma_boar/rock_bear/
  metal_beetle) keep authored-but-empty pools, documented dormant.

### F. Talent

Faucets found: creation offers (`rollCharacterCreationTalents` — Phase-2's
scope), breakthrough entitlements (`BREAKTHROUGH_TALENT_POOLS` — qi_refining
+ foundation_establishment pools are beta-live; `golden_core` pool already
suppressed by isBreakthroughAcquisitionEnabled), the pham_cot ->
pham_nhan_chi_cot great-dao evolution inside resolveVictory (a mortal/foundation
narrative transformation, not a non-beta grant surface), PARKED_TALENTS at
weight 0 (no faucet). Quest rewards grant NO talents (QuestItemReward is
material/pill only). F outcome = a census pin: no quest/reward path grants
talent ids; breakthrough pools for closed realms stay gated (existing test
coverage) — plus a guard that breakthrough-pool talent effects do not touch
scope-hidden domains is documented but not blocked (tc_dia_can's
body_refinement_progress is a no-op while the body domain is hidden;
flagged in open questions).

### Hidden channel / hidden_window_opened (coordinator fallout item)

- `HiddenBeastSystem.onEnemyDefeated` counts band kills → crossing
  `killThreshold` makes BattleLootSystem emit `hidden_window_opened` (the
  audio cue + downstream hidden-window UI affordance). In beta this cue must
  never fire.
- `maybeReplaceSpawn` substitution is already funnel-gated by Phase-4
  stage-declared spawn sets; still add the `hiddenContent` domain gate at
  origin: `onEnemyDefeated` → no counting/no report; `maybeReplaceSpawn` →
  undefined. Persisted `player.hiddenBeastKills` untouched.
- `rollHiddenChannelRewards` (grotto emissions) gated the same way.

### G. Economy census (§17)

Beta material flow classes:

| Class | Materials | Sources | Sinks | Verdict |
|---|---|---|---|---|
| Base currency | ha_pham/thuong_pham/tran_pham linh thach (spirit stones) | stage bands, vendor, Linh Tuyen | alchemy spiritStoneCost, enhance cost, building upgrades | OK |
| Profession wood | `<realm>_wood_<age>` | forest sites | alchemy fuelWood, vendor | OK |
| Profession ore | `<realm>_ore_<age>` | mine sites, stage bands | enhance (ore_decade x2), vendor, collect quests | OK (decompose sink removed by gate — enhance+vendor remain) |
| Beta-family herbs | `<betaFamily>_<realm>_<age>` | grotto sites | beta recipes, vendor | OK |
| Dormant-family herbs | `<other family>_<realm>_<age>` | grotto sites | vendor (sellable profession material) | OK — vendor is a beta sink; recipes stay dormant |
| Breakthrough special | yeu_dan_hung_giao | ferocious_flood_serpent signature (roster boss, chance 1) | thong_mach_dan + truc_co_dan specialIngredients | OK |
| Equipment essence | luyen_khi_tinh_hoa | dissolve (beta) [+ decompose, hidden] | wash/refine (hidden) → none in beta | EXEMPT store-of-value: banks dissolved equipment value for post-beta; dissolve cannot pay nothing |
| Physique essences | tinh_hoa_pham_the/bao_the/phap_the | stage bands (guaranteed) — SUPPRESSED this phase (bodyPath) | body invest / ZhouTian / Nghich Chu Thian — all bodyPath | DORMANT (source and sink both gated) |
| Companion token | chieu_hien_lenh | boss signature + daily quest — suppressed (pull pool + dailyQuest + companion) | pull (companion) | DORMANT |
| Artifact shard | doan_bao_thach | foundation band — suppressed at delivery (domainUnlockRealmId) | artifact awaken (artifact) | DORMANT |
| Lore | broken_foundation_scroll, old_jade_slip, cultivator_diary, stele_fragment | wild_wolf + giant_earthworm signatures (roster) | none by design | EXEMPT lore (LORE_ALLOWLIST parity) |
| Hidden-only | thien_dia_chi_kieu, huyet_mong drops, channel-only mats | none live in beta | none | DORMANT |
| Pills | crafted pills | alchemy jobs (beta families only) | pill consumption | census on pill side not material — out of scope of source/sink table |

Census implementation: new `game/tests/architecture/betaEconomyCensus.test.ts`
computes the live beta source set (stage tables + roster-family tables +
roster-enemy signatures + enabled-quest itemDrops + production site outputs
+ building produces + dissolve output) minus suppressed deliveries, and the
live beta sink set (beta-family recipe costs, enhance catalog, vendor
sellability, collect-quest debits, building upgrade costs). Every material
with source>0 must have sink>0, and vice versa, unless it sits in an
authored exemption class (lore / store-of-value / base currency). The
classification list lives in `betaScope.ts` (policy authority).

## Q1–Q12

- Q1 invariant: beta offers only allow-listed surfaces — gates fail closed
  via BETA_FEATURES (unknown names already resolve hidden).
- Q2 authority: betaScope.ts stays the single admission authority;
  ReleasePolicy stays the release-window authority — new gates COMPOSE them,
  never re-derive.
- Q3 state ownership: no persisted shape changes; hidden-domain state
  (hiddenBeastKills, channel cycles, companion roster, artifact progress,
  decompose settings incl. restored workers) round-trips verbatim.
- Q4 ordering: no new async seams; gates are synchronous predicates at
  existing entry points.
- Q5 consumers: equipment hall tabs, alchemy panel, worker lodge panel,
  quest board, gift mailbox — all consume ops/read-models later (frontend
  swap deferred); backend surfaces are gate-complete NOW.
- Q6 error model: mutating calls return `{ ok:false, reason:'scope_hidden' }`
  (existing reason-string contract); queries return undefined/null/[] per
  signature — no signature churn.
- Q7 save: restore/getSaveState paths never re-check scope (single-check
  invariant from ReleasePolicy); stale assignments/pending records persist.
- Q8 determinism: decompose rng path untouched; grotto channel rng stream
  untouched (gate precedes the draw).
- Q9 tests: gates get direct-bypass tests; census gets the orphan source/
  sink sweep; quest invariants pinned by authority.
- Q10 rollback: every gate is `isBetaFeature`/`isScopeHidden` — flip flags
  to re-enable; no data deleted.
- Q11 risks: (a) essence suppression removes the mortal guaranteed drop —
  intended per §17 (faucet shutdown); (b) getSettings workers:0 while hidden
  means a stale save's decompose workers never claim capacity — intended
  (spec C automatic allocation); (c) ops-level queries for wash/refine costs
  remain readable (pure constants) — accepted, actions fail closed.
- Q12 boundary: no .vue, no styling, no test-of-record edits, no registry
  deletions; `data/` edits limited to FamilyDropTables pool rows + a
  `family` passthrough on the roster scorpion.

## Plan

1. `core/betaScope.ts` — economy classification exports (lore ids,
   store-of-value ids, base-currency note), Worker Lodge tab authority.
2. Domain gates: EquipmentSystem (wash/refine), DecomposeSystem (tick/
   settle/settings), AlchemySystem.startJob + preview, ProductionSystem
   (setWorkerAssignment + rollHiddenChannelRewards), CompanionAvailability,
   FormationPlacement, ArtifactProgression, CompanionGifts,
   HiddenBeastSystem, QuestSystem (isUnlocked + resolveClaimable),
   BattleLootSystem physique-essence suppression.
3. Ops additions: GameManagerAlchemyOps.getBetaAlchemyRecipeModels,
   GameManagerBuildingOps.getWorkerLodgeSurfaceModel (+ assignWorkers gate).
4. Data: FamilyDropTables re-source rows; FoundationEnemies forwards
   `family` for foundation_sand_scorpion (+ ferocious twin for symmetry —
   both share the family; only the roster normal spawns in beta anyway).
5. Tests: new `core/game/betaScopeGates.test.ts` (or per-domain files),
   `game/tests/architecture/betaEconomyCensus.test.ts`.
6. Gates: P3 quick → E3 simplify → P18 OCR → P4 quick → ≥3 P5 passes →
   draft PR.

---

## Implementation report (post-plan)

### Exported API / read-models added

- `core/betaScope.ts`: `BetaEconomyClass`, `BETA_ECONOMY_EXEMPTIONS`,
  `betaEconomyClassOf(materialId)` (lore / store_of_value /
  base_currency), `BETA_WORKER_LODGE_TABS`, `WORKER_LODGE_TAB_FEATURE`.
- `GameManagerAlchemyOps.getBetaAlchemyRecipeModels(player)` ->
  `BetaAlchemySurfaceModel` (beta families only; per-variant
  herb/fuel-wood ownership + sufficiency, special ingredients, spirit
  stone, `craftable`, `breakthroughAvailable`, job state).
- `GameManagerBuildingOps.getWorkerLodgeSurfaceModel()` ->
  `{ tabs: [{ id, verdict, manualAssignOffered? }] }` - the Worker Lodge
  frontend consumes tab verdicts with no CompanionDomain logic.
- `locale`: `alchemy.reason.scope_hidden` (vi + en).

### Gates (all fail closed on direct API, persistence untouched)

- EquipmentSystem: `washAffixes`, `previewWashAffixes`,
  `commitWashAffixes`, `refineAffixValues`, `previewRefineValues`,
  `commitRefineValues`, `getWashPreviewAffixes` -> scope-hidden.
- DecomposeSystem: `getSettings().workers` reports 0, `setSetting`
  no-op, `listMatchingOres` -> [], `settleOffline`/`tick` inert;
  `getSaveState`/`restore` round-trip raw state (single-check rule).
- AlchemySystem.startJob + ops start/preview: dormant families
  (`betaRecipeFamilyOfId == null`) -> scope_hidden/null.
- ProductionSystem: `setWorkerAssignment` -> false; grotto herb roll
  filtered to beta recipe families (dormant-family herbs never emit).
- Companion/Formation/Artifact: `isCompanionDomainUnlocked`,
  `isFormationUnlocked`, `isArtifactDomainUnlocked` -> false at all
  realms; `issueCompanionGifts` -> []; `commitFormationLoadout` -> false.
- BattleLootSystem: `COMPANION_PULL_TOKEN_MATERIAL_IDS` suppressed at
  delivery (authored signature rows preserved).
- HiddenBeastSystem: `onEnemyDefeated` -> [] under hiddenContent (kill
  counter frozen -> hidden_window_opened cue dead); `maybeReplaceSpawn`
  LEFT LIVE (Phase-4 funnel contract - roster exclusion is upstream in
  pickEnemyForTurnSpawn).
- QuestSystem: `isUnlocked` composes `isBetaQuestEnabled`; inverse
  reconcile pass deactivates stale gated progress; `resolveClaimable`
  fails closed.

### Data changes

- quests.ts: removed daily_collect_hoi_xuan_thao, daily_kill_bandit_15,
  daily_chieu_hien_lenh; retargeted kill_foundation_stone_fungus_15 ->
  foundation_mud_golem (id preserved) and
  kill_foundation_flood_dragon_whelp_10 ->
  foundation_ferocious_flood_dragon_whelp (roster twin).
- FamilyDropTables: boar->base_quan, earthworm->base_hai,
  sand_scorpion->base_gioi (equipment-base re-source).
- FoundationEnemies: `family` passthrough; sand_scorpion family+tags.

### Tests

- New: tests/architecture/betaScopeEconomyGates.test.ts (15 tests,
  direct-bypass + read-model contracts against REAL flag table).
- New: tests/architecture/betaEconomyCensus.test.ts (6 tests; computes
  live sources/sinks from authored data; ~80 source rows; fails on
  orphan source or orphan purpose-sink).
- ~26 dormant-system suites carry the per-file vi.mock enabled-impl
  stub (dormant != deleted; enabled impls keep coverage).
- quests.betaRoster.qa.test.ts: sanctioned it.fails->it flip for the
  retargeted roster spawn check.
- Rollover/reconcile tests re-seated on a fabricated registry daily
  (machinery dormant, still exercised); retired-id residue pinned inert.

### Verification

- npm run type-check: clean.
- npx vitest run (full): 851 files / 7753 tests green.

### Open questions / limitations

- tc_dia_can body_refinement_progress: dead-effect while bodyPath is
  scope-hidden - flagged, left for coordinator (cosmetic progression
  stat, no economy impact).
- Kinh Nghiem (exp) and skillInsight are not material-economy entries;
  census scope is materials + stone/tinh_hoa currencies only.
- Vault-3 equipment bases still list non-beta realm species in
  lore text; sources are family tables now (data-level, no .vue edits).

---

## P5 Sequential review evidence (post-P4 state, commits through 0c863ad3)

Sequential Review Pass 1 - Local Correctness / Regression
  Reviewed state: post-OCR + post-P4 production diff (82 files, 3ff4b826..0c863ad3).
  Method: every production hunk re-read (betaScope authority, CompanionAvailability/
  ArtifactProgression/FormationPlacement predicates, CompanionGifts, HiddenBeastSystem,
  EquipmentSystem wash/refine, DecomposeSystem, ProductionSystem manualWorkforce +
  grotto filter + hidden channels, GameManagerAlchemyOps gates + read-model,
  GameManagerBuildingOps assignWorkers + worker-lodge model, QuestSystem predicates,
  BattleLootSystem essence/EXP gates, CombatBuild companion/formation gates,
  FamilyDropTables/quests/FoundationEnemies data).
  Findings: none new. Verified-non-findings: (a) deliversInBeta lacks the
  breakthroughRealmId leg - vacuous today, no Material carries the tag
  (only truc_co_dan pill + alchemy_truc_co_dan recipe); (b)
  foundation_ferocious_sand_scorpion family tag is data-true (same species
  as roster normal, off-roster so pool never fires - correct).
  Fixes: none. Verification: npx vitest run src/core/game + tests/architecture
  = 199 files green; type-check clean; ascii ratchet green.

Sequential Review Pass 2 - Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES (no fixes needed).
  Findings:
    - LOW: betaEconomyCensus.deliversInBeta mirrors BattleLootSystem
      delivery suppressions test-side; a future delivery suppression not
      mirrored would drift the census. Deferred - the suppressed-faucet
      assertions pin today's 5 suppressed ids and the mirror is
      documented in-code.
    - Accepted: CombatBuild + BattleLootSystem key grandfathered-save
      access on isScopeHidden directly (not the unlock predicates) -
      deliberate, the scope question is flag-only; both read the same
      authority. Ops-level reason-string mirrors (startAlchemyJob,
      assignWorkers) are intentional fail-fast UX seams with the domain
      gate behind them.
  Fixes: none. Verification: type-check clean (no import cycles -
  betaScope imports Quest type-only).

Sequential Review Pass 3 - Adversarial Integration
  Reviewed state after Pass 2 fixes: YES (no fixes needed).
  Adversarial sweep results:
    - Grandfathered saves: companion participants [] in resolveCombatBuild,
      Tran Phap buff skipped, companion EXP closed, commitFormationLoadout
      closed, pull/exchange/claim/feed realm_locked, gifts suppressed,
      token suppressed at delivery (existing seam), essences suppressed
      (new gate), hidden channels frozen (onEnemyDefeated +
      rollHiddenChannelRewards), offline settle returns 0, spawn funnel
      stageSpawnableEnemyIds rejects huyet_mong on beta stages.
    - Talent faucets: no quest reward grants a talent; TribulationOutcome
      pham_nhan_chi_cot push sits behind isGreatDaoBreakthrough (dormant
      classification - unreachable in beta); creation-offer filtering is
      Phase-2 scope.
    - Daily residue: unregistered questProgress inert (registry-filtered
      everywhere), pinned by ChieuHienLenhDrops + r81qa tests.
    - Auto-farm path: same loot seam -> EXP + suppression gates apply.
  Findings: none new.
  Fixes: none. Verification: full affected scope green (see P3/P4).

Deferred findings ledger (all Low, safe to defer):
  1. census deliversInBeta mirror-drift risk (Pass 2 above).
  2. EquipmentSystem.ts pre-existing unused imports (~lines 20-22) -
     predates this phase; recorded.
  3. Repo-wide 92 pre-existing eslint errors - predates this phase.

Post-merge integration note (2026-09-30):
  Base branch advanced to 73853e36 (phase-2 creation merged, PR #85)
  while the draft PR was open; CI runs against the merge result.
  - Merge: clean, no conflicts (betaScope.ts edits landed in
    disjoint sections).
  - CI fallout: phase-2 added a global vitest setup
    (tests/setup.betaScope.ts) that calls unlockAllWaysForTests() for
    every file; phase-3's betaScopeSkillDomain.test.ts asserts the way
    lock itself but never re-pinned -> 3 failures on the merged base.
    Reproduced on base tip alone (pre-existing on new base, not a
    regression from this phase). Fixed in 7d9ef781 by calling
    lockBetaWaysForTests() - the seam authored for exactly this class
    of suite. No production change.
  - Re-verification on merged tree: type-check clean;
    tests/architecture/ 64 files / 331 tests green; CI verify + Vercel
    + windows dry-run all green.
