import { calculateStats, resolveAttributeTotals, type StatModifier } from '../stats/StatCalculator'
import { collectActiveWayStatModifiers } from './CultivationPathSystem'
import { createBaseStats, type BaseStats, type Stats } from '../stats/StatBlock'
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

export interface PlayerData {
  name: string

  realmId: string
  realmLevel: number

  cultivation: number
  cultivationPerSecond: number

  // Hai Nap talent (talent-catalog-v4 §4.3) — cultivation that would
  // overflow past the current level cap banks here and pours into the
  // next tier on breakthrough. Owned by CultivationSystem.
  cultivationOvercharge: number

  /** Pool nhân công tự động dùng chung cho mọi ProductionSite. */
  autoWorkerCapacity: number

  baseStats: BaseStats

  // Modifier "tĩnh", gắn trực tiếp với nhân vật: equipment, talent,
  // reincarnation... Người chơi tự thêm/bớt qua các hành động rõ ràng
  // (trang bị vũ khí, chọn talent...).
  modifiers: StatModifier[]

  // Modifier "động", được GameManager tổng hợp lại mỗi tick từ
  // BuffSystem + TechniqueSystem (xem GameManager.getAggregatedModifiers()).
  // Store không tự tính modifier này — chỉ nhận và lưu để finalStats dùng.
  externalModifiers: StatModifier[]

  // Linh Thạch KHÔNG còn là currency trên PlayerData (plan Workstream
  // F) — số dư duy nhất là materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID).

  // Ba Thiên Phú được chốt khi tạo nhân vật. Hiệu ứng gameplay sẽ được
  // nối vào stat/effect system theo talent-system-plan.md.
  selectedTalentIds: string[]

  // Đột Phá Trúc Cơ (Phase 5) — Căn Cơ CAO NHẤT từng đạt qua Độ Kiếp
  // thắng lợi (mục 16 spec `breakthrough` — "được reveal" sau khi
  // thắng). undefined = chưa từng Trúc Cơ thành công. CHỈ dùng để
  // hiện tên tier lúc reveal, KHÔNG BAO GIỜ dùng để gợi ý điều kiện
  // trước khi đạt (xem core/breakthrough/FoundationResolver.ts).
  highestFoundationAchieved?: FoundationType

  // Beta Phase 4 (Tutorial Carousel) - whether the intro tutorial was
  // seen/skipped, gated per NEW character (App.vue's onMounted()
  // else-branch) - add the field + default in createDefaultPlayer(),
  // self-persists via spread.
  hasSeenTutorial: boolean

  // Pháp Tu profession-tier ladder (2026-08-14, xem
  // core/player/CultivationPathKit.ts) — undefined (mặc định của MỌI
  // nhân vật hiện có) -> chọn 1 lần DUY NHẤT qua
  // GameManager.chooseCultivationPath() -> VĨNH VIỄN (không có thao
  // tác "đổi lại"/respec — đúng tinh thần "nghề nghiệp", một khi chọn
  // thì gắn bó). Việc chọn tự cấp Tâm Pháp Tu Luyện + Tâm Pháp Chiến
  // Đấu + đúng 3 skill cố định của tier đó — KHÔNG phải hệ thống
  // build tự do, chỉ là 1 bộ nội dung đã thiết kế sẵn được mở khoá.
  //
  // Phàm Nhân (2026-08-16) — GIỜ CŨNG là 1 đại cảnh giới thật (REALMS[0],
  // xem data/realms/realm.ts), khác field này (vốn là trạng thái "chưa
  // chọn nghề", độc lập với realmId). 2 khái niệm trùng tên nhưng KHÔNG
  // phải 1: chọn path chính là nghi lễ đột phá Phàm Nhân -> Luyện Khí
  // (xem GameManager.chooseCultivationPath()), nên trên thực tế
  // cultivationPath luôn undefined trong lúc realmId === 'mortal' và
  // luôn có giá trị ngay khi realmId rời khỏi 'mortal' — save cũ
  // (tạo trước khi Phàm Nhân tồn tại, đã ở qi_refining+ mà chưa chọn
  // path) là NGOẠI LỆ duy nhất, xem CharacterPanel.vue's
  // canChooseCultivationPath.
  cultivationPath?: CultivationPathId

