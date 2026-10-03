<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore } from '@/stores/notification'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { NotificationKind } from '@/core/notification/NotificationEvent'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { isMaxRankTone } from '@/core/profession/slotRank'
import { useAudioStore } from '@/stores/audio'

const notification = useNotificationStore()
const { t } = useI18n()

// Toast kind -> cue id (W7: manifest cue ids, not legacy SynthSoundId).
// Playing here (not in the store's push()) keeps the notification store
// free of audio deps and - more importantly - plays the sound at the
// moment the toast becomes visible, not when it is queued.
const KIND_SOUND: Record<NotificationKind, string> = {
  loot: 'ui.toast.loot',
  craft: 'ui.toast.craft',
  upgrade: 'ui.toast.upgrade',
  save: 'ui.toast.save',
  warning: 'ui.toast.warning',
  error: 'ui.toast.error',
}

watch(
  () => notification.toasts.map((toast) => toast.id),
  (ids, prevIds) => {
    const prev = new Set(prevIds)
    for (const toast of notification.toasts) {
      if (!prev.has(toast.id)) useAudioStore().cue(KIND_SOUND[toast.kind])
    }
  },
)

// Khớp token màu có sẵn trong assets/theme.css — không thêm token
// mới, tái dùng đúng bảng màu game đã có.
const KIND_COLOR: Record<NotificationKind, string> = {
  loot: 'var(--hk-jade)',
  craft: 'var(--hk-gold)',
  upgrade: 'var(--hk-gold)',
  save: 'var(--hk-jade-soft)',
  warning: 'var(--hk-gold)',
  error: 'var(--hk-cinnabar-bright)',
}

// Số toast hiện đồng thời tuỳ chiều cao màn hình thật — Teleport to
// body nên .toast-container KHÔNG nằm trong scale transform của
// .game-root (xem GameRoot.vue), window.innerHeight là đúng đơn vị.
// Chiều cao item lấy dư ra (46px) vì loot toast kèm icon + nội dung
// hai dòng render ~40-44px thực tế, không phải 32px như toast chữ trơn.
const TOAST_TOP_OFFSET_PX = 24
const TOAST_BOTTOM_MARGIN_PX = 24
const TOAST_ITEM_HEIGHT_PX = 46
const TOAST_GAP_PX = 4

// Hard cap on top of the height-derived count - a 720p viewport
// otherwise permits ~13 concurrent toasts, which reads as a pile
// down the right edge (e.g. on victory loot bursts).
const TOAST_MAX_VISIBLE = 6

function updateMaxVisible() {
  const availableHeight = window.innerHeight - TOAST_TOP_OFFSET_PX - TOAST_BOTTOM_MARGIN_PX
  const maxVisible = Math.floor((availableHeight + TOAST_GAP_PX) / (TOAST_ITEM_HEIGHT_PX + TOAST_GAP_PX))

  notification.setMaxVisible(Math.min(maxVisible, TOAST_MAX_VISIBLE))
}

onMounted(() => {
  updateMaxVisible()
  window.addEventListener('resize', updateMaxVisible)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMaxVisible)
})

