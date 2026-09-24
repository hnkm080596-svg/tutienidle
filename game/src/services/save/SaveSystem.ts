import type { PlayerData } from '../../core/player/Player'
import type { GameManager } from '../../core/game/GameManager'
import type {
  AlchemyJobSave,
  GameSave,
  GameSessionPlayerOwner,
  ProductionCycleSave,
  ProductionSiteStateSave,
  RestoreGameSessionResult,
} from './saveTypes'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import {
  resolveBackupKey,
  resolveImportHandoffKey,
  resolveRevisionKey,
  resolveSaveKey,
} from './saveKeys'

// large-file-split — save-shape interfaces (GameSave, stack saves,
// production/alchemy save states, restore contract) live in
// saveTypes.ts; re-exported so existing `from './SaveSystem'` imports
// keep working unchanged.
export * from './saveTypes'

// Re-export cho mọi consumer cũ (SupabaseCharacterCreationService, tests...)
// — nguồn sự thật của version nằm ở saveVersion.ts để tránh circular
// import với saveShapeValidation.ts.
export { CURRENT_SAVE_VERSION }

// Storage keys are per-account since Mission F (spec F8) - every path
// below resolves through saveKeys.ts resolvers ('<base>:<accountId>',
// guest slot when unauthenticated). The comments below keep documenting
// the backup/handoff/revision *purpose*; the key shape lives there.

// Phase 5 (Reliability) — bản sao save TRƯỚC lần ghi đè/xoá gần nhất
// (deleteSave()), không phải lịch sử nhiều bản. Mục đích duy nhất:
// nếu người chơi bấm "Xoá & Bắt Đầu Mới" nhầm trên save không tương
// thích, dữ liệu cũ vẫn còn 1 bước để cứu qua restoreBackup() —
// KHÔNG thay thế Export (export mới là nơi an toàn thật sự, backup
// này nằm cùng localStorage nên mất theo nếu người dùng xoá site data).

// Import current-version có equipment legacy phải normalize TRƯỚC khi ghi,
// nên reload sau import không thể tự đếm lại entry đã bỏ. Handoff one-shot
// này giữ counter cùng CHÍNH XÁC normalized payload để không gán nhầm cho
// một save khác được ghi xen giữa; nó không nằm trong GameSave schema.

// Revision phục vụ CAS optimistic-concurrency của cloud-save adapter
// (xem services/cloudSave/). Đặt ở đây (thay vì trong LocalCloudSaveService)
// để deleteSave() có thể xoá cùng lúc, tránh để lại revision cũ sau khi
// save chính đã bị xoá — nếu không, nhân vật mới tạo sẽ CAS-fail ngay
// lần save đầu tiên ("Save đã thay đổi ở một phiên khác.").