  // Cultivation Path Framework (spec 2026-09-16, M7) — the chosen WAY
  // inside the path (e.g. 'spell_pathway', 'hidden_spell_pathway'), written together with
  // cultivationPath by CultivationPathSystem.applyPathChoice() inside
  // the Initiation Ritual transaction. Post-M7 the union is exactly the
  // three base ids and the pair is atomic — a way-less or foreign-way
  // pair is corrupt and fails closed everywhere.
  cultivationWay?: CultivationWayId

  // Phap Tu Reimagined (spec 2026-09-14) — persistent path-choice
  // authority for the normal Phap Tu path: { element, route } commit
  // atomically via selectSpellPathElement(). Present from character
  // creation (both null until the ritual + atomic pick); hidden_spell_pathway
  // holders carry the same inert shape — the (path, way) pair, not
  // this state, is what matters.
  spellPath: SpellPathState

  // Kiem Tu Reimagined (spec 2026-09-15 K1) — the ONE canonical path
  // state. Written at applyPathChoice('sword', way) inside the
  // ritual; way membership lives on cultivationWay ('sword_pathway'|'hidden_sword_pathway') —
  // the retired mode field is gone.
  swordPath?: SwordPathState

  // Kiếm Tu (2026-08-15) — Kiếm Ý VĨNH VIỄN: đếm dồn suốt đời save,
  // KHÔNG BAO GIỜ giảm (khác `cultivation`, bị tiêu hao lúc đột phá) —
  // Tu vi tích được suốt đời save (đếm dồn, KHÔNG BAO GIỜ giảm — khác
  // `cultivation`, bị tiêu hao lúc đột phá). Tăng trong stores/
  // player.ts's cultivate() (DUNG luong tu vi that vua cong). Sau spec
  // 2026-08-29, nguon tang Kiem Y doi sang bossKillCount (xem duoi) -
  // field nay con thong ke.
  totalCultivationGained: number

  // Tổng boss/elite đã diệt vĩnh viễn suốt đời save (boss stage isBoss +
  // boss Độ Kiếp + elite/mini-boss, đếm trong BattleLootSystem), chỉ
  // tăng không giảm — counter thống kê/điều kiện chung.
  bossKillCount: number

  // Bát Mạch (spec dot-pha-loi-kiep §4.1a) — id các đường Kỳ Kinh đã
  // thông (tuần tự, xem core/realm/MeridianSystem.ts). 9/9 gồm Kỳ Kinh
  // Thiên Địa Chi Kiều là điều kiện Đại Đạo Trúc Cơ.
  openedMeridianIds: string[]

  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — đếm kill quái Luyện Khí từ
  // lần giết quái ẩn gần nhất; đủ 1000 mở cửa sổ quái ẩn trà trộn pool
  // spawn (giết quái ẩn reset về 0).
  luyenKhiKillsSinceBeast: number

  // Đại Đạo Trúc Cơ (spec §4.2/§4.3) — snapshot "hoàn hảo Phàm Nhân"
  // (5/5 main stat 10/10 + Luyện Th thể 6/6) chốt lúc bấm Quán Khí,
  // KHÔNG hồi cứu sau khi vào Luyện Khí.
  mortalPerfectionAchieved: boolean

  // Thua kiếp Đại Đạo → mất VĨNH VIỄN cơ hội Đại Đạo (spec §4.3) —
  // chỉ set, không bao giờ clear. Resolver cap ở Thiên Đạo khi true.
  greatDaoOpportunityLost: boolean

