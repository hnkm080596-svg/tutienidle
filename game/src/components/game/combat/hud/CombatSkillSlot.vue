<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 6/8 — component nhỏ
// DÙNG CHUNG cho mọi renderer theo path (icon/cooldown mask/resource
// cost/cast indicator), nhưng KHÔNG có nút bấm/hotkey/manual cast —
// thuần trình bày, đọc snapshot chỉ-đọc.
//
// electron-combat-timing-smoothing-plan.md mục 7 — prop shape CỐ Ý
// dùng tên trung lập (remaining/total/isMasked): component phục vụ cả
// cooldown thật lẫn cadence Attack Speed — 2 clock khác nhau ở tầng dữ
// liệu core, KHÔNG được hợp nhất lại thành 1 semantic ở đây. Mỗi call
// site tự map state CỦA MÌNH sang prop trung lập bên dưới. Execution
// policy rework (plan §11.3) — thêm is-out-of-range cho trạng thái
// thống nhất 'out_of_range'.
import { computed } from 'vue'
import SlotView from '@/components/common/SlotView.vue'
import type { Skill } from '@/core/skill/Skill'
import type { SlotPresentationState } from '@/components/common/SlotTypes'
import type { TooltipContent } from '@/composables/useTooltip'

const props = withDefaults(defineProps<{
  skill?: Skill
  emptyLabel?: string

  // Thời gian còn lại/tổng của "vòng phủ" đang hiện — cooldown thật
  // (policy cooldown/cast_time) hoặc cadence Attack Speed (policy
  // attack_speed), tuỳ call site.
  remaining: number
  total: number

  // true = hiện vòng phủ tối + số đếm ngược (remaining > 0 VÀ đang
  // "chạy", call site tự quyết định).
  isMasked?: boolean

  castRemaining?: number
  castTotal?: number
  isCasting?: boolean

  resourceCost?: number
  isInsufficientResource?: boolean

  // Trạng thái 'out_of_range' thống nhất (plan §11.3) — không có primary
  // target trong attack range của avatar; slot làm mờ thay vì vòng phủ.
  isOutOfRange?: boolean

  isUnreleased?: boolean
  isLocked?: boolean

  tooltipOverride?: TooltipContent
}>(), {
  isMasked: false,
  resourceCost: 0,
  isCasting: false,
  isInsufficientResource: false,
  isOutOfRange: false,
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
      'is-out-of-range': isOutOfRange,
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
  background: color-mix(in srgb, var(--ink-950) 72%, transparent);
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
  font-size: var(--text-lg);
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
  background: color-mix(in srgb, var(--ink-950) 75%, transparent);
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
  background: color-mix(in srgb, var(--ink-950) 60%, transparent);
  pointer-events: none;
}

.combat-skill-slot.is-insufficient :deep(.slot-view),
.combat-skill-slot.is-out-of-range :deep(.slot-view) {
  filter: grayscale(0.6);
  opacity: 0.7;
}
</style>
