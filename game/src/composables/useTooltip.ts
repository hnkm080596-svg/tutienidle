import { ref, shallowRef } from 'vue'
import type { ElementType } from '@/core/element/ElementType'
import type { SlotPreviewProps } from '@/components/common/SlotTypes'

// Dang cu, DUNG CHUNG cho tuyet dai da so v-tooltip hien co trong
// game (chi tieu de + mo ta 1 dong) - `kind` optional de moi object
// literal `{ title, description }` san co (hang chuc noi) van khop
// union TooltipContent ben duoi ma KHONG can sua gi.
export interface PlainTooltipContent {
  kind?: 'plain'

  title?: string

  description?: string
}

export interface TooltipStatRow {
  label: string

  value: string

  detail?: string

  // "[min-max]" - rendered muted, inline after value (item-info-card
  // spec section 3; replaces the old Alt-revealed advancedSections
  // values).
  range?: string

  // "up-arrow +2" - compare marker rendered after range (spec
  // section 4); only emitted when the builder received a compare
  // context.
  delta?: string

  deltaTone?: 'positive' | 'negative' | 'muted'

  tone?: 'default' | 'muted' | 'positive' | 'negative' | 'warning' | 'special'

  tier?: number

  // Arbitrary token color for the value (e.g. '--rank-color-5' for a
  // Pham/Chat text - rule: any grade/quality text carries its set
  // color). tone/tier styles win when both are absent.
  colorVar?: string
}

export interface TooltipSection {
  label: string

  rows: TooltipStatRow[]
}

// Tooltip Tam Phap (2026-08-15, mau dau tien cho huong "tooltip co
// cau truc theo tung loai item" - lam TUNG LOAI mot, du) - hinh +
// nhieu khoi chi so (Cong Them/Chien Dau/Tu Luyen/Dot Pha), builder o
// TechniqueSlotCard.vue. Loai item khac (Equipment/Pill/...) se them
// bien the rieng vao union nay khi toi luot, theo dung khuon.
export interface TechniqueTooltipContent {
  kind: 'technique'

  name: string

  imagePath?: string

  // Phap Tu Redesign (magicpath) - Tam Phap khong con level/maxLevel
  // (khong con cong chi so nen khong con gi de len cap).
  levelLabel?: string

  elementLabel?: string

  description?: string

  sections: TooltipSection[]
}

// Tooltip Dan/Phu/Tran (2026-08-15) - 3 loai item CUNG SHAPE
// (name/image/gradeLabel Ngu Pham/description/sections), khac Equipment
// (khong co instance state rieng - pill/talisman/formation chi la
// template + so luong trong tui, khong roll/enhance/affix nhu
// EquipmentInstance) nen gop chung 1 kind union thay vi 3 interface
// rieng, Tooltip.vue render CHUNG 1 nhanh cho ca 3. Builder o tung
// BagSection tuong ung (PillBagSection.vue/TalismanBagSection.vue/
// FormationBagSection.vue).
export interface GradedItemTooltipContent {
  kind: 'material' | 'pill' | 'talisman' | 'formation'

  // FULL display name - composed "Chat - Name" where the item kind
  // composes one (pills); materials carry their plain name.
  name: string

  // Single title color (item-info-card spec section 2) - replaces
  // per-segment colors; nameTone below overrides it for the max-rank
  // rainbow.
  nameColorVar?: string

  // 'tien' => rainbow title (max-rank gradient), beats nameColorVar.
  nameTone?: string

  // Static SlotView header props bag (spec section 3) - see
  // SlotTypes.ts.
  slotPreview?: SlotPreviewProps

  imagePath?: string

  gradeLabel?: string

  gradeKey?: string

  // Pham rank on the 10-step profession ramp (materials) - feeds the
  // tooltip aura color via --rank-color-N when gradeKey is absent
  // (2026-09-14 aura ruling).
  gradeRank?: number

  gradeLine?: string

