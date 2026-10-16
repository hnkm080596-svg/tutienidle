<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore, type ChatLogEntry } from '@/stores/notification'
import type { NotificationKind } from '@/core/notification/NotificationEvent'
import { isMaxRankTone } from '@/core/profession/slotRank'
import GamePanel from '@/components/common/GamePanel.vue'

const { t } = useI18n()
const notification = useNotificationStore()

type ChatFilter = 'all' | 'loot' | 'system'

const activeFilter = ref<ChatFilter>('all')
const expanded = ref(false)
const listEl = ref<HTMLElement | null>(null)

const KIND_TAG_KEY: Record<NotificationKind, string> = {
  loot: 'dongFu.chatbox.tags.loot',
  craft: 'dongFu.chatbox.tags.craft',
  upgrade: 'dongFu.chatbox.tags.upgrade',
  save: 'dongFu.chatbox.tags.save',
  warning: 'dongFu.chatbox.tags.warning',
  error: 'dongFu.chatbox.tags.error',
}

const filteredEntries = computed<ChatLogEntry[]>(() => {
  const all = notification.logEntries
  if (activeFilter.value === 'loot') {
    return all.filter((entry) => entry.kind === 'loot' || entry.kind === 'craft')
  }
  if (activeFilter.value === 'system') {
    return all.filter((entry) => entry.kind !== 'loot' && entry.kind !== 'craft')
  }
  return all
})

function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

watch(
  () => notification.logEntries.length,
  async () => {
    await nextTick()
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight
    }
  },
)
</script>

<template>
  <GamePanel
    class="df-chatbox"
    :class="{ 'is-expanded': expanded }"
    :title="t('dongFu.chatbox.title')"
    :aria-label="t('dongFu.chatbox.aria')"
    data-df-ui
    data-testid="dong-fu-chatbox"
  >
    <div class="df-chatbox__toolbar">
      <div class="df-chatbox__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeFilter === 'all' }"
          :aria-selected="activeFilter === 'all'"
          @click="activeFilter = 'all'"
        >
          {{ t('dongFu.chatbox.filters.all') }}
        </button>
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeFilter === 'loot' }"
          :aria-selected="activeFilter === 'loot'"
          @click="activeFilter = 'loot'"
        >
          {{ t('dongFu.chatbox.filters.loot') }}
        </button>
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeFilter === 'system' }"
          :aria-selected="activeFilter === 'system'"
          @click="activeFilter = 'system'"
        >
          {{ t('dongFu.chatbox.filters.system') }}
        </button>
      </div>
      <div class="df-chatbox__actions">
        <button
          v-if="notification.logEntries.length > 0"
          type="button"
          class="df-chatbox__icon-btn"
          :title="t('dongFu.chatbox.clear')"
          :aria-label="t('dongFu.chatbox.clear')"
          @click="notification.clearLog()"
        >
          ×
        </button>
        <button
          type="button"
          class="df-chatbox__icon-btn"
          :aria-label="t(expanded ? 'dongFu.chatbox.collapse' : 'dongFu.chatbox.expand')"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? '▼' : '▲' }}
        </button>
      </div>
    </div>

    <div ref="listEl" class="df-chatbox__list" role="log" aria-live="polite" aria-relevant="additions">
      <p v-if="!filteredEntries.length" class="df-chatbox__empty">
        {{ t('dongFu.chatbox.empty') }}
      </p>
      <div
        v-for="entry in filteredEntries"
        :key="entry.id"
        class="df-chatbox__line"
        :class="`df-chatbox__line--${entry.kind}`"
      >
        <span class="df-chatbox__time">{{ formatTime(entry.timestampMs) }}</span>
        <span class="df-chatbox__tag">[{{ t(KIND_TAG_KEY[entry.kind]) }}]</span>
        <span v-if="entry.lootItems.length > 0" class="df-chatbox__loot-group">
          <span class="df-chatbox__prefix">{{ t('toasts.received') }}: </span>
          <template v-for="(seg, idx) in entry.lootItems" :key="`${seg.name}-${idx}`">
            <span v-if="idx > 0" class="df-chatbox__comma">, </span>
            <span
              class="df-chatbox__loot-item"
              :class="{ 'df-chatbox__loot-item--max-rank': isMaxRankTone(seg.nameTone) }"
              :style="seg.nameColorVar && !isMaxRankTone(seg.nameTone) ? { color: `var(${seg.nameColorVar})` } : undefined"
            >{{ seg.name }}</span>
            <span v-if="seg.gradeLabel" class="df-chatbox__loot-grade"> ({{ seg.gradeLabel }})</span>
            <strong v-if="seg.amountLabel" class="df-chatbox__loot-amount"> {{ seg.amountLabel }}</strong>
          </template>
        </span>
        <span v-else class="df-chatbox__text">{{ entry.message }}</span>
      </div>
    </div>
  </GamePanel>