// v23: Thiên Công Phường rework — thêm building 'artisan_workshop',
// xoá hẳn exploration 'myriad-demon-forest' (Vạn Yêu Lâm), thêm
// 'wood-spirit-forest' (Mộc Lâm). Save cũ (version < 23) KHÔNG tương
// thích, không viết migration — save cũ có thể đang chạy dở
// exploration 'myriad-demon-forest' (nạp thẳng sẽ ORPHAN entry đó
// trong ExplorationManager: không throw, nhưng chiếm vĩnh viễn 1 slot
// concurrent mà không cách nào thu hoạch/huỷ vì id không còn trong
// registry).
// version 24: Pháp Tu Redesign (magicpath) — player: PlayerData thêm 3
// field BẮT BUỘC MỚI `skillPoints: number`/`unlockedElements: ElementType[]`/
// `equippedElements: ElementType[]` (cả hai đã retired cùng
// ElementLoadout ở Phap Tu Reimagined Task 14 — element authority giờ
// là `player.spellPath.element`), CỘNG THÊM baseStats (Stats) lúc đó có
// thêm 6 field wind/lightning (đã bị XOÁ lại ở spec
// 2026-08-30-phap-tu-dao-sac §5 — bỏ Phong/Lôi toàn hệ). Lịch sử
// version giữ nguyên để truy vết.
// Save cũ thiếu các field này — không viết migration, cùng convention
// mọi version trước.
// version 25: Pháp Tu Redesign — Node Tree, player: PlayerData thêm
// field BẮT BUỘC MỚI `purchasedNodeIds: string[]` (xem
// core/progression/NodeSystem.ts). CỘNG THÊM baseStats (Stats) thêm
// `manaShieldPercent` (Mana Shield). Save cũ thiếu các field này —
// không viết migration, cùng convention mọi version trước.
// version 26: Pháp Tu Redesign — Tâm Pháp không còn cộng chỉ số dưới
// bất kỳ hình thức nào (xoá `modifiers`/`mechanic`/`breakthroughEffect`
// khỏi Technique.ts) VÀ `cultivationRate` bị xoá HOÀN TOÀN khỏi Stats
// (baseStats mất field này, tốc độ tu luyện giờ cố định — xem
// core/realm/realmSystem.ts's BASE_CULTIVATION_PER_SECOND). Save cũ có
// `technique.modifiers`/`mechanic`/`breakthroughEffect` VÀ
// `baseStats.cultivationRate` KHÔNG khớp shape mới — không viết
// migration, cùng convention mọi version trước.
// version 27: Pháp Tu Redesign — gộp 5 CultivationPathId Ngũ Hành
// (phap_tu_hoa/moc/thuy/kim/tho) thành 1 "spell" duy nhất (xem
// CultivationPathKit.ts) VÀ player: PlayerData xoá field
// `totalMonstersKilled` (mồ côi, xem RewardSystem.ts). Save cũ có
// `player.cultivationPath` là 1 trong 5 giá trị cũ (KHÔNG còn hợp lệ
// trong union mới) — không viết migration, cùng convention mọi version
// trước.
// version 28 (2026-08-20): Character/Cultivation/Skill/Inventory rework
// — player: PlayerData thêm field BẮT BUỘC MỚI `techniqueExperience:
// number` (thanh kinh nghiệm riêng của Tâm Pháp, xem
// core/technique/TechniqueTier.ts). Save cũ thiếu field này — không
// viết migration, cùng convention mọi version trước.
// version 29 (2026-08-20): Realm Passive & Pressure System — player:
// PlayerData thêm 4 field BẮT BUỘC MỚI `bodyRefinementCompletedTiers`/
// `bodyRefinementCurrentTierProgress`/`breakthroughGrade`/
// `grantedRealmPassiveIds` (Luyện Thể Phàm Nhân + Nhập Đạo/Kiến Cơ, xem
// core/realm/BodyRefinementSystem.ts/RealmPassiveSystem.ts). Save cũ thiếu
// các field này — không viết migration, cùng convention mọi version
// trước.
// version 30 (2026-08-21): Hỏa FirePath redesign (Plans/FirePath) —
// baseStats (Stats) thêm field BẮT BUỘC MỚI `projectileSpeedPercent`
// (Tật Hỏa minor; MissileSystem sau đó đã xóa, xem ActionImpactSystem).
// Save cũ thiếu field này — không viết migration, cùng convention mọi
// version trước.
// version 31 (2026-08-21): Hỏa Trúc Cơ hoàn thiện (Plans/FirePath mục
// 5-9) — baseStats (Stats) thêm 4 field BẮT BUỘC MỚI
// `elementApplicationPercent`/`reactionEffectPercent`/
// `hoaTheGainPerCast`/`hoaTheDecayReductionPercent` (Dẫn Hỏa/Hỏa
// Nguyên/Cộng Minh/Tụ Hỏa/Hỏa Mạch/Tụ Viêm, xem data/progression/
// PhapTuNodes.ts). Save cũ thiếu các field này — không viết migration,
// cùng convention mọi version trước.
// version 32 (2026-08-21): Thủy waterpath hoàn thiện (Plans/waterpath)
// — baseStats (Stats) thêm 2 field BẮT BUỘC MỚI `thuyThePercent`/
// `waterReactionExtensionSeconds` (Tụ Thủy/Thủy Mạch/Nhu Lưu/Dẫn Lưu,
// xem data/progression/PhapTuNodes.ts). Save cũ thiếu các field này —
// không viết migration, cùng convention mọi version trước.
// version 33 (2026-08-21): Mộc PoisonPath hoàn thiện (Plans/PoisonPath)
// — baseStats (Stats) thêm 4 field BẮT BUỘC MỚI `ailmentDurationPercent`/
// `poisonRootPercentPerStack`/`poisonRootMaxStacks`/
// `poisonRootThresholdBonusPercent` (Độc Tức/Độc Trường/Độc Căn/Độc
// Uyên/Độc Mạch, xem data/progression/PhapTuNodes.ts). Save cũ thiếu
// các field này — không viết migration, cùng convention mọi version
// trước.
// version 34 (2026-08-21): Thổ EarthPath hoàn thiện (Plans/EarthPath) —
// baseStats (Stats) thêm 5 field BẮT BUỘC MỚI `earthAoeRadius`/
// `earthAoeSecondaryDamagePercent`/`earthKnockbackDistance`/
// `skillImpactPercent`/`thoTheGainPerCast` (Thổ Thế/Chấn Lực/Chấn Vực/
// Trọng Thổ, xem data/progression/PhapTuNodes.ts). Save cũ thiếu các
// field này — không viết migration, cùng convention mọi version trước.
// version 35 (2026-08-21): Kim KimPath hoàn thiện (Plans/KimPath) —
// baseStats (Stats) thêm 5 field BẮT BUỘC MỚI `kimTheGainPerProc`/
// `kimTheDotDamagePercentPerStack`/
// `kimTheDotResistancePenetrationPercentPerStack`/`kimTheMaxStacksBonus`/
// `metalAilmentPotencyPercent` (Kim Thế/Kim Uyên/Huyết Ấn/Huyết Lưu,
// xem data/progression/PhapTuNodes.ts). Đây cũng là hành CUỐI CÙNG
// trong Ngũ Hành hoàn tất redesign (Hỏa/Thủy/Mộc/Thổ/Kim). Save cũ
// thiếu các field này — không viết migration, cùng convention mọi
// version trước.
// version 36 (2026-08-21): Plans/magicpathgeneral — Reaction Engine
// transaction refactor + DOT RES + Poison Recovery. baseStats (Stats)
// thêm 2 field BẮT BUỘC MỚI `dotResistancePercent`/
// `poisonRecoveryPercent` (xem core/combat/CombatSystem.ts's
// applyDotDamage(), core/stats/StatTypes.ts). CŨNG đổi tên hiển
// (2026-09-14 note: poisonRecoveryPercent has since retired — saves
// carrying it drop the key via the baseStats whitelist at restore.)
// thị "Độc Căn" <-> "Mộc Thế" cho đúng semantic (KHÔNG đổi field/id
// nào — save cũ tương thích với riêng phần này). Save cũ thiếu 2 field
// Stats mới — không viết migration, cùng convention mọi version trước.
// version 37 (2026-08-21): Plans/magicpathgeneral Phase 13 — Huyết
// Phá (Kim Tu). baseStats (Stats) thêm 2 field BẮT BUỘC MỚI
// `huyetPhaGainPerProc`/`huyetPhaBurstDamage` (node "Huyết Phá", xem
// data/progression/PhapTuNodes.ts). `CombatEntity.currentHuyetPha` là
// optional/runtime-only, KHÔNG persist (không cần bump vì lý do này).
// Save cũ thiếu 2 field Stats mới — không viết migration, cùng
// convention mọi version trước.
// version 38: progression/combat rework. No migration: development saves
// from earlier schemas are intentionally rejected.
// version 40 (skill-insight-and-auto-combat-hud-plan.md): PlayerData's
// `skillPoints` XOÁ HẲN, thay bằng `skillInsight`/`totalSkillInsightGained`
// (nhận từ chiến đấu, không còn cấp khi đột phá tiểu cảnh giới, xem
// CultivationSystem.breakthrough()). ProgressionNode.cost đổi tên thành
// insightCost. Skill.experience/experienceRequired (XP-per-cast) đã xoá
// entirely - skill upgrades now spend skillInsight via Core Node level (M-QI-05).
// Save cũ thiếu/lệch field — không viết migration, cùng convention mọi
// version trước.
// version 41 (Milestone naming pass 2026-08-24, xem
// docs/naming-conventions.md) — đổi TOÀN BỘ id values/fields lưu trong
// save theo quy ước naming mới: realm 'pham_nhan'→'mortal',
// 'foundation'→'foundation_establishment'; grade 5 phẩm
// 'hoang_pham'→'hoang'… + field 'pham'→'grade' (Pill/Talisman/Formation);
// skills/techniques/materials/buildings theo bảng mapping N2b; fields
// Luyện Thể 'luyenThe*'→'bodyRefinement*'. Save v40 KHÔNG tương thích —
// không viết migration, cùng convention mọi version trước.
// Export cho các service ngoài (ví dụ SupabaseCharacterCreationService
// gửi p_schema_version khi tạo nhân vật) — đảm bảo mọi nơi cùng tham chiếu
// MỘT nguồn chân lý về version schema, không tự hardcode số.
// version 42 (Combat Grid Rework 2026-08-24) — xoá stat
// projectileSpeedPercent khỏi baseStats (StatBlock) cùng hệ affix/node/
// enemy-input liên quan; thay thế theo ngữ cảnh: node pháp thuật ->
// castSpeedPercent, affix vật lý -> attackSpeed/cooldown. Save v41
// KHÔNG tương thích — không migration, cùng convention.
// version 43 (2026-08-24, resource-professions-rework): MIGRATION ĐẦU
// TIÊN được viết (phá convention "không migration" — plan §9 yêu cầu
// migrate không mất progression):
// - player.persistentTimedEffects: mặc định [] (timed effect regen).
// - materials map id cũ → mới: linh_thao_chung→mortal_herb_common_raw,
//   quang_sat→mortal_ore_common_raw, thanh_linh_moc→mortal_wood_common_raw,
//   huyen_thiet→mortal_ore_common_processed, phu_chi→mortal_wood_common_processed
//   (gộp amount nếu trùng id đích).
// - legacy pills map to the nearest effect: healing->pill_regen_mortal,
//   cultivation->pill_cultivation_mortal; permanent/buff do NOT become
//   +1 Main Stat (wrong semantics - plan sec.9) but refund 100 Linh
//   Thach/stack into player.spiritStone.
// Migration IDEMPOTENT: running twice does not double the refund.
// version 44 (2026-08-25, resource-professions-rework plan §10 — rework
// vòng kinh tế "Địa Giới → Lâm/Quáng/Động Thiên → Bag"):
// - materials: map cặp raw/processed cũ về material TRỰC TIẾP mới theo
//   bảng quy đổi cố định (không parse tên ID ngoài pattern đã chốt):
//   wood_*_raw/processed → `<realm>_wood_decade`; ore_*_raw/processed →
//   `<realm>_ore_decade` (gp123 6E C2: trục tuổi thống nhất); herb_*_raw/processed → thảo Động Thiên decade
//   đầu tiên của realm tương ứng (không xác định được đan phương cũ).
// - Phu/Tran legacy RETIRED (sec.10.1): talismans/formations in the Bag
//   + socket state on slots convert to Linh Thach per the compensation
//   table (common 200 / uncommon 500 / rare 1200); all socket state is
//   dropped. Rolled affixes on equipment are KEPT (sec.10.1.5).
// - Buildings trung gian bị loại bỏ (herb_garden/smelter/
//   artisan_workshop/formation_altar/talisman_institute): hoàn trả Linh
//   Thạch theo bảng cố định /level; strip gardenPlots/processingJobs.
// - Tạo productionSites (3 nguồn Thanh Vân level 1, idle) + alchemyJobs
//   rỗng + Điểm Rèn per-item (đã chuyển sang EquipmentInstance, v46).
// - Exploration/crafts legacy bỏ khỏi schema (hệ thống đã xoá).
// version 45 (2026-08-26, combat-gate-teleport-autocast-rework): player:
// PlayerData thêm field BẮT BUỘC MỚI `combatAiStrategy: CombatAiStrategy`
// (AI target strategy, xem core/battle/CombatAiStrategy.ts). Restore
// validate: thiếu/sai → fallback 'nearest' (plan §10.2 — development
// build, KHÔNG viết migration). Save cũ (v44) không tương thích theo
// convention "mỗi thay đổi schema đều bump".
// version 46 (2026-08-26, điểm rèn per-item rework): PlayerData XOÁ
// refinementPoints/lastRefinementRegenAtMs (pool chung + regen); Điểm Rèn
// per-item DÙNG LẠI forgePoints/forgePotential có sẵn trên instance
// (tooltip "Tình trạng rèn x/y") — Tẩy/Tinh Luyện trừ thẳng forgePoints.
// Save v45 không tương thích theo convention development build — không migration.
// version 47 (2026-08-26, node level plan §6.1): PlayerData thêm field
// BẮT BUỘC MỚI `nodeLevels: Record<string, number>` (nguồn sự thật cấp
// node, xem core/progression/NodeSystem.ts). Save v46 CŨ (trước khi có
// field giữa chuỗi v46) thiếu nodeLevels — từng gây crash getNodeLevel
// lúc boot khiến người chơi không thể tới Settings để Xoá Save; giờ
// route thẳng qua SaveIncompatibleScreen (Xuất/Xoá) đúng UX recovery.
// version 48 (2026-08-26, dong-fu-command-wheel-inventory-spirit-stone
// plan Workstream F): PlayerData XOÁ field `spiritStone` — Linh Thạch
// là MATERIAL trong MaterialBag (stack 'spirit_stone', xem
// core/material/SpiritStoneMaterial.ts), KHÔNG migration (development
// phase). Save v47 và mọi version cũ hơn → 'incompatible'.
// version 49: catalog đan/linh thảo được thay bằng đúng tám họ theo phẩm.
// Development build không migration: save v48 trở xuống buộc reset rõ ràng.
// version 50: loại hoàn toàn Linh Chi/Quế/Cúc Hoa và mọi linh thảo
// luyện đan legacy khỏi registry/drop table runtime. Save v49 có thể
// còn stack legacy nên buộc reset, không migration trong development.
// version 51 (2026-08-27, Quest System v1): GameSave thêm field MỚI
// `quests?: QuestManagerState` (active quest progress + completedOnceIds
// + lastDailyResetAtMs, xem core/quest/QuestManager.ts). Không migration
// (development phase) — save v50 và cũ hơn -> 'incompatible', buộc
// Xuất/Xoá qua SaveIncompatibleScreen.
// version 52 (2026-08-28, talent-direction-choice-plan §6): PlayerData
// thêm field `cultivationInsightAccumulator: number` (thiên phú Ngộ Đạo
// tích luỹ tu vi đổi Cảm Ngộ Kỹ năng, xem stores/player.ts's cultivate()).
// Không migration (development phase) — save v51 và cũ hơn -> 'incompatible'.
//
// 2026-08-28 (save-shape-validation-plan.md, KHÔNG bump version vì không
// đổi schema): loadGame()/importSaveRaw() chạy validateGameSaveShape()
// sau khi version khớp — save đúng version nhưng thiếu/hỏng field bắt
// buộc trả 'corrupted' (load) hoặc bị từ chối (import) thay vì crash
// boot ở restoreFromSave() hay NaN cultivation vĩnh viễn.

