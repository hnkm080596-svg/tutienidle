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

export interface PlayerData {
  name: string

  realmId: string
  realmLevel: number

  cultivation: number
  cultivationPerSecond: number

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

  // Kiếm Tu (2026-08-15) — Kiếm Ý VĨNH VIỄN: đếm dồn suốt đời save,
  // KHÔNG BAO GIỜ giảm (khác `cultivation`, bị tiêu hao lúc đột phá) —
  // mỗi 9999 điểm tích được thì +1 tầng Kiếm Ý, xem
  // core/player/SwordIntentSystem.ts. Tăng trong stores/player.ts's
  // cultivate() (ĐÚNG lượng tu vi thật vừa cộng, cùng nguồn nuôi
  // techniqueExperience bên dưới).
  totalCultivationGained: number

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

  lastSavedAt: number
}

export function createDefaultPlayer(): PlayerData {
  return {
    name: 'Vô Danh',

    realmId: 'mortal',
    realmLevel: 1,

    cultivation: 0,
    cultivationPerSecond: 10,

    baseStats: createBaseStats(),
    modifiers: [],
    externalModifiers: [],

    selectedTalentIds: [],
    completedStageIds: [],
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

    totalCultivationGained: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
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

    currentRage: 0,

    currentSwordIntent: 0,

    currentMomentum: 0,

    currentHoaThe: 0,

    currentThoThe: 0,

    currentKimThe: 0,

    timeSinceLastBleedProc: 0,

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
