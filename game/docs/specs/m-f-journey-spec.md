# M-F-JOURNEY — Trúc Cơ End-to-End Journey + Integration Sweep — Spec

Status: v1 — draft (worker-authored, pending C2C spec review)
Depends on: every sibling M-F mission — merged on `p7/truc-co` at
spec time: M-F-REALM18 (`365c804a`), M-F-RESPEC (`04364847`),
M-F-CEILING (`4b8d8270`), M-F-BODY-CORE, M-F-TALENT (`c40e72cb`),
M-F-TECHNIQUE (`271df96e`), M-F-ESSENCE (`3b5fbac5`),
M-F-COMPANION-GIFT (`fb381e8a`), M-F-CHU-THIEN (`a3cdd7ca`),
M-UI-SYSTEM (`6ffead5f`) — plus M-QI-01..10 and the whole P7 wave.
Pending at spec time: **M-F-ARTIFACT-DEFER, M-F-BODY-PERFECTION,
M-F-BODY-HIDDEN** (and M-QI-11, M-QI-12 — see §9). Phase 2 starts only
after the coordinator confirms ALL siblings merged, then rebases onto
fresh `origin/p7/truc-co`; legs touching pending surfaces are marked
`(conditional)` — their exact assertions are re-derived against the
landed shape at implementation start, not assumed now.

Precedents: **M-C** (`MortalChapterJourney.test.ts` leg suite,
`EarlyGameSession` harness — `docs/p7/missions/mc-mortal-journey.spec.md`),
**M8** (`docs/p7/missions/m8-integration-sweep.notes.md` — sweep table +
save-version decision + docs-sync format), M-QI-12 (unlanded LQ→TC
journey — scope overlap resolved in §9).

Mission scope (coordinator mandate, verbatim anchors): headless E2E
journey across the Trúc Cơ surface; integration sweep (dead-authority
audit, unreferenced seams, duplicated authorities, naming/doc drift);
docs sync; final save-version decision; full gates. **NO new
behavior/features — sweep-only; discovered defects are reported, not
fixed; authored-content blanks are reported, not filled; every leg
runs against REAL merged production seams (no mocks bypassing shipped
contracts).**

## 1. Intent

Four committed deliverables:

1. **`TrucCoJourney.test.ts`** — the headless E2E regression contract
   for the Trúc Cơ chapter, sibling to `MortalChapterJourney.test.ts`,
   on the `EarlyGameSession` harness. Coverage ordered per mandate:
   LQ cap → breakthrough → TC initiation → realm levels → Body
   chapters (meridian page + body_refinement + zhou_tian circulation)
   → stage progression → stage clears → breakthrough gates →
   perfection surfaces where authored — including a mid-chapter
   save/restore checkpoint leg.
2. **Integration sweep** — `docs/p7/missions/mf-journey.notes.md`
   (new): a dead-authority audit table over the merged trúc cơ
   surface (orphan systems, unreferenced seams, duplicated authorities
   between sibling missions), residual naming/doc drift findings, and
   the final save-version decision — M8's format, widened to the
   M-QI + M-F waves.
3. **Docs sync** — `docs/roadmap.md` gains the M-QI and M-F wave
   ledgers (the file currently ends at P7-M8); `docs/p7/
   mission-graph.md` ledgers updated for landed missions (M-QI-11/12
   rows + M-F wave section); `docs/naming-conventions.md` amended only
   if the sweep confirms a family the rules don't cover.
4. **Save-version decision** — recorded M8-style in the notes doc:
   evaluate accumulated schema changes across the wave (v72..v78 +
   pending siblings) against the "CURRENT at merge time +1" rule; this
   mission itself owns no persisted shape, so the expected verdict is
   NO bump — the decision is recorded with evidence either way.

