<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import type { CombatEvent } from '@/core/combat/CombatEvent'

// Combat UI Redesign mục 10 — feed nhỏ cuộn ngang, KHÔNG phải combat
// log chi tiết (damage thường vẫn hiện trực tiếp trên quái qua
// CombatScene.ts's showFloatingText, không lặp lại ở đây). Chỉ 3 loại
// event "đáng chú ý": phản ứng ngũ hành (reaction), Chí Mạng (critical),
// Hạ Gục (kill).
// Combat Balance Pass (2026-08-29, plan §3.7) — dọn emoji: thay 💥☠🔥
// bằng glyph CSS đúng tông Ink & Gold (mỗi reaction một glyph riêng).
interface EventEntry {
  id: number
  glyph: string
  label: string
}

const MAX_ENTRIES = 6
const ENTRY_LIFETIME_MS = 3500

const gameManager = useGameManager()
const entries = ref<EventEntry[]>([])

let nextId = 0

function pushEntry(glyph: string, label: string) {
  const id = nextId++

  entries.value.push({ id, glyph, label })

  if (entries.value.length > MAX_ENTRIES) {
    entries.value.shift()
  }

  setTimeout(() => {
    entries.value = entries.value.filter(entry => entry.id !== id)
  }, ENTRY_LIFETIME_MS)
}

function onCritical() {
  pushEntry('crit', 'Chí Mạng')
}

function onKill() {
  pushEntry('kill', 'Hạ Gục')
}

const REACTION_GLYPH: Record<string, string> = {
  'Bốc Hơi': 'reaction-boc-hoi',
  'Lôi Viêm': 'reaction-loi-viem',
  'Độc Viêm': 'reaction-doc-viem',
  'Độc Thủy': 'reaction-doc-thuy',
  'Dung Nham': 'reaction-dung-nham',
  'Trói Chân': 'reaction-troi-chan',
  'Độc Thế': 'reaction-doc-the',
  'Thiêu Huyết': 'reaction-thieu-huyet',
  'Huyết Độc': 'reaction-huyet-doc',
}

function onReaction(event: { name?: string }) {
  const name = event.name ?? 'Phản Ứng'
  const glyph = REACTION_GLYPH[name] ?? 'reaction-generic'

  pushEntry(glyph, name)
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
        <span :class="['combat-event-bar__glyph', `combat-event-bar__glyph--${entry.glyph}`]" aria-hidden="true" />
        {{ entry.label }}
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
  background: color-mix(in srgb, var(--ink-950) 50%, transparent);
  overflow: hidden;
  pointer-events: none;
}

.combat-event-bar__list {
  display: flex;
  align-items: center;
  gap: 14px;
}

.combat-event-bar__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Glyph CSS thuần theo tông Ink & Gold — hình học đơn giản, không emoji,
   không asset. Mỗi reaction 1 glyph riêng (plan §3.7). */
.combat-event-bar__glyph {
  --gl: var(--gold-400, #c9a45c);
  width: 10px;
  height: 10px;
  display: inline-block;
  flex: none;
  position: relative;
}

.combat-event-bar__glyph--crit {
  background: radial-gradient(circle, var(--gl) 0 40%, transparent 41%);
  border-radius: 50%;
}

.combat-event-bar__glyph--kill {
  width: 9px;
  height: 9px;
  background: var(--gl);
  transform: rotate(45deg);
}

.combat-event-bar__glyph--reaction-boc-hoi {
  width: 10px;
  height: 6px;
  border-radius: 50%;
  background: var(--gl);
}

.combat-event-bar__glyph--reaction-loi-viem {
  width: 2px;
  height: 10px;
  background: var(--gl);
  box-shadow: 4px 2px 0 0 var(--gl);
}

.combat-event-bar__glyph--reaction-doc-viem {
  width: 10px;
  height: 10px;
  border: 2px solid var(--gl);
  border-radius: 50%;
}

.combat-event-bar__glyph--reaction-doc-thuy {
  width: 8px;
  height: 8px;
  border: 2px solid var(--gl);
  transform: rotate(45deg);
}

.combat-event-bar__glyph--reaction-dung-nham {
  width: 10px;
  height: 10px;
  background: linear-gradient(45deg, var(--gl) 0 25%, transparent 25% 75%, var(--gl) 75% 100%);
}

.combat-event-bar__glyph--reaction-troi-chan {
  width: 10px;
  height: 2px;
  background: var(--gl);
  box-shadow: 0 4px 0 0 var(--gl);
}

.combat-event-bar__glyph--reaction-doc-the {
  width: 10px;
  height: 10px;
  border-bottom: 2px solid var(--gl);
  border-left: 2px solid var(--gl);
  transform: rotate(-45deg);
}

.combat-event-bar__glyph--reaction-thieu-huyet {
  width: 10px;
  height: 10px;
  background: radial-gradient(circle, transparent 0 30%, var(--gl) 31% 45%, transparent 46%);
  border: 2px solid var(--gl);
  border-radius: 50%;
}

.combat-event-bar__glyph--reaction-huyet-doc {
  width: 2px;
  height: 10px;
  background: var(--gl);
  transform: rotate(45deg);
}

.combat-event-bar__glyph--reaction-generic {
  width: 10px;
  height: 10px;
  border: 2px solid var(--gl);
  transform: rotate(45deg);
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
