<script setup lang="ts">
// Command wheel nhiều tầng (plan Workstream B) — mở bằng click nhân vật
// tu luyện giữa Động Phủ (trigger ở DongFuScene.vue), đóng bằng click
// lần nữa/click vùng trống/Escape. Slot phân bố đều 360° theo thứ tự
// catalog trên hai quỹ đạo tròn. Slot đi từ tâm theo cung xoắn, hai vòng
// quay ngược chiều nhau và tăng alpha trong suốt hành trình.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import {
  COMMAND_WHEEL_SLOTS,
  type CommandWheelDisabledContext,
  type CommandWheelSlot,
} from '@/game/support/commandWheelCatalog'
import { getCommandWheelOrbitDirection } from '@/game/support/commandWheelOrbit'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { ARTIFACT_ID_BY_CULTIVATION_PATH } from '@/core/artifact/Artifact'
import NotificationBadge from '@/components/common/NotificationBadge.vue'

const ui = useUiStore()
const player = usePlayerStore()

const stageActive = useStageActive()

const navigation = useBuildingNavigation()

// Bản Mệnh Pháp Bảo (2026-08-27) — context runtime cho
// CommandWheelSlot.disabledReason(), build ở ĐÂY (component, không
// phải catalog) — xem ghi chú "catalog thuần data" trong
// commandWheelCatalog.ts.
const disabledContext = computed<CommandWheelDisabledContext>(() => ({
  hasFoundationRealm: getRealmIndex(player.realmId) >= getRealmIndex('foundation_establishment'),
  hasArtifactDefinition: player.cultivationPath
    ? Boolean(ARTIFACT_ID_BY_CULTIVATION_PATH[player.cultivationPath])
    : false,
}))

function disabledReason(slot: CommandWheelSlot): string | null {
  return slot.disabledReason?.(disabledContext.value) ?? null
}

/** Future slot (available=false) tồn tại trong catalog nhưng KHÔNG render. */
const renderedSlots = computed(() => COMMAND_WHEEL_SLOTS.filter((slot) => slot.available()))

const ORBIT_COUNT = 2
const ORBIT_SWEEP_DEGREES = 112
const MOTION_DURATION_MS = 320

// ================= Circular orbit layout — clamp() thích nghi viewport =======
const viewportSize = ref({ width: window.innerWidth, height: window.innerHeight })