/** Settings phát sự kiện này để App dừng autosave trước khi xóa save. */
export const SAVE_RESET_REQUEST_EVENT = 'tien-hiep:reset-save-requested'

/**
 * Exact App restore order. Registry drift is rejected before Pinia, active-player,
 * or manager state can mutate; valid saves then restore through the existing owners.
 */
export function restoreGameSession(
  player: GameSessionPlayerOwner,
  gameManager: GameManager,
  save: GameSave,
): RestoreGameSessionResult {
  try {
    gameManager.saveOps.preflightSaveRegistryReferences(save)
  } catch (error: unknown) {
    return {
      status: 'rejected',
      message: error instanceof Error ? error.message : 'Save registry preflight failed',
    }
  }

  // M1 (ARCH-001) — a mid-restore failure is a handled rejection, not an
  // uncaught boot exception. Identity hashes commit only after each owner
  // finished applying, so retrying the same payload re-applies the
  // un-committed slices instead of skipping them.
  try {
    const offline = player.restoreFromSave(save)

    gameManager.setActivePlayer(player.$state)

    const equipmentModifiers = gameManager.saveOps.restoreFromSave(save)

    player.setEquipmentModifiers(equipmentModifiers)

    return { status: 'ok', offline }
  } catch (error: unknown) {
    return {
      status: 'rejected',
      message: error instanceof Error ? error.message : 'Session restore failed',
    }
  }
}

