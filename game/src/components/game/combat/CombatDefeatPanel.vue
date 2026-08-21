<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { formatNumber } from '@/core/format/NumberFormatter'

// Combat UI Redesign mục 18/23 — CHỈ 1 nút "Về Động Phủ", không đánh
// lại/auto retry/đổi build. Auto Battle DỪNG NGAY (spec mục 17/23).
const gameManager = useGameManager()
const ui = useUiStore()

const summary = computed(() => gameManager.getBattleRewardSummary())

const hasAnyReward = computed(() =>
  summary.value.experience > 0 || summary.value.spiritStone > 0 || summary.value.cultivation > 0 || summary.value.items.length > 0,
)

function returnHome() {
  ui.isAuto = false
  ui.exitCombatScene()
  gameManager.eventBus.emit('combat_scene_exit', undefined)
}
</script>

<template>
  <div class="combat-defeat-panel">
    <h2 class="combat-defeat-panel__title">☠ THẤT BẠI</h2>

    <div v-if="hasAnyReward" class="combat-defeat-panel__rewards">
      <p v-if="summary.experience > 0">EXP <span>+{{ formatNumber(summary.experience) }}</span></p>
      <p v-if="summary.spiritStone > 0">Linh Thạch <span>+{{ formatNumber(summary.spiritStone) }}</span></p>
      <p v-if="summary.cultivation > 0">Tu Vi <span>+{{ formatNumber(summary.cultivation) }}</span></p>
      <p v-for="item in summary.items" :key="`${item.kind}-${item.itemId}`">{{ item.name }} <span>+{{ formatNumber(item.amount) }}</span></p>
    </div>

    <button type="button" class="combat-defeat-panel__return" @click="returnHome">Về Động Phủ</button>
  </div>
</template>

<style scoped>
.combat-defeat-panel {
  width: 420px;
  padding: 28px 32px;
  background: var(--ink-900);
  border: 1px solid var(--crimson);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.combat-defeat-panel__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  color: var(--crimson);
  font-size: 1.3rem;
}

.combat-defeat-panel__rewards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.combat-defeat-panel__rewards p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.combat-defeat-panel__rewards p span {
  color: var(--jade);
  font-weight: 700;
}

.combat-defeat-panel__return {
  width: 100%;
  padding: 10px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.combat-defeat-panel__return:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}
</style>