function onResize() {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

function outerOrbitRadius(): number {
  const { width, height } = viewportSize.value
  const shortSide = Math.min(width, height)
  // Wheel ở y=66%: giới hạn theo khoảng trống thật phía dưới, không giả
  // định tâm nằm giữa viewport. Button nhỏ hơn cho phép vòng mở rộng mà vẫn
  // chừa mép màn hình; khoảng trống tâm phải đủ để không che sprite nhân vật.
  const bottomFit = height * 0.34 - 32
  return Math.max(168, Math.min(340, shortSide * 0.34, bottomFit))
}

function orbitRadius(orbitIndex: number): number {
  const outer = outerOrbitRadius()
  const innerRatio = 0.7
  const ratio = innerRatio + (orbitIndex / (ORBIT_COUNT - 1)) * (1 - innerRatio)

  return outer * ratio
}

const orbitIndexes = computed(() => Array.from({ length: ORBIT_COUNT }, (_, index) => index))

function orbitStyle(orbitIndex: number) {
  return {
    '--orbit-diameter': `${orbitRadius(orbitIndex) * 2}px`,
  }
}

function slotStyle(_slot: CommandWheelSlot, index: number, total: number) {
  const orbitIndex = index % ORBIT_COUNT
  const indexInOrbit = Math.floor(index / ORBIT_COUNT)
  const slotsInOrbit = Math.ceil((total - orbitIndex) / ORBIT_COUNT)
  const ringOffsetAngle = orbitIndex === 0 ? 0 : 180 / slotsInOrbit
  const endAngle = (indexInOrbit / slotsInOrbit) * 360 + ringOffsetAngle
  const direction = getCommandWheelOrbitDirection(orbitIndex)
  const startAngle =
    direction === 'clockwise' ? endAngle - ORBIT_SWEEP_DEGREES : endAngle + ORBIT_SWEEP_DEGREES

  return {
    '--orbit-radius': `${orbitRadius(orbitIndex)}px`,
    '--start-angle': `${startAngle}deg`,
    '--end-angle': `${endAngle}deg`,
    '--start-counter-angle': `${-startAngle}deg`,
    '--end-counter-angle': `${-endAngle}deg`,
  }
}

// ================= Fan-out — bật lớp ready sau 1 frame =================
const isVisible = ref(false)
const isReady = ref(false)
const isClosing = ref(false)

let readyHandle: number | undefined
let closeHandle: number | undefined

// Component sống cùng GameRoot, nên mỗi lần store chuyển closed → open
// phải render trạng thái co tại tâm trước, rồi mới bật class đích ở frame
// kế tiếp. Nếu chỉ set ready lúc component mount thì lần mở sau không còn
// transition và wheel cũng có thể hiện dù store đang đóng.
watch(
  () => ui.isCommandWheelOpen,
  async (isOpen) => {
    if (readyHandle !== undefined) {
      cancelAnimationFrame(readyHandle)
      readyHandle = undefined
    }

    if (!isOpen) {
      isReady.value = false

      if (!isVisible.value) {
        isClosing.value = false

        return
      }

      isClosing.value = true
      closeHandle = window.setTimeout(() => {
        closeHandle = undefined
        isVisible.value = false
        isClosing.value = false
      }, MOTION_DURATION_MS)

      return
    }

    if (closeHandle !== undefined) {
      clearTimeout(closeHandle)
      closeHandle = undefined
    }

    isVisible.value = true
    isReady.value = false
    isClosing.value = false

    await nextTick()

    if (!ui.isCommandWheelOpen) {
      return
    }

    readyHandle = window.requestAnimationFrame(() => {
      readyHandle = undefined
      isReady.value = true
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (readyHandle !== undefined) {
    cancelAnimationFrame(readyHandle)
  }

  if (closeHandle !== undefined) {
    clearTimeout(closeHandle)
  }
})

// ================= Keyboard toggle/close wheel ========================
function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    ui.closeCommandWheel()

    return
  }

  if (
    event.key === 'Tab' &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !stageActive.value &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault()
    ui.toggleCommandWheel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ================= Trạng thái active suy ra từ uiStore =================
function isActive(slot: CommandWheelSlot): boolean {
  const target = slot.target

  if (target?.kind === 'left_panel') {
    return ui.leftPanelMode === target.mode
  }

  if (target?.kind === 'standalone') {
    return ui.standalonePanel === target.panel
  }

  if (slot.buildingId) {
    const { template } = navigation.getBuildingPresentation(slot.buildingId)

    return (
      ui.activeBuildingPopoverId === slot.buildingId ||
      (template?.functionType !== undefined && ui.leftPanelMode === template.functionType)
    )
  }

  return false
}

function isUpgradeable(slot: CommandWheelSlot): boolean {
  return (
    slot.buildingId !== undefined &&
    navigation.getBuildingPresentation(slot.buildingId).isUpgradeable
  )
}

// Idle-conventions rework — badge "có việc mới" đầu tiên trong game
// (trước đợt này KHÔNG có pattern unseen/new nào). Đột Phá sẵn sàng
// (cultivationProgress >= 1, cùng điều kiện Character panel's "Có thể
// đột phá" — xem CharacterPanel.vue) là tín hiệu rõ ràng nhất hiện có
// để gắn lên slot Nhân Vật, không cần thêm state mới.
function hasBreakthroughBadge(slot: CommandWheelSlot): boolean {
  return slot.id === 'character' && player.cultivationProgress >= 1
}

// Chọn shortcut: đóng wheel TRƯỚC rồi mới mở panel/overlay tương ứng.
function activate(slot: CommandWheelSlot) {
  if (disabledReason(slot)) {
    return
  }

  ui.closeCommandWheel()

  if (slot.buildingId) {
    navigation.openBuilding(slot.buildingId)

    return
  }

  const target = slot.target

  if (!target) {
    return
  }

  if (target.kind === 'left_panel') {
    ui.openLeftPanel(target.mode)

    return
  }

  ui.openStandalonePanel(target.panel)
}
</script>

<template>
  <div
    class="command-wheel-layer"
    :class="{
      'is-visible': isVisible && !stageActive,
      'is-ready': isReady,
      'is-closing': isClosing,
    }"
    :aria-hidden="!isVisible || stageActive"
  >
    <!-- Vùng trống (backdrop) — click đóng wheel VÀ chặn click xuyên
         xuống hotspot bên dưới khi wheel đang mở (Workstream C). -->
    <div class="command-wheel-layer__backdrop" aria-hidden="true" @click="ui.closeCommandWheel()" />

    <div
      class="command-wheel"
      role="group"
      aria-label="Bảng lệnh Động Phủ"
      :class="{ 'is-ready': isReady, 'is-closing': isClosing }"
    >
      <span
        v-for="orbitIndex in orbitIndexes"
        :key="orbitIndex"
        class="command-wheel__orbit"
        :style="orbitStyle(orbitIndex)"
        aria-hidden="true"
      />

      <button
        v-for="(slot, index) in renderedSlots"
        :key="slot.id"
        type="button"
        class="command-wheel__slot"
        :class="[
          `command-wheel__slot--ring${slot.ring}`,
          { 'is-active': isActive(slot), 'is-upgradeable': isUpgradeable(slot), 'is-disabled': disabledReason(slot) },
        ]"
        :style="slotStyle(slot, index, renderedSlots.length)"
        :data-wheel-orbit="index % ORBIT_COUNT"
        :aria-label="slot.label"
        :data-wheel-slot="slot.id"
        :aria-disabled="Boolean(disabledReason(slot))"
        v-tooltip="disabledReason(slot) ?? undefined"
        @click="activate(slot)"
      >
        <span class="command-wheel__label">{{ slot.label }}</span>

        <span v-if="isUpgradeable(slot)" class="command-wheel__upgrade-dot" aria-hidden="true" />

        <NotificationBadge
          v-if="hasBreakthroughBadge(slot)"
          variant="dot"
          class="command-wheel__notification-badge"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.command-wheel-layer {
  position: absolute;
  inset: 0;
  /* Trên hotspot (z-index 5), dưới LeftPanel (10)/tooltip/combat overlay
     — wheel không được che panel, tooltip hay combat overlay. */
  z-index: 8;
  visibility: hidden;
  pointer-events: none;
}

.command-wheel-layer.is-visible {
  visibility: visible;
}

.command-wheel-layer.is-ready {
  pointer-events: auto;
}

.command-wheel-layer__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 6, 9, 0.42);
  cursor: pointer;
}