/**
 * M1 (ARCH-001) — the snapshot-boundary detach. EVERY GameSave slice
 * must be a detached VALUE: mutating live manager state after the build,
 * or mutating the built save itself, must never reach the other side.
 *
 * JSON round-trip, NOT structuredClone: a save is also built from a
 * Pinia store's reactive $state (the player slice), and structuredClone
 * has no concept of Proxy exotic objects at ANY nesting depth — it throws
 * DataCloneError the moment it meets one, including a nested field Vue
 * only wrapped in a Proxy lazily after some earlier getter/computed
 * touched it during actual gameplay (toRaw() alone is not sufficient —
 * it only unwraps the outermost proxy). JSON.stringify/parse reads
 * through Proxies transparently at any depth, and the built save is
 * exactly what writeGameSave() serializes to localStorage anyway — the
 * in-memory snapshot now equals its persisted form byte-for-byte.
 */
function detachSaveValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function buildGameSave(player: PlayerData, gameManager: GameManager): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,

    player: {
      ...detachSaveValue(player),

      lastSavedAt: Date.now(),
    },

    // Manager getters intentionally return LIVE domain objects for
    // gameplay consumers — the detach happens HERE, at the save
    // boundary, so every slice in the returned save is a value copy.
    techniques: detachSaveValue(gameManager.techniqueManager.getAll()),

    skills: detachSaveValue(gameManager.skillManager.getAll()),

    materials: detachSaveValue(gameManager.materialBag.getAll().map((stack) => ({
      materialId: stack.material.id,

      amount: stack.amount,
    }))),

    equipment: detachSaveValue(gameManager.equipmentBag.getAll()),

    pills: detachSaveValue(gameManager.pillBag.getAll().map((stack) => ({
      pillId: stack.pill.id,

      amount: stack.amount,
    }))),

    // Phù/Trận khai tử (§10.1) — bag không còn; mảng rỗng giữ shape save.
    talismans: [],

    formations: [],

    buildings: detachSaveValue(gameManager.buildingManager.getAll()),

    equipmentSlots: detachSaveValue(gameManager.equipmentSlotManager.getAll()),

    productionSites: detachSaveValue(gameManager.productionSystem.getAllStates().map((state) => ({
      siteId: state.siteId,

      level: state.level,

      autoRestart: state.autoRestart,

      workerCycles: state.workerCycles?.length ? state.workerCycles : undefined,

      // Mission A2 — manual allocation must persist; runtime-only
      // activeWorkerSlots stays derived from live capacity (not saved).
      assignedWorkers: state.assignedWorkers,

      // M-F-BODY-HIDDEN (v81) - grotto hidden-channel settle counters.
      hiddenChannelCycles: state.hiddenChannelCycles,
    }))),

    alchemyJobs: detachSaveValue(gameManager.alchemySystem.getJobs()),

    quests: detachSaveValue(gameManager.questManager.getState()),

    // R7 (AR-08) - detached decompose snapshot (getSaveState returns a
    // value copy; detachSaveValue keeps it independent of live state).
    decompose: detachSaveValue(gameManager.decomposeSystem.getSaveState()),

    // F-W-5 (v82) - tribulation director runtime: committed outcome +
    // cooldown survive reload. Slice vang mat khi khong co gi pending.
    tribulation: (() => {
      const runtime = gameManager.tribulationDirector.serializeRuntime()
      return Object.keys(runtime).length > 0 ? detachSaveValue(runtime) : undefined
    })(),
  }
}

