<script setup lang="ts">
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import type { ActionFeedbackTone } from '@/stores/actionFeedback'

// Workstream A §4.3 — "Nhật ký thao tác": phản hồi cho action gameplay
// (Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện, xây công trình, đột phá...),
// tách khỏi toast loot (ToastContainer.vue) neo góc trên phải. Neo góc
// dưới phải, không che combat control/modal (z-index thấp hơn modal).
const feedback = useActionFeedbackStore()

const TONE_COLOR: Record<ActionFeedbackTone, string> = {
  success: 'var(--jade)',
  warning: 'var(--chrome-300)',
  error: 'var(--crimson)',
}
</script>

<template>
  <Teleport to="body">
    <div class="feedback-log" role="log" aria-live="polite" aria-relevant="additions">
      <div class="feedback-log__header">
        <span>Nhật ký thao tác</span>

        <div class="feedback-log__controls">
          <button
            v-if="feedback.entries.length > 0"
            type="button"
            class="feedback-log__btn"
            @click="feedback.clear()"
          >
            Xóa
          </button>

          <button type="button" class="feedback-log__btn" @click="feedback.toggleCollapsed()">
            {{ feedback.collapsed ? 'Mở' : 'Thu gọn' }}
          </button>
        </div>
      </div>

      <TransitionGroup v-if="!feedback.collapsed" name="feedback-entry" tag="div" class="feedback-log__list">
        <div
          v-for="(entry, index) in feedback.entries"
          :key="entry.id"
          class="feedback-log__entry"
          :class="{ 'is-latest': index === feedback.entries.length - 1 }"
          :style="{ '--entry-color': TONE_COLOR[entry.tone] }"
        >
          <span class="feedback-log__message">{{ entry.message }}</span>
          <span v-if="entry.count > 1" class="feedback-log__count">×{{ entry.count }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.feedback-log {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  width: min(320px, 90vw);
  gap: 6px;
  pointer-events: none;
}

.feedback-log__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--ink-900) 85%, transparent);
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  pointer-events: auto;
}

.feedback-log__controls {
  display: flex;
  gap: 6px;
}

.feedback-log__btn {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
}

.feedback-log__btn:hover {
  color: var(--text-primary);
}

.feedback-log__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feedback-log__entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--entry-color, var(--ink-line));
  border-left: 3px solid var(--entry-color, var(--ink-line));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--ink-900) 92%, transparent);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  opacity: 0.75;
  pointer-events: auto;
}

.feedback-log__entry.is-latest {
  opacity: 1;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.feedback-log__count {
  flex-shrink: 0;
  color: var(--entry-color);
  font-variant-numeric: tabular-nums;
}

.feedback-entry-enter-active,
.feedback-entry-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.feedback-entry-enter-from,
.feedback-entry-leave-to {
  transform: translateY(12px);
  opacity: 0;
}
</style>
