import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import { CORE_SKILLS } from './CoreSkills'
import { PASSIVE_SKILLS } from './PassiveSkills'
import { PHAP_TU_SKILLS } from './PhapTuChainSkills'

export const SKILLS: Skill[] = [
  ...CORE_SKILLS,
  ...PASSIVE_SKILLS,
  ...PHAP_TU_SKILLS,
]

// Pháp Tu Thuần Hệ (spec 2026-09-03 §2; Future Systems Task 1, 2026-09-04)
// — chuỗi 3 skill/hành khớp mô hình 3-skill role (Slice 2): [basic, special,
// ultimate]. Mapping giữ vị trí A/C/E của chuỗi 5 cũ (A = root no-cooldown
// khớp yêu cầu basic; C = tier giữa; E = tier đỉnh) — 2 skill vị trí B/D
// không mất, chỉ rời khỏi chuỗi mặc định (data vẫn tồn tại trong SKILLS
// cho nội dung tương lai).
export const CHAIN_SKILL_IDS: Record<ElementType, readonly [string, string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa', 'hoa_ha_cuu_thien'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh', 'bac_hai_cuong_lan'],
  wood: ['doc_chuong', 'cau_mang_can_tri', 'doc_vien_bao_can'],
  metal: ['diem_kim_thuat', 'kim_lang_toan_phong', 'kim_luan_tran_ap'],
  earth: ['tho_cau_thuat', 'dia_tru_thua_thien', 'cuu_tru_dia_lao'],
}