  // Cảm ngộ Kỹ năng (skill-insight-and-auto-combat-hud-plan.md) — thay
  // HẲN skillPoints cũ (không còn cấp khi đột phá tiểu cảnh giới, xem
  // CultivationSystem.breakthrough()). Nhận từ chiến đấu (hạ quái, xem
  // GameManager.grantBattleRewardIfNeeded()), tiêu vào mở node tree
  // (NodeSystem.ts's insightCost) và nâng cấp skill
  // (SkillSystem.upgradeSkill()) — 1 hồ điểm DUY NHẤT cho cả 2 việc.
  skillInsight: number

  // Chỉ tăng, không giảm — thống kê/điều kiện progression về sau.
  totalSkillInsightGained: number

  // Thiên phú Ngộ Đạo (talent-direction-choice-plan §6) — tu vi tu luyện
  // online tích luỹ vào đây, đủ ngưỡng cultivationPerInsight thì đổi 1
  // điểm Cảm Ngộ Kỹ năng; phần dư giữ lại cho lần sau. Chỉ tu luyện
  // online — tiến độ offline là thiết kế riêng sau này.
  cultivationInsightAccumulator: number

  // PLAN HOÀN CHỈNH mục 2 — điểm Main Stat CHƯA phân phối, cấp mỗi khi
  // đột phá TIỂU cảnh giới (xem CultivationSystem.breakthrough()) —
  // KHÁC skillInsight (giờ chỉ đến từ chiến đấu, không còn cấp cùng
  // lúc với attributePoints nữa) — tiêu vào baseStats.{strength,dexterity,intelligence,
  // attunement,vitality} qua GameManager.allocateAttributePoint(), có
  // trần riêng từng stat theo đại cảnh giới (xem core/stats/StatCap.ts).
  attributePoints: number

  // Pháp Tu Redesign — id của MỌI ProgressionNode đã mua, xuyên suốt
  // MỌI path (Node Tree là hạ tầng CHUNG, không tách riêng theo path)
  // — xem core/progression/NodeSystem.ts.
  purchasedNodeIds: string[]

  // Node level (combat-skill-flow-element-power-dot-plan.md §6.1) —
  // NGUỒN SỰ THẬT duy nhất của state đã đầu tư: level 0 = chưa lĩnh
  // ngộ, >=1 = đã lĩnh ngộ (mức stack). purchasedNodeIds giữ lại làm
  // compat read-only, luôn đồng bộ = các id có level >= 1.
  nodeLevels: Record<string, number>

  // Van Dao talent (talent-catalog-v4 §4.3) — nodeId -> times a node
  // purchase or upgrade went free via the talent roll. Kept after the
  // talent is removed so refund accounting stays honest.
  nodeFreePurchaseRecord: Record<string, number>

  // Màn chỉ mở tuần tự: thắng một màn mới mở màn kế tiếp.
  completedStageIds: string[]

  // Auto-farm Hoàn Mỹ (2026-09-04 spec) — stage đã đạt điều kiện "Hoàn
  // Mỹ" (spec v3 D1: all party alive at victory + roundsElapsed <
  // stage.perfectClearTurnLimit - rounds, not actor actions). Ghi 1
  // LẦN lúc đạt lần đầu, không cập nhật lại sau đó.
  perfectClearStageIds: string[]

  // Wall-clock giây của lần đạt Hoàn Mỹ đầu tiên cho stage đó — dùng
  // làm cycleSeconds = giá trị này / 2 cho auto-farm. Đây là 1 trong
  // đúng 2-3 chỗ combat được phép đọc Date.now() (xem plan
  // 2026-09-04-stage-auto-farm.md's Global Constraints).
  perfectClearSeconds: Record<string, number>

  // Stage đang auto-farm (chỉ 1 tại 1 thời điểm, khớp StageManager's
  // single-active cardinality). null = không có auto-farm nào đang chạy.
  autoFarmStage: { stageId: string; lastCheckedMs: number } | null

