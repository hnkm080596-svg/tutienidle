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
// - id authored riêng cho turn engine (generic_physical, ngu_kiem_thuat,
//   orb_* / kiem_combo_*, water_surge, reaction path) → author trực tiếp
//   tại đây, kèm số liệu đối chiếu file authored tương ứng.

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

  // The Tu Reimagined (spec 2026-09-15 §2.3) — mortal cast-leveled
  // basic sibling of tram; Lv3 gates the ung_the way at the ritual.
  huy_quyen: fromSkills('huy_quyen', { name: 'Hủy Quyền', description: 'Quyền pháp phàm nhân, không tốn tài nguyên.' }),

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

  // Enemy special — Thủy Giáp Long "Nuốt Sáng" (TurnBasicAttacks.ts:
  // everyNth 4, damage ×2.5).
  water_surge: {
    name: 'Nuốt Sáng',
    description: 'Đòn đặc biệt của Thủy Giáp Long — sóng nước dâng quét ngang, mỗi 4 lượt.',
  },

  // The Tu Reimagined (spec 2026-09-15 section 5, BodySkills.ts) —
  // Hien kits: Cuong Chien (missing-HP berserker) + Tran The (tank).
  cuong_quyen: {
    name: 'Cuồng Quyền',
    description: 'Quyền cuồng bạo — sát thương tăng theo phần sinh mệnh đã mất.',
  },
  loan_dau: {
    name: 'Loạn Đấu',
    description: 'Đòn đánh mạnh cùng scalar sinh mệnh thiếu hụt. Hồi 4 lượt.',
  },
  bat_tu_ba_the: {
    name: 'Bất Tử Bá Thể',
    description: 'Trong 3 lượt của bản thân, sát thương trí mạng chỉ để lại 1 sinh mệnh. Hồi 8 lượt.',
  },
  tran_ap: {
    name: 'Trấn Áp',
    description: 'Trấn áp quét ngang mọi kẻ địch bằng sức thân thể.',
  },
  phan_chinh: {
    name: 'Phản Chấn',
    description: 'Huy chương nội tại — phản lại một phần sát thương nhận vào.',
  },
  son_nhac: {
    name: 'Sơn Nhạc',
    description: 'Thân như núi lớn: hộ thể cho đồng đội, khiêu khích kẻ địch, giảm sát thương bản thân. Hồi 6 lượt.',
  },

  // The Tu Reimagined (spec 2026-09-15 section 6, BodySkills.ts) —
  // An kit (fixed at path choice) + reactive payload defs.
  tham_the: {
    name: 'Thám Thế',
    description: 'Dò thế địch bằng một đòn thân pháp — đánh trúng tích Thế.',
  },
  tu_the: {
    name: 'Tú Thế',
    description: 'Tích tụ nhịp thế trong 3 lượt: kiểm tra phản ứng tốn ít Thế hơn. Hồi 5 lượt.',
  },
  bach_ung: {
    name: 'Bách Ứng',
    description: 'Bách ứng bất lao trong 3 lượt: mọi kiểm tra phản ứng miễn phí, phản kích kèm Choáng. Hồi 8 lượt.',
  },
  phan_kich: {
    name: 'Phản Kích',
    description: 'Đòn phản kích tức thì sau khi trúng hoặc né đòn.',
  },
  tro_kich: {
    name: 'Trợ Kích',
    description: 'Đòn đánh theo sau hành động của đồng đội.',
  },

  // ---------------------------------------------------------------------
  // Companion skills (companion-gacha Task 11, data/companion/Companions.ts)
  // - ids follow the <definitionId>_<slot> convention; names/descriptions
  //   are pure display data for the HUD skill bar and companion panel.
  // ---------------------------------------------------------------------

  ho_ly_tinh_basic: {
    name: 'Trảo Kích',
    description: 'Hồ Ly Tinh vồ mồi bằng móng vuốt sắc.',
  },
  ho_ly_tinh_special: {
    name: 'Hồ Hỏa',
    description: 'Lửa hồ ly thiêu đốt một mục tiêu, có thể gây Bỏng.',
  },
  ho_ly_tinh_ultimate: {
    name: 'Tam Vĩ Diễm',
    description: 'Diễm hỏa từ ba cái đuôi thiêu rụi mục tiêu, chồng 2 tầng Bỏng.',
  },

  khai_son_luc_si_basic: {
    name: 'Trọng Quyền',
    description: 'Nắm đấm nặng như núi đè vào một mục tiêu.',
  },
  khai_son_luc_si_special: {
    name: 'Khai Sơn Trảm',
    description: 'Chém mở núi quét qua các ô lân cận, mảnh đá có thể gây Thạch Hóa.',
  },
  khai_son_luc_si_ultimate: {
    name: 'Bàn Sơn Thế',
    description: 'Sức mạnh bàn sơn đè vùng rộng, chấn động có thể gây Choáng.',
  },

  linh_hac_basic: {
    name: 'Vũ Nhận',
    description: 'Lông vũ sắc như lưỡi dao cắt một mục tiêu, có thể gây Làm Chậm.',
  },
  linh_hac_special: {
    name: 'Sương Vũ Tán',
    description: 'Quạt sương lạnh quét cả hàng, gây Hàn Khí.',
  },
  linh_hac_ultimate: {
    name: 'Băng Vũ Thiên La',
    description: 'Thiên la băng vũ phủ ba cột, gây Làm Chậm toàn diện.',
  },

  duoc_dong_tu_basic: {
    name: 'Dược Trụ',
    description: 'Chày giã thuốc đập vào một mục tiêu, có thể gây Trúng Độc.',
  },
  duoc_dong_tu_special: {
    name: 'Ngũ Độc Tán',
    description: 'Rải bột ngũ độc lên một vùng, chắc chắn gây Trúng Độc.',
  },
  duoc_dong_tu_ultimate: {
    name: 'Vạn Độc Quy Tông',
    description: 'Kích nổ toàn bộ tầng Trúng Độc của mục tiêu — mỗi tầng thêm sát thương chân thực.',
  },

  van_du_kiem_khach_basic: {
    name: 'Tùy Hành Kiếm',
    description: 'Nhát kiếm vân du gọn gàng vào một mục tiêu.',
  },
  van_du_kiem_khach_special: {
    name: 'Phi Kiếm Thứ',
    description: 'Phi kiếm xuyên dọc cả hàng địch.',
  },
  van_du_kiem_khach_ultimate: {
    name: 'Tuyệt Kiếm Nhất Thứ',
    description: 'Tích Thế 2 lượt rồi tung nhất kích tất sát vào một mục tiêu.',
  },

  thuy_linh_xa_basic: {
    name: 'Xà Nhai',
    description: 'Một cú cắn băng lạnh của linh xà, có thể gây Tê Cóng.',
  },
  thuy_linh_xa_special: {
    name: 'Giao Long Ngập Thủy',
    description: 'Giao long gây lụt dọc một cột, phần lớn kèm Làm Chậm.',
  },
  thuy_linh_xa_ultimate: {
    name: 'Cửu Thủy Phong Ba',
    description: 'Chín tầng sóng cuốn cả hàng, chồng Hàn Khí và có thể gây Tê Cóng.',
  },

  thiet_y_tang_basic: {
    name: 'Côn Pháp',
    description: 'Gậy sắt quét vào một mục tiêu.',
  },
  thiet_y_tang_special: {
    name: 'Kim Cang Hộ Thể',
    description: 'Thân hóa kim cang — tự tăng phòng ngự và phản đòn trong 6 lượt.',
  },
  thiet_y_tang_ultimate: {
    name: 'Phật Chưởng Trấn Ma',
    description: 'Chưởng lực Phật môn trấn áp một vùng, gây Uy Áp lên kẻ trúng.',
  },

  kim_quang_thanh_nhan_basic: {
    name: 'Kim Quang Chỉ',
    description: 'Tia kim quang điểm xuyết một mục tiêu, có thể gây Chảy Máu.',
  },
  kim_quang_thanh_nhan_special: {
    name: 'Vạn Kiếm Quyết',
    description: 'Vạn kiếm quang hóa phủ một vùng, dễ gây Chảy Máu.',
  },
  kim_quang_thanh_nhan_ultimate: {
    name: 'Kim Quang Phá Giáp',
    description: 'Kim quang quét dải rộng mọi hàng, bóc Giáp Rạn kẻ trúng.',
  },

  huyen_vu_basic: {
    name: 'Quy Giáp Trùng',
    description: 'Mai rùa huyền võ đập vào một mục tiêu, có thể gây Thạch Hóa.',
  },
  huyen_vu_special: {
    name: 'Huyền Vũ Trấn Địa',
    description: 'Trấn địa theo hình chữ thập, đất nứt có thể gây Trói Chân.',
  },
  huyen_vu_ultimate: {
    name: 'Hậu Thổ Gia Thân',
    description: 'Hậu thổ phù hộ — tự dựng Địa Trụ khiên dày, hồi khiên và phản đòn.',
  },

  cuu_thien_huyen_nu_basic: {
    name: 'Tinh Hoa Kiếm Quang',
    description: 'Kiếm quang tinh hoa bản nguyên đâm một mục tiêu.',
  },
  cuu_thien_huyen_nu_special: {
    name: 'Lạc Tinh Thứ',
    description: 'Sao rơi dọc cả hàng, uy áp thiên đình có thể gây Uy Áp.',
  },
  cuu_thien_huyen_nu_ultimate: {
    name: 'Cửu Thiên Tinh Lạc',
    description: 'Cửu thiên vãn tinh lạc xuống ba cột, hút sinh cơ về bản thân.',
  },

  // P7-M-G beta roster - Than Nong (healer) + Khai Minh (buffer).
  than_nong_basic: {
    name: 'Dược Thảo Kích',
    description: 'Thảo mộc hóa gai đâm một mục tiêu.',
  },
  than_nong_hoi_phuc_thuat: {
    name: 'Hồi Phục Thuật',
    description: 'Dược lực phủ khắp đồng đội — mỗi người hồi sinh lực dần theo lượt của mình.',
  },
  than_nong_than_dang: {
    name: 'Thần Đằng Dược Vương',
    description: 'Thần đằng dâng trào — hồi phục mạnh cho toàn đội và thanh tẩy khống chế.',
  },
  khai_minh_basic: {
    name: 'Cửu Thủ Trảo',
    description: 'Vuốt Khai Minh xé một mục tiêu.',
  },
  khai_minh_ho_ve_thuat: {
    name: 'Hộ Vệ Thuật',
    description: 'Cửu thủ gầm vang — toàn đội tăng công và thủ.',
  },
  khai_minh_thanh_an: {
    name: 'Thanh Ấn Côn Lôn',
    description: 'Ấn Côn Lôn che chở — mỗi đồng đội nhận một lớp giáp ngoài hấp thụ sát thương.',
  },

  // Phap Tu An kit (Task 16) — dong bo tu Skills.ts; ngo_dao_hon_don's
  // description must carry the basic-slot-only multicast clause because
  // its HUD emblem tooltip is the only place the rule surfaces.
  van_phap_tuy_tam: fromSkills('van_phap_tuy_tam', {
    name: 'Vạn Pháp Tùy Tâm',
    description: 'Mỗi đòn hóa thành một nguyên tố bất định.',
  }),
  da_phap_lien_tuyen: fromSkills('da_phap_lien_tuyen', {
    name: 'Đa Pháp Liên Tuyên',
    description: 'Pháp thuật cơ bản bắn ra liên tiếp nhiều lần.',
  }),
  ngo_dao_hon_don: fromSkills('ngo_dao_hon_don', {
    name: 'Ngộ Đạo Hỗn Độn',
    description: 'Chỉ đòn ở ô Thường (Vạn Pháp Tùy Tâm) có thể tự phân luồng — Đa Pháp Liên Tuyên không kích hoạt.',
  }),

  // Kiem Tu Reimagined (spec 2026-09-15 §3/§4.3) — the five Kiem Pho
  // orbs (manual picker + HUD strip readout). The 37 combos are
  // DELIBERATELY absent: K11 forbids any combo-name surface — the fired
  // payload's VFX/damage is the only discovery signal, so no combo id
  // may resolve to display text here (INV-7 fs-guard enforces).
  orb_dam: {
    name: 'Đâm',
    description: 'Đâm thẳng một mục tiêu — đòn kiếm gốc của Kiếm Phổ.',
  },
  orb_chem: {
    name: 'Chém',
    description: 'Chém nặng, gây Kiếm Thương chảy máu cộng dồn.',
  },
  orb_bo: {
    name: 'Bổ',
    description: 'Bổ mạnh phá giáp — giảm phòng thủ mục tiêu.',
  },
  orb_hat: {
    name: 'Hất',
    description: 'Hất ngược có tỉ lệ gây Choáng.',
  },
  orb_quet: {
    name: 'Quét',
    description: 'Quét ngang toàn trận — sát thương mọi mục tiêu.',
  },

  // Ngu Kiem Dao (Task 9) — the multi-instance phi kiem basic + the two
  // emblem slots (HUD markers only, never resolvable).
  ngu_kiem_thuat: {
    name: 'Ngự Kiếm Thuật',
    description: 'Phi kiếm độc lập đánh chuỗi mục tiêu — mỗi kiếm một đòn.',
  },
  tu_kiem_y: {
    name: 'Tụ Kiếm Ý',
    description: 'Mỗi đòn phi kiếm tích 1 Kiếm Ý — đủ Ý luyện thêm phi kiếm.',
  },
  kiem_dao_cascade: {
    name: 'Kiếm Đạo Liên Toát',
    description: 'Mỗi phi kiếm tự quyết sát chiêu, bạo kích, phá giáp.',
  },

}

/** Lookup an toàn — id không có trong map trả undefined (caller fallback). */
export function turnSkillDisplayMetaOf(skillId: string): TurnSkillDisplayMeta | undefined {
  return TURN_SKILL_DISPLAY_META[skillId]
}
