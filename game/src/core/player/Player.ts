import { calculateStats, resolveAttributeTotals, type StatModifier } from '../stats/StatCalculator'
import { collectActiveWayStatModifiers } from './CultivationPathSystem'
import { collectBodyBaseStatDeltas, statDeltaEntries } from '../realm/body/BodyProgressionSystem'
import { asBaseStats, createBaseStats, type BaseStats, type Stats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { CENTER_LANE_INDEX } from '../battle/BattleLane'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  type CombatAiStrategy,
} from '../battle/CombatAiStrategy'
import { addCultivation } from '../cultivation/CultivationSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import { getRealmIndex } from '../realm/realmSystem'
import type { FoundationType } from '../breakthrough/FoundationType'
import type { CultivationPathId, CultivationWayId } from './CultivationPathKit'
import { createSpellPathState, type SpellPathState } from '../phap-tu/PhapTuState'
import type { PersistentTimedEffect } from './PersistentTimedEffect'
import type { ArtifactProgress } from '../artifact/Artifact'
import type { CompanionInstance } from '../../data/companion/Companions'
import type { SwordPathState } from '../kiem-tu/KiemTuState'
import {
  createDefaultBodyProgression,
  type BodyProgressionState,
} from '../realm/body/BodyChapter'
import type { PhysiqueGradeId } from '../../data/realm/PhysiqueLadder'

export interface PlayerData {
  name: string

  realmId: string
  realmLevel: number

  cultivation: number
  cultivationPerSecond: number

  // Hai Nap talent (talent-catalog-v4 sec.4.3) - cultivation that would
  // overflow past the current level cap banks here and pours into the
  // next tier on breakthrough. Owned by CultivationSystem.
  cultivationOvercharge: number

  /** Pool nhan cong tu dong dung chung cho moi ProductionSite. */
  autoWorkerCapacity: number

  baseStats: BaseStats

  // Modifier "tinh", gan truc tiep voi nhan vat: equipment, talent,
  // reincarnation... Nguoi choi tu them/bot qua cac hanh dong ro rang
  // (trang bi vu khi, chon talent...).
  modifiers: StatModifier[]

  // Modifier "dong", duoc GameManager tong hop lai moi tick tu
  // BuffSystem + TechniqueSystem (xem GameManager.getAggregatedModifiers()).
  // Store khong tu tinh modifier nay - chi nhan va luu de finalStats dung.
  externalModifiers: StatModifier[]

  // Linh Thach KHONG con la currency tren PlayerData (plan Workstream
  // F) - so du duy nhat la materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID).

  // Ba Thien Phu duoc chot khi tao nhan vat. Hieu ung gameplay se duoc
  // noi vao stat/effect system theo talent-system-plan.md.
  selectedTalentIds: string[]

  // Dot Pha Truc Co (Phase 5) - Can Co CAO NHAT tung dat qua Do Kiep
  // thang loi (muc 16 spec `breakthrough` - "duoc reveal" sau khi
  // thang). undefined = chua tung Truc Co thanh cong. CHI dung de
  // hien ten tier luc reveal, KHONG BAO GIO dung de goi y dieu kien
  // truoc khi dat (xem core/breakthrough/FoundationResolver.ts).
  highestFoundationAchieved?: FoundationType

  // Beta Phase 4 (Tutorial Carousel) - whether the intro tutorial was
  // seen/skipped, gated per NEW character (App.vue's onMounted()
  // else-branch) - add the field + default in createDefaultPlayer(),
  // self-persists via spread.
  hasSeenTutorial: boolean

