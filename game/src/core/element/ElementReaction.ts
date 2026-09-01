import type { AilmentId } from '../ailment/AilmentTypes'
import type { ElementType } from './ElementType'

/**
 * Combat Rework Phase 6 (Pháp Tu — Reaction) — 2 ailment hành KHÁC
 * NHAU cùng active trên 1 target thì phản ứng, gây thêm 1 cục true
 * damage MỘT LẦN (bỏ qua Armor/Resistance, cùng tinh thần Detonate/
 * primordialPower hiện có) rồi tiêu CẢ 2 ailment. Không phụ thuộc build
 * nào áp được đa-hành cùng lúc (equipment Set phụ, quái tự mang ailment
 * nền, hoặc sau này nhiều hành/trận theo kế hoạch gộp path) — engine
 * chỉ cần 2 ailment hành khác nhau CÙNG có mặt trên target, bất kể
 * nguồn nào áp ra chúng.
 */
export interface ElementReactionDefinition {
  name: string

  // Flat, giống damagePerStack của Detonate hiện có (SkillEffect.ts) —
  // không tự tính từ dpsRatio 2 ailment liên quan, dễ balance độc lập.
  baseDamage: number

  // Combat Balance Pass (2026-08-29, plan §3.2) — tỷ lệ Power nguyên tố
  // của NGUỒN kích (element snapshot trên instance ailment vừa áp)
  // cộng vào damage: damage = (baseDamage + sourcePower × ratio) ×
  // (1 + reactionEffectPercent). Nguồn Power đọc qua helper DÙNG CHUNG
  // elementalBasePower() (ElementDamageCalculator.ts) — cùng nguồn với
  // direct hit/DoT, hai pipeline không thể lệch. undefined = giữ nguyên
  // behavior cũ (chỉ baseDamage) — tương thích test/data hiện có.
  // Reaction "Độc Viêm" (percentOfTargetCurrentHp) và reaction không
  // damage (appliesAilmentId/appliesBuffId với baseDamage 0) không cần
  // field này.
  powerScalingRatio?: number

  // Mộc Tu (Plans/PoisonPath mục 3, "Độc Viêm" — Mộc+Hỏa, "Damage dựa
  // trên HP hiện tại") — % currentHp của TARGET tại thời điểm Reaction
  // kích hoạt (TRƯỚC khi trừ baseDamage của chính lần kích này), cộng
  // dồn với baseDamage — xem ReactionManager.checkAndTrigger(). Số
  // liệu minh hoạ (10%), cần tinh chỉnh qua playtest, không phải số
  // chốt cứng — cùng tinh thần baseDamage.
  percentOfTargetCurrentHp?: number

  // Thổ Tu (Plans/EarthPath mục V/VI, 2026-08-21) — Reaction sinh ra 1
  // ailment MỚI trên TARGET (Dung Nham=DoT, Trói Chân=CC 'root') thay
  // vì/thêm vào baseDamage — 2 ailment bị tiêu vẫn xoá như thường, xem
  // ReactionManager.checkAndTrigger(). Duration của ailment này được
  // nhân thêm reactionEffectPercent (không phải ailmentDurationPercent
  // thường — ailment này đến từ REACTION, không phải skill trực tiếp).
  appliesAilmentId?: AilmentId

  // Thổ Tu (Plans/EarthPath mục VII, "Độc Thế") — Reaction ĐẶC BIỆT:
  // KHÔNG áp gì lên target, mà cấp 1 tầng buff (BuffRegistry id) lên
  // chính SOURCE (người kích Reaction) — xem ReactionManager.ts. Loại
  // trừ lẫn nhau về mặt Ý NGHĨA với appliesAilmentId (1 reaction chỉ
  // nên khai đúng 1 trong 2, dù kỹ thuật không cấm khai cả hai).
  appliesBuffId?: string

