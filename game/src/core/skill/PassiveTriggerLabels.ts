import type { PassiveTrigger } from './SkillTypes'

// Nhãn tiếng Việt cho PassiveTrigger — dùng chung cho bất kỳ nơi nào
// hiện thị "kích hoạt khi nào" của 1 passive (skill/Formation), xem
// tooltip Trận Pháp (FormationBagSection.vue).
export const PASSIVE_TRIGGER_LABELS: Record<PassiveTrigger, string> = {
  cast: 'Khi Thi Triển Skill',
  hit: 'Khi Đánh Trúng',
  kill: 'Khi Hạ Gục Mục Tiêu',
  damage_taken: 'Khi Bị Đánh Trúng',
  attack: 'Khi Ra Đòn',
  critical: 'Khi Chí Mạng',
  dodge: 'Khi Né Đòn',
  block: 'Khi Đỡ Đòn',
  per_second: 'Mỗi Giây',
}
