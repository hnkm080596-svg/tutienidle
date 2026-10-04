<script setup lang="ts">
// Nut "Nang cap" DUY NHAT cho moi panel cong trinh (imperial scroll,
// legacy overlay, paper fidelity scene) - hien/an theo CUNG predicate
// getBuildingStatus()==='upgradeable' voi chip nang cap tren plaque ngoai
// dong phu, va ca hai cung goi useBuildingNavigation().upgradeBuilding()
// (quote-guarded - khong re-derive cost/dieu kien o component).
//
// /ui-*.html preview mount cac scene nay ma khong provide GameManager /
// stateVersion -> inject-optional; thieu provider thi component render rong
// thay vi throw chet trang duyet UI.
import { computed, inject, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import GameButton from '@/components/common/GameButton.vue'

const props = defineProps<{ buildingId: string }>()

const { t } = useI18n()

const gameManager = inject(GAME_MANAGER_KEY, null)
const stateVersion = inject(STATE_VERSION_KEY, null)
const bumpState = inject(BUMP_STATE_KEY, null)
const provided = Boolean(gameManager && stateVersion && bumpState)

const navigation = provided ? useBuildingNavigation() : null
const header = provided ? useBuildingHeaderState(toRef(props, 'buildingId')) : null

const upgradeable = computed(() => {
  if (!navigation || !stateVersion) {
    return false
  }

  stateVersion.value

  return navigation.getBuildingStatus(props.buildingId) === 'upgradeable'
})

const costLabel = computed(() => header?.upgradeCostLabel.value ?? '')
</script>

<template>
  <div v-if="upgradeable" class="building-upgrade">
    <GameButton
      class="building-heading__upgrade"
      size="sm"
      :title="costLabel || t('layout.functionOverlay.noUpgradeCost')"
      @click="navigation?.upgradeBuilding(props.buildingId)"
    >
      {{ t('layout.functionOverlay.upgrade') }}
    </GameButton>
    <small v-if="costLabel" class="building-heading__cost">{{ costLabel }}</small>
  </div>
</template>

<style scoped>
/* Cung bo class voi block upgrade cu trong FunctionOverlayPanel
   (.building-heading__upgrade / __cost) de selector test + style tiep
   tuc bat duoc; layout goc replicate tu .building-heading__upgrade-area. */
.building-upgrade {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.building-heading__cost {
  text-align: right;
  color: var(--surface-text-muted);
  font-size: var(--text-xs);
}
</style>
