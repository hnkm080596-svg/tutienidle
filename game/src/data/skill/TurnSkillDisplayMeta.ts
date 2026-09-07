import type { Skill } from '../../core/skill/Skill'
import { SKILLS } from './Skills'

// Bảng 9.5 #5 (2026-09-07) — mapping skillId → display metadata cho HUD
// turn (TurnCombatSkillBar/CombatSkillSlot). TurnSkillDefinition cố ý
// KHÔNG mang name/description (Slice 2 spec §3 — shape gameplay thuần);
// lớp display metadata này tách riêng để content pass skill sau này chỉ
// cần bổ sung 1 entry ở đây.
//
// Nguồn dữ liệu:
// - id trùng SKILLS (Skills.ts) → ĐỒNG BỘ name/description từ bảng Skill
//   thật (SKILLS_BY_ID lookup lúc khởi tạo — không hardcode 2 nơi).
// - id authored riêng cho turn engine (generic_physical, bat_kiem_thuat,
//   water_surge, reaction path) → author trực tiếp tại đây, kèm số liệu
//   đối chiếu file authored tương ứng.

/** Display metadata hiển thị cho 1 TurnSkillDefinition trong HUD. */
export interface TurnSkillDisplayMeta {
  name: string

  description: string
}

const SKILLS_BY_ID = new Map<string, Skill>()

for (const skill of SKILLS) {
  SKILLS_BY_ID.set(skill.id, skill)
}

/** Đồng bộ từ SKILLS: name/description lấy đúng bảng skill thật. */
function fromSkills(id: string, fallback: TurnSkillDisplayMeta): TurnSkillDisplayMeta {
  const live = SKILLS_BY_ID.get(id)

  if (live) {
    return { name: live.name, description: live.description }
  }

  return fallback
}

/**
 * Metadata cho mọi TurnSkillDefinition production id. Lookup qua
 * turnSkillDisplayMetaOf() — id lạ trả undefined để caller fallback
 * nhãn role (không crash, không hiển thị raw id).
 */
export const TURN_SKILL_DISPLAY_META: Record<string, TurnSkillDisplayMeta> = {
  // Kiếm Tu basic — 'Trảm'/"Huy Kiếm" (giữ nguyên theo chốt 9.4).
  tram: fromSkills('tram', { name: 'Huy Kiếm', description: 'Một chiêu thức cơ bản, không tốn tài nguyên.' }),

  // 5 Pháp Tu Thuần Hệ — đồng bộ từ Skills.ts.
  hoa_cau_thuat: fromSkills('hoa_cau_thuat', { name: 'Hỏa Cầu Thuật', description: 'Hỏa hệ công kích.' }),
  thuy_tien_thuat: fromSkills('thuy_tien_thuat', { name: 'Thủy Tiên Thuật', description: 'Thủy hệ công kích.' }),
  doc_chuong: fromSkills('doc_chuong', { name: 'Độc Chương', description: 'Mộc hệ công kích.' }),
  diem_kim_thuat: fromSkills('diem_kim_thuat', { name: 'Điểm Kim Thuật', description: 'Kim hệ công kích.' }),
  tho_cau_thuat: fromSkills('tho_cau_thuat', { name: 'Thổ Cầu Thuật', description: 'Thổ hệ công kích.' }),

  // Thể Tu + Phàm Nhân — generic melee (không dùng Skill object).
  generic_physical: {
    name: 'Vật Công',
    description: 'Tấn công vật lý cơ bản bằng sức mạnh thân thể.',
  },

  // Kiếm Tu special — Bạt Kiếm Thuật (BatKiemThuat.ts: charge 3 lượt,
  // damage Trảm theo số lượt tích × 3, cooldown 5).
  bat_kiem_thuat: {
    name: 'Bạt Kiếm Thuật',
    description: 'Thế: tích lực 3 lượt. Trảm: gây sát thương theo số lượt tích luỹ. Hồi 5 lượt sau Trảm.',
  },

  // Enemy special — Thủy Giáp Long "Nuốt Sáng" (TurnBasicAttacks.ts:
  // everyNth 4, damage ×2.5).
  water_surge: {
    name: 'Nuốt Sáng',
    description: 'Đòn đặc biệt của Thủy Giáp Long — sóng nước dâng quét ngang, mỗi 4 lượt.',
  },

  // Pháp Tu Reaction Path (TurnReactionPathSkills.ts). special là MARKER
  // definition — TurnBattleSystem thay bằng 2 pick random từ pool elemental.
  phap_tu_reaction_special: {
    name: 'Ngũ Hành Luân Chuyển',
    description: 'Đòn đặc biệt Pháp Tu — tung 2 thuật ngũ hành khác nhau cùng lượt, có thể cộng hưởng phản ứng.',
  },
  phap_tu_reaction_ultimate: {
    name: 'Ngũ Hành Hợp Nhất',
    description: 'Tuyệt kỹ Pháp Tu — tự cường hóa sát thương phản ứng nguyên tố trong 4 lượt.',
  },
}

/** Lookup an toàn — id không có trong map trả undefined (caller fallback). */
export function turnSkillDisplayMetaOf(skillId: string): TurnSkillDisplayMeta | undefined {
  return TURN_SKILL_DISPLAY_META[skillId]
}
