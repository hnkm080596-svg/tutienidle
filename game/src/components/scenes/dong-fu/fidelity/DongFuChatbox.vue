<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore, type ChatLogEntry } from '@/stores/notification'
import type { NotificationKind } from '@/core/notification/NotificationEvent'
import { isMaxRankTone } from '@/core/profession/slotRank'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

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
  <section
    class="df-chatbox"
    :class="{ 'is-expanded': expanded }"
    :aria-label="t('dongFu.chatbox.aria')"
    data-df-ui
    data-testid="dong-fu-chatbox"
  >
    <InkNineSlice chrome-id="surface-l-drawer" layer="surface" />

    <header class="df-chatbox__header">
      <span class="df-chatbox__title">{{ t('dongFu.chatbox.title') }}</span>
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
    </header>

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
  </section>
</template>

<style scoped>
.df-chatbox {
  position: absolute;
  right: 30px;
  bottom: 18px;
  width: 345px;
  z-index: 6;
  isolation: isolate;
  padding: 10px 14px 12px;
  color: #f1e6c5;
  font-family: var(--pc-font-body, Georgia, serif);
  transition: max-height 180ms ease;
}

.df-chatbox > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.df-chatbox__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201, 166, 106, 0.42);
}

.df-chatbox__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--df-gold-light, #ebd094);
  white-space: nowrap;
}

.df-chatbox__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-chatbox__tab {
  padding: 2px 7px;
  border: 1px solid rgba(189, 163, 99, 0.35);
  background: rgba(24, 21, 15, 0.65);
  color: #bfb293;
  font-size: 11px;
  cursor: pointer;
}

.df-chatbox__tab.is-active {
  border-color: #d6a852;
  background: rgba(214, 168, 82, 0.22);
  color: #ffeab3;
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
  border: 1px solid rgba(189, 163, 99, 0.4);
  background: rgba(28, 24, 16, 0.75);
  color: #e4cfa0;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.df-chatbox__icon-btn:hover {
  color: #fff2cc;
  border-color: #e4cfa0;
}

.df-chatbox__list {
  margin-top: 6px;
  max-height: 98px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 1.4;
  scrollbar-width: thin;
}

.df-chatbox.is-expanded .df-chatbox__list {
  max-height: 215px;
}

.df-chatbox__empty {
  margin: 0;
  padding: 8px 2px;
  color: #a99f86;
  font-style: italic;
  font-size: 12px;
}

.df-chatbox__line {
  padding: 2px 4px;
  border-radius: 3px;
  background: rgba(14, 13, 10, 0.36);
  overflow-wrap: anywhere;
}

.df-chatbox__time {
  color: #93886f;
  margin-right: 4px;
  font-size: 11px;
}

.df-chatbox__tag {
  font-weight: 700;
  margin-right: 5px;
  color: #d6a852;
}

.df-chatbox__line--loot .df-chatbox__tag {
  color: #7ee2a8;
}

.df-chatbox__line--warning .df-chatbox__tag {
  color: #f3c462;
}

.df-chatbox__line--error .df-chatbox__tag {
  color: #ff7b72;
}

.df-chatbox__prefix {
  color: #cfc2a3;
}

.df-chatbox__loot-item {
  font-weight: 600;
  color: #f4e6c1;
}

.df-chatbox__loot-item--max-rank {
  background: linear-gradient(90deg, #ff9a9e, #fad0c4, #fbc2eb, #a18cd1, #84fab0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.df-chatbox__loot-grade {
  color: #b7aa8c;
  font-size: 11px;
}

.df-chatbox__loot-amount {
  color: #ffe399;
  font-weight: 700;
}

.df-chatbox__text {
  color: #e9dec0;
}
</style>