  // Phap Tu profession-tier ladder (2026-08-14, xem
  // core/player/CultivationPathKit.ts) - undefined (mac dinh cua MOI
  // nhan vat hien co) -> chon 1 lan DUY NHAT qua
  // GameManager.chooseCultivationPath() -> VINH VIEN (khong co thao
  // tac "doi lai"/respec - dung tinh than "nghe nghiep", mot khi chon
  // thi gan bo). Viec chon tu cap Tam Phap Tu Luyen + Tam Phap Chien
  // Dau + dung 3 skill co dinh cua tier do - KHONG phai he thong
  // build tu do, chi la 1 bo noi dung da thiet ke san duoc mo khoa.
  //
  // Pham Nhan (2026-08-16) - GIO CUNG la 1 dai canh gioi that (REALMS[0],
  // xem data/realms/realm.ts), khac field nay (von la trang thai "chua
  // chon nghe", doc lap voi realmId). 2 khai niem trung ten nhung KHONG
  // phai 1: chon path chinh la nghi le dot pha Pham Nhan -> Luyen Khi
  // (xem GameManager.chooseCultivationPath()), nen tren thuc te
  // cultivationPath luon undefined trong luc realmId === 'mortal' va
  // luon co gia tri ngay khi realmId roi khoi 'mortal' - save cu
  // (tao truoc khi Pham Nhan ton tai, da o qi_refining+ ma chua chon
  // path) la NGOAI LE duy nhat, xem CharacterPanel.vue's
  // canChooseCultivationPath.
  cultivationPath?: CultivationPathId

  // Cultivation Path Framework (spec 2026-09-16, M7) - the chosen WAY
  // inside the path (e.g. 'spell_pathway', 'hidden_spell_pathway'), written together with
  // cultivationPath by CultivationPathSystem.applyPathChoice() inside
  // the Initiation Ritual transaction. Post-M7 the union is exactly the
  // three base ids and the pair is atomic - a way-less or foreign-way
  // pair is corrupt and fails closed everywhere.
  cultivationWay?: CultivationWayId

  // P7-M4 - the mortal basic pick: which learned precursor the player
  // fights with before initiation ('tram' | 'linh_bao' | 'huy_quyen';
  // absent -> 'tram'). Mortal-scoped: written only via
  // progressionOps.setMortalBasicSkill() while cultivationPath is
  // unset, and cleared by the ritual commit. A post-path save carrying
  // it is corrupt (save-v71 preflight rejects).
  mortalBasicSkillId?: string

  // Phap Tu Reimagined (spec 2026-09-14) - persistent path-choice
  // authority for the normal Phap Tu path: { element, route } commit
  // atomically via selectSpellPathElement(). Present from character
  // creation (both null until the ritual + atomic pick); hidden_spell_pathway
  // holders carry the same inert shape - the (path, way) pair, not
  // this state, is what matters.
  spellPath: SpellPathState

  // Kiem Tu Reimagined (spec 2026-09-15 K1) - the ONE canonical path
  // state. Written at applyPathChoice('sword', way) inside the
  // ritual; way membership lives on cultivationWay ('sword_pathway'|'hidden_sword_pathway') -
  // the retired mode field is gone.
  swordPath?: SwordPathState

  // Kiem Tu (2026-08-15) - Kiem Y VINH VIEN: dem don suot doi save,
  // KHONG BAO GIO giam (khac `cultivation`, bi tieu hao luc dot pha) -
  // Tu vi tich duoc suot doi save (dem don, KHONG BAO GIO giam - khac
  // `cultivation`, bi tieu hao luc dot pha). Tang trong stores/
  // player.ts's cultivate() (DUNG luong tu vi that vua cong). Sau spec
  // 2026-08-29, nguon tang Kiem Y doi sang bossKillCount (xem duoi) -
  // field nay con thong ke.
  totalCultivationGained: number

  // Tong boss/elite da diet vinh vien suot doi save (boss stage isBoss +
  // boss Do Kiep + elite/mini-boss, dem trong BattleLootSystem), chi
  // tang khong giam - counter thong ke/dieu kien chung.
  bossKillCount: number

  // Quai an (spec dot-pha-loi-kiep sec.4.1c) - dem kill quai Luyen Khi tu
  // lan giet quai an gan nhat; du 1000 mo cua so quai an tra tron pool
  // spawn (giet quai an reset ve 0).
  luyenKhiKillsSinceBeast: number

  // Dai Dao Truc Co (spec sec.4.2/sec.4.3) - snapshot "hoan hao Pham Nhan"
  // (5/5 main stat 10/10 + Luyen Th the 6/6) chot luc bam Quan Khi,
  // KHONG hoi cuu sau khi vao Luyen Khi.
  mortalPerfectionAchieved: boolean