  // Kim Tu ("Thiêu Huyết", Hỏa+Kim, Plans/KimPath mục 5, 2026-08-21) —
  // % maxHp của TARGET bị trừ VĨNH VIỄN (khác baseDamage — đó là
  // currentHp), trần ở MAX_HP_REDUCTION_CAP_PERCENT CỘNG DỒN qua nhiều
  // lần Reaction trong CÙNG 1 trận (xem ReactionManager.ts,
  // CombatEntity.totalMaxHpReductionPercent) — "tránh boss bị xoá HP
  // quá nhanh" đúng lo ngại doc tự nêu.
  maxHpReductionPercent?: number

  // Thủy Tu Trúc Cơ Reaction ("Dẫn Lưu" major, Plans/waterpath mục VII)
  // — Plans/magicpathgeneral Phase 5 (2026-08-21) — kéo hành vi "GIỮ
  // LẠI 1 vế thay vì tiêu" ra khỏi ReactionManager (trước đây hard-code
  // `existingId === 'te_cong'`) thành 1 field DATA đúng tinh thần Phase
  // 5's ví dụ ("trừ khi reaction definition chủ động chỉ định một
  // status không bị consume"). CHỈ có tác dụng khi field này khớp 1
  // trong 2 vế ĐANG reaction VÀ nguồn có
  // `source.skillStats.waterReactionExtensionSeconds > 0` — nền là vế đó
  // vẫn bị tiêu như mọi ailment khác (xem ReactionManager.ts). Không
  // áp dụng cho appliesAilmentId/appliesBuffId (2 nhánh đó đã luôn
  // consume-rồi-tạo-mới, tự thân đã đúng invariant Phase 16).
  keepsAilmentId?: AilmentId

  // Plans/magicpathgeneral Phase 12 (2026-08-21) — "Lava Zone không
  // phải DoT trên target": ngoài (không thay thế) appliesAilmentId,
  // reaction này CÒN spawn 1 LavaZone tại VỊ TRÍ target lúc kích hoạt
  // (xem BattleSystem.spawnLavaZone()) — vùng tồn tại độc lập, gây
  // damage cho MỌI entity phe đối lập đứng trong bán kính lúc tick,
  // không riêng gì target ban đầu. Số liệu minh hoạ, cần playtest.
  spawnsLavaZone?: {
    laneRadius: number

    columnRadius: number
    duration: number
    tickInterval: number
    damagePerTick: number
    element: ElementType | 'physical'
  }

  // Spec 2026-08-30-phap-tu-dao-sac §4 — quan hệ sinh/khắc của cặp vế
  // (theo vòng Ngũ Hành) cho UI ngôi sao 5 cánh + logic khuếch đại
  // Chế Khắc của Đa Pháp tra bảng. Bảng 10 cặp: 5 sinh (Mộc→Hỏa→Thổ→
  // Kim→Thủy→Mộc) + 5 khắc (Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim,
  // Kim⇄Mộc) — khớp 1-1 hình học ngôi sao (cạnh ngoài = sinh, đường
  // chéo = khắc).
  relation?: 'sinh' | 'khac'
}

