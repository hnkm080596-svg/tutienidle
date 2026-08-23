import { ref, shallowRef } from 'vue'

// Dạng cũ, DÙNG CHUNG cho tuyệt đại đa số v-tooltip hiện có trong
// game (chỉ tiêu đề + mô tả 1 dòng) — `kind` optional để mọi object
// literal `{ title, description }` sẵn có (hàng chục nơi) vẫn khớp
// union TooltipContent bên dưới mà KHÔNG cần sửa gì.
export interface PlainTooltipContent {
  kind?: 'plain'

  title?: string

  description?: string
}

export interface TooltipStatRow {
  label: string

  value: string

  detail?: string

  tone?: 'default' | 'muted' | 'positive' | 'negative' | 'warning' | 'special'

  tier?: number
}

export interface TooltipSection {
  label: string

  rows: TooltipStatRow[]
}

// Tooltip Tâm Pháp (2026-08-15, mẫu đầu tiên cho hướng "tooltip có
// cấu trúc theo từng loại item" — làm TỪNG LOẠI một, đủ) — hình +
// nhiều khối chỉ số (Cộng Thêm/Chiến Đấu/Tu Luyện/Đột Phá), builder ở
// TechniqueSlotCard.vue. Loại item khác (Equipment/Pill/...) sẽ thêm
// biến thể riêng vào union này khi tới lượt, theo đúng khuôn.
export interface TechniqueTooltipContent {
  kind: 'technique'

  name: string

  imagePath?: string

  // Pháp Tu Redesign (magicpath) — Tâm Pháp không còn level/maxLevel
  // (không còn cộng chỉ số nên không còn gì để lên cấp).
  levelLabel?: string

  elementLabel?: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Đan/Phù/Trận (2026-08-15) — 3 loại item CÙNG SHAPE
// (name/image/phamLabel Ngũ Phẩm/description/sections), khác Equipment
// (không có instance state riêng — pill/talisman/formation chỉ là
// template + số lượng trong túi, không roll/enhance/affix như
// EquipmentInstance) nên gộp chung 1 kind union thay vì 3 interface
// riêng, Tooltip.vue render CHUNG 1 nhánh cho cả 3. Builder ở từng
// BagSection tương ứng (PillBagSection.vue/TalismanBagSection.vue/
// FormationBagSection.vue).
export interface GradedItemTooltipContent {
  kind: 'material' | 'pill' | 'talisman' | 'formation'

  name: string

  imagePath?: string

  phamLabel?: string

  phamKey?: string

  // "Sở hữu: N" — CHỈ có ý nghĩa khi hiện trong túi đồ (có bag stack
  // thật), undefined nếu hiện ở nơi khác (vd khi chưa sở hữu cái nào).
  ownedLabel?: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Equipment (2026-08-15) — loại CUỐI trong đợt "tooltip theo
// từng loại item". KHÁC GradedItemTooltipContent (có instance state
// thật: quality/rarity/affix/enhance/forge, xem
// composables/useEquipmentTooltip.ts's builder) nên tự 1 kind riêng.
export interface EquipmentTooltipContent {
  kind: 'equipment'

  name: string

  imagePath?: string

  slotLabel: string

  qualityKey: string

  description?: string

  sections: TooltipSection[]

  advancedSections?: TooltipSection[]
}

// Tooltip Building (Động Phủ UI redesign) — công trình trong Home
// Scene giờ là world object thật (xem components/game/HomeBuildingIcons.vue),
// tooltip cần tên + chức năng + trạng thái xây/cấp cùng khuôn với
// ItemTooltip/SkillTooltip thay vì {title, description} phẳng cũ.
export interface BuildingTooltipContent {
  kind: 'building'

  name: string

  functionLabel?: string

  statusLabel: string
}

export type TooltipContent =
  | PlainTooltipContent
  | TechniqueTooltipContent
  | GradedItemTooltipContent
  | EquipmentTooltipContent
  | BuildingTooltipContent

// State module-level (không phải Pinia) — chỉ 1 tooltip hiển thị
// tại 1 thời điểm trong toàn game, không cần theo dõi lịch sử/persist.
const content = ref<TooltipContent | null>(null)

const reference = shallowRef<HTMLElement | null>(null)

// Element đang "sở hữu" tooltip hiện tại — cần để directive tooltip.ts
// tự dọn đúng lúc unmounted() (vd BreakthroughButton biến mất ngay
// giữa lúc đang hover, do v-if tắt khi cultivation reset sau khi
// bấm) mà không vô tình xoá nhầm tooltip của 1 element KHÁC vừa mới
// showTooltip() sau đó (edge case chuột di chuyển rất nhanh).
let ownerElement: HTMLElement | null = null

let hideTimer: ReturnType<typeof setTimeout> | undefined

// Tooltip của slot cần phản hồi ngay khi hover. Khoảng đệm lúc đóng vẫn
// giữ rất ngắn để tránh chớp khi con trỏ đi qua ranh giới hai slot.
const TOOLTIP_HIDE_DELAY_MS = 30

function clearTimers() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = undefined
}

function showTooltip(value: TooltipContent, owner: HTMLElement, _immediate = false) {
  if (hideTimer) clearTimeout(hideTimer)

  const commit = () => {
    ownerElement?.removeAttribute('aria-describedby')
    content.value = value
    reference.value = owner
    ownerElement = owner
    owner.setAttribute('aria-describedby', 'global-tooltip')
  }

  commit()
}

function updateTooltip(value: TooltipContent, owner: HTMLElement) {
  if (ownerElement === owner) {
    content.value = value
  }
}

function hideTooltip(owner?: HTMLElement, immediate = false) {
  if (owner && ownerElement && ownerElement !== owner) {
    return
  }

  const commit = () => {
    if (owner && ownerElement && ownerElement !== owner) return
    content.value = null
    reference.value = null
    ownerElement?.removeAttribute('aria-describedby')
    ownerElement = null
    hideTimer = undefined
  }

  if (immediate) {
    commit()
    return
  }

  hideTimer = setTimeout(commit, TOOLTIP_HIDE_DELAY_MS)
}

function dismissTooltip() {
  clearTimers()
  content.value = null
  reference.value = null
  ownerElement?.removeAttribute('aria-describedby')
  ownerElement = null
}

export function useTooltip() {
  return { content, reference, showTooltip, updateTooltip, hideTooltip, dismissTooltip }
}
