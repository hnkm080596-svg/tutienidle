<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md muc 6/8 -- component nho
// DUNG CHUNG cho moi renderer theo path (icon/cooldown mask/resource
// cost/cast indicator), thuan trinh bay, doc snapshot chi-doc.
//
// Slice 7 (2026-09-04) -- THAY DOI thiet ke cu "khong co nut bam": them
// isTappable prop + click emit (plan Task 6). Emit CHI khi tappable
// (call site quyet dinh dieu kien -- dang la luot player paused + slot
// ready); keyboard accessibility qua role="button"/tabindex.
//
// electron-combat-timing-smoothing-plan.md muc 7 -- prop shape CO Y
// dung ten trung lap (remaining/total/isMasked): component phuc vu ca
// cooldown that lan cadence Attack Speed -- 2 clock khac nhau o tang du
// lieu core, KHONG duoc hop nhat lai thanh 1 semantic o day. Moi call
// site tu map state CUA MINH sang prop trung lap ben duoi.
import { computed } from 'vue'
import SlotView from '@/components/common/SlotView.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import type { Skill } from '@/core/skill/Skill'
import type { SlotPresentationState } from '@/components/common/SlotTypes'
import type { TooltipContent } from '@/composables/useTooltip'

const props = withDefaults(defineProps<{
  skill?: Skill
  emptyLabel?: string

  // Bang 9.5 #5 (2026-09-07) -- label hien thi override (ten skill that
  // tu TurnSkillDisplayMeta). undefined = fallback skill?.name ->
  // emptyLabel -> 'Trong' nhu cu. Khong dung tooltip rieng (tooltipOverride).
  displayLabel?: string

  // Three-path design (2026-09-25) -- icon path tu iconKey manifest;
  // undefined/loi tai = SlotView monogram fallback.
  displayIcon?: string

  // Thoi gian con lai/tong cua "vong phu" dang hien -- cooldown that
  // (policy cooldown/cast_time) hoac cadence Attack Speed (policy
  // attack_speed), tuy call site. Turn-based: SO LUOT.
  remaining: number
  total: number

  // true = hien vong phu toi + so dem nguoc (remaining > 0 VA dang
  // "chay", call site tu quyet dinh).
  isMasked?: boolean

  castRemaining?: number
  castTotal?: number
  isCasting?: boolean

  resourceCost?: number
  isInsufficientResource?: boolean

  // Trang thai 'out_of_range' thong nhat (plan 11.3) -- khong co primary
  // target trong attack range cua avatar; slot lam mo thay vi vong phu.
  isOutOfRange?: boolean

  isUnreleased?: boolean
  isLocked?: boolean

  // Slice 7 -- true = slot bam duoc LUC NAY (player paused turn + ready).
  isTappable?: boolean

  tooltipOverride?: TooltipContent
}>(), {
  isMasked: false,
  resourceCost: 0,
  isCasting: false,
  isInsufficientResource: false,
  isOutOfRange: false,
  isUnreleased: false,
  isLocked: false,
  isTappable: false,
})

const emit = defineEmits<{ click: [] }>()

function onClick() {
  if (props.isTappable) {
    emit('click')
  }
}

const label = computed(() => props.displayLabel ?? props.skill?.name ?? props.emptyLabel ?? 'Trống')

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

const castValue = computed(() => {
  if (!props.castTotal || props.castTotal <= 0 || props.castRemaining === undefined) {
    return 0
  }

  return props.castTotal - props.castRemaining
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
      'is-tappable': isTappable,
    }"
    :role="isTappable ? 'button' : undefined"
    :tabindex="isTappable ? 0 : undefined"
    @click="onClick"
    @keydown.enter="onClick"
    @keydown.space.prevent="onClick"
  >
    <SlotView
      :item="skill ?? null"
      :icon="displayIcon"
      :label="label"
      show-label
      :tooltip="tooltip"
      :state="slotState"
    />

    <div v-if="showMask" class="combat-skill-slot__mask" :style="{ height: `${maskPercent}%` }" />

    <span v-if="showMask" class="combat-skill-slot__mask-number">
      {{ Math.ceil(remaining * 10) / 10 }}
    </span>

    <Bar
      v-if="isCasting"
      class="combat-skill-slot__cast-bar"
      :value="castValue"
      :max="castTotal ?? 1"
      :height="3"
    />

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

/* Slice 7 -- affordance cho slot bam duoc (cursor + hover ring). */
.combat-skill-slot.is-tappable {
  cursor: pointer;
}

.combat-skill-slot.is-tappable:hover {
  outline: 2px solid var(--jade);
  outline-offset: 1px;
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
  width: auto;
  border-radius: 2px;
  z-index: 9;
  --bar-track: var(--ink-900);
  --bar-from: var(--jade);
  --bar-to: var(--jade);
}

.combat-skill-slot__cast-bar :deep(.bar__fill) {
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
