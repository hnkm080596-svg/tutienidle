<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'

const BUILDING_ID = 'spirit_spring'

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const nowSeconds = ref(Date.now() / 1000)

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowSeconds.value = Date.now() / 1000
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === BUILDING_ID)
})

const instance = computed(() => {
  stateVersion.value

  const current = gameManager.buildingManager.getByBuildingId(BUILDING_ID)

  return current ? { ...current } : undefined
})

const storedAmount = computed(() => {
  if (!instance.value) {
    return 0
  }

  return Math.floor(
    gameManager.getBuildingStoredAmount(instance.value.instanceId, nowSeconds.value),
  )
})

const displayedCapacity = computed(() => instance.value ? gameManager.getBuildingCapacity(instance.value.instanceId) : 0)
const ratePerMinute = computed(() => instance.value ? gameManager.getBuildingRatePerMinute(instance.value.instanceId) : 0)
const outputName = computed(() => {
  const id = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))
  return gameManager.materialRegistry.has(id) ? gameManager.materialRegistry.get(id).name : SPIRIT_STONE_LABEL
})

function collect() {
  if (!instance.value || storedAmount.value <= 0) {
    return
  }

  gameManager.collectBuilding(instance.value.instanceId, player.$state, nowSeconds.value)
  bumpState()
}
</script>

<template>
  <section class="spirit-spring-panel">
    <p class="spirit-spring-panel__description">{{ template?.description }}</p>

    <div class="spirit-spring-panel__card">
      <h3>{{ outputName }} tích luỹ</h3>

      <Bar
        class="spirit-spring-panel__progress"
        :value="storedAmount"
        :max="displayedCapacity"
        :height="8"
        pill
      />

      <strong>{{ storedAmount.toLocaleString('vi-VN') }} / {{ displayedCapacity.toLocaleString('vi-VN') }}</strong>

      <small class="spirit-spring-panel__rate">+{{ ratePerMinute.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} thạch/phút</small>

      <GameButton class="spirit-spring-panel__collect" size="sm" :disabled="storedAmount <= 0" @click="collect">Thu hoạch</GameButton>
    </div>
  </section>
</template>

<style scoped>
.spirit-spring-panel {
  min-height: 100%;
  padding: 18px;
  color: var(--paper-text);
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--scene-water-accent) 10%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.spirit-spring-panel__description {
  margin: 0 0 16px;
  color: var(--paper-text-soft);
  line-height: var(--lh-relaxed);
}

.spirit-spring-panel__card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--scene-water-accent) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-water-accent) 12%, var(--paper-50)), color-mix(in srgb, var(--scene-water-accent) 5%, var(--paper-100)));
}

.spirit-spring-panel__card h3 {
  margin: 0;
  color: var(--scene-water-accent);
  font: 700 var(--text-lg) var(--font-display);
}

.spirit-spring-panel__rate {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.spirit-spring-panel__progress {
  --bar-from: var(--scene-water-accent);
  --bar-to: var(--jade);
}

.spirit-spring-panel__collect {
  justify-self: start;
  padding: 8px 14px;
  background: var(--scene-water-accent);
  border: 0;
  color: var(--ink-950);
}

.spirit-spring-panel__collect:disabled {
  background: var(--paper-200);
  color: var(--paper-text-muted);
}
</style>