  // Luyện Thể (Realm Passive & Pressure System, 2026-08-20) — 6 tầng
  // rèn thể Phàm Nhân, xem data/realm/LuyenThe.ts. bodyRefinementCompletedTiers
  // đếm số tầng ĐÃ HOÀN THÀNH (0-6, tuần tự), bodyRefinementCurrentTierProgress
  // là Tinh Hoa Phàm Thể đã đầu tư vào tầng ĐANG DỞ (0..cap của tầng
  // bodyRefinementCompletedTiers). Xem core/realm/BodyRefinementSystem.ts.
  bodyRefinementCompletedTiers: number

  bodyRefinementCurrentTierProgress: number

  // Bậc Nhập Đạo (1-6) — chốt DUY NHẤT 1 lần lúc Lễ Nhập Môn (Phàm
  // Nhân -> Luyện Khí, xem GameManager.chooseCultivationPath()) từ
  // bodyRefinementCompletedTiers tại thời điểm đó, dùng cho cả Nhập Đạo
  // (data/realm/RealmPassives.ts) lẫn Realm Pressure (xem
  // core/combat/RealmPressure.ts). Mặc định 6 (không bị áp chế) cho
  // save cũ/nhân vật chưa từng qua Phàm Nhân — KHÔNG hồi tố phạt
  // nhân vật chưa từng có cơ hội chọn.
  breakthroughGrade: number

  // Loi Kiep talent (talent-catalog-v4 §4.3) — permanent +10% all
  // attributes per successful tribulation while the talent is held.
  // Owned by TribulationOutcomeService's victory path.
  tribulationBonusStacks: number

  // Pha Giap talent M2 carry (talent-catalog-v4 §4.3) — half the Pha
  // Giap passive's metalPenetration stacks bank at battle end and
  // re-seed the next battle; resets when realmId changes.
  phaGiapCarryStacks: number
  phaGiapCarryRealmId: string | null

  // Idempotency guard for realm-scoped Realm Passives (Nhap Dao/Kien
  // Co/...) - key = the realmId just entered. See
  // core/realm/RealmPassiveSystem.ts.
  grantedRealmPassiveIds: string[]

  // Timed effect theo thời gian thực (2026-08-24, plan §5.4) — deadline
  // tuyệt đối expiresAtMs là authority; load bỏ effect hết hạn. Xem
  // PersistentTimedEffect.ts / GameManager.getActiveRuntimeModifiers().
  persistentTimedEffects: PersistentTimedEffect[]


  // Combat AI strategy (combat-gate-teleport-autocast plan §10) — lựa
  // chọn gameplay lâu dài của người chơi, áp dụng ngay và tự lưu khi đổi.
  // Save thiếu field/giá trị sai → fallback DEFAULT (development build,
  // không migration).
  combatAiStrategy: CombatAiStrategy

  // Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md
  // §10.2) — undefined trước Trúc Cơ hoặc khi nghề chưa có definition
  // (Kiếm Tu/Thể Tu, xem ARTIFACT_ID_BY_CULTIVATION_PATH). KHÔNG phải
  // array inventory — mỗi nhân vật chỉ có đúng MỘT bản mệnh, không
  // roll/nhặt/craft/equip/đổi sang pháp bảo nghề khác.
  artifact?: ArtifactProgress

  // Kiếm Tu (2026-08-28) — mirror của Skill.totalExperience/level cho
  // TỪNG skill (key = skillId), ghi mỗi lần cast trong
  // SkillSystem.recordCast() qua sink (xem
  // GameManager's skillSystem.setCastCountSink()). Tồn tại VÌ
  // NodeSystem.hasPrerequisite() chỉ nhận PlayerData — không có
  // SkillManager để tra totalExperience/level trực tiếp. Skill instance
  // thật vẫn sống trong SkillManager (KHÔNG nằm trong PlayerData); đây
  // chỉ là bản sao đọc-thôi phục vụ prerequisite `skillCastCount`.
  skillCastCounts?: Record<string, number>

