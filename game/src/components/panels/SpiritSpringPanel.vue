<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'

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
  return gameManager.materialRegistry.has(id) ? gameManager.materialRegistry.get(id).name : 'Linh Thạch'
})

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
    <div class="spirit-spring-panel__scene" aria-hidden="true">
      <img :src="'/assets/buildings/dong-fu/spirit_spring.png'" alt="" />
      <div class="spirit-spring-panel__orb" />
      <span>LINH MẠCH HỘI TỤ</span>
    </div>

    <p class="spirit-spring-panel__description">{{ template?.description }}</p>

    <div class="spirit-spring-panel__card">
      <h3>{{ outputName }} tích luỹ</h3>

      <div class="spirit-spring-panel__progress" aria-hidden="true">
        <div :style="{ width: `${storagePercent * 100}%` }" />
      </div>

      <strong>{{ storedAmount.toLocaleString('vi-VN') }} / {{ displayedCapacity.toLocaleString('vi-VN') }}</strong>

      <small class="spirit-spring-panel__rate">+{{ ratePerMinute.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} thạch/phút</small>

      <button type="button" :disabled="storedAmount <= 0" @click="collect">Thu hoạch</button>
    </div>
  </section>
</template>

<style scoped>
.spirit-spring-panel {
  min-height: 100%;
  padding: 18px;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 50% 20%, rgba(62, 178, 220, .13), transparent 32%),
    linear-gradient(150deg, rgba(13, 29, 35, .96), rgba(9, 14, 18, .98));
}

.spirit-spring-panel__scene {
  position: relative;
  height: 210px;
  overflow: hidden;
  border: 1px solid rgba(89, 198, 226, .34);
  border-radius: var(--radius-md);
  background: #0b1820;
  box-shadow: inset 0 -45px 55px rgba(4, 12, 17, .72), 0 12px 30px rgba(0, 0, 0, .22);
}

.spirit-spring-panel__scene img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 58%;
  opacity: .7;
  filter: saturate(1.18) contrast(1.05);
}

.spirit-spring-panel__scene span {
  position: absolute;
  left: 18px;
  bottom: 14px;
  color: #a6e8f2;
  font: 700 var(--text-sm) var(--font-display);
  letter-spacing: .18em;
  text-shadow: 0 2px 6px #000;
}

.spirit-spring-panel__orb {
  position: absolute;
  right: 12%;
  top: 28%;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #e8ffff, #56cee5 35%, rgba(31, 119, 180, .2) 72%);
  box-shadow: 0 0 30px #5edcf2, 0 0 70px rgba(76, 198, 229, .5);
  animation: spring-orb 2.2s ease-in-out infinite alternate;
}

.spirit-spring-panel__description {
  margin: 14px 0 16px;
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
}

.spirit-spring-panel__card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--azure) 45%, var(--ink-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, rgba(30, 82, 99, .25), rgba(10, 22, 28, .86));
  box-shadow: inset 0 0 24px rgba(75, 190, 220, .08);
}

@keyframes spring-orb {
  to { transform: translateY(-8px) scale(1.08); opacity: .82; }
}

.spirit-spring-panel__card h3 {
  margin: 0;
  color: var(--azure);
  font: 700 1rem var(--font-display);
}

.spirit-spring-panel__rate {
  color: var(--text-secondary);
  font-size: var(--text-xs);
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