export type SaveWriteResult = { status: 'ok' } | { status: 'failed'; reason: 'quota' | 'unknown' }

export function writeGameSave(save: GameSave): SaveWriteResult {
  try {
    localStorage.setItem(resolveSaveKey(), JSON.stringify(save))
    return { status: 'ok' }
  } catch (error: unknown) {
    // QuotaExceededError (DOMException name) — save vượt ~5MB localStorage.
    // Không throw: caller (CloudSaveCoordinator → autosave) quyết định cách
    // báo cho người chơi thay vì chết im lặng giữa tick.
    const name = error instanceof DOMException ? error.name : String(error)
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { status: 'failed', reason: 'quota' }
    }
    return { status: 'failed', reason: 'unknown' }
  }
}

// Phase 5 (Reliability, mục XVI) — trước đây version không khớp hoặc
// JSON hỏng đều trả về null giống hệt "chưa từng có save", khiến
// App.vue coi là nhân vật mới và ÂM THẦM ghi đè save cũ ở lần save()
// kế tiếp. Giờ phân biệt rõ 3 trường hợp để App.vue chặn boot, báo
// người chơi, và để họ tự quyết (Export/Xoá) thay vì mất trắng không
// biết vì sao — xem SaveIncompatibleScreen.vue.
export type LoadOutcome =
  | { status: 'empty' }
  // `raw` rides along so a rejected-after-shape save can still be
  // exported byte-identically (same contract as the incompatible/
  // corrupted branches) - the normalized object silently drops
  // shape-discarded entries and key order.
  | { status: 'ok'; save: GameSave; discardedEquipmentCount: number; raw: string }
  | { status: 'incompatible'; foundVersion: number | undefined; raw: string }
  | { status: 'corrupted'; raw: string }
  // Mission A review (MA-R2-02) — storage access itself threw
  // (SecurityError/denied). Deliberately NOT 'empty': callers must not
  // start a new character over an unreadable existing save.
  | { status: 'storage_unavailable' }

