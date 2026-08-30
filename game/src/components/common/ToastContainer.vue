<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import type { NotificationKind } from '@/core/notification/NotificationEvent'
import { isMaxRankTone } from '@/composables/slots/normalizeSlotRank'

const notification = useNotificationStore()

// Khớp token màu có sẵn trong assets/theme.css — không thêm token
// mới, tái dùng đúng bảng màu game đã có.
const KIND_COLOR: Record<NotificationKind, string> = {
  loot: 'var(--jade)',
  craft: 'var(--mineral-gold)',
  upgrade: 'var(--mineral-gold)',
  save: 'var(--azure)',
  warning: 'var(--gold-700)',
  error: 'var(--crimson)',
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

function updateMaxVisible() {
  const availableHeight = window.innerHeight - TOAST_TOP_OFFSET_PX - TOAST_BOTTOM_MARGIN_PX
  const maxVisible = Math.floor((availableHeight + TOAST_GAP_PX) / (TOAST_ITEM_HEIGHT_PX + TOAST_GAP_PX))

  notification.setMaxVisible(maxVisible)
}

onMounted(() => {
  updateMaxVisible()
  window.addEventListener('resize', updateMaxVisible)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMaxVisible)
})
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in notification.toasts"
          :key="toast.id"
          class="toast-item"
          :style="{ '--toast-color': toast.loot?.accentColorVar ? `var(${toast.loot.accentColorVar})` : KIND_COLOR[toast.kind] }"
          @click="notification.dismiss(toast.id)"
        >
          <template v-if="toast.loot">
            <div class="toast-item__icon-shell">
              <span class="toast-item__icon-fallback">{{ toast.loot.nameSegments.at(-1)?.text.charAt(0) }}</span>
              <img
                v-if="toast.loot.icon"
                class="toast-item__icon"
                :src="toast.loot.icon"
                alt=""
                @error="($event.currentTarget as HTMLImageElement).hidden = true"
              />
            </div>
            <div class="toast-item__content">
              <span class="toast-item__eyebrow">Nhận được</span>
              <span class="toast-item__name">
                <template v-for="(segment, index) in toast.loot.nameSegments" :key="`${index}-${segment.text}`">
                  <span v-if="index > 0" class="toast-item__separator"> · </span>
                  <span
                    :class="{ 'toast-item__segment--max-rank': isMaxRankTone(segment.tone) }"
                    :style="segment.colorVar ? { color: `var(${segment.colorVar})` } : undefined"
                  >{{ segment.text }}</span>
                </template>
              </span>
            </div>
            <strong v-if="toast.loot.amountLabel" class="toast-item__amount">{{ toast.loot.amountLabel }}</strong>
          </template>
          <template v-else>{{ toast.message }}</template>
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
  z-index: 1500;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  min-width: 100px;
  max-width: 160px;
  padding: 5px 7px;
  background:
    var(--paper-grain) 0 0 / 100px 100px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
  border: 1px solid var(--toast-color, var(--frame-outer));
  border-left: 3px solid var(--toast-color, var(--frame-outer));
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
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
  border: 1px solid color-mix(in srgb, var(--toast-color) 55%, var(--ink-line));
  border-radius: var(--radius-sm);
  background: linear-gradient(145deg, var(--ink-700), var(--ink-950));
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
  background: linear-gradient(145deg, var(--ink-700), var(--ink-950));
}

.toast-item__icon-fallback {
  color: var(--toast-color);
  font: 700 var(--text-xs) var(--font-display);
}

.toast-item__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.toast-item__eyebrow {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.toast-item__name {
  overflow: hidden;
  font-family: var(--font-display);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-item__separator {
  color: var(--paper-text-muted);
}

.toast-item__segment--max-rank {
  color: transparent !important;
  background: var(--rank-gradient-9);
  background-clip: text;
  -webkit-background-clip: text;
}

.toast-item__amount {
  color: var(--toast-color);
  font-variant-numeric: tabular-nums;
}

.toast-enter-active {
  transition: transform 0.4s ease-out, opacity 0.4s ease-out;
}

.toast-leave-active {
  transition: transform 0.7s ease-in, opacity 0.7s ease-in;
  position: absolute;
}

.toast-move {
  transition: transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(56px);
  opacity: 0;
}

</style>