  // Thua kiep Dai Dao -> mat VINH VIEN co hoi Dai Dao (spec sec.4.3) -
  // chi set, khong bao gio clear. Resolver cap o Thien Dao khi true.
  greatDaoOpportunityLost: boolean

  // Cam ngo Ky nang (skill-insight-and-auto-combat-hud-plan.md) - thay
  // HAN skillPoints cu (khong con cap khi dot pha tieu canh gioi, xem
  // CultivationSystem.breakthrough()). Nhan tu chien dau (ha quai, xem
  // GameManager.grantBattleRewardIfNeeded()), tieu vao mo node tree
  // (NodeSystem.ts's insightCost) va nang cap skill
  // (Core Node level qua progressionOps.levelUpSkill, M-QI-05) - 1 ho diem DUY NHAT cho ca 2 viec.
  skillInsight: number

  // Chi tang, khong giam - thong ke/dieu kien progression ve sau.
  totalSkillInsightGained: number

  // Thien phu Ngo Dao (talent-direction-choice-plan sec.6) - tu vi tu luyen
  // online tich luy vao day, du nguong cultivationPerInsight thi doi 1
  // diem Cam Ngo Ky nang; phan du giu lai cho lan sau. Chi tu luyen
  // online - tien do offline la thiet ke rieng sau nay.
  cultivationInsightAccumulator: number

  // PLAN HOAN CHINH muc 2 - diem Main Stat CHUA phan phoi, cap moi khi
  // dot pha TIEU canh gioi (xem CultivationSystem.breakthrough()) -
  // KHAC skillInsight (gio chi den tu chien dau, khong con cap cung
  // luc voi attributePoints nua) - tieu vao baseStats.{strength,dexterity,intelligence,
  // attunement,vitality} qua GameManager.allocateAttributePoint(), co
  // tran rieng tung stat theo dai canh gioi (xem core/stats/StatCap.ts).
  attributePoints: number

  // Phap Tu Redesign - id cua MOI ProgressionNode da mua, xuyen suot
  // MOI path (Node Tree la ha tang CHUNG, khong tach rieng theo path)
  // - xem core/progression/NodeSystem.ts.
  purchasedNodeIds: string[]

  // Node level (combat-skill-flow-element-power-dot-plan.md sec.6.1) -
  // NGUON SU THAT duy nhat cua state da dau tu: level 0 = chua linh
  // ngo, >=1 = da linh ngo (muc stack). purchasedNodeIds giu lai lam
  // compat read-only, luon dong bo = cac id co level >= 1.
  nodeLevels: Record<string, number>

  // Van Dao talent (talent-catalog-v4 sec.4.3) - nodeId -> times a node
  // purchase or upgrade went free via the talent roll. Kept after the
  // talent is removed so refund accounting stays honest.
  nodeFreePurchaseRecord: Record<string, number>

  // Man chi mo tuan tu: thang mot man moi mo man ke tiep.
  completedStageIds: string[]

  // Auto-farm Hoan My (2026-09-04 spec) - stage da dat dieu kien "Hoan
  // My" (spec v3 D1: all party alive at victory + roundsElapsed <
  // stage.perfectClearTurnLimit - rounds, not actor actions). Ghi 1
  // LAN luc dat lan dau, khong cap nhat lai sau do.
  perfectClearStageIds: string[]

  // Wall-clock giay cua lan dat Hoan My dau tien cho stage do - dung
  // lam cycleSeconds = gia tri nay / 2 cho auto-farm. Day la 1 trong
  // dung 2-3 cho combat duoc phep doc Date.now() (xem plan
  // 2026-09-04-stage-auto-farm.md's Global Constraints).
  perfectClearSeconds: Record<string, number>

  // Stage dang auto-farm (chi 1 tai 1 thoi diem, khop StageManager's
  // single-active cardinality). null = khong co auto-farm nao dang chay.
  autoFarmStage: { stageId: string; lastCheckedMs: number } | null

  // P7-M5 - the ONE canonical body progression record (chapter-keyed:
  // body_refinement tiers + meridian openedIds today). Owned by
  // core/realm/body/BodyProgressionSystem; consumers read derived facts
  // through it, never the slices directly.
  bodyProgression: BodyProgressionState