// F2 / INV-F-19 - inspectLocalSave() is the PURE read half of the
// pipeline: raw -> parse -> version -> shape, with zero consumption.
// The one-shot import-handoff marker stays untouched, so a preflight
// reader (remote newest-wins) can never eat the count the real owner
// load is supposed to report. loadGame() = inspect + consume.
export type InspectedSave =
  | { status: 'empty' }
  | {
      status: 'ok'
      save: GameSave
      raw: string
      shapeDiscardedEquipmentCount: number
    }
  | { status: 'incompatible'; foundVersion: number | undefined; raw: string }
  | { status: 'corrupted'; raw: string }
  | { status: 'storage_unavailable' }

export function inspectLocalSave(): InspectedSave {
  let raw: string | null

  try {
    raw = localStorage.getItem(resolveSaveKey())
  } catch {
    return { status: 'storage_unavailable' }
  }

  if (!raw) {
    return { status: 'empty' }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupted', raw }
  }

  const foundVersion = (parsed as { version?: unknown })?.version

  if (typeof foundVersion !== 'number') {
    return {
      status: 'incompatible',
      foundVersion: undefined,
      raw,
    }
  }

  // Development-phase policy (dong-fu-command-wheel-inventory-spirit-
  // stone-plan.md §"Chính sách migration") — KHÔNG còn auto-migration
  // nào: mọi version cũ hơn CURRENT_SAVE_VERSION trả về 'incompatible'
  // để SaveIncompatibleScreen cho phép Export/Xoá. Điều này bảo đảm
  // không bao giờ có writeGameSave() phát sinh từ loadGame() (trước đây
  // nhánh v42/v43 ghi đè save gốc mà không backup và gắn thẳng version
  // hiện hành dù thiếu field của schema mới).
  if (foundVersion !== CURRENT_SAVE_VERSION) {
    return {
      status: 'incompatible',
      foundVersion,
      raw,
    }
  }

  // save-shape-validation-plan.md §3.4 — version khớp CHƯA đủ: save thiếu
  // array/field bắt buộc (vd player.nodeLevels thời v47) từng gây crash
  // boot hoặc NaN cultivation vĩnh viễn ở restoreFromSave(). Phát hiện
  // có chủ đích tại đây để SaveIncompatibleScreen xử lý (Xuất/Xoá).
  const shape = validateGameSaveShape(parsed)

  if (!shape.ok) {
    console.warn('[SaveSystem] Save đúng version nhưng sai shape:', shape.issues)

    return { status: 'corrupted', raw }
  }

  return {
    status: 'ok',
    save: shape.normalizedSave as GameSave,
    raw,
    shapeDiscardedEquipmentCount: shape.discardedEquipmentCount,
  }
}