// Khoá theo CẶP AilmentId — ReactionManager tự thử cả 2 chiều (A→B và
// B→A) nên chỉ cần khai 1 chiều mỗi cặp. Số liệu khởi điểm hợp lý, cần
// tinh chỉnh qua playtest — không phải số chốt cứng.
//
// Plans/waterpath (2026-08-21) — chốt lại bảng reaction của Thủy: XOÁ
// hẳn Thủy+Kim ("Đông Lôi" cũ) vì spec Thủy mới nói rõ "THỦY + KIM:
// Không Reaction". THÊM Thủy+Mộc ("Độc Thủy", te_cong+trung_doc) —
// cùng shape burst-damage-1-lần với Bốc Hơi (doc mô tả "tick dày hơn"
// về flavor, nhưng AilmentSystem hiện mô hình DoT liên tục theo
// damagePerSecond, không có khái niệm "tick rời rạc" để nhân đôi tần
// suất — burst damage là cách diễn giải gần nhất với hạ tầng hiện có).
//
// Phong/Lôi đã bỏ toàn hệ (spec 2026-08-30-phap-tu-dao-sac §5) — các
// cặp reaction cho hệ đó (Đông Lôi/Thủy Lôi/Độc Phong/Mù/Lôi Huyết)
// không bao giờ mở lại; ailment te_dien (Tê Điện, mồ côi từ đợt Kim
// cũ) xoá sạch cùng đợt. Bảng reaction giờ hoàn chỉnh 10 cặp thuần
// Ngũ Hành theo spec §4 (5 sinh + 5 khắc — Task 3 của plan thêm
// relation metadata + 2 reaction sinh Ngưng Lộ/Khai Sơn).
//
// Plans/PoisonPath (2026-08-21) — bảng phản ứng của Mộc (mục 3) có 6
// cặp, nhưng CHỈ "Độc Viêm" (Mộc+Hỏa) và "Độc Thủy" (Mộc+Thủy, đã có
// từ đợt Thủy) khớp được model hiện tại (1 cục true damage tức thời).
// "Độc Thế" (Mộc+Thổ, "Độc → buff BẢN THÂN người chơi" — không phải
// damage lên target, cần 1 loại Reaction hoàn toàn khác — cấp buff/
// stack cho SOURCE thay vì trừ HP TARGET). "Huyết Độc" (Mộc+Kim, "gộp
// 2 DoT thành 1 DoT MỚI mạnh hơn" — cần thay thế/nâng cấp ailment
// đang có, khác hẳn "trừ 1 cục rồi xoá cả 2" hiện tại).
export const ELEMENT_REACTIONS: Partial<Record<string, Partial<Record<string, ElementReactionDefinition>>>> = {
  // Hỏa (Bỏng) + Thủy (Tê Cóng) — "Bốc Hơi". keepsAilmentId: 'te_cong'
  // (Plans/magicpathgeneral Phase 5) — Dẫn Lưu (waterReactionExtensionSeconds)
  // có thể giữ lại Tê Cóng thay vì tiêu, xem ReactionManager.ts.
  bong: {
    // Hỏa+Thủy — KHẮC (Thủy khắc Hỏa).
    te_cong: { name: 'Bốc Hơi', baseDamage: 60, keepsAilmentId: 'te_cong', powerScalingRatio: 0.5, relation: 'khac' },
    // Hỏa (Bỏng) + Mộc (Trúng Độc) — "Độc Viêm", damage dựa trên %
    // currentHp của target thay vì flat (xem ElementReactionDefinition).
    // Mộc sinh Hỏa — SINH.
    // (Lôi Viêm bong+te_dien đã xoá — te_dien mồ côi, spec §5.)
    trung_doc: { name: 'Độc Viêm', baseDamage: 0, percentOfTargetCurrentHp: 0.1, relation: 'sinh' },
  },

  // Thủy (Tê Cóng) + Mộc (Trúng Độc) — "Độc Thủy". keepsAilmentId:
  // 'te_cong' cùng lý do như Bốc Hơi ở trên. Thủy sinh Mộc — SINH.
  te_cong: {
    trung_doc: { name: 'Độc Thủy', baseDamage: 65, keepsAilmentId: 'te_cong', powerScalingRatio: 0.5, relation: 'sinh' },
  },

  // Plans/EarthPath mục IV (2026-08-21) — bảng phản ứng của Thổ. "Mù"
  // (Thổ+Phong) không bao giờ thêm — Phong đã bỏ toàn hệ (spec
  // 2026-08-30-phap-tu-dao-sac §5).
  thach_hoa: {
    // Thổ+Hỏa — "Dung Nham": DoT phần THẬT (ailment 'dung_nham') TRÊN
    // target VẪN GIỮ NGUYÊN + Plans/magicpathgeneral Phase 12
    // (2026-08-21) thêm phần AoE persistent theo VỊ TRÍ (LavaZone, xem
    // ElementReactionDefinition/BattleSystem.spawnLavaZone()) — số
    // liệu minh hoạ (bán kính/tick/damage), cần playtest.
    // Hỏa sinh Thổ — SINH.
    bong: {
      name: 'Dung Nham',
      baseDamage: 0,
      appliesAilmentId: 'dung_nham',
      spawnsLavaZone: { laneRadius: 1, columnRadius: 2, duration: 6, tickInterval: 1, damagePerTick: 20, element: 'fire' },
      relation: 'sinh',
    },
    // Thổ+Thủy — "Trói Chân": Root thuần, không damage (đúng doc mục
    // VI, không nhắc gì tới sát thương). Thổ khắc Thủy — KHẮC.
    te_cong: { name: 'Trói Chân', baseDamage: 0, appliesAilmentId: 'troi_chan', relation: 'khac' },
    // Thổ+Mộc — "Độc Thế": KHÔNG áp ailment lên target, chuyển hóa
    // thành buff self-stack trên SOURCE (xem appliesBuffId, data/buff/
    // buffs.ts's `doc_the`). Mộc khắc Thổ — KHẮC.
    trung_doc: { name: 'Độc Thế', baseDamage: 0, appliesBuffId: 'doc_the', relation: 'khac' },
    // Thổ+Kim — "Khai Sơn" (spec 2026-08-30-phap-tu-dao-sac §4 card 2,
    // SINH — núi bật gốc hé lộ mỏ kim loại): buff nguồn khai_son
    // +8% defense/tầng (mirror doc_the), max 3, 6s. Pháo đài cho
    // combo kề Thổ→Kim của build sinh. baseDamage nhẹ vì sinh không
    // giết. Số liệu khởi điểm playtest.
    chay_mau: {
      name: 'Khai Sơn',
      baseDamage: 50,
      powerScalingRatio: 0.5,
      relation: 'sinh',
      appliesBuffId: 'khai_son',
    },
  },

  // Plans/KimPath mục 4 (2026-08-21) — bảng phản ứng của Kim. Thủy+Kim
  // là "Không Reaction" CHỦ Ý theo doc (mục 8: "Kim không cần phải
  // tương tác với mọi hệ") — không thêm entry giả. ("Lôi Huyết"
  // Lôi+Kim không bao giờ thêm — Lôi đã bỏ toàn hệ, spec
  // 2026-08-30-phap-tu-dao-sac §5.)
  chay_mau: {
    // Kim+Hỏa — "Thiêu Huyết": Reaction Damage + trừ vĩnh viễn % maxHp
    // (trần cộng dồn, xem ElementReactionDefinition's ghi chú). "100%
    // Skill Power" của doc không literal-scale theo Power nguồn (đúng
    // convention baseDamage flat hiện có, cùng cách xử lý mọi reaction
    // khác) — 85 là số minh hoạ giữa khoảng 60-90 của các reaction cũ.
    // Hỏa khắc Kim — KHẮC.
    bong: { name: 'Thiêu Huyết', baseDamage: 85, maxHpReductionPercent: 0.03, powerScalingRatio: 0.5, relation: 'khac' },
    // Kim+Mộc — "Huyết Độc": Trúng Độc + Chảy Máu "hợp nhất" thành 1
    // DoT MỚI mạnh hơn (ailment 'huyet_doc'), tái dùng appliesAilmentId
    // (đã xây cho Thổ) — closes luôn gap "Huyết Độc" từng bị hoãn ở đợt
    // Mộc ([[tienhiep-poisonpath-moc]]'s ghi chú "cần thay thế/nâng cấp
    // ailment đang có"). Kim khắc Mộc — KHẮC.
    trung_doc: { name: 'Huyết Độc', baseDamage: 0, appliesAilmentId: 'huyet_doc', relation: 'khac' },
    // Kim+Thủy — "Ngưng Lộ" (spec 2026-08-30-phap-tu-dao-sac §4 card 1,
    // SINH — lưỡi thép lạnh ngưng sương, máu trên kim loại thành dòng
    // suối tinh khiết tiếp Pháp Lực cho nguồn): buff nguồn ngung_lo
    // +5 manaRegen/s, 6s, refresh. Nuôi đúng thanh tài nguyên của thiên
    // phú Pháp Lực Thân Hòa (spec §3.5). baseDamage nhẹ nhất bảng vì
    // sinh không giết. Số liệu khởi điểm playtest.
    te_cong: {
      name: 'Ngưng Lộ',
      baseDamage: 40,
      powerScalingRatio: 0.5,
      relation: 'sinh',
      appliesBuffId: 'ngung_lo',
    },
  },
}