  // M-QI-07 (QI-D4) - the persisted physique (The Phach) grade on the
  // Pham -> Bao -> ... -> Tien ladder (data/realm/PhysiqueLadder.ts).
  // Advanced EXACTLY ONE rung per completed physique-advancement body
  // chapter (today: 6/6 body_refinement -> 'bao'), written inside the
  // BodyProgressionSystem invest transaction - never derived from realm
  // or re-derived at restore (save integrity REJECTS a grade that does
  // not match the authored-transition derivation).
  physiqueGrade: PhysiqueGradeId

  // Bac Nhap Dao (1-6) - chot DUY NHAT 1 lan luc Le Nhap Mon (Pham
  // Nhan -> Luyen Khi, xem GameManager.chooseCultivationPath()) tu so
  // tang body_refinement da hoan thanh tai thoi diem do, dung cho ca Nhap Dao
  // (data/realm/RealmPassives.ts) lan Realm Pressure (xem
  // core/combat/RealmPressure.ts). Mac dinh 6 (khong bi ap che) cho
  // save cu/nhan vat chua tung qua Pham Nhan - KHONG hoi to phat
  // nhan vat chua tung co co hoi chon.
  breakthroughGrade: number

  // Loi Kiep talent (talent-catalog-v4 sec.4.3) - permanent +10% all
  // attributes per successful tribulation while the talent is held.
  // Owned by TribulationOutcomeService's victory path.
  tribulationBonusStacks: number

  // Pha Giap talent M2 carry (talent-catalog-v4 sec.4.3) - half the Pha
  // Giap passive's metalPenetration stacks bank at battle end and
  // re-seed the next battle; resets when realmId changes.
  phaGiapCarryStacks: number
  phaGiapCarryRealmId: string | null

  // Idempotency guard for realm-scoped Realm Passives (Nhap Dao/Kien
  // Co/...) - key = the realmId just entered. See
  // core/realm/RealmPassiveSystem.ts.
  grantedRealmPassiveIds: string[]

  // Timed effect theo thoi gian thuc (2026-08-24, plan sec.5.4) - deadline
  // tuyet doi expiresAtMs la authority; load bo effect het han. Xem
  // PersistentTimedEffect.ts / GameManager.getActiveRuntimeModifiers().
  persistentTimedEffects: PersistentTimedEffect[]


  // Combat AI strategy (combat-gate-teleport-autocast plan sec.10) - lua
  // chon gameplay lau dai cua nguoi choi, ap dung ngay va tu luu khi doi.
  // Save thieu field/gia tri sai -> fallback DEFAULT (development build,
  // khong migration).
  combatAiStrategy: CombatAiStrategy

  // Ban Menh Phap Bao (2026-08-27, foundation-artifact-system-plan.md
  // sec.10.2) - undefined truoc Truc Co hoac khi nghe chua co definition
  // (Kiem Tu/The Tu, xem ARTIFACT_ID_BY_CULTIVATION_PATH). KHONG phai
  // array inventory - moi nhan vat chi co dung MOT ban menh, khong
  // roll/nhat/craft/equip/doi sang phap bao nghe khac.
  artifact?: ArtifactProgress

  // Kiem Tu (2026-08-28) - mirror cua Skill.totalExperience/level cho
  // TUNG skill (key = skillId), ghi moi lan cast trong
  // SkillSystem.recordCast() qua sink (xem
  // GameManager's skillSystem.setCastCountSink()). Ton tai VI
  // NodeSystem.hasPrerequisite() chi nhan PlayerData - khong co
  // SkillManager de tra totalExperience/level truc tiep. Skill instance
  // that van song trong SkillManager (KHONG nam trong PlayerData); day
  // chi la ban sao doc-thoi phuc vu prerequisite `skillCastCount`.
  skillCastCounts?: Record<string, number>

  // P7-M6 - read-only mirror of the canonical technique holder's
  // {rank, grade}. The holder lives in TechniqueManager (0-or-1, no
  // list/unequip); TechniqueSystem's progress sink republishes this pair
  // on every write that can change it (grant/rank-up/grade-advance/
  // restore). Exists VI NodeSystem.hasPrerequisite() chi nhan
  // PlayerData - techniqueRank/techniqueGrade prerequisites cannot
  // reach the manager. undefined = no technique held. One record keeps
  // the pair atomic - advanceTechniqueGrade changes both at once.
  techniqueProgress?: { rank: number; grade: number }

