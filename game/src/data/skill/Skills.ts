import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import { CORE_SKILLS } from './CoreSkills'
import { PASSIVE_SKILLS } from './PassiveSkills'
import { PHAP_TU_SKILLS } from './PhapTuSkills'
import { TALENT_PASSIVE_SKILLS } from './TalentPassives'

export const SKILLS: Skill[] = [
  ...CORE_SKILLS,
  ...PASSIVE_SKILLS,
  ...PHAP_TU_SKILLS,
  // M-QI-05 - talent passives are registered templates so the canonical
  // learnSkill funnel (preflight + grant contract) owns their insertion;
  // all are fixed Lv1 (no Core Nodes).
  ...TALENT_PASSIVE_SKILLS,
]

// Phap Tu Reimagine (2026-09-26 spec sec.3a) -- the kit is a {basic,
// special} PAIR per element: [0] the element basic (learned via the
// element root), [1] the Phap Trang special (learned via
// linh_ngo_<special>). The old chain/route/god-ult third slot is gone;
// the engine's resolveSpecialUltimate reads index 1.
export const SPELL_KIT_IDS: Record<ElementType, readonly [string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh'],
  wood: ['doc_chuong', 'van_moc_sinh_co'],
  metal: ['diem_kim_thuat', 'kim_y_ngung_phong'],
  earth: ['tho_cau_thuat', 'trong_nhac'],
}
