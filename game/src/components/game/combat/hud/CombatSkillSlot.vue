<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 6/8 — component nhỏ
// DÙNG CHUNG cho mọi renderer theo path (icon/cooldown mask/resource
// cost/cast indicator), nhưng KHÔNG có nút bấm/hotkey/manual cast —
// thuần trình bày, đọc snapshot chỉ-đọc.
//
// electron-combat-timing-smoothing-plan.md mục 7 — prop shape CỐ Ý
// dùng tên trung lập (remaining/total/isMasked) thay vì cooldownRemaining/
// cooldownTotal: component này phục vụ CẢ active skill loadout (cooldown
// thật, xem CombatSkillPresentationState) LẪN Trảm (nhịp đánh, xem
// BasicAttackPresentationState) — 2 khái niệm khác hẳn nhau ở tầng dữ
// liệu core, KHÔNG được hợp nhất lại thành 1 semantic ở đây. Mỗi call
// site tự map type CỦA MÌNH sang prop trung lập bên dưới.
import { computed } from 'vue'
import SlotView from '@/components/common/SlotView.vue'
import type { Skill } from '@/core/skill/Skill'
import type { SlotPresentationState } from '@/components/common/SlotTypes'
import type { TooltipContent } from '@/composables/useTooltip'

const props = withDefaults(defineProps<{
  skill?: Skill
  emptyLabel?: string

  // Thời gian còn lại/tổng của "vòng phủ" đang hiện — cooldown thật
  // (active skill) hoặc nhịp đánh (Trảm), tuỳ call site.
  remaining: number
  total: number

  // true = hiện vòng phủ tối + số đếm ngược (remaining > 0 VÀ đang
  // "chạy", call site tự quyết định — Trảm dùng isAdvancing, active
  // skill dùng state==='cooldown').
  isMasked?: boolean

  castRemaining?: number
  castTotal?: number
  isCasting?: boolean

  resourceCost?: number
  isInsufficientResource?: boolean

  isUnreleased?: boolean
  isLocked?: boolean

  tooltipOverride?: TooltipContent
}>(), {
  isMasked: false,
  resourceCost: 0,
  isCasting: false,
  isInsufficientResource: false,
  isUnreleased: false,
  isLocked: false,
})

const label = computed(() => props.skill?.name ?? props.emptyLabel ?? 'Trống')

const slotState = computed<SlotPresentationState>(() => {
  if (props.isLocked) {
    return { availability: 'locked' }
  }

  return { availability: 'available' }
})

const maskPercent = computed(() => {
  if (props.total <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (props.remaining / props.total) * 100))
})

const showMask = computed(() => props.isMasked && maskPercent.value > 0)

const castPercent = computed(() => {
  if (!props.castTotal || props.castTotal <= 0 || props.castRemaining === undefined) {
    return 0
  }

  return Math.max(0, Math.min(100, ((props.castTotal - props.castRemaining) / props.castTotal) * 100))
})

const tooltip = computed<TooltipContent | undefined>(() => {
  if (props.tooltipOverride) {
    return props.tooltipOverride
  }

  if (!props.skill) {
    return undefined
  }

  return { title: props.skill.name, description: props.skill.description }
})
</script>

<template>
  <div
    class="combat-skill-slot"
    :class="{
      'is-masked': showMask,
      'is-casting': isCasting,
      'is-insufficient': isInsufficientResource,
      'is-unreleased': isUnreleased,
    }"
  >
    <SlotView
      :item="skill ?? null"
      :label="label"
      :tooltip="tooltip"
      :state="slotState"
    />

    <div v-if="showMask" class="combat-skill-slot__mask" :style="{ height: `${maskPercent}%` }" />

    <span v-if="showMask" class="combat-skill-slot__mask-number">
      {{ Math.ceil(remaining * 10) / 10 }}
    </span>

    <div v-if="isCasting" class="combat-skill-slot__cast-bar">
      <div class="combat-skill-slot__cast-fill" :style="{ width: `${castPercent}%` }" />
    </div>

    <span v-if="resourceCost > 0" class="combat-skill-slot__resource-cost">
      {{ resourceCost }}
    </span>

    <span v-if="isUnreleased" class="combat-skill-slot__unreleased">Chưa Ra Mắt</span>
  </div>
</template>

<style scoped>
.combat-skill-slot {
  position: relative;
  pointer-events: auto;
}

.combat-skill-slot__mask {
  position: absolute;
  inset: 0 0 auto 0;
  top: auto;
  bottom: 0;
  width: 100%;
  background: rgba(10, 10, 13, 0.72);
  pointer-events: none;
  z-index: 8;
  transition: height 0.1s linear;
}

.combat-skill-slot__mask-number {
  position: absolute;
  inset: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

.combat-skill-slot__cast-bar {
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: -6px;
  height: 3px;
  border-radius: 2px;
  background: var(--ink-900);
  overflow: hidden;
  z-index: 9;
}

.combat-skill-slot__cast-fill {
  height: 100%;
  background: var(--jade);
  transition: width 0.05s linear;
}

.combat-skill-slot__resource-cost {
  position: absolute;
  bottom: 16px;
  left: 3px;
  z-index: 7;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(10, 10, 13, 0.75);
  color: var(--jade);
  font-size: var(--text-xs);
  line-height: 1.4;
  pointer-events: none;
}

.combat-skill-slot__unreleased {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: rgba(10, 10, 13, 0.6);
  pointer-events: none;
}

.combat-skill-slot.is-insufficient :deep(.slot-view) {
  filter: grayscale(0.6);
  opacity: 0.7;
}
</style>