This is a **test/docs-only mission**. The only production-adjacent
edits permitted are session seams inside `EarlyGameSession.ts` — the
M-C carve-out (the harness may grow seams that mirror real entry
contracts; it must never become a second authority and never import
`stores/*`). Any true production defect found is a report item with
evidence, not a fix (P12/coordinator rule).

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Session harness | `EarlyGameSession` — one `GameManager`+one `PlayerData`, SeededCombatRng battle RNG + separate loot RNG (`seed ^ 0x9e3779b9`), `ManualClockSource`, full production catalog registration matching `App.vue`. Seams: `cultivate`, `breakthroughIfReady`, `materialAmount`, `runStage` (`driveTurnBattleToTerminal`), `runTribulation` (`canTriggerBreakthrough` precheck + `startTribulation` + `tickOps.update(1)` + scripted correct answers), `performRitual`, `purchaseNode`, `allocateAttribute`, `investRefinement` (hardwired to `'body_refinement'`), `equipAll`, `restoreCheckpoint(save, playerOwner)` wrapping the real `restoreGameSession`, normalized `snapshot()`. | `core/simulation/earlygame/EarlyGameSession.ts` |
| Settlement gap | `runTribulation` returns the committed outcome but never SETTLES it — in production `checkTribulationOutcomeAction` (`useTribulation.ts:131`) runs `TribulationOutcomeService.settleOutcome` each tick. For mortal→LQ that was a no-op (qi_refining early-return); at LQ→TC settlement is where realm/level/cultivation, `highestFoundationAchieved`, passive syncs, technique seal, sword merge, gift issue, unequip-all, and `pendingTalentEntitlement` all write. **Harness seam needed.** | `core/tribulation/TribulationOutcomeService.ts`, `composables/useTribulation.ts:145-208` |
| Writer shape | `settleOutcome` and `resolveTalentEntitlement` require the Pinia-store writer (`setEquipmentModifiers` exists only on `stores/player.ts:214`). M-C's convention: the TEST owns a real `usePlayerStore` and passes it in (`restoreCheckpoint(save, owner)`); the harness file stays stores-free. | `stores/player.ts`, `core/simulation/earlygame/MortalChapterJourney.test.ts` (leg D) |
| LQ→TC admission | `canTriggerBreakthrough` = `[{level≥12},{chapterClear qi_refining_abyssal_pool}]` both met; rows come from `getBreakthroughRequirements` (M-QI-02/03). | `core/game/GameManagerRealmAdvanceOps.ts:625-670` |
| LQ→TC tribulation | `startTribulation` guard order: cooldown/active → **`isRealmTransitionEnabled`** (M-F-CEILING) → authored chapters → `resolveKienCoGrade` snapshot. Chapters: mind (4 questions) → body tank (20s, 2s interval, 10% maxHp) → lightning (18s, 1.5s interval, 13% + 30% final strike). `GRADE_DIFFICULTY_MULTIPLIER` 1/1.15/1.3/1.85 scales strike interval AND damage. Survival depends on REAL `maxHp`/`defense`/`hpRegenPerTurn`. | `core/tribulation/TribulationDirector.ts`, `data/tribulation/TribulationChapters.ts` |
| Kiến Cơ grade ladder | `resolveKienCoGrade(player, hasTrucCoDan)`: earth = `truc_co_dan` held + ≥3 refinement tiers; heaven = 6/6 tiers + ≥6 meridians; great_dao = heaven + 9/9 meridians + `pham_cot` talent + `mortalPerfectionAchieved` + realmLevel ≥18 + all 5 main stats at cap; `greatDaoOpportunityLost` caps at heaven. | `data/breakthrough/BreakthroughGrades.ts` |
| Initiation chain | `resolveVictory` order: LoiKiep bonus → `createTalentEntitlement` (skipped for great_dao) → qi_refining early-return → `applyTechniqueRealmTransition` (frozen-cycle seal, M-F-TECHNIQUE) → realmId/`realmLevel=1`/`cultivation=0` → overcharge pour → quest reconcile → unequip-all + modifier sync → `highestFoundationAchieved` (TC only) → realm passive + realm stat passive → sword merge → realm reward (spell way: `ngu_hanh_chau` artifactId in `realmRewards.foundation_establishment`) → companion gifts → great_dao `pham_cot`→`pham_nhan_chi_cot` conversion. | `core/tribulation/TribulationOutcomeService.ts`, `data/progression/RealmPassiveLadder.ts` |
| Talent lock | `pendingTalentEntitlement` persists; `checkTribulationOutcomeAction` defers drain while unresolved and `reconcileTalentEntitlement` prunes dead records; `realmAdvanceOps.resolveTalentEntitlement(player, decision)` grants ONE result (new card from the realm pool OR owned-talent upgrade) then `syncTalentCombatPassive`. | `core/talent/TalentEntitlement.ts`, `GameManagerRealmAdvanceOps.ts:125` |
| Realm ladder | `foundation_establishment`: maxLevel 18, attributeCap 100, baseCultivationMinutes 64. Minor-level breakthrough = `cultivate`+`breakthroughIfReady` (realm-agnostic seams). | `data/realms/realm.ts`, `core/cultivation/CultivationSystem.ts` |
| Stage chain | ONE zone `thanh_van` holds all 30 floors in order; `isStageUnlocked` = realm gate (`requiredRealmId` + `requiredRealmLevel` == floor) + sequential previous-stage-clear. `foundation_floor_1` sits behind `qi_refining_abyssal_pool`. Floor 10 = boss (`bossEnemyId`, `perfectClearTurnLimit` 15 rounds; normal floors `9+floor` enemies / +10 rounds margin). | `data/stage/{Stages,Zones,ChapterStages}.ts`, `core/game/GameManagerCatalogOps.ts:272` |
| Perfection surfaces | `recordPerfectClearIfEligible` — everyoneAlive + `roundsElapsed < perfectClearTurnLimit` writes `perfectClearStageIds` + `perfectClearSeconds` once → `startAutoFarm`/`autoFarmStage` unlock (GameManagerAutoFarmOps). Hidden-foundation grades = `highestFoundationAchieved` + `BreakthroughGrades` ladder. `physiqueGrade` ladder (Phàm→Bảo at 6/6 refinement, M-QI-07). `mortalPerfectionAchieved` snapshot locks at the ritual (6/6 + all stats at mortal cap). | `core/game/GameManagerBattleRewardOps.ts:189`, `GameManagerAutoFarmOps.ts:66-102`, `GameManagerRealmAdvanceOps.ts:352` |
| Body chapters | Registry order IS the chain: `body_refinement` → `meridian` (`unlocksAfterChapters:['body_refinement']`) → `zhou_tian` (`['meridian']`). Tick auto-invest covers body_refinement only (`GameManager.ts:916`); meridian/zhou_tian invest is manual-only (deferred ruling, M-F-CHU-THIEN spec §1). | `core/realm/body/{BodyChapter,MeridianChapter,ZhouTianChapter}.ts` |
| body_refinement | 6 tiers sequential caps 50/175/615/2150/7500/26300 **pham** essence; `requiredRealmLevel` tier gates read `player.realmLevel` — post-LQ the pace gate lifts (page monotonic); completion → `physiqueGrade` pham→bao via `applyPhysiqueAdvancement`. Essence namespace `material` → substitution-eligible (M-QI-09: bao=2×pham, phap=2×bao compound). | `data/realm/BodyRefinement.ts`, `core/realm/body/BodyRefinementChapter.ts` |
| meridian | 9 one-shot meridians, ALL on the `qi_refining` page, cost `thongMachDanCost` 1/2/4/7/11/16/22/30/40 (pill bag `thong_mach_dan`) + `thien_dia_chi_kieu` aux for `ky_kinh` only; strict-prefix `openedIds`; `bat-mach:*` modifier emission; pace gate applies only while `realmId==='qi_refining'` — at TC all rows are investable once body_refinement is complete. | `core/realm/body/MeridianChapter.ts`, `data/realm/Meridians.ts` |
| zhou_tian | capacity `20 × realmLevel` in TC (0 pre-TC, 360 post-TC); Tiểu ≥180 (L9), Đại ≥360 = complete (L18); currency `tinh_hoa_phap_the` (material bag, top-rung → exact debit, no substitution fill); `collectBaseStatDeltas` returns `{}` (channel wired, magnitudes deferred); no `physiqueAdvancement` declared. | `core/realm/body/ZhouTianChapter.ts`, `data/realm/ZhouTian.ts` |
| Essence bands | `PHYSIQUE_ESSENCE_BAND`: mortal→pham, qi_refining→bao, foundation_establishment→phap; each banded realm's `STAGE_DROP_TABLES` guaranteed list carries the band drop (1-3/kill live on every stage victory); `huyet_mong` pham ×12 signature exempt. | `data/realm/PhysiqueEssence.ts`, `data/drop/StageDropTables.ts` |
| Pill inputs | `truc_co_dan` + `thong_mach_dan` exist only via special alchemy recipes (pill_room building + herbs + fuel wood + spirit stones + `yeu_dan_hung_giao` boss-drop + 900s job). `thien_dia_chi_kieu` = 5% hidden-beast drop. Production pacing is measured in days — see §4 seeding decision. | `data/alchemy/alchemyRecipes.ts`, `data/enemy/{MortalEnemies,HiddenBeasts}.ts` |
| Respec | `progressionOps.respecNodeTree(player, {rootId?})` — free Beta respec, clone-preflight atomicity, commit-marker roots exempt, 25% insight tax. | `core/game/GameManagerProgressionOps.ts:484`, `core/progression/NodeSystem.ts:660` |
| Release boundary | `progressionCeilingRealmId = 'foundation_establishment'`; `isRealmTransitionEnabled` adjacent-only → at TC `getBreakthroughRequirements` returns `[]`, `canTriggerBreakthrough` false, `startTribulation('golden_core')` refused; `isCompanionPullPoolEnabled()` false; `isBreakthroughAcquisitionEnabled` gates tagged acquisition routes (e.g. `alchemy_truc_co_dan`). | `core/realm/ReleasePolicy.ts` |
| Save | `CURRENT_SAVE_VERSION = 78` (v72 body progression → v73 nodeLevels authority → v74 physiqueGrade → v75 technique frozen cycle → v76 pendingTalentEntitlement → v77 companionGifts → v78 zhou_tian slice). `buildGameSave`/`restoreGameSession` = the only persisted contract; restore = replacement; committed tribulation outcome is transient (not persisted — M-C documented exclusion). | `services/save/saveVersion.ts`, `services/save/SaveSystem.ts` |
| Docs drift | `roadmap.md` ends at P7-M8 — no M-QI/M-F wave sections; `mission-graph.md` ledger covers M-QI-01..10 only; M-F specs live in `docs/specs|plans/` while older missions live in `docs/p7/missions/` (convention drift to record); `naming-conventions.md` untouched by the wave. | `docs/roadmap.md`, `docs/p7/mission-graph.md` |

