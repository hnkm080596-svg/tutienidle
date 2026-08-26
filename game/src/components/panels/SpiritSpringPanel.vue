<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

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

const displayedCapacity = computed(() =>
  Math.max(template.value?.baseStorageCapacity ?? 0, storedAmount.value),
)

const storagePercent = computed(() =>
  displayedCapacity.value > 0 ? Math.min(1, storedAmount.value / displayedCapacity.value) : 0,
)

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
      <h3>Linh Thạch tích luỹ</h3>

      <div class="spirit-spring-panel__progress" aria-hidden="true">
        <div :style="{ width: `${storagePercent * 100}%` }" />
      </div>

      <strong>{{ storedAmount }} / {{ displayedCapacity }}</strong>

      <button type="button" :disabled="storedAmount <= 0" @click="collect">Thu hoạch</button>
    </div>
  </section>
</template>

<style scoped>
.spirit-spring-panel {
  padding: 18px;
  color: var(--text-primary);
}

.spirit-spring-panel__description {
  margin: 0 0 16px;
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
}

.spirit-spring-panel__card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--azure) 45%, var(--ink-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--azure) 8%, var(--ink-900));
}

.spirit-spring-panel__card h3 {
  margin: 0;
  color: var(--azure);
  font: 700 1rem var(--font-display);
}

.spirit-spring-panel__progress {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ink-700);
}

.spirit-spring-panel__progress div {
  height: 100%;
  background: linear-gradient(90deg, var(--azure), var(--jade));
}

.spirit-spring-panel__card button {
  justify-self: start;
  padding: 8px 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--azure);
  color: var(--ink-950);
  font-weight: 700;
  cursor: pointer;
}

.spirit-spring-panel__card button:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
