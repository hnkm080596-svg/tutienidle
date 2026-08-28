<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { MAX_RAGE, MAX_SWORD_INTENT } from '@/core/combat/CombatTypes'
import type { CombatEvent } from '@/core/combat/CombatEvent'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import { usePlayerStore } from '@/stores/player'

// Combat UI Redesign — kế thừa nguyên logic target-bar/player-bars từ
// CombatHud.vue cũ (đã retire, xem GameRoot.vue), chỉ đổi layout từ
// overlay-tự-do (position:absolute theo top/bottom riêng) sang 1
// THANH ngang cố định dưới CombatTopBar (spec mục 9). Không còn tự
// gate theo state==='fighting' — cha (CombatSceneOverlay.vue) đã gate
// isCombatSceneActive rồi, thanh này cứ hiện xuyên suốt cả lúc
// victory/defeat (đứng yên ở giá trị cuối, khớp modal kết quả đang
// hiện đè lên).
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

const hasBattle = computed(() => {
  stateVersion.value

  return gameManager.getBattle() !== null
})

const playerCurrentHp = ref(0)
const playerMaxHp = ref(1)

function syncPlayerHealth(currentHp: number, maxHp: number) {
  playerCurrentHp.value = currentHp
  playerMaxHp.value = maxHp
}

function onDamage(_event: CombatEvent) {
  bumpState()
}

function onVitalsChanged(event: EntityVitalsChangedEvent) {
  const activeBattle = gameManager.getBattle()

  if (activeBattle && event.entityId === activeBattle.player.id) {
    syncPlayerHealth(event.hpAfter, event.maxHp)
  }

  bumpState()
}

function onPositions(_event: BattlePositionsEvent) {
  bumpState()
}

onMounted(() => {
  const activeBattle = gameManager.getBattle()

  if (activeBattle) {
    syncPlayerHealth(activeBattle.player.currentHp, activeBattle.player.maxHp)
  }

  gameManager.eventBus.on<CombatEvent>('damage', onDamage)
  gameManager.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', onVitalsChanged)
  gameManager.eventBus.on<BattlePositionsEvent>('positions', onPositions)
})

onUnmounted(() => {
  gameManager.eventBus.off<CombatEvent>('damage', onDamage)
  gameManager.eventBus.off<EntityVitalsChangedEvent>('entity_vitals_changed', onVitalsChanged)
  gameManager.eventBus.off<BattlePositionsEvent>('positions', onPositions)
})

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

const playerCurrentMp = computed(() => {
  stateVersion.value

  return gameManager.getBattle()?.player.currentMp ?? 0
})

const playerMaxMp = computed(() => {
  stateVersion.value

  return gameManager.getBattle()?.player.stats.maxMp ?? 0
})

const resourceCurrent = computed(() => {
  stateVersion.value

  const activeBattle = gameManager.getBattle()

  if (!activeBattle) {
    return 0
  }

  return usesSwordIntent.value ? activeBattle.player.currentSwordIntent : activeBattle.player.currentRage
})

const resourceMax = computed(() => usesSwordIntent.value ? MAX_SWORD_INTENT : MAX_RAGE)
</script>

<template>
  <div v-if="hasBattle" class="combat-status-bar">
    <div class="combat-status-bar__player">
      <Bar
        class="combat-status-bar__bar combat-status-bar__bar--hp"
        :value="playerCurrentHp"
        :max="playerMaxHp"
        :height="14"
      >
        <template #label>{{ formatNumber(Math.ceil(playerCurrentHp)) }} / {{ formatNumber(playerMaxHp) }}</template>
      </Bar>

      <Bar
        v-if="player.cultivationPath === 'phap_tu'"
        class="combat-status-bar__bar combat-status-bar__bar--mp"
        :value="playerCurrentMp"
        :max="playerMaxMp"
        :height="14"
      >
        <template #label>{{ mpLabel }} {{ formatNumber(Math.ceil(playerCurrentMp)) }} / {{ formatNumber(Math.round(playerMaxMp)) }}</template>
      </Bar>

      <Bar
        class="combat-status-bar__bar combat-status-bar__bar--rage"
        :value="resourceCurrent"
        :max="resourceMax"
        :height="14"
      >
        <template #label>{{ rageLabel }} {{ formatNumber(Math.ceil(resourceCurrent)) }} / {{ formatNumber(resourceMax) }}</template>
      </Bar>
    </div>

  </div>
</template>

<style scoped>
.combat-status-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 24px;
  padding: 0 20px;
  background: color-mix(in srgb, var(--ink-950) 55%, transparent);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--ink-line-soft);
  font-family: var(--font-body);
  pointer-events: auto;
}

.combat-status-bar__player {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: min(260px, 30vw);
  flex: 0 0 auto;
}

.combat-status-bar__bar {
  border-radius: 7px;
  --bar-track: var(--ink-900);
  border: 1px solid var(--ink-line);
}

.combat-status-bar__bar :deep(.bar__fill) {
  transition: width 0.15s ease;
}

.combat-status-bar__bar--hp {
  --bar-from: var(--hp-color);
  --bar-to: var(--hp-color);
}

.combat-status-bar__bar--mp {
  --bar-from: var(--jade);
  --bar-to: var(--jade);
}

.combat-status-bar__bar--rage {
  --bar-from: var(--gold-500);
  --bar-to: var(--gold-500);
}

.combat-status-bar__bar :deep(.bar__label) {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

</style>