export function loadGame(): LoadOutcome {
  const inspected = inspectLocalSave()

  switch (inspected.status) {
    case 'empty':
    case 'storage_unavailable':
      return { status: inspected.status }
    case 'incompatible':
      return {
        status: 'incompatible',
        foundVersion: inspected.foundVersion,
        raw: inspected.raw,
      }
    case 'corrupted':
      return { status: 'corrupted', raw: inspected.raw }
  }

  const raw = inspected.raw

  // Handoff marker is auxiliary — a read failure degrades to "no
  // marker" (count lost, save still loads) instead of failing the load.
  let importedHandoffRaw: string | null = null

  try {
    importedHandoffRaw = localStorage.getItem(
      resolveImportHandoffKey(),
    )
  } catch {
    importedHandoffRaw = null
  }

  let importedDiscardedCount = 0

  if (importedHandoffRaw) {
    let importedHandoff: unknown

    try {
      importedHandoff = JSON.parse(importedHandoffRaw)
    } catch {
      importedHandoff = undefined
    }

    if (
      typeof importedHandoff === 'object' &&
      importedHandoff !== null &&
      'normalizedRaw' in importedHandoff &&
      importedHandoff.normalizedRaw === raw &&
      'discardedEquipmentCount' in importedHandoff &&
      Number.isSafeInteger(importedHandoff.discardedEquipmentCount) &&
      typeof importedHandoff.discardedEquipmentCount === 'number' &&
      importedHandoff.discardedEquipmentCount > 0
    ) {
      importedDiscardedCount = importedHandoff.discardedEquipmentCount
    }

    // OPT-06 — removeItem chạy SAU khi đọc + consume xong (trước đây
    // xóa ngay trước khi parse). Chỉ chạm storage khi key thực sự tồn
    // tại; handoff không còn giá trị sử dụng sau load hợp lệ nên vẫn
    // bị xóa kể cả khi marker lệch normalizedRaw (rác). Ý đồ cũ giữ
    // nguyên: mọi đường return trước (parse fail, version, shape) nằm
    // TRƯỚC block này nên handoff còn nguyên cho lần load hợp lệ.
    try {
      localStorage.removeItem(resolveImportHandoffKey())
    } catch {
      // Marker persists harmlessly — next valid load consumes/removes it.
    }
  }

  return {
    status: 'ok',
    save: inspected.save,
    raw,
    discardedEquipmentCount:
      inspected.shapeDiscardedEquipmentCount + importedDiscardedCount,
  }
}

// Sao lưu save hiện có vào BACKUP_KEY — gọi TRƯỚC mọi thao tác có
// thể xoá/ghi đè save chính (deleteSave(), importSaveRaw()), để luôn
// còn 1 bước lùi qua restoreBackup() nếu người chơi bấm nhầm.
// Mission A5 — storage throw (quota/SecurityError) thì trả false thay
// vì làm caller crash: backup là best-effort, không được phá flow chính.
export function backupCurrentSave(): boolean {
  try {
    const raw = localStorage.getItem(resolveSaveKey())

    if (raw) {
      localStorage.setItem(resolveBackupKey(), raw)
    }

    return true
  } catch {
    return false
  }
}

