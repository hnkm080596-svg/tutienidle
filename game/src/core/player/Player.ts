import type { StatModifier } from '../stats/StatCalculator'
import { createBaseStats, type Stats } from '../stats/StatBlock'
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
import type { CultivationPathId } from './CultivationPathKit'
import type { PersistentTimedEffect } from './PersistentTimedEffect'
import type { ElementType } from '../element/ElementType'
import type { ArtifactProgress } from '../artifact/Artifact'
import type { CompanionInstance } from '../../data/companion/Companions'

/** Kiếm Tu tự lực (2026-08-28) — 2 nhánh song song, xem PlayerData.kiemTuRoute. */
export type KiemTuRoute = 'kiem_tran' | 'bat_kiem'

export interface PlayerData {
  name: string

  realmId: string
  realmLevel: number

  cultivation: number
  cultivationPerSecond: number

  /** Pool nhân công tự động dùng chung cho mọi ProductionSite. */
  autoWorkerCapacity: number

  baseStats: Stats

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

  // Ghi nhận đã unlock hiệu ứng gắn passive của Phá Cảnh Tâm Pháp khi
  // phá ĐẠI cảnh giới (key: `${techniqueId}:${realmId}`) — tránh cộng
  // trùng modifier vĩnh viễn nếu code chạy lại (idempotent, giống
  // GameManager.syncRealmPassive()). Xem composables/useBreakthrough.ts.
  unlockedRealmEnhancements: string[]

  // Đột Phá Trúc Cơ (Phase 5) — Căn Cơ CAO NHẤT từng đạt qua Độ Kiếp
  // thắng lợi (mục 16 spec `breakthrough` — "được reveal" sau khi
  // thắng). undefined = chưa từng Trúc Cơ thành công. CHỈ dùng để
  // hiện tên tier lúc reveal, KHÔNG BAO GIỜ dùng để gợi ý điều kiện
  // trước khi đạt (xem core/breakthrough/FoundationResolver.ts).
  highestFoundationAchieved?: FoundationType

  // Beta Phase 4 (Tutorial Carousel) — đã xem/bỏ qua tutorial nhập môn
  // chưa, gate theo nhân vật MỚI (App.vue's onMounted() else-branch) —
  // đúng pattern unlockedRealmEnhancements (thêm field + default trong
  // createDefaultPlayer(), tự persist qua spread).
  hasSeenTutorial: boolean

  // Cultivation ⇄ combat (2026-08-20) — KHÔNG còn nút bấm thủ công,
  // field này giờ SUY RA THẲNG từ isFighting mỗi tick (App.vue's
  // tick(): `player.isCultivating = !isFighting`) — chiến đấu thì
  // không tu luyện, không chiến đấu thì tự động tu luyện. Vẫn giữ làm
  // field thật (không tính lại tại chỗ dùng) vì MainScene.ts's
  // onCultivationChanged() cần 1 giá trị ổn định để đổi pose ngồi
  // thiền, và SaveSystem.ts vẫn persist field này.
  isCultivating: boolean

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

  // Kiếm Tu route (spec 2026-08-29-kiem-the-kiem-y mục 1) — chốt VĨNH
  // VIỄN trong chooseCultivationPath() theo tram Lv3 (10.000 trảm →
  // bat_kiem, chưa → kiem_tran), KHÔNG còn API đổi (setKiemTuRoute đã
  // dỡ). Mặc định (undefined) = chưa chọn path Kiếm Tu. Type export —
  // tránh UI component tự khai lại union này rồi lệch field thật.
  kiemTuRoute?: KiemTuRoute

