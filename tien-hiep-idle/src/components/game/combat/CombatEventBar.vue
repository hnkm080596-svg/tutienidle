<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import type { CombatEvent } from '@/core/combat/CombatEvent'

// Combat UI Redesign mục 10 — feed nhỏ cuộn ngang, KHÔNG phải combat
// log chi tiết (damage thường vẫn hiện trực tiếp trên quái qua
// CombatScene.ts's showFloatingText, không lặp lại ở đây). Chỉ 3 loại
// event "đáng chú ý": phản ứng ngũ hành (reaction — 🔥/⚡/☠ tuỳ tên),
// Chí Mạng (critical), Hạ Gục (kill).
interface EventEntry {
  id: number
  icon: string
  label: string
}

const MAX_ENTRIES = 6
const ENTRY_LIFETIME_MS = 3500

const gameManager = useGameManager()
const entries = ref<EventEntry[]>([])

let nextId = 0

function pushEntry(icon: string, label: string) {
  const id = nextId++

  entries.value.push({ id, icon, label })

  if (entries.value.length > MAX_ENTRIES) {
    entries.value.shift()
  }

  setTimeout(() => {
    entries.value = entries.value.filter(entry => entry.id !== id)
  }, ENTRY_LIFETIME_MS)
}

function onCritical() {
  pushEntry('💥', 'Chí Mạng')
}

function onKill() {
  pushEntry('☠', 'Hạ Gục')
}

function onReaction(event: { name?: string }) {
  pushEntry('🔥', event.name ?? 'Phản Ứng')
}

onMounted(() => {
  gameManager.eventBus.on<CombatEvent>('critical', onCritical)
  gameManager.eventBus.on<CombatEvent>('kill', onKill)
  gameManager.eventBus.on<{ name?: string }>('reaction', onReaction)
})

onUnmounted(() => {
  gameManager.eventBus.off<CombatEvent>('critical', onCritical)
  gameManager.eventBus.off<CombatEvent>('kill', onKill)
  gameManager.eventBus.off<{ name?: string }>('reaction', onReaction)
})
</script>

<template>
  <div class="combat-event-bar">
    <TransitionGroup name="combat-event-bar__item" tag="div" class="combat-event-bar__list">
      <span v-for="entry in entries" :key="entry.id" class="combat-event-bar__item">
        {{ entry.icon }} {{ entry.label }}
      </span>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.combat-event-bar {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: rgba(10, 10, 13, 0.5);
  border-bottom: 1px solid var(--ink-line-soft);
  overflow: hidden;
  pointer-events: none;
}

.combat-event-bar__list {
  display: flex;
  align-items: center;
  gap: 14px;
}

.combat-event-bar__item {
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.combat-event-bar__item-enter-active,
.combat-event-bar__item-leave-active {
  transition: opacity 0.25s ease;
}

.combat-event-bar__item-enter-from,
.combat-event-bar__item-leave-to {
  opacity: 0;
}
</style>
