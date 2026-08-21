<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { MAX_RAGE, MAX_SWORD_INTENT } from '@/core/combat/CombatTypes'
import type { CombatEvent } from '@/core/combat/CombatEvent'
import { formatNumber } from '@/core/format/NumberFormatter'

// Combat UI Redesign — kế thừa nguyên logic target-bar/player-bars từ
// CombatHud.vue cũ (đã retire, xem GameRoot.vue), chỉ đổi layout từ
// overlay-tự-do (position:absolute theo top/bottom riêng) sang 1
// THANH ngang cố định dưới CombatTopBar (spec mục 9). Không còn tự
// gate theo state==='fighting' — cha (CombatSceneOverlay.vue) đã gate
// isCombatSceneActive rồi, thanh này cứ hiện xuyên suốt cả lúc
// victory/defeat (đứng yên ở giá trị cuối, khớp modal kết quả đang
// hiện đè lên).
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const battle = computed(() => {
  stateVersion.value

  return gameManager.getBattle()
})

const TARGET_BAR_TIMEOUT_MS = 4000

const lastHitEnemyId = ref<string | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | undefined

function onDamage(event: CombatEvent) {
  const activeBattle = gameManager.getBattle()

  if (!activeBattle || event.sourceId !== activeBattle.player.id || !event.targetId) {
    return
  }

  lastHitEnemyId.value = event.targetId

  if (hideTimer) {
    clearTimeout(hideTimer)
  }

  hideTimer = setTimeout(() => {
    lastHitEnemyId.value = null
  }, TARGET_BAR_TIMEOUT_MS)
}

onMounted(() => {
  gameManager.eventBus.on<CombatEvent>('damage', onDamage)
})

onUnmounted(() => {
  gameManager.eventBus.off<CombatEvent>('damage', onDamage)

  if (hideTimer) {
    clearTimeout(hideTimer)
  }
})

const priorityEnemy = computed(() => {
  stateVersion.value

  const activeBattle = battle.value

  if (!activeBattle) {
    return undefined
  }

  const boss = activeBattle.enemies.find(enemy => enemy.entity.isBoss && enemy.entity.alive)?.entity

  if (boss) {
    return boss
  }

  return activeBattle.enemies.find(enemy => enemy.entity.isElite && enemy.entity.alive)?.entity
})

const isBossTarget = computed(() => {
  stateVersion.value

  return priorityEnemy.value?.isBoss ?? false
})

const isElitePriorityTarget = computed(() => {
  stateVersion.value

  return !isBossTarget.value && (priorityEnemy.value?.isElite ?? false)
})

const targetEnemy = computed(() => {
  stateVersion.value

  const activeBattle = battle.value

  if (!activeBattle) {
    return undefined
  }

  if (priorityEnemy.value) {
    return priorityEnemy.value
  }

  if (!lastHitEnemyId.value) {
    return undefined
  }

  const found = activeBattle.enemies.find(enemy => enemy.entity.id === lastHitEnemyId.value)?.entity

  return found?.alive ? found : undefined
})

function percent(current: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
}

const rageLabel = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getEquipped()?.resourceLabel ?? 'Nộ Khí'
})

const mpLabel = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getEquipped()?.mpLabel ?? 'Linh Lực'
})

const usesSwordIntent = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getEquipped()?.usesSwordIntentResource ?? false
})

const resourceCurrent = computed(() => {
  stateVersion.value

  const activeBattle = battle.value

  if (!activeBattle) {
    return 0
  }

  return usesSwordIntent.value ? activeBattle.player.currentSwordIntent : activeBattle.player.currentRage
})

const resourceMax = computed(() => usesSwordIntent.value ? MAX_SWORD_INTENT : MAX_RAGE)
</script>

<template>
  <div v-if="battle" class="combat-status-bar">
    <div class="combat-status-bar__player">
      <div class="combat-status-bar__bar combat-status-bar__bar--hp">
        <div class="combat-status-bar__bar-fill" :style="{ width: `${percent(battle.player.currentHp, battle.player.maxHp)}%` }" />
        <span class="combat-status-bar__bar-label">{{ formatNumber(Math.ceil(battle.player.currentHp)) }} / {{ formatNumber(battle.player.maxHp) }}</span>
      </div>

      <div class="combat-status-bar__bar combat-status-bar__bar--mp">
        <div class="combat-status-bar__bar-fill" :style="{ width: `${percent(battle.player.currentMp, battle.player.stats.maxMp)}%` }" />
        <span class="combat-status-bar__bar-label">{{ mpLabel }} {{ formatNumber(Math.ceil(battle.player.currentMp)) }} / {{ formatNumber(Math.round(battle.player.stats.maxMp)) }}</span>
      </div>

      <div class="combat-status-bar__bar combat-status-bar__bar--rage">
        <div class="combat-status-bar__bar-fill" :style="{ width: `${percent(resourceCurrent, resourceMax)}%` }" />
        <span class="combat-status-bar__bar-label">{{ rageLabel }} {{ formatNumber(Math.ceil(resourceCurrent)) }} / {{ formatNumber(resourceMax) }}</span>
      </div>
    </div>

    <div
      v-if="targetEnemy"
      class="combat-status-bar__target"
      :class="{ 'combat-status-bar__target--boss': isBossTarget, 'combat-status-bar__target--elite': isElitePriorityTarget }"
    >
      <span class="combat-status-bar__target-name">{{ targetEnemy.name }}</span>

      <div class="combat-status-bar__target-bar">
        <div class="combat-status-bar__target-fill" :style="{ width: `${percent(targetEnemy.currentHp, targetEnemy.maxHp)}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-status-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 20px;
  background: rgba(10, 10, 13, 0.55);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--ink-line-soft);
  font-family: var(--font-body);
  pointer-events: auto;
}

.combat-status-bar__player {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 260px;
  flex: 0 0 auto;
}

.combat-status-bar__bar {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  overflow: hidden;
}

.combat-status-bar__bar-fill {
  height: 100%;
  transition: width 0.15s ease;
}

.combat-status-bar__bar--hp .combat-status-bar__bar-fill {
  background: var(--hp-color);
}

.combat-status-bar__bar--mp .combat-status-bar__bar-fill {
  background: var(--jade);
}

.combat-status-bar__bar--rage .combat-status-bar__bar-fill {
  background: var(--gold-500);
}

.combat-status-bar__bar-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  color: var(--ink-950);
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
}

.combat-status-bar__target {
  width: 320px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.combat-status-bar__target--boss .combat-status-bar__target-name {
  color: var(--gold-500);
}

.combat-status-bar__target--boss .combat-status-bar__target-bar {
  border-color: var(--gold-500);
}

.combat-status-bar__target--elite .combat-status-bar__target-name {
  color: var(--azure);
}

.combat-status-bar__target--elite .combat-status-bar__target-bar {
  border-color: var(--azure);
}

.combat-status-bar__target-name {
  font-size: 0.72rem;
  color: var(--text-primary);
  text-align: right;
}

.combat-status-bar__target-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  overflow: hidden;
}

.combat-status-bar__target-fill {
  height: 100%;
  background: var(--crimson);
  transition: width 0.15s ease;
}
</style>