.command-wheel-layer.is-closing {
  pointer-events: none;
}

/* Tâm wheel = vị trí nhân vật tu luyện giữa Động Phủ (cùng tọa độ
   .home-player trong DongFuScene.vue). */
.command-wheel {
  position: absolute;
  left: 50%;
  top: 66%;
  width: 0;
  height: 0;
}

.command-wheel__orbit {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--orbit-diameter);
  height: var(--orbit-diameter);
  border: 1px solid color-mix(in srgb, var(--gold-500) 34%, transparent);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
  transition:
    opacity 0.24s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1);
}

.command-wheel.is-ready .command-wheel__orbit {
  opacity: 0.72;
  transform: translate(-50%, -50%) scale(1);
}

.command-wheel__slot {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  min-width: 57px;
  max-width: 81px;
  min-height: 57px;
  padding: 6px 8px;
  border: 1px solid var(--ink-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-900) 88%, transparent);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  text-align: center;
  cursor: pointer;
  transform: rotate(var(--start-angle)) translateY(0) rotate(var(--start-counter-angle))
    translate(-50%, -50%);
  opacity: 0;
  transition:
    opacity 0.32s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1),
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: transform, opacity;
  -webkit-tap-highlight-color: transparent;
}

/* Counter-rotation giữ chữ thẳng; alpha tăng từ 0 lên 1 trên toàn quỹ đạo. */
.command-wheel.is-ready .command-wheel__slot {
  opacity: 1;
  transform: rotate(var(--end-angle)) translateY(calc(-1 * var(--orbit-radius)))
    rotate(var(--end-counter-angle)) translate(-50%, -50%);
}

.command-wheel__slot:hover,
.command-wheel__slot:focus-visible {
  border-color: var(--gold-500);
  background: color-mix(in srgb, var(--ink-800) 92%, transparent);
  color: var(--gold-300);
}

.command-wheel__slot:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
}

/* Bản Mệnh Pháp Bảo (2026-08-27) — slot render được nhưng tạm chưa bấm
   được (disabledReason), khác hẳn "không tồn tại" (available=false,
   không render nút nào cả). */
.command-wheel__slot.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.command-wheel__slot.is-disabled:hover,
.command-wheel__slot.is-disabled:focus-visible {
  border-color: var(--ink-line);
  color: var(--text-primary);
}

/* Active state suy ra từ uiStore (panel/popover đang mở). */
.command-wheel__slot.is-active {
  border-color: var(--gold-500);
  background: rgba(255, 213, 79, 0.14);
  color: var(--gold-300);
}

/* Ring màu nhận diện nhẹ theo tầng. */
.command-wheel__slot--ring1 {
  border-left: 3px solid var(--gold-500);
}
.command-wheel__slot--ring2 {
  border-left: 3px solid var(--azure);
}
.command-wheel__slot--ring3 {
  border-left: 3px solid var(--jade);
}
.command-wheel__slot--ring4 {
  border-left: 3px solid var(--el-primordial);
}

/* Cùng indicator nâng cấp với hotspot (Workstream C). */
.command-wheel__upgrade-dot {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--gold-500);
}

.command-wheel__notification-badge {
  position: absolute;
  left: 6px;
  top: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .command-wheel__orbit,
  .command-wheel__slot {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }
}
</style>