## 3. Target design — `TrucCoJourney.test.ts`

Lives next to the harness: `core/simulation/earlygame/TrucCoJourney.test.ts`.
Journey **legs** as named describes; every leg rides production seams.
Pinned profile convention reused (`{name:'journey',
talentIds:['hap_linh'], attributes:{strength:2,vitality:3}}` — the M-C
PINNED profile; grade-leg fixtures use the committed seeded-state
pattern instead).

**Leg A — LQ-side state to admission (documented fixture, NOT a
replay):** the committed fixtures prove honest LQ completion is not
reachable in suite time today — `mortal_dong_5` is a characterized
balance wall (M-C keeps the marker), and the `qi_refining_*` floor
chain behind it is unproven; the economy paths to `thong_mach_dan` /
`truc_co_dan` / `thien_dia_chi_kieu` are alchemy+drop surfaces paced
in days, not journey scope. Leg A therefore builds the LQ-side state
through the committed fixture pattern (`surviveFoundationTribulation`
/`investForGreatDao` in `TribulationOutcomeSettlement.test.ts`):
`realmId='qi_refining'` + `realmLevel` set honestly at the admission
boundary + `completedStageIds` carrying the sequential chain +
baseStats seeded to a survivable profile — then the ADMISSION
contract itself runs real: `getBreakthroughRequirements` rows,
`canTriggerBreakthrough`, `startTribulation`'s real guards. Seeded
fields are enumerated in the suite header (auditability); the honest
reachability gap is itself recorded as a sweep finding (§5).