  // "So huu: N" - renders ONLY when > 0 (spec: never renders
  // "So huu: 0"); undefined outside the bag surface.
  ownedCount?: number

  description?: string

  sections: TooltipSection[]
}

// Tooltip Equipment (2026-08-15) - loai CUOI trong dot "tooltip theo
// tung loai item". KHAC GradedItemTooltipContent (co instance state
// that: quality/rarity/affix/enhance/forge, xem
// composables/useEquipmentTooltip.ts's builder) nen tu 1 kind rieng.
export interface EquipmentTooltipContent {
  kind: 'equipment'

  name: string

  nameColorVar?: string

  nameTone?: string

  slotPreview?: SlotPreviewProps

  imagePath?: string

  slotLabel: string

  qualityKey: string

  // "Canh gioi: {Pham} ({realm})" - the Pham axis rendered as the meta
  // line under the title (2026-09-14 ruling). Replaces the old
  // "Phan Loai" section rows.
  gradeLine?: string

  description?: string

  sections: TooltipSection[]

  // Paired compare card (spec section 4): the equipped counterpart's
  // own single-card payload, built by the same builder with NO compare
  // context - recursion stops at depth 1.
  compareWith?: Omit<EquipmentTooltipContent, 'compareWith'>
}

// Tooltip Building (Dong Phu UI redesign) - cong trinh trong Home
// Scene gio la world object that (xem scenes/dong-fu/hotspots/DongFuBuildingHotspots.vue),
// tooltip can ten + chuc nang + trang thai xay/cap cung khuon voi
// ItemTooltip/SkillTooltip thay vi {title, description} phang cu.
export interface BuildingTooltipContent {
  kind: 'building'

  name: string

  functionLabel?: string

  statusLabel: string

  // 2026-08-30 frontend-design pass - statusLabel truoc day LUON to mau
  // jade du dang noi "Chua mo" (locked) hay "Da mo" (built), gay hieu
  // nham trang thai khoa trong nhu tich cuc. Optional de khong pha vo
  // caller cu khac (khong caller nao khac ngoai hotspot layer DongFuBuildingHotspots).
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

  // Accessible name only - banner art already carries the element's
  // identity, so the title is NOT rendered (user ruling 2026-09-15).
  title: string

  description?: string
}

// Aggregate-stat tooltip (character stat board source breakdown) - the
// stat title + its resolved aggregate + the per-source fold (base row,
// then each contributing source + its Added/Increased/More amounts).
// Reuses the item-info-card section/row vocabulary.
export interface StatBreakdownTooltipContent {
  kind: 'stat'

  name: string

  /** Pre-formatted aggregate value shown beside the title. */
  total?: string

  description?: string

  sections: TooltipSection[]
}

export type TooltipContent =
  | PlainTooltipContent
  | TechniqueTooltipContent
  | GradedItemTooltipContent
  | EquipmentTooltipContent
  | BuildingTooltipContent
  | ElementTooltipContent
  | StatBreakdownTooltipContent

// State module-level (khong phai Pinia) - chi 1 tooltip hien thi
// tai 1 thoi diem trong toan game, khong can theo doi lich su/persist.
const content = ref<TooltipContent | null>(null)

const reference = shallowRef<HTMLElement | null>(null)

// Element dang "so huu" tooltip hien tai - can de directive tooltip.ts
// tu don dung luc unmounted() (vd BreakthroughButton bien mat ngay
// giua luc dang hover, do v-if tat khi cultivation reset sau khi
// bam) ma khong vo tinh xoa nham tooltip cua 1 element KHAC vua moi
// showTooltip() sau do (edge case chuot di chuyen rat nhanh).
let ownerElement: HTMLElement | null = null

let hideTimer: ReturnType<typeof setTimeout> | undefined

// Tooltip cua slot can phan hoi ngay khi hover. Khoang dem luc dong van
// giu rat ngan de tranh chop khi con tro di qua ranh gioi hai slot.
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
