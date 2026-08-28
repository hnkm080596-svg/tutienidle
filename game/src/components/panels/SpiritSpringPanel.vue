<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import Bar from '@/components/common/primitives/Bar.vue'
import {
  SPIRIT_STONE_CONVERSION_RATIO,
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
  getSpiritStoneMaterialIdForRealmTier,
} from '@/core/material/SpiritStoneMaterial'

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

function collect() {
  if (!instance.value || storedAmount.value <= 0) {
    return
  }

  gameManager.collectBuilding(instance.value.instanceId, player.$state, nowSeconds.value)
  bumpState()
}

// =========================
// Quy đổi phẩm Linh Thạch (T2, review 2026-08-28) — 1 chiều LÊN:
// 100 Hạ → 1 Trung, 100 Trung → 1 Thượng.
// =========================

const haPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

const trungPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)
})

const thuongPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)
})

function convertToTrungPham() {
  gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, 1)
  bumpState()
}

function convertToThuongPham() {
  gameManager.convertSpiritStonesUp(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID, 1)
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

      <Bar
        class="spirit-spring-panel__progress"
        :value="storedAmount"
        :max="displayedCapacity"
        :height="8"
        pill
      />

      <strong>{{ storedAmount.toLocaleString('vi-VN') }} / {{ displayedCapacity.toLocaleString('vi-VN') }}</strong>

      <small class="spirit-spring-panel__rate">+{{ ratePerMinute.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} thạch/phút</small>

      <button type="button" :disabled="storedAmount <= 0" @click="collect">Thu hoạch</button>
    </div>

    <div class="spirit-spring-panel__card">
      <h3>Đổi Phẩm Linh Thạch</h3>

      <small class="spirit-spring-panel__rate">
        Quy đổi 1 chiều lên: {{ SPIRIT_STONE_CONVERSION_RATIO }} Hạ → 1 Trung,
        {{ SPIRIT_STONE_CONVERSION_RATIO }} Trung → 1 Thượng.
      </small>

      <div class="spirit-spring-panel__tiers">
        <span>{{ SPIRIT_STONE_MATERIAL.name }}: {{ haPhamOwned.toLocaleString('vi-VN') }}</span>
        <span>{{ SPIRIT_STONE_TRUNG_PHAM_MATERIAL.name }}: {{ trungPhamOwned.toLocaleString('vi-VN') }}</span>
        <span>{{ SPIRIT_STONE_THUONG_PHAM_MATERIAL.name }}: {{ thuongPhamOwned.toLocaleString('vi-VN') }}</span>
      </div>

      <div class="spirit-spring-panel__convert">
        <button
          type="button"
          :disabled="haPhamOwned < SPIRIT_STONE_CONVERSION_RATIO"
          @click="convertToTrungPham"
        >
          {{ SPIRIT_STONE_CONVERSION_RATIO }} Hạ → 1 Trung
        </button>

        <button
          type="button"
          :disabled="trungPhamOwned < SPIRIT_STONE_CONVERSION_RATIO"
          @click="convertToThuongPham"
        >
          {{ SPIRIT_STONE_CONVERSION_RATIO }} Trung → 1 Thượng
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.spirit-spring-panel {
  min-height: 100%;
  padding: 18px;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--scene-water-accent) 13%, transparent), transparent 32%),
    linear-gradient(150deg, var(--ink-900), var(--ink-950));
}

.spirit-spring-panel__scene {
  position: relative;
  height: 210px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--scene-water-accent) 34%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--scene-water-accent) 8%, var(--ink-950));
  box-shadow: inset 0 -45px 55px color-mix(in srgb, var(--ink-950) 72%, transparent), 0 12px 30px rgba(0, 0, 0, .22);
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
  color: color-mix(in srgb, var(--scene-water-accent) 55%, white);
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
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--scene-water-accent) 12%, white), var(--scene-water-accent) 35%, color-mix(in srgb, var(--scene-water-accent) 20%, transparent) 72%);
  box-shadow: 0 0 30px color-mix(in srgb, var(--scene-water-accent) 65%, white), 0 0 70px color-mix(in srgb, var(--scene-water-accent) 50%, transparent);
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
  border: 1px solid color-mix(in srgb, var(--scene-water-accent) 45%, var(--ink-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-water-accent) 25%, transparent), color-mix(in srgb, var(--ink-950) 86%, transparent));
  box-shadow: inset 0 0 24px color-mix(in srgb, var(--scene-water-accent) 8%, transparent);
}

@keyframes spring-orb {
  to { transform: translateY(-8px) scale(1.08); opacity: .82; }
}

.spirit-spring-panel__card h3 {
  margin: 0;
  color: var(--scene-water-accent);
  font: 700 var(--text-lg) var(--font-display);
}

.spirit-spring-panel__rate {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.spirit-spring-panel__progress {
  --bar-from: var(--scene-water-accent);
  --bar-to: var(--jade);
}

.spirit-spring-panel__card button {
  justify-self: start;
  padding: 8px 14px;
  min-height: var(--tap-min);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--scene-water-accent);
  color: var(--ink-950);
  font-weight: 700;
  cursor: pointer;
}

.spirit-spring-panel__card button:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.spirit-spring-panel__tiers {
  display: grid;
  gap: 4px;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.spirit-spring-panel__convert {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
