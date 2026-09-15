import type { ElementType } from '../element/ElementType'
import type { StatModifier } from '../stats/StatCalculator'
import type { ArtifactId } from '../artifact/Artifact'
import type { PlayerData } from './Player'

// Pháp Tu Redesign (magicpath, 2026-08-18) — 5 path Ngũ Hành cũ
// (phap_tu_hoa/moc/thuy/kim/tho) đã GỘP thành 1 "phap_tu" duy nhất
// (mục 1 magicpath: "Pháp Tu không còn được thiết kế thành nhiều hệ
// nguyên tố tách biệt"). Kiếm Tu vẫn đứng RIÊNG (nhánh song song, cơ
// chế kit cố định KHÁC hẳn — chưa đi qua Element/Node Tree). Thêm giá
// trị mới khi Thể Tu được thiết kế sau này — KHÔNG BAO GIỜ tái cấu
// trúc union này, chỉ mở rộng thêm string.
//
// The Tu Reimagined (spec 2026-09-15, T1) — the_tu (Hien) and the_tu_an
// (An) are SEPARATE path ids offered at the Initiation Ritual; picking
// An excludes the ordinary path permanently (no node/mode flip).
export type CultivationPathId = 'phap_tu' | 'kiem_tu' | 'the_tu' | 'the_tu_an'

export interface CultivationPathRealmReward {
  techniqueId?: string
  artifactId?: ArtifactId
}

export interface CultivationPathKit {
  id: CultivationPathId

  name: string

  // Pháp Tu Redesign — KHÔNG còn 1 hành cố định cho Pháp Tu (multi-
  // element qua Element Loadout, xem core/element/ElementLoadout.ts).
  // Optional — CHỈ Kiếm Tu còn khai (giữ identity/màu UI riêng), Pháp
  // Tu để trống.
  element?: ElementType

  // Tâm Pháp hợp nhất (2026-08-15) — CHỈ 1 technique, tự học+trang bị
  // qua GameManager.chooseCultivationPath(), GHI ĐÈ bất kỳ tâm pháp
  // nào đang trang bị (kể cả tâm pháp khởi đầu
  // 'tu_linh_quyet' — chuyển nghề = đổi hẳn tâm pháp).
  techniqueId: string

  /** Chỉ số nền của con đường tu luyện. Được tổng hợp từ data mỗi lần
   * tính stats, không ghi lặp vào PlayerData. */
  statModifiers?: readonly StatModifier[]

  /** Reward cấp theo đại cảnh giới. Consumer phải idempotent để không
   * ghi đè tiến trình người chơi nếu được gọi lại. */
  realmRewards?: Readonly<Record<string, CultivationPathRealmReward>>

  // ĐÚNG 3 skill cố định, gán thẳng vào Skill Loadout slot 0/1/2 lúc
  // chọn path (xem GameManager.chooseCultivationPath(), PLAN HOÀN CHỈNH
  // mục 8). Execution policy rework (plan §8.6) — skill đầu tuple
  // (Ngự Kiếm Thuật) dùng policy 'attack_speed', vẫn là 1 loadout skill
  // bình thường ở slot 0. Pháp Tu Redesign — Optional: CHỈ Kiếm Tu còn
  // khai (chưa đi qua Node Tree). Pháp Tu để trống — skill giờ mở qua
  // Node Tree (unlock 1 hành = unlock luôn 3 skill + 1 nội tại của hành
  // đó, xem data/progression/PhapTuNodes.ts).
  skillIds?: [basic: string, special: string, ultimate: string]

  // The Tu Reimagined (T6) — a path may gate its Ritual offer on
  // prerequisites evaluated against the live player (the_tu_an requires
  // huy_quyen Lv3). Consumed by isCultivationPathOffered — the single
  // predicate both the offer panel and chooseCultivationPath consult.
  offerGate?: {
    requiresSkillLevel?: { skillId: string; level: number }
  }