</template>

<style scoped>
.df-chatbox.game-panel {
  --game-panel-header-top: 8px;
  --game-panel-line-bottom: 24px;
  position: absolute;
  left: auto;
  top: auto;
  right: 30px;
  bottom: 18px;
  width: 356px;
  height: 192px;
  z-index: 6;
  box-shadow: 0 8px 24px rgba(10, 8, 4, 0.55);
  transition: height 180ms ease;
}

.df-chatbox.game-panel.is-expanded {
  height: 308px;
}

.df-chatbox :deep(.game-panel__header) {
  inset: 8px 12px auto;
  height: 30px;
}

.df-chatbox :deep(.game-panel__title) {
  height: 24px;
  font-size: 22px;
  line-height: 24px;
}

.df-chatbox :deep(.game-panel__line) {
  bottom: 0;
}

.df-chatbox :deep(.game-panel__content) {
  inset: 42px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.df-chatbox__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex: none;
}

.df-chatbox__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-chatbox__tab {
  padding: 2px 8px;
  border: 1px solid #b39a68;
  background: #ede0c4;
  color: #5c492c;
  font-size: 11px;
  cursor: pointer;
}

.df-chatbox__tab.is-active {
  border-color: #8a6420;
  background: #302519;
  color: #f4e4c1;
  font-weight: 600;
}

.df-chatbox__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-chatbox__icon-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #b39a68;
  background: #ede0c4;
  color: #302519;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.df-chatbox__icon-btn:hover {
  background: #decba2;
  border-color: #8a6420;
}

.df-chatbox__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--pc-font-body, Georgia, serif);
  font-size: 12px;
  line-height: 1.4;
  scrollbar-width: thin;
  scrollbar-color: #a18547 transparent;
}

.df-chatbox__empty {
  margin: 0;
  padding: 8px 2px;
  color: #675637;
  font-style: italic;
  font-size: 12px;
}

.df-chatbox__line {
  padding: 3px 6px;
  border-radius: 2px;
  background: rgba(178, 138, 67, 0.14);
  border-left: 2px solid #b28a43;
  color: #302519;
  overflow-wrap: anywhere;
}

.df-chatbox__time {
  color: #675637;
  margin-right: 4px;
  font-size: 11px;
}

.df-chatbox__tag {
  font-weight: 700;
  margin-right: 5px;
  color: #8a5a19;
}

.df-chatbox__line--loot {
  border-left-color: #287257;
}

.df-chatbox__line--loot .df-chatbox__tag {
  color: #1f6b50;
}

.df-chatbox__line--warning {
  border-left-color: #b87314;
}

.df-chatbox__line--warning .df-chatbox__tag {
  color: #9e5f0b;
}

.df-chatbox__line--error {
  border-left-color: #a63628;
}

.df-chatbox__line--error .df-chatbox__tag {
  color: #a63628;
}

.df-chatbox__prefix {
  color: #5c492c;
}

.df-chatbox__loot-item {
  font-weight: 600;
  color: #302519;
}

.df-chatbox__loot-item--max-rank {
  background: linear-gradient(90deg, #b33225, #8a5a19, #287257, #5b3882);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.df-chatbox__loot-grade {
  color: #675637;
  font-size: 11px;
}

.df-chatbox__loot-amount {
  color: #6b3f08;
  font-weight: 700;
}

.df-chatbox__text {
  color: #302519;
}
</style>
