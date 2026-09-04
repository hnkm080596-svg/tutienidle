<script setup lang="ts">
// Slice 7 extension (Completion Task 11) — turn-order strip: "ai sắp tới
// lượt" (đặc trưng HSR/FF ATB). Render peekUpcomingActors(battle, 5),
// refresh theo stateVersion (không setInterval riêng).
import { computed } from 'vue'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'

const { isBattleFighting, upcomingActors } = useTurnBattleInfo()

const visible = computed(() => isBattleFighting.value)

function label(index: number): string {
  const actor = upcomingActors.value[index]

  if (!actor) {
    return ''
  }

  return index === 0 ? '▶ ' : ''
}
</script>

<template>
  <div v-if="visible && upcomingActors.length > 0" class="turn-order-strip">
    <span class="turn-order-strip__title">Lượt tới</span>

    <ol class="turn-order-strip__list">
      <li
        v-for="(actor, index) in upcomingActors"
        :key="`${actor.id}-${index}`"
        class="turn-order-strip__item"
        :class="{ 'is-current': index === 0 }"
      >
        {{ label(index) }}{{ actor.entity.name || actor.id }}
      </li>
    </ol>
  </div>
</template>

<style scoped>
.turn-order-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  font-size: var(--text-xs, 12px);
}

.turn-order-strip__title {
  color: var(--text-muted, #999);
}

.turn-order-strip__list {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.turn-order-strip__item {
  padding: 2px 8px;
  border: 1px solid var(--ink-800, #333);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink-950, #111) 70%, transparent);
  color: var(--text-primary, #eee);
  white-space: nowrap;
}

.turn-order-strip__item.is-current {
  border-color: var(--jade, #4caf50);
  color: var(--jade, #4caf50);
}
</style>