  // Kiếm Tu (2026-08-15) — Kiếm Ý VĨNH VIỄN: đếm dồn suốt đời save,
  // KHÔNG BAO GIỜ giảm (khác `cultivation`, bị tiêu hao lúc đột phá) —
  // Tu vi tích được suốt đời save (đếm dồn, KHÔNG BAO GIỜ giảm — khác
  // `cultivation`, bị tiêu hao lúc đột phá). Tăng trong stores/
  // player.ts's cultivate() (ĐÚNG lượng tu vi thật vừa cộng, cùng nguồn
  // nuôi techniqueExperience bên dưới). Sau spec 2026-08-29, nguồn
  // tầng Kiếm Ý đổi sang bossKillCount (xem dưới) — field này còn nuôi
  // technique tier + thống kê.
  totalCultivationGained: number

  // Kiếm Ý VĨNH VIỄN (spec 2026-08-29-kiem-the-kiem-y mục 3.1) — tổng
  // boss/elite đã diệt vĩnh viễn suốt đời save (boss stage isBoss +
  // boss Độ Kiếp + elite/mini-boss, đếm trong BattleLootSystem), chỉ
  // tăng không giảm. Nguồn tầng Kiếm Ý (thay totalCultivationGained cũ
  // của SwordIntentSystem đã dọn): tầng N cần tổng 10 + 5×(N-1) boss
  // cộng dồn, mỗi tầng +10 kiếm ý vĩnh viễn + 0.5%/tầng dmg/crit —
  // xem core/player/KiemYSystem.ts.
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

  // Tâm Pháp có thanh kinh nghiệm riêng (2026-08-20) — thay driver cũ
  // (đại cảnh giới người chơi) của getTechniqueTier(), xem
  // core/technique/TechniqueTier.ts. Đếm dồn suốt đời save (không reset
  // khi đột phá, cùng nguồn với totalCultivationGained) — technique chỉ
  // có ĐÚNG 1 cái trong đời save (permanent path choice) nên 1 số vô
  // hướng là đủ, không cần key theo techniqueId.
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

  // Pháp Tu Redesign — Element đã mở khóa (KHÔNG mất khi unequip, xem
  // spec mục 32) — rỗng mặc định, phải mở qua node tree. Element
  // KHÔNG nằm trong mảng này thì không equip/học skill/nâng cấp được.
  unlockedElements: ElementType[]

  // Pháp Tu Redesign — Element ĐANG mang vào combat, tối đa theo
  // getElementSlotCount(realmId) (xem core/element/ElementSlot.ts).
  // Phải là tập con của unlockedElements — GameManager.equipElement()
  // enforce, type này không tự enforce được.
  equippedElements: ElementType[]

  // Pháp Tu Redesign — id của MỌI ProgressionNode đã mua, xuyên suốt
  // MỌI path (Node Tree là hạ tầng CHUNG, không tách riêng theo path)
  // — xem core/progression/NodeSystem.ts.
  purchasedNodeIds: string[]

  // Node level (combat-skill-flow-element-power-dot-plan.md §6.1) —
  // NGUỒN SỰ THẬT duy nhất của state đã đầu tư: level 0 = chưa lĩnh
  // ngộ, >=1 = đã lĩnh ngộ (mức stack). purchasedNodeIds giữ lại làm
  // compat read-only, luôn đồng bộ = các id có level >= 1.
  nodeLevels: Record<string, number>

  // Màn chỉ mở tuần tự: thắng một màn mới mở màn kế tiếp.
  completedStageIds: string[]

  // Auto-farm Hoàn Mỹ (2026-09-04 spec) — stage đã đạt điều kiện "Hoàn
  // Mỹ" (HP đội mất <=75% + turn < stage.perfectClearTurnLimit). Ghi 1
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

  // Idempotency guard cho Realm Passive theo cảnh giới (Nhập Đạo/Kiến
  // Cơ/...) — cùng pattern unlockedRealmEnhancements, key = realmId
  // vừa bước vào. Xem core/realm/RealmPassiveSystem.ts.
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
  // SkillSystem.gainCastExperience() qua sink (xem
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
    unlockedRealmEnhancements: [],
    hasSeenTutorial: false,
    isCultivating: false,