  // Companion Roster (2026-09-05) - gacha-recruited combatants owned by
  // the player. Khong co equipment/node-tree ky nang rieng tung nhan vat
  // (bo ky nang co dinh trong CompanionDefinition, xem
  // data/companion/Companions.ts) - day la field moi DUY NHAT feature
  // nay can tren PlayerData.
  companions: CompanionInstance[]

  // Companion Gacha (2026-09-12) - pity counter: pulls since the last
  // grade >= 'dia' result (reset on dia/thien/tien, see CompanionGacha).
  companionPullsSinceRare: number

  // Companion Gacha (2026-09-12) - Duyen Phan exchange currency, earned
  // from duplicate pulls on constellation-maxed companions.
  duyenPhan: number

  // Tran Phap (2026-09-05) - tran phap dang active + vi tri gan tung o.
  // null = nguoi choi chua tung cau hinh tran phap nao; buildTurnBattle()
  // se fallback ve DEFAULT_PARTY_FORMATION (Combat Art Pipeline spec sec.7).
  formationLoadout: FormationLoadout | null

  lastSavedAt: number
}

// Tran Phap (2026-09-05) - type du nho nen khai bao inline luon o day
// (chua co consumer nao khac can tach rieng module), khac voi
// CompanionInstance o Task 11 phai tach file vi co nhieu consumer dung lai.
export interface FormationSlotAssignment {
  row: number
  column: number
  combatantId: string
}

export interface FormationLoadout {
  formationId: string
  assignments: FormationSlotAssignment[]
}

export function createDefaultPlayer(): PlayerData {
  return {
    name: 'Vô Danh',

    realmId: 'mortal',
    realmLevel: 1,

    cultivation: 0,
    cultivationPerSecond: 10,
    autoWorkerCapacity: 0,

    baseStats: createBaseStats(),
    modifiers: [],
    externalModifiers: [],

    selectedTalentIds: [],
    completedStageIds: [],
    perfectClearStageIds: [],
    perfectClearSeconds: {},
    autoFarmStage: null,
    hasSeenTutorial: false,

    // PHAI khai bao tuong minh (du `undefined`) - Pinia Options Store
    // dung reactive property bang toRefs() snapshot 1 LAN luc khoi tao
    // store; field nao KHONG co mat nhu 1 key o day thi
    // player.cultivationPath (doc qua store instance) se KHONG BAO GIO
    // phan ung khi GameManager.chooseCultivationPath() gan gia tri qua
    // player.$state sau nay (bug that da gap: technique/skill equip
    // dung nhung UI gate khong tu chuyen vi thieu dong nay).
    cultivationPath: undefined,

    // MUST be declared explicitly (even as `undefined`) - same Pinia
    // toRefs() snapshot reason as cultivationPath above: applyPathChoice
    // assigns this field through player.$state inside the ritual.
    cultivationWay: undefined,

    // MUST be declared explicitly (even as `undefined`) - same Pinia
    // toRefs() snapshot reason as cultivationPath above:
    // progressionOps.setMortalBasicSkill() assigns this field through
    // player.$state.
    mortalBasicSkillId: undefined,

    // Required (non-optional) field - present from creation; both
    // members stay null until the ritual + atomic element/route pick.
    spellPath: createSpellPathState(),

    // PHAI khai bao tuong minh (du `undefined`) - cung ly do
    // cultivationPath o tren (toRefs() snapshot 1 lan luc init store).
    swordPath: undefined,

    // PHAI khai bao tuong minh (du `undefined`) - cung ly do
    // cultivationPath o tren (toRefs() snapshot 1 lan luc init store).
    artifact: undefined,

    // PHAI khai bao tuong minh (du `undefined`) - cung ly do
    // cultivationPath o tren: TribulationOutcomeService gan field nay
    // qua store proxy, khong phai qua player.$state - key thieu o day
    // thi write roi ra ngoai $state, khong bao gio vao save va khong bi
    // restore reset (M1, ARCH-001).
    highestFoundationAchieved: undefined,

    // PHAI khai bao tuong minh (rong, khong undefined) - cung ly do
    // Pinia toRefs() snapshot o tren: sink cua SkillSystem ghi field
    // con (`skillCastCounts[skillId] = ...`) sau khi store da khoi
    // tao, nen object chua PHAI ton tai san lam key reactive tu dau.
    skillCastCounts: {},

    // PHAI khai bao tuong minh (du `undefined`) - cung ly do
    // cultivationPath o tren (toRefs() snapshot + restore whitelist):
    // TechniqueSystem's progress sink assigns this field through
    // player.$state after store init.
    techniqueProgress: undefined,

    totalCultivationGained: 0,
    bossKillCount: 0,
    luyenKhiKillsSinceBeast: 0,
    mortalPerfectionAchieved: false,
    greatDaoOpportunityLost: false,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    cultivationInsightAccumulator: 0,
    cultivationOvercharge: 0,
    attributePoints: 0,
    purchasedNodeIds: [],
    nodeLevels: {},
    nodeFreePurchaseRecord: {},

    bodyProgression: createDefaultBodyProgression(),
    physiqueGrade: 'pham',
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    tribulationBonusStacks: 0,
    phaGiapCarryStacks: 0,
    phaGiapCarryRealmId: null,

    persistentTimedEffects: [],


    combatAiStrategy: DEFAULT_COMBAT_AI_STRATEGY,

    companions: [],
    companionPullsSinceRare: 0,
    duyenPhan: 0,

    formationLoadout: null,

    lastSavedAt: Date.now(),
  }
}