**Leg B — breakthrough → TC initiation:** `runTribulation
('foundation_establishment')` drives the real director (4 mind
questions answered correctly via the session seam, then both tank
chapters on real stats) → `getCommittedOutcome()` stamps victory →
**new seam** `settleTribulationOutcome(playerOwner)` (mirrors the
domain half of `checkTribulationOutcomeAction`: `settleOutcome` then
`director.clear()`) → assert the initiation bundle on real state:
`realmId='foundation_establishment'`, `realmLevel=1`,
`cultivation=0`, `highestFoundationAchieved` = the run's committed
grade, equipment unequipped + modifiers resynced, realm passive
`passive_truc_co_y_chi` learned, `pendingTalentEntitlement` present
(non-great_dao run) → `resolveTalentEntitlement(playerOwner,
decision)` grants exactly one result and clears the record →
`companionGifts` carries the realm_entered record → `claimCompanionGift`
through `companionOps`. Technique `gradeHistory` seal asserted when the
pre-TC technique lags the realm (M-F-TECHNIQUE frozen cycle).
Idempotency pinned: a second `settleOutcome` returns the bound receipt
with no double-apply (committed-suite contract).

**Leg C — TC realm levels:** `cultivate` + `breakthroughIfReady`
ladder on the real realm data (baseCultivationMinutes 64, cap 18,
attributeCap 100). Asserts the level-attribute-point feed, the
zhou_tian capacity growth coupling (`20 × realmLevel`), and floor
gates rising with level (`foundation_floor_N` locked below N).