  // The Tu Reimagined (T22) — the combat HUD's path resource bar reads
  // this flag (data-driven): the path's battle participant carries the
  // Thế pool (currentThe/maxThe on CombatEntity). UI never checks path
  // ids — only this kit flag.
  usesTheResource?: boolean
}

export const CULTIVATION_PATH_KITS: Record<CultivationPathId, CultivationPathKit> = {
  phap_tu: {
    id: 'phap_tu',
    name: 'Pháp Tu — Đại Ngũ Hành Chân Quyết',
    techniqueId: 'dai_ngu_hanh_chan_quyet',
    // Task 3 (D17): MP-pool + mana-shield grants carry domain:'phap_tu'
    // so the Task-7 domain gate keeps accepting them once those stats
    // are gated to the phap_tu domain.
    statModifiers: [
      {
        id: 'phap_tu_linh_luc',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'maxMp',
        flat: 100,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_linh_luc_regen',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'manaRegenPerTurn',
        flat: 2,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_ho_the',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'manaShieldPercent',
        flat: 0.25,
        domain: 'phap_tu',
      },
    ],
    realmRewards: {
      foundation_establishment: {
        techniqueId: 'dai_ngu_hanh_quyet_truc_co',
        artifactId: 'ngu_hanh_chau',
      },
    },
  },

  kiem_tu: {
    id: 'kiem_tu',
    name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
    element: 'metal',
    techniqueId: 'ngu_kiem',
    // Kiếm Thế / Kiếm Ý (spec 2026-08-29) — KHÔNG còn tuple 3-skill:
    // route chốt vĩnh viễn trong chooseCultivationPath theo tram Lv3,
    // mỗi route ĐÚNG 1 active skill (Lưỡng Nghi Kiếm Trận / Bạt Kiếm
    // Thức) vào slot 0, ult qua node + nút manual riêng.
  },

  the_tu: {
    id: 'the_tu',
    name: 'Thể Tu — Kim Cang Bất Hoại Thể',
    element: 'metal',
    techniqueId: 'kim_cang_bat_hoai_the',
    // The Tu Reimagined (T5) — root-mutex kit: the chosen progression
    // root (cuong_chien XOR tran_the) resolves the kit at battle build;
    // no loadout tuple.
  },

  the_tu_an: {
    id: 'the_tu_an',
    name: 'Thể Tu Ẩn — Ứng Thể Thần Quyết',
    techniqueId: 'ung_the_than_quyet',
    // T6 — offered at the Initiation Ritual only when the mortal skill
    // huy_quyen reaches Lv3 (offerGate, see isCultivationPathOffered).
    offerGate: { requiresSkillLevel: { skillId: 'huy_quyen', level: 3 } },
    usesTheResource: true,
  },
}

// Nghi Lễ Nhập Môn (2026-08-16) — gate cũ (mốc realmLevel cố định
// trong qi_refining) đã bị THAY THẾ: chọn nghề giờ CHÍNH LÀ nghi lễ
// đột phá Phàm Nhân -> Luyện Khí, nên điều kiện mở khoá gắn với việc
// hoàn thành Phàm Nhân cảnh (realmId === 'mortal' && realmLevel ===
// maxLevel), xem CharacterPanel.vue's canChooseCultivationPath. Không
// còn hằng số riêng ở đây nữa — đọc thẳng maxLevel của REALMS.

// The Tu Reimagined (T6) — single offer predicate consumed by BOTH the
// Quan Khi offer list (QuanKhiPanel.vue) and chooseCultivationPath() so
// the UI can never show a choice the ritual would reject. Reads the live
// skillLevels mirror — a path with no offerGate is always offered.
export function isCultivationPathOffered(kit: CultivationPathKit, player: PlayerData): boolean {
  const required = kit.offerGate?.requiresSkillLevel

  if (!required) {
    return true
  }

  return (player.skillLevels?.[required.skillId] ?? 0) >= required.level
}
