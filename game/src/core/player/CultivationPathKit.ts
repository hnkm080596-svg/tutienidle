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
// Phap Tu Reimagined (Task 7) — 'phap_tu_an' is a first-class hidden
// path (not a node/mode): offered only inside the initiation ritual
// when linh_bao is Lv3, permanent, mutually exclusive with phap_tu.
//
// The Tu Reimagined (spec 2026-09-15, T1) — the_tu (Hien) and the_tu_an
// (An) are SEPARATE path ids offered at the Initiation Ritual; picking
// An excludes the ordinary path permanently (no node/mode flip).
export type CultivationPathId = 'phap_tu' | 'phap_tu_an' | 'kiem_tu' | 'the_tu' | 'the_tu_an'

export interface CultivationPathRealmReward {
  techniqueId?: string
  artifactId?: ArtifactId
}

export interface CultivationPathKit {
  id: CultivationPathId

  name: string

  // Phap Tu Reimagined — Phap Tu has no fixed kit element: the chosen
  // element lives on player.phapTu.element (single authority, picked at
  // the element-root node). Optional — only Kiem Tu still declares one
  // (keeps its identity/UI color); Phap Tu leaves it empty.
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

  // Phap Tu An (Task 7) — hidden path. Owns the same 'phap_tu' stat
  // domain (CULTIVATION_PATH_STAT_DOMAINS) so its MP-shield kit line
  // passes the D10 gate. skillIds intentionally absent: the kit is
  // granted in a bespoke branch like kiem_tu's (the ult slot is a
  // passive via the technique's innateSkillId, not a loadout skill).
  phap_tu_an: {
    id: 'phap_tu_an',
    name: 'Pháp Tu Ẩn — Ngộ Đạo Chân Quyết',
    techniqueId: 'ngo_dao_chan_quyet',
    statModifiers: [
      {
        id: 'phap_tu_an_linh_luc',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'maxMp',
        flat: 100,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_an_linh_luc_regen',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'manaRegenPerTurn',
        flat: 2,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_an_ho_the',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'manaShieldPercent',
        flat: 0.25,
        domain: 'phap_tu',
      },
    ],
  },

  kiem_tu: {
    id: 'kiem_tu',
    name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
    element: 'metal',
    techniqueId: 'ngu_kiem',
    // Kiem Tu Reimagined (spec 2026-09-15) — no authored skill grants:
    // hien basics come from the Kiem Pho orb preset (KiemPhoProvider);
    // the hidden ngu conversion lives on the kiem_tu_an node.
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

// Phap Tu An required kit (review round-4, MEDIUM) — the ritual grants
// exactly these three skills atomically: two loadout actives + the dao
// passive carried by ngo_dao_chan_quyet.innateSkillId (the skillIds
// tuple cannot express a passive member). Battle construction asserts
// the full set is learned; a partial kit is corrupt progression state
// and must fail loudly, never silently drop a slot.
export const PHAP_TU_AN_BASIC_ID = 'van_phap_tuy_tam'
export const PHAP_TU_AN_SPECIAL_ID = 'da_phap_lien_tuyen'
export const PHAP_TU_AN_PASSIVE_ID = 'ngo_dao_hon_don'
export const PHAP_TU_AN_REQUIRED_SKILLS: readonly string[] = [
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_SPECIAL_ID,
  PHAP_TU_AN_PASSIVE_ID,
]

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