**Leg D — Body chapters through real invest seams** (ordering =
authored chain):
1. `body_refinement` — finish incomplete tiers with seeded pham-equiv
   coverage (§4), assert the tier sequence + `bat-mach`-style baseStat
   deltas on `baseStats` + `physiqueGrade` pham→bao flip at 6/6
   (M-QI-07's idempotent transform), plus substitution coverage when
   only higher-band essence is held (phap→bao→pham through the real
   `investBodyChapter` probe/commit — M-QI-09 in journey form).
2. `meridian` — invest opens `openedIds` in strict prefix order
   (nham_mach first; ky_kinh last, gated on `thien_dia_chi_kieu` aux),
   `bat-mach:*` modifiers emitted, 9/9 → chapter complete; pace gate
   proven lifted (no `requiredRealmLevel` block post-LQ) while
   `unlocksAfterChapters` still refuses invest before
   body_refinement is complete (assert 0 + no debit).
3. `zhou_tian` — capacity clamps invest at `20 × realmLevel` at each
   asserted level; Tiểu read at ≥180 (post-L9), Đại at 360 post-L18;
   exact Pháp debit only (no substitution fill on the top rung);
   `collectBaseStatDeltas {}` recorded as an authored content blank
   (report, not fill).

**Leg E — stage progression + clears:** `runStage` on
`foundation_floor_1` → victory → sequential unlock observed →
level-gated refusals asserted (`locked` on floor N+1 below realmLevel
N) → driven to `foundation_floor_10` boss victory →
`completedStageIds` covers all 10 ids in order. Difficulty recovery
uses the loop's real growth cycle (farm cleared floor → equipAll →
allocate → invest) — no debug stat grants mid-leg.

**Leg F — breakthrough gates + ceiling boundary:** at TC,
`getBreakthroughRequirements()` returns `[]`,
`canTriggerBreakthrough` false, `runTribulation('golden_core')` →
`'refused'` BEFORE any chapter work (release-policy guard in
`startTribulation`); state byte-untouched. Companion pull pool stays
closed (`isCompanionPullPoolEnabled()` false). `(conditional)` —
artifact-domain unlock state asserted against the value of
`ARTIFACT_UNLOCK_REALM_ID` on the merged base (M-F-ARTIFACT-DEFER may
move it; the leg reads the constant, not a literal).

**Leg G — mid-chapter save/restore checkpoint:** mid-TC state
(post-initiation, partial zhou_tian circulation, partial floor clears,
gift claimed, entitlement resolved) → `buildGameSave` → restore via
`restoreCheckpoint(save, freshOwner)` on a SECOND `EarlyGameSession`
(fresh catalog-registered manager; real `restoreGameSession`;
`vi.setSystemTime` pins `Date.now` so offline=0) → persisted-field
parity: every journey-visible persisted field equals the checkpoint —
`bodyProgression` (tiers + `openedIds` + `circulation`), `artifact`,
`companionGifts`, `pendingTalentEntitlement` (undefined after resolve),
`technique.gradeHistory`/`grade`/`rank`, `physiqueGrade`,
`highestFoundationAchieved`, `perfectClearStageIds` — transient
`tribulationState` excluded per the documented M-C exclusion →
post-restore continuation runs a MANAGER-BACKED action
(`runStage` victory + resumed `investBodyChapter`), not only a raw
tick. Boundary case: a save carrying `{zhou_tian progressed, meridian
incomplete}` is REJECTED at the restore preflight (C2C-64 coherence —
real `assertBodyProgressionIntegrity` path, not a mock).

**Leg H — boundary/adversarial rejects** (journey-narrative, all
asserted state-unchanged):
- `runTribulation('foundation_establishment')` below L12 or without
  the abyssal clear → `'refused'`, no committed outcome.