    // PHẢI khai báo tường minh (dù `undefined`) — Pinia Options Store
    // dựng reactive property bằng toRefs() snapshot 1 LẦN lúc khởi tạo
    // store; field nào KHÔNG có mặt như 1 key ở đây thì
    // player.cultivationPath (đọc qua store instance) sẽ KHÔNG BAO GIỜ
    // phản ứng khi GameManager.chooseCultivationPath() gán giá trị qua
    // player.$state sau này (bug thật đã gặp: technique/skill equip
    // đúng nhưng UI gate không tự chuyển vì thiếu dòng này).
    cultivationPath: undefined,

    // PHẢI khai báo tường minh (dù `undefined`) — cùng lý do
    // cultivationPath ở trên (toRefs() snapshot 1 lần lúc init store).
    kiemTuRoute: undefined,

    // PHẢI khai báo tường minh (dù `undefined`) — cùng lý do
    // cultivationPath ở trên (toRefs() snapshot 1 lần lúc init store).
    artifact: undefined,

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
    attributePoints: 0,
    unlockedElements: [],
    equippedElements: [],
    purchasedNodeIds: [],
    nodeLevels: {},

    bodyRefinementCompletedTiers: 0,
    bodyRefinementCurrentTierProgress: 0,
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],

    persistentTimedEffects: [],


    combatAiStrategy: DEFAULT_COMBAT_AI_STRATEGY,

    companions: [],

    formationLoadout: null,

    lastSavedAt: Date.now(),
  }
}

/**
 * Chuyển PlayerData thành CombatEntity để đưa vào BattleSystem.
 *
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
  skillStats?: import('../skill/SkillRuntimeStats').SkillRuntimeStats,
  skillLevels?: Readonly<Record<string, number>>,
): CombatEntity {
  return {
    id: 'player',

    name: player.name,

    type: 'player',

    baseStats: stats,

    stats,

    skillStats,

    skillLevels,

    currentHp: stats.maxHp,

    maxHp: stats.maxHp,

    currentMp: stats.maxMp,

    currentSwordIntent: 0,

    currentKiemThe: 0,

    currentKiemYTemp: 0,

    currentMomentum: 0,

    currentHoaThe: 0,

    currentThoThe: 0,

    currentKimThe: 0,

    // Phase A3 (2026-09-07) — Pháp Tu Thế pool (Thuần-path ultimate
    // resource). Same pattern as the other current*The pools.
    currentThe: 0,

    timeSinceLastBleedProc: 0,

    tuLucActive: false,

    tuLucElapsed: 0,

    tuLucDamageTakenPercent: 0,

    currentWard: 0,

    // Vô cực — "chưa từng bị đánh" lúc trận vừa bắt đầu, để Ward có
    // thể hồi ngay từ đầu trận thay vì phải chờ 1 khoảng WARD_REGEN_
    // DELAY_SECONDS giả tạo dù chưa hề ăn đòn nào (xem CombatEntity.ts).
    timeSinceLastHitTaken: Infinity,

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
}

/**
 * `addTechniqueInsight` nuôi Cảm ngộ Tâm Pháp CỦA riêng tâm pháp đang
 * trang bị (xem GameManager.gainEquippedTechniqueInsight()) — tách
 * biệt khỏi Cảm ngộ Kỹ năng (player.skillInsight), cấp trực tiếp trong
 * GameManager.grantBattleRewardIfNeeded() vì KHÔNG cần trang bị tâm
 * pháp vẫn nhận được (xem skill-insight-and-auto-combat-hud-plan.md
 * mục 3).
 *
 * `addSpiritStone` (plan Workstream F) — GameManager inject implementation
 * cộng vào MaterialBag (SPIRIT_STONE_MATERIAL_ID); PlayerData không còn
 * giữ currency nào cả.
 */
export function createPlayerRewardReceiver(
  player: PlayerData,
  addInsight?: (amount: number) => void,
  addSpiritStone?: (amount: number) => void,
): RewardReceiver {
  return {
    addTechniqueInsight(amount: number) {
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