/**
 * ARCH-002 (M7) - the single raw -> resolved stat assembly for the player.
 * Extracted from the player store's `finalStats` getter so the battle entry
 * path can resolve the same value WITHOUT reading the store's
 * `externalModifiers` mirror (a per-tick cache that can hold stale
 * battle-scoped modifiers - the ARCH-002 leak channel).
 *
 * `externalModifiers` here is the caller-provided modifier list: the store
 * passes its mirror field; the battle ops pass the fresh static aggregation
 * (`GameManagerPersistentEffectOps.getBattleBaseModifiers`).
 */
/**
 * P2 - the stat assembly in two parts: the resolved Stats plus the way-facet
 * modifier emission that fed it (the canonical build needs the channel
 * contents for attribution). resolvePlayerFinalStats delegates - one formula
 * owner, no parallel derivation.
 */
export function resolvePlayerStatAssembly(
  player: PlayerData,
  externalModifiers: StatModifier[],
): { stats: Stats; wayFacetModifiers: readonly StatModifier[] } {
  const allModifiers = [
    ...player.modifiers,
    ...externalModifiers,
  ]

  // P7-M-F (D1) - assembledBase: Body Refinement contributes FLAT BASE
  // STAT deltas, merged additively per key ONTO the persisted raw
  // baseStats (never an overwrite: a stat with base 5 and delta 4
  // resolves from 9, not 4). Ephemeral - recomputed at every resolution
  // from canonical bodyProgression state; player.baseStats is never
  // mutated, so saves, mortal perfection's persisted-base read, and
  // restore rehydration are unaffected.
  const assembledBase = { ...player.baseStats }
  for (const [stat, delta] of statDeltaEntries(collectBodyBaseStatDeltas(player))) {
    assembledBase[stat] += delta
  }
  const pipelineBase = asBaseStats(assembledBase)

  // D12 ordering contract (spec section 5): the active way's stat facet
  // reads the resolved attribute totals and emits its gated modifiers
  // BEFORE calculateStats runs -- the totals read is not a second
  // attribute derivation (INV-6), and the emitted modifiers are the ONLY
  // gated channels (INV-10). M4 moved the Phap Tu attunement emitter
  // behind the way facet (collectActiveWayStatModifiers); M5 moves the
  // The Tu channels the same way - body_pathway's vitality->enduranceThreshold
  // and hidden_body_pathway's attribute->chance emissions are declared on the way
  // stat facets in core/the-tu/TheTuPath.ts, keyed by cultivationWay.
  const attributeTotals = resolveAttributeTotals(pipelineBase, allModifiers)
  const pathModifiers = collectActiveWayStatModifiers(player, attributeTotals)

  return {
    stats: calculateStats(pipelineBase, [...allModifiers, ...pathModifiers]),
    wayFacetModifiers: pathModifiers,
  }
}