  skillLevels?: Record<string, number>

  // Companion Roster (2026-09-05) — gacha-recruited combatants owned by
  // the player. Không có equipment/node-tree kỹ năng riêng từng nhân vật
  // (bộ kỹ năng cố định trong CompanionDefinition, xem
  // data/companion/Companions.ts) — đây là field mới DUY NHẤT feature
  // này cần trên PlayerData.
  companions: CompanionInstance[]

  // Companion Gacha (2026-09-12) - pity counter: pulls since the last
  // grade >= 'dia' result (reset on dia/thien/tien, see CompanionGacha).
  companionPullsSinceRare: number

  // Companion Gacha (2026-09-12) - Duyen Phan exchange currency, earned
  // from duplicate pulls on constellation-maxed companions.
  duyenPhan: number

  // Trận Pháp (2026-09-05) — trận pháp đang active + vị trí gán từng ô.
  // null = người chơi chưa từng cấu hình trận pháp nào; buildTurnBattle()
  // sẽ fallback về DEFAULT_PARTY_FORMATION (Combat Art Pipeline spec §7).
  formationLoadout: FormationLoadout | null

  lastSavedAt: number
}

// Trận Pháp (2026-09-05) — type đủ nhỏ nên khai báo inline luôn ở đây
// (chưa có consumer nào khác cần tách riêng module), khác với
// CompanionInstance ở Task 11 phải tách file vì có nhiều consumer dùng lại.
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

    // PHẢI khai báo tường minh (dù `undefined`) — Pinia Options Store
    // dựng reactive property bằng toRefs() snapshot 1 LẦN lúc khởi tạo
    // store; field nào KHÔNG có mặt như 1 key ở đây thì
    // player.cultivationPath (đọc qua store instance) sẽ KHÔNG BAO GIỜ
    // phản ứng khi GameManager.chooseCultivationPath() gán giá trị qua
    // player.$state sau này (bug thật đã gặp: technique/skill equip
    // đúng nhưng UI gate không tự chuyển vì thiếu dòng này).
    cultivationPath: undefined,

    // MUST be declared explicitly (even as `undefined`) — same Pinia
    // toRefs() snapshot reason as cultivationPath above: applyPathChoice
    // assigns this field through player.$state inside the ritual.
    cultivationWay: undefined,

    // Required (non-optional) field — present from creation; both
    // members stay null until the ritual + atomic element/route pick.
    spellPath: createSpellPathState(),

    // PHẢI khai báo tường minh (dù `undefined`) — cùng lý do
    // cultivationPath ở trên (toRefs() snapshot 1 lần lúc init store).
    swordPath: undefined,

    // PHẢI khai báo tường minh (dù `undefined`) — cùng lý do
    // cultivationPath ở trên (toRefs() snapshot 1 lần lúc init store).
    artifact: undefined,

    // PHẢI khai báo tường minh (dù `undefined`) — cùng lý do
    // cultivationPath ở trên: TribulationOutcomeService gán field này
    // qua store proxy, không phải qua player.$state — key thiếu ở đây
    // thì write rơi ra ngoài $state, không bao giờ vào save và không bị
    // restore reset (M1, ARCH-001).
    highestFoundationAchieved: undefined,

    // PHẢI khai báo tường minh (rỗng, không undefined) — cùng lý do
    // Pinia toRefs() snapshot ở trên: sink của SkillSystem ghi field
    // con (`skillCastCounts[skillId] = ...`) sau khi store đã khởi
    // tạo, nên object chứa PHẢI tồn tại sẵn làm key reactive từ đầu.
    skillCastCounts: {},
    skillLevels: {},

    totalCultivationGained: 0,
    bossKillCount: 0,
    openedMeridianIds: [],
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

    bodyRefinementCompletedTiers: 0,
    bodyRefinementCurrentTierProgress: 0,
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
 * ARCH-002 (M7) — the single raw -> resolved stat assembly for the player.
 * Extracted from the player store's `finalStats` getter so the battle entry
 * path can resolve the same value WITHOUT reading the store's
 * `externalModifiers` mirror (a per-tick cache that can hold stale
 * battle-scoped modifiers — the ARCH-002 leak channel).
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

  // D12 ordering contract (spec section 5): the active way's stat facet
  // reads the resolved attribute totals and emits its gated modifiers
  // BEFORE calculateStats runs -- the totals read is not a second
  // attribute derivation (INV-6), and the emitted modifiers are the ONLY
  // gated channels (INV-10). M4 moved the Phap Tu attunement emitter
  // behind the way facet (collectActiveWayStatModifiers); M5 moves the
  // The Tu channels the same way — body_pathway's vitality->enduranceThreshold
  // and hidden_body_pathway's attribute->chance emissions are declared on the way
  // stat facets in core/the-tu/TheTuPath.ts, keyed by cultivationWay.
  const attributeTotals = resolveAttributeTotals(player.baseStats, allModifiers)
  const pathModifiers = collectActiveWayStatModifiers(player, attributeTotals)

  return {
    stats: calculateStats(player.baseStats, [...allModifiers, ...pathModifiers]),
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
 * Chuyển PlayerData thành CombatEntity để đưa vào BattleSystem.
 * `stats` phải là finalStats đã tính sẵn (baseStats + modifiers +
 * externalModifiers) — hàm này KHÔNG tự gọi calculateStats, để
 * tránh phụ thuộc ngược vào StatCalculator theo 2 cách khác nhau
 * tại 2 nơi (store đã có finalStats getter, dùng lại luôn).
 *
 * currentHp luôn khởi tạo bằng maxHp: giống enemyToCombatEntity(),
 * PlayerData không lưu HP giữa các trận — HP là state "sống" chỉ
 * tồn tại trong lúc battle đang diễn ra (do BattleSystem quản lý),
 * không phải state cần persist vào save file.
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

    // Vô cực — "chưa từng bị đánh" lúc trận vừa bắt đầu, để Ward có
    // thể hồi ngay từ đầu trận thay vì phải chờ 1 khoảng WARD_REGEN_
    // DELAY_SECONDS giả tạo dù chưa hề ăn đòn nào (xem CombatEntity.ts).
    turnsSinceLastHitLanded: Infinity,

    realmIndex: getRealmIndex(player.realmId),

    // Realm Pressure (xem core/combat/RealmPressure.ts) — CHỈ player có
    // giá trị thật (enemy không breakthrough nên không có khái niệm
    // này, enemyToCombatEntity() để undefined).
    breakthroughGrade: player.breakthroughGrade,

    // Placeholder — BattleSystem.start() set lại thành HERO_HOME_X
    // ngay khi trận bắt đầu (xem core/battle/BattleLane.ts).
    x: 0,

    // Hero luôn đứng cố định lane giữa (2026-08-22, top-down 5-lane).
    row: CENTER_LANE_INDEX,

    alive: true,
  }

  resetBattleScopedResources(entity)

  return entity
}

/**
 * Phap Tu Reimagined Task 8 (INV-14) — battle-instance-scoped resource
 * reset, the ONE home for fields that must not survive a battle
 * boundary. currentThe is the breaking change: legacy let it ride
 * entity reuse across a farm session; now every fresh participant
 * build AND every auto-repeat restartTurnBattleCycle zeroes it — for
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
 * - kenh reward truc tiep cho quest/direct grants (P7-M3: doi ten tu
 * addTechniqueInsight; technique gio an techniqueMastery qua
 * TechniqueSystem.gainMastery, KHONG qua receiver nay).
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
      // Cố ý không làm gì — xem ghi chú JSDoc phía trên.
    },

    addCultivation(amount: number) {
      addCultivation(player, amount)
    },

    addSpiritStone(amount: number) {
      addSpiritStone?.(amount)
    },
  }
}