- `runTribulation('golden_core')` at TC → `'refused'` (closed
  transition — same leg as F's seam asserts).
- `investBodyChapter('meridian')` before body_refinement complete →
  0, bags unchanged; `investBodyChapter('zhou_tian')` before meridian
  complete → 0.
- `runStage` on a level-gated floor → `'locked'`.
- `resolveTalentEntitlement` with an off-pool/illegal decision →
  `false`, record retained (uncancellable by construction).
- `startAutoFarm` on a non-perfect stage → `false`.
- Post-state validity: after every rejected leg the session still
  completes the happy-path leg (atomicity — a reject leaves no
  half-transition).

**Leg I — perfection surfaces where authored:**
- Perfect clear: a dominated floor re-run fast-enough records
  `perfectClearStageIds` + `perfectClearSeconds` exactly once;
  `startAutoFarm` then succeeds on that stage (real ops) and
  `autoFarmStage` persists through a checkpoint restore.
- Grade ladder (committed seeded-fixture pattern — full honest
  great_dao needs a mortal-perfection investment the suite cannot
  grow in-run; flagged §9 for C2C): fresh sessions seeded per grade
  tier assert `resolveKienCoGrade` through the REAL `startTribulation`
  snapshot — uninvested → human; `truc_co_dan` + ≥3 tiers → earth;
  6/6 + 6 meridians → heaven; the full input set → great_dao;
  `greatDaoOpportunityLost` caps heaven. Asserts the committed
  outcome's `grade` field — the same surface the settle writes.
- `highestFoundationAchieved` recorded at initiation (leg B) and
  surviving restore (leg G).

**Leg J — determinism:** two same-seed runs through the journey's
driver produce identical normalized snapshots (extended for TC
fields — §4).

## 4. Session-seam additions (EarlyGameSession only — the M-C carve-out)

The harness gains the seams the TC surface needs; every addition
mirrors a real entry contract and stays stores-free:

| Seam | Shape | Mirrors |
|---|---|---|
| `playerOwner` option | `EarlyGameSessionOptions.playerOwner?: GameSessionPlayerOwner` — when present, the session's player IS `owner.$state` from construction (profile + bootstrap write into it). `restoreCheckpoint` unchanged. | production: the live player IS a Pinia store; settle/entitlement writers require the store shape |
| `settleTribulationOutcome()` | requires `playerOwner`; calls `new TribulationOutcomeService().settleOutcome(playerOwner, gm, director)`, asserts the entitlement drain rule (`reconcileTalentEntitlement` + `pendingTalentEntitlement` retained = unresolved), then `director.clear()`. Returns the bound receipt. | `checkTribulationOutcomeAction` (domain half only — curtain/presentation sequencing stays presentation scope) |
| `resolveTalentEntitlement(decision)` | delegates `realmAdvanceOps.resolveTalentEntitlement(playerOwner, decision)` | the modal's commit seam |
| `investChapter(chapterId)` | generalizes `investRefinement` to `realmAdvanceOps.investBodyChapter(player, chapterId)`; `investRefinement` stays as the body_refinement shorthand (existing callers unchanged) | `MeridianSection`/`ZhouTianSection` invest buttons |
| `pillAmount(id)` / `holdPill(id, n)` / `holdMaterial(id, n)` | `pillBag`/`materialBag` typed reads + bag writes over the registered catalogs | `pillBag.add`/`materialBag.add` — the committed fixture seam (TribulationOutcomeSettlement.test.ts:64) |
| `giftRecords()` / `claimGift(id)` | read `player.companionGifts`; `companionOps.claimCompanionGift(id)` | the mail-claim UI seam |
| `perfectClearOf(stageId)` / `startAutoFarm(stageId)` | reads + `turnBattleOps.autoFarmOps.startAutoFarm` | stage auto-farm unlock |
| `snapshot()` extension | adds normalized TC fields: `bodyProgression` summary, `physiqueGrade`, `highestFoundationAchieved`, `artifact` presence/level/grade, `companionGifts` id set, `pendingTalentEntitlement` presence, `technique` grade/rank/history keys | existing normalized-snapshot contract (volatile fields excluded per M0 census) |

**Seeded-input decision (flag for C2C):** inputs whose authored
acquisition is paced in days — `thong_mach_dan` ×133, `truc_co_dan`,
`thien_dia_chi_kieu`, the 36,790-essence full refinement ladder, and
grade-fixture stat/investment states — are seeded through the real bag
APIs / state writes listed above (the committed fixture convention),
never through a mock, a bypassed gate, or a fabricated seam. Inputs
whose authored pacing is run-scale — phap essence ≤360 for zhou_tian
(guaranteed 1-3/kill on every TC victory) and partial pham/bao
coverage — are farmed honestly through `runStage`. The split is
enumerated in the suite header; every seeded field is named. The
alchemy/hidden-beast production chains themselves are out of scope
(their own surfaces have their own tests).

## 5. Integration sweep — audit program

`docs/p7/missions/mf-journey.notes.md` records the sweep M8-style.
Seed audit rows (worker-authored at spec time; implementation widens):

| Surface | Audit |
|---|---|
| Dead authority | `ung_the_than_quyet` old table residue (`data/technique/Techniques.ts:171` comment); `skillLevels`/`Skill.level` post-v73; `openedMeridianIds`/`luyenTheTiers` flat-field residue post-v72; `usesTheResource`, `swordPathRoute`, legacy path ids; `RETIRED_*` lists confirmed fail-closed-only; `tribulation_scene_exit`-style dead emits (M8 precedent). |
| Orphan seams | `collectBaseStatDeltas` zhou_tian `{}` (authored blank — verify no consumer expects magnitudes); tick auto-invest covers body_refinement only (documented deferral — verify no other chapter expected it); `physiqueAdvancement` undeclared on meridian/zhou_tian (reserved seam — verify no reader assumes presence); `advanceArtifactRealmLevel`/`setArtifactPath`/`tryUpgradeArtifactGrade` consumers vs `ARTIFACT_UNLOCK_REALM_ID` (conditional on M-F-ARTIFACT-DEFER's landed shape). |
| Duplicated authorities | essence namespace gate `bodyChapterEssenceGrade` (M-F-ESSENCE) vs `PhysiqueEssence` registry (M-QI-08) — exactly one resolver; breakthrough admission `canTriggerBreakthrough`↔`getBreakthroughRequirements` single read-model; release-policy composed gates (artifact awaken / companion pool / recipe tag / pill tag) vs the single `progressionCeilingRealmId` rule; technique mirror `player.techniqueProgress` vs `TechniqueManager` authority. |
| Naming/doc drift | `mission-graph.md` missing M-F wave + M-QI-11/12; `roadmap.md` missing post-P7 phases; spec/plan path convention drift (`docs/p7/missions/*` vs `docs/specs|plans/m-f-*`); N-rules coverage of new families (zhou_tian ids, talent-entitlement ids, gift ids, `tinh_hoa_phap_the`); stale "designed up to Trúc Cơ tầng 18" statements vs landed state. |
| Persisted drift | v72..v78 slices vs current `PlayerData` fields (e.g. fields added without a bump — none expected; verify `techniqueProgress` mirror + `pendingTalentEntitlement` + `companionGifts` + `zhou_tian` all in `buildGameSave` parity); saveShapeValidation delegation coverage per slice. |
| Boundary honesty | `EarlyGameSession` free of `stores/*` imports; no journey assertion rides a mock; seeded-input list in §4 enumerated and named. |

Findings classification per coordinator rule: in-mission defects (any
the suite/seams introduce) get fixed; pre-existing defects → report
rows with evidence; authored-content blanks (material identities, mail
moments, stat magnitudes) → report rows marked expected-deferral.

## 6. Docs sync plan

- `docs/roadmap.md` — append the M-QI wave ledger (M-QI-01..10 merged,
  M-QI-11/12 status rows) and a Trúc Cơ (M-F) wave section with the
  landed ledger (missions, commits, save versions, gates) in P7's
  ledger style; refresh stale ceiling statements if the sweep finds
  them.
- `docs/p7/mission-graph.md` — append the M-F wave graph/ledger
  section (mission rows + landed state) and the M-QI-11/M-QI-12 status
  rows; M-QI-12's row records the subsumption note from §9.
- `docs/naming-conventions.md` — amend only if the sweep confirms a
  family gap (candidate: `zhou_tian` mechanic id is English-family;
  `tinh_hoa_phap_the`/`thong_mach_dan`/`thien_dia_chi_kieu` are VN
  content ids — expected consistent, verify don't assume).
- `docs/p7/naming-migration.md` — amend only for post-P7 wave
  amendments confirmed by the sweep.
- `docs/p7/missions/mf-journey.notes.md` — sweep table + save-version
  decision + gates (M8 notes format).

## 7. Save-version decision (recorded, not assumed)

Rule: **bump iff the wave's landed state creates a persisted-shape
requirement not already enforced by a sibling bump** — the "CURRENT at
merge time +1" rule read against the merged base at implementation
start. This mission adds no persisted state (test+docs only). Expected
verdict at spec time: **NO bump** — v78's boundary already rejects every
pre-wave save, and each shape-changing sibling paid its own +1.
Evidence to record at phase 2: CURRENT value on the merged base at
implementation start (expect ≥78 — pending siblings may bump further);
enumeration of each wave bump and what it covers; a statement that no
persisted field exists on the merged surface that lacks version
coverage. M8's decision block is the format.

## 8. Gates

- **P3 full** — `cd game && npm run verify` (test suite joins the
  suite; mission docs + notes are docs-only edits).
- **P18 OCR** delegation pass over the diff (per blueprint knowledge:
  `ocr delegate preview -f json` + `ocr delegate rule <paths>`).
- **P4** adversarial QA — `tutienidle-adversarial-qa` (quick by
  default; the sweep findings + suite seeds are the review surface;
  escalate to deep if quick flags breadth — progression/persistence
  vectors).
- **P5** sequential ≥3 passes with per-pass evidence blocks; the
  sweep report itself is reviewed under P5 pass 2 (authority audit is
  its own finding surface).
- **External review** per wave convention (SPEC then IMPL rounds via
  coordinator).
- **No P13/P14 trigger** — headless suite + docs; no
  wiring/browser-facing surface. If the sweep uncovers a wiring defect
  needing runtime evidence, it goes to the report, not a fix.
- **P15** — new comments ASCII English.

## 9. Resolved at spec time / open items for C2C

Resolved:
- **Journey start state** — documented fixture seed for the LQ-side
  state (§3 Leg A). Honest replay is impossible-in-suite-time: the
  characterized mortal_dong_5 wall blocks the stage chain and the
  alchemy/beast economies are day-paced. The fixture pattern is the
  committed-suite convention; reachability gaps are reported as sweep
  findings, not worked around.
- **Settlement seam** — `settleTribulationOutcome(playerOwner)` +
  `playerOwner` construction option; the harness stays stores-free
  (the test owns the Pinia store, same convention as leg-D
  `restoreCheckpoint`).
- **Seeded inputs** — §4's two-class split; all seeded fields named.
- **TC→KD closed** — asserted as the boundary leg (F); the authored
  golden_core chapters stay dormant data.
- **Suite file** — `core/simulation/earlygame/TrucCoJourney.test.ts`
  (new; no existing suite is deleted — `MortalChapterJourney`
  stays intact and independent).

Open items for C2C:
- **M-QI-12 subsumption** — its LQ→TC E2E scope (initiation → chapter
  10 → L12 + meridian invest + breakthrough) is covered by legs A–B;
  recommend the graph row record "covered by M-F-JOURNEY" (or
  coordinator assigns residual scope). Needs a coordinator ruling.
- **Grade-ladder honesty bound** — leg I's seeded fixtures vs full
  honest great_dao: the latter needs mortalPerfection + LQ18 + cap
  stats, i.e., a second wall-crossing build; seeded per-grade sessions
  pin the resolver contract at a fraction of runtime. C2C may choose
  either.
- **Pending-sibling conditionals** — ARTIFACT-DEFER (artifact
  unlock realm may move off TC), BODY-PERFECTION, BODY-HIDDEN
  (chapter 4/5? hidden-way TC body surface): their assertions are
  re-derived at implementation start against the landed shape.
- **Auto-farm cycle assertion depth** — whether leg I also asserts
  completed auto-farm cycles (wall-clock `lastCheckedMs` driven) or
  stops at the unlock contract.

## 10. Acceptance

| # | Acceptance |
|---|---|
| A1 | `TrucCoJourney.test.ts` committed on the harness; every leg rides production seams (no store imports in the harness file, no mock substituting a shipped contract); seeded-input list enumerated in-file. |
| A2 | Leg B asserts the full initiation bundle (realm write, cultivation 0, grade record, unequip+modifier resync, passive learn, talent entitlement resolve, gift issue+claim, technique seal when applicable) through `settleOutcome` + real ops — not direct field pokes. |
| A3 | Body chapters complete in authored order through `investBodyChapter`: sequential rejections asserted first (0 + no debit), then meridian strict-prefix to 9/9 with `bat-mach:*` emission, then zhou_tian capacity-clamped invest to Đại (360) with exact Pháp debit; physique transform pham→bao at 6/6. |
| A4 | Stage legs: floor-1 → floor-10 sequential clears via `runStage` on the real zone chain; level-gate `locked` asserts; `completedStageIds` ordered coverage; perfect-clear record + `startAutoFarm` unlock on at least one floor. |
| A5 | Ceiling boundary: at TC, `getBreakthroughRequirements` `[]`, `canTriggerBreakthrough` false, `runTribulation('golden_core')` `'refused'`; companion pull pool closed; state byte-untouched post-refusal. |
| A6 | Checkpoint leg: `buildGameSave`→`restoreGameSession` round-trip through `restoreCheckpoint` on a fresh session+owner; persisted-field parity on all journey fields (transient tribulation excluded per documented contract); post-restore manager-backed action succeeds; incoherent zhou_tian/meridian save rejected at preflight. |
| A7 | Determinism: two same-seed runs → identical normalized snapshots (extended surface). |
| A8 | Sweep notes doc committed with the full audit table (dead authority / orphan seams / duplicated authorities / naming-doc drift / persisted drift), every finding classified (in-mission fix vs pre-existing report vs authored blank). |
| A9 | Docs synced: roadmap M-QI + M-F wave ledgers, mission-graph rows updated incl. M-QI-12 disposition, naming-conventions amended iff warranted. |
| A10 | Save-version decision recorded M8-style with the rule, the CURRENT value on the merged base at implementation start, and the per-bump evidence table. |
| A11 | Gates: `npm run verify` green on the final state; OCR delegation run; P4 QA report committed under `docs/qa/`; P5 sequential evidence blocks; external review routed through coordinator. |
| A12 | Zero production behavior change — the only non-test edits are `EarlyGameSession` seams + docs/notes; every pre-existing defect found is in the report with evidence, never silently fixed. |