export function resolvePlayerFinalStats(
  player: PlayerData,
  externalModifiers: StatModifier[],
): Stats {
  return resolvePlayerStatAssembly(player, externalModifiers).stats
}

/**
 * Chuyen PlayerData thanh CombatEntity de dua vao BattleSystem.
 * `stats` phai la finalStats da tinh san (baseStats + modifiers +
 * externalModifiers) - ham nay KHONG tu goi calculateStats, de
 * tranh phu thuoc nguoc vao StatCalculator theo 2 cach khac nhau
 * tai 2 noi (store da co finalStats getter, dung lai luon).
 *
 * currentHp luon khoi tao bang maxHp: giong enemyToCombatEntity(),
 * PlayerData khong luu HP giua cac tran - HP la state "song" chi
 * ton tai trong luc battle dang dien ra (do BattleSystem quan ly),
 * khong phai state can persist vao save file.
 */
export function playerToCombatEntity(
  player: PlayerData,
  stats: Stats,
  skillLevels?: Readonly<Record<string, number>>,
): CombatEntity {
  const entity: CombatEntity = {
    id: 'player',

    name: player.name,

    type: 'player',

    baseStats: stats,

    stats,

    skillLevels,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    currentMp: stats.maxMp,




    currentWard: 0,

    // Vo cuc - "chua tung bi danh" luc tran vua bat dau, de Ward co
    // the hoi ngay tu dau tran thay vi phai cho 1 khoang WARD_REGEN_
    // DELAY_SECONDS gia tao du chua he an don nao (xem CombatEntity.ts).
    turnsSinceLastHitLanded: Infinity,

    realmIndex: getRealmIndex(player.realmId),

    // Realm Pressure (xem core/combat/RealmPressure.ts) - CHI player co
    // gia tri that (enemy khong breakthrough nen khong co khai niem
    // nay, enemyToCombatEntity() de undefined).
    breakthroughGrade: player.breakthroughGrade,

    // Placeholder - BattleSystem.start() set lai thanh HERO_HOME_X
    // ngay khi tran bat dau (xem core/battle/BattleLane.ts).
    x: 0,

    // Hero luon dung co dinh lane giua (2026-08-22, top-down 5-lane).
    row: CENTER_LANE_INDEX,

    alive: true,
  }

  resetBattleScopedResources(entity)

  return entity
}

/**
 * Phap Tu Reimagined Task 8 (INV-14) - battle-instance-scoped resource
 * reset, the ONE home for fields that must not survive a battle
 * boundary. currentThe is the breaking change: legacy let it ride
 * entity reuse across a farm session; now every fresh participant
 * build AND every auto-repeat restartTurnBattleCycle zeroes it - for
 * Phap Tu, Bat Kiem, and any future path sharing the pool.
 *
 * Call sites: playerToCombatEntity (fresh build) +
 * GameManagerTurnBattleOps startStage / restartTurnBattleCycle
 * (carried-over player entities).
 */
export function resetBattleScopedResources(entity: CombatEntity): void {
  entity.currentThe = 0
}

/**
 * `addSkillInsight` cong thang vao Cam ngo Ky nang (player.skillInsight)
 * - kenh reward truc tiep cho quest/direct grants (P7-M3: technique
 * gio an techniqueMastery qua TechniqueSystem.gainMastery, KHONG qua
 * receiver nay).
 *
 * `addSpiritStone` (plan Workstream F) - GameManager inject implementation
 * cong vao MaterialBag (SPIRIT_STONE_MATERIAL_ID); PlayerData khong con
 * giu currency nao ca.
 */
export function createPlayerRewardReceiver(
  player: PlayerData,
  addInsight?: (amount: number) => void,
  addSpiritStone?: (amount: number) => void,
): RewardReceiver {
  return {
    addSkillInsight(amount: number) {
      addInsight?.(amount)
      // Co y khong lam gi - xem ghi chu JSDoc phia tren.
    },

    addCultivation(amount: number) {
      addCultivation(player, amount)
    },

    addSpiritStone(amount: number) {
      addSpiritStone?.(amount)
    },
  }
}
