<script setup lang="ts">
// Linh mach Khai Vat Duong (the Linh Tuyen) - the spirit-stone vein
// claim card inside ProductionPanel. 2026-10-11 landscape port: same
// reads/collect call as the old .lin-mach block, rendered in the
// preview's .production-vein shape (icon + info grid + tube + gold
// harvest button).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'

// The panel's 500ms tick drives stored-amount freshness - single ticker
// owner, passed down instead of a second interval here.
const props = defineProps<{ nowMs: number }>()

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const OUTPOST_ID = 'gathering_outpost'

const outpostInstance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(OUTPOST_ID)
})

const linMachStored = computed(() => {
  if (!outpostInstance.value) {
    return 0
  }

  return Math.floor(
    gameManager.buildingOps.getBuildingStoredAmount(outpostInstance.value.instanceId, props.nowMs / 1000),
  )
})

const linMachCapacity = computed(() =>
  outpostInstance.value ? gameManager.buildingOps.getBuildingCapacity(outpostInstance.value.instanceId) : 0,
)

const linMachRatePerMinute = computed(() =>
  outpostInstance.value ? gameManager.buildingOps.getBuildingRatePerMinute(outpostInstance.value.instanceId) : 0,
)

const linMachOutputName = computed(() => {
  const id = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

  return gameManager.materialRegistry.has(id)
    ? gameManager.materialRegistry.get(id).name
    : SPIRIT_STONE_LABEL
})

const fill = computed(() =>
  linMachCapacity.value > 0 ? (linMachStored.value / linMachCapacity.value) * 100 : 0,
)

const veinIcon = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/icons/navigation-exploration-v2.png')

function collectLinMach() {
  if (!outpostInstance.value || linMachStored.value <= 0) {
    return
  }

  gameManager.buildingOps.collectBuilding(outpostInstance.value.instanceId, player.$state, props.nowMs / 1000)

  bumpState()
}
</script>

<template>
  <div v-if="outpostInstance" class="lin-mach">
    <article class="lin-mach__card">
      <img class="lin-mach__icon" :src="veinIcon" alt="" />

      <div class="lin-mach__info">
        <h3 class="lin-mach__title">{{ t('panels.production.linMach.title') }}</h3>

        <EquipmentEnergyTube :fill="fill" color="#e1b354" />

        <strong>{{ linMachStored }} / {{ linMachCapacity }} {{ linMachOutputName }}</strong>

        <small class="lin-mach__rate">+{{ linMachRatePerMinute.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} {{ t('panels.production.linMach.rateSuffix') }}</small>
      </div>

      <EquipmentArtButton
        class="lin-mach__collect"
        gold
        :disabled="linMachStored <= 0"
        @click="collectLinMach"
      >
        {{ t('panels.production.linMach.collect') }}
      </EquipmentArtButton>
    </article>
  </div>
</template>

<style scoped>
/* Preview .production-vein shape: icon left, info grid middle, gold
   harvest button right - on the shared paper card chrome. */
.lin-mach__card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 90px;
  padding: 7px 12px;
  border: 3px double #b58a42;
  background: #f7ecd4 url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') center / cover;
  box-sizing: border-box;
  color: #30271b;
}

.lin-mach__icon {
  flex: none;
  width: 65px;
  height: 65px;
  object-fit: contain;
}

.lin-mach__info {
  flex: 1;
  display: grid;
  gap: 5px;
  min-width: 0;
}

.lin-mach__title {
  margin: 0;
  font-size: 18px;
  font-family: var(--pc-font-body);
}

.lin-mach__info strong {
  font-size: 16px;
  font-weight: 400;
}

.lin-mach__rate {
  font-size: 12px;
  color: #8a7450;
}

.lin-mach__collect {
  flex: none;
  width: 150px;
  height: 42px;
  font-size: 17px;
}
</style>