export function hasBackup(): boolean {
  try {
    return localStorage.getItem(resolveBackupKey()) !== null
  } catch {
    return false
  }
}

export function getRawSave(): string | null {
  try {
    return localStorage.getItem(resolveSaveKey())
  } catch {
    return null
  }
}

export function restoreBackup(): boolean {
  try {
    const raw = localStorage.getItem(resolveBackupKey())

    if (!raw) {
      return false
    }

    // Xoá handoff TRƯỚC khi ghi: nếu removeItem throw thì SAVE_KEY còn
    // nguyên và `false` phản ánh đúng "chưa restore gì" (ghi trước xoá
    // sau sẽ báo false dù backup đã được restore).
    localStorage.removeItem(resolveImportHandoffKey())
    localStorage.setItem(resolveSaveKey(), raw)

    return true
  } catch {
    // Mission A5 — storage throw → báo thất bại thay vì crash recovery UI.
    return false
  }
}

// Mission A review (MA-R2-01) — returns observable success: callers
// must only reload on `true`, otherwise a swallowed removeItem failure
// would reload into the same corrupt save the user just tried to
// delete. Every key is attempted even when one throws — aborting the
// loop early could leave a stale SAVE_REVISION_KEY that fails the next
// character's first CAS write.
export function deleteSave(): boolean {
  // Best-effort: backup fail (quota/SecurityError) KHÔNG chặn xoá —
  // người chơi đã xác nhận mất save.
  void backupCurrentSave()

  let ok = true

  for (const key of [
    resolveSaveKey(),
    resolveImportHandoffKey(),
    resolveRevisionKey(),
  ]) {
    try {
      localStorage.removeItem(key)
    } catch {
      ok = false
    }
  }

  return ok
}

// Tải save hiện có (bất kể đọc được hay không) xuống file .json —
// đường thoát an toàn thật sự cho save không tương thích/hỏng, vì
// BACKUP_KEY vẫn nằm trong cùng localStorage nên mất theo nếu người
// dùng xoá site data.
export function exportSaveToFile(raw: string) {
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  link.href = url
  link.download = `tien-hiep-idle-save-${Date.now()}.json`
  link.click()

  URL.revokeObjectURL(url)
}

// Nhập save từ nội dung file .json do người chơi chọn — kiểm tra parse
// được + có field `version`/`player`, và nếu là save ĐÚNG version hiện
// hành thì phải nguyên shape (validateGameSaveShape) mới cho ghi — chặn
// ghi đè save tốt bằng một save hỏng ngay tại cửa nhập. Save version
// KHÁC vẫn được ghi (loadGame() lần reload kế sẽ phân loại 'incompatible'
// và cho Export/Xoá qua SaveIncompatibleScreen — đúng flow recovery hiện
// có). Backup save hiện tại (nếu có) trước khi ghi đè.
export function importSaveRaw(raw: string): boolean {
  let parsed: unknown
  let normalizedRaw = raw
  let discardedEquipmentCount = 0

  try {
    parsed = JSON.parse(raw)
  } catch {
    return false
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('player' in parsed)
  ) {
    return false
  }

  // Chỉ enforce shape khi đúng version hiện hành — save version khác để
  // loadGame() xử lý 'incompatible' (không chặn đường recovery của user).
  if ((parsed as { version?: unknown }).version === CURRENT_SAVE_VERSION) {
    const shape = validateGameSaveShape(parsed)

    if (!shape.ok) {
      return false
    }

    normalizedRaw = JSON.stringify(shape.normalizedSave)
    discardedEquipmentCount = shape.discardedEquipmentCount
  }

  // Chuẩn bị handoff TRƯỚC khi đụng backup/save chính. Nếu storage không
  // nhận được marker thì import thất bại nguyên vẹn thay vì thay save nhưng
  // làm mất counter. Exact normalizedRaw ràng buộc marker với đúng payload.
  try {
    if (discardedEquipmentCount > 0) {
      localStorage.setItem(
        resolveImportHandoffKey(),
        JSON.stringify({ normalizedRaw, discardedEquipmentCount }),
      )
    } else {
      localStorage.removeItem(resolveImportHandoffKey())
    }
  } catch {
    return false
  }

  // Mission A5 — backup failure aborts the import intact: overwriting
  // the only save without a written safety net is the unsafe outcome,
  // so a failed backup returns false with SAVE_KEY untouched.
  if (!backupCurrentSave()) {
    return false
  }

  try {
    localStorage.setItem(resolveSaveKey(), normalizedRaw)
  } catch {
    return false
  }

  return true
}