// The "Chat - Name" naming model (2026-09-14) embeds the dash inside the
// composed name ("Chat - Name") - strip the prefix when deriving a
// monogram so the glyph starts with the item's own letter.
function lastNameText(name: string): string {
  const dashIndex = name.indexOf(' - ')
  return dashIndex === -1 ? name : name.slice(dashIndex + 3)
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" :style="{ zIndex: OVERLAY_LAYERS.toast }">
      <TransitionGroup name="toast">
        <div
          v-for="toast in notification.toasts"
          :key="toast.id"
          class="toast-item"
          :style="{ '--toast-color': toast.loot?.accentColorVar ? `var(${toast.loot.accentColorVar})` : KIND_COLOR[toast.kind] }"
          role="status"
        >
          <InkNineSlice chrome-id="frame-xs-tooltip" layer="surface" tint-var="var(--toast-color)" />
          <!-- UI-006 (Task 4, 2026-09-07) — toast message là live region
               (role="status"), dismiss là NÚT RIÊNG (keyboard/SR reachable)
               thay vì click div toàn toast. -->
          <GameButton
            variant="ghost"
            shape="circle"
            size="sm"
            class="toast-item__dismiss"
            :sound="false"
            :aria-label="t('toasts.dismissAria', { label: toast.loot ? toast.loot.name : toast.message ?? '' })"
            @click="notification.dismiss(toast.id)"
          >×</GameButton>
          <template v-if="toast.loot">
            <div class="toast-item__icon-shell">
              <span class="toast-item__icon-fallback">{{ lastNameText(toast.loot.name).charAt(0) }}</span>
              <img
                v-if="toast.loot.icon"
                class="toast-item__icon"
                :src="toast.loot.icon"
                alt=""
                @error="($event.currentTarget as HTMLImageElement).hidden = true"
              />
            </div>
            <div class="toast-item__content">
              <span class="toast-item__eyebrow">{{ t('toasts.received') }}</span>
              <!-- Single-color name + muted grade suffix (item-info-card
                   spec section 2): 'tien' tone upgrades to the rainbow
                   class. -->
              <span class="toast-item__name">
                <span
                  :class="{ 'toast-item__segment--max-rank': isMaxRankTone(toast.loot.nameTone) }"
                  :style="toast.loot.nameColorVar && !isMaxRankTone(toast.loot.nameTone) ? { color: `var(${toast.loot.nameColorVar})` } : undefined"
                >{{ toast.loot.name }}</span>
                <span v-if="toast.loot.gradeLabel" class="toast-item__grade">· {{ toast.loot.gradeLabel }}</span>
              </span>
            </div>
            <strong v-if="toast.loot.amountLabel" class="toast-item__amount">{{ toast.loot.amountLabel }}</strong>
          </template>
          <span v-else class="toast-item__message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  /* z-index via OVERLAY_LAYERS.toast (inline style). */
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.toast-item {
  position: relative;
  isolation: isolate;
  pointer-events: auto;
  min-width: 100px;
  max-width: 160px;
  padding: 5px 7px;
  border-left: 3px solid var(--toast-color, var(--hk-border-active));
  border-radius: var(--hk-radius-sm);
  overflow: hidden;
  color: var(--hk-text-primary);
  font-family: var(--hk-font-ui);
  /* UI-006 (Task 4) — toast text dài (vi/en) tự xuống dòng, không tràn. */
  overflow-wrap: anywhere;
}

/* Chrome slice stays under the content (same lift as ConfirmModal);
   the dismiss rule below overrides its own z back up to 4. */
.toast-item > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

/* GameButton ghost-circle chrome; nested under .toast-item so the size
   overrides beat the component's own scoped rules. */
.toast-item .toast-item__dismiss {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 4;
  width: 20px;
  height: 20px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--hk-text-secondary);
  font: 700 var(--text-sm) / 1 var(--hk-font-ui);
  cursor: pointer;
}

.toast-item {
  font-size: var(--text-xs);
  cursor: default;
  box-shadow: 0 2px 12px var(--hk-shadow-low);
}

.toast-item:has(.toast-item__content) {
  display: grid;
  grid-template-columns: 21px minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  min-width: 140px;
}

.toast-item__icon-shell {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--toast-color) 55%, var(--hk-border-muted));
  border-radius: var(--hk-radius-sm);
  background: linear-gradient(145deg, var(--hk-surface-raised), var(--hk-surface-base));
}

.toast-item__icon,
.toast-item__icon-fallback {
  grid-area: 1 / 1;
}

.toast-item__icon {
  width: 100%;
  height: 100%;
  padding: 2px;
  box-sizing: border-box;
  object-fit: contain;
  background: linear-gradient(145deg, var(--hk-surface-raised), var(--hk-surface-base));
}

.toast-item__icon-fallback {
  color: var(--toast-color);
  font: 700 var(--text-xs) var(--hk-font-display);
}

.toast-item__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.toast-item__eyebrow {
  color: var(--hk-text-muted);
  font-size: var(--text-xs);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.toast-item__name {
  overflow: hidden;
  font-family: var(--hk-font-display);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Muted Pham suffix after the loot name (item-info-card spec section 2). */
.toast-item__grade {
  color: var(--hk-text-muted);
  font-weight: 400;
}

/* Max-rank (tien) name - rainbow gradient text, replaces nameColorVar. */
.toast-item__segment--max-rank {
  color: transparent;
  background: var(--rank-gradient-10);
  background-clip: text;
  -webkit-background-clip: text;
}

.toast-item__amount {
  color: var(--toast-color);
  font-variant-numeric: tabular-nums;
}

.toast-enter-active {
  transition: transform var(--hk-motion-scene) var(--hk-ease-standard), opacity var(--hk-motion-scene) var(--hk-ease-standard);
}

.toast-leave-active {
  transition: transform var(--hk-motion-scene) ease-in, opacity var(--hk-motion-scene) ease-in;
  position: absolute;
}

.toast-move {
  transition: transform var(--hk-motion-panel) var(--hk-ease-standard);
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(56px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: none;
  }
}

</style>
