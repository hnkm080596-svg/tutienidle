import { ref, shallowRef } from 'vue'
import type { NameSegment } from '@/core/item/NameSegment'
import type { ElementType } from '@/core/element/ElementType'

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

  // Arbitrary token color for the value (e.g. '--rank-color-5' for a
  // Pham/Chat text — rule: any grade/quality text carries its set
  // color). tone/tier styles win when both are absent.
  colorVar?: string
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
// (name/image/gradeLabel Ngũ Phẩm/description/sections), khác Equipment
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

  gradeLabel?: string

  gradeKey?: string

  // Pham rank on the 10-step profession ramp (materials) — feeds the
  // tooltip aura color via --rank-color-N when gradeKey is absent
  // (2026-09-14 aura ruling).
  gradeRank?: number

  // "{Chat} - {Name}" title segments — text structure only
  // (item-info-card spec 2026-09-14); the single display color is the
  // payload's nameColorVar (added by the spec's payload task).
  // Optional so existing callers keep the plain-name header.
  nameSegments?: NameSegment[]

  gradeLine?: string

  gradeLineColorVar?: string

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

  // Composed "{Chat} - {Name}" title segments — text structure only
  // (item-info-card spec 2026-09-14); the single display color is the
  // payload's nameColorVar (added by the spec's payload task). `name`
  // (flat string) stays for alt text/icon fallback and the plain
  // title render.
  nameSegments: NameSegment[]

  imagePath?: string

  slotLabel: string

  qualityKey: string

  // "Canh gioi: {Pham} ({realm})" — the Pham axis rendered as the meta
  // line under the title (2026-09-14 ruling); Chat stays on the name
  // segments. Replaces the old "Phan Loai" section rows.
  gradeLine?: string

  // Pham color var for gradeLine (e.g. '--rank-color-3') — keeps the
  // line on the same ramp as the slot underlay.
  gradeLineColorVar?: string

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

  // 2026-08-30 frontend-design pass — statusLabel trước đây LUÔN tô màu
  // jade dù đang nói "Chưa mở" (locked) hay "Đã mở" (built), gây hiểu
  // nhầm trạng thái khóa trông như tích cực. Optional để không phá vỡ
  // caller cũ khác (không caller nào khác ngoài HomeBuildingIcons.vue).
  isBuilt?: boolean
}

// Five Elements tooltip (2026-09-15 formation redesign) - hovering an
// element medallion shows that element's own banner art as the
// background (banner-{element}.png cut from the sprite sheet) instead
// of the default InkNineSlice paper frame. Text sits on a separate
// content layer with a fixed inset into the banner's clear paper zone
// so the art never covers it.
export interface ElementTooltipContent {
  kind: 'element'

  // 'primordial' = Hon Nguyen (taiji center) - the blank paper banner
  // cut from the base of sheet 2; not an element, but shares the same
  // banner mechanism.
  element: ElementType | 'primordial'

  // Accessible name only — banner art already carries the element's
  // identity, so the title is NOT rendered (user ruling 2026-09-15).
  title: string

  description?: string
}

export type TooltipContent =
  | PlainTooltipContent
  | TechniqueTooltipContent
  | GradedItemTooltipContent
  | EquipmentTooltipContent
  | BuildingTooltipContent
  | ElementTooltipContent

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
