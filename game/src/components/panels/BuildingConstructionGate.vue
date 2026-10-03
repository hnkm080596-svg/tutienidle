<script setup lang="ts">
// BUILDing spec muc 2/5 - moi panel Tu Nghe (Dan Phong/Tran Dai/Phu
// Vien/Khi Duong) gio di qua dung 1 BuildingInstance that: CHUA xay
// thi chan han Function UI, hien man Construction (tai dung
// BuildingSystem.canBuild/build); DA xay thi hien header Lv.X + Nang
// Cap, roi moi toi noi dung that qua <slot /> - click Building (nav
// entry) van mo THANG panel nhu cu, gate nay chi quyet dinh BEN TRONG
// panel render gi (khong them man hinh trung gian nao ngoai panel).
// Tham Hiem rework - build() them window.confirm() (y/n mo khoa) TRUOC
// khi tru nguyen lieu, cung pattern HomeBuildingIcons.vue's
// BuildingDetailPopover.vue (2 noi build Building gio deu xac nhan).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import { isTestModeUnlockAll } from '@/core/dev/DevMode'
import GameButton from '@/components/common/GameButton.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps<{ buildingId: string }>()

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => gameManager.buildingRegistry.get(props.buildingId))

const instance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(props.buildingId)
})

// Co test (2026-08-20) - tu cap instance MIEN PHI thay vi hien man
// Construction, cung pattern App.vue's grant khoi tao cho
// teleport_array/gathering_outpost (add THANG qua buildingManager, bo
// qua canBuild/cost). Lam o day (thay vi fake `instance` trong template)
// de noi dung that phia sau gate (Lv.X/Nang Cap/<slot>) doc 1 instance
// THAT, khong can ne null-check rieng.
onMounted(() => {
  if (isTestModeUnlockAll() && !instance.value) {
    gameManager.buildingManager.add({
      instanceId: crypto.randomUUID(),
      buildingId: props.buildingId,
      level: 1,
      lastCollectedAt: Date.now() / 1000,
    })

    bumpState()
  }
})

const buildCost = computed(() => template.value.upgradeCost[0] ?? [])

const canBuild = computed(() => {
  // T4-31 - materialBag is not reactive; without this read the gate froze
  // at first evaluation and never re-enabled after materials arrived.
  stateVersion.value

  return gameManager.buildingSystem.canBuild(
    props.buildingId,
    gameManager.buildingRegistry,
    gameManager.buildingManager,
    player.$state,
    gameManager.materialBag,
  )
})

function materialLabel(materialId: string): string {
  return gameManager.materialRegistry.has(materialId) ? gameManager.materialRegistry.get(materialId).name : materialId
}

// UI-007 (Task 5, 2026-09-07) - window.confirm() native -> ConfirmModal
// dung chung (in-game modal, keyboard + focus trap, huy cac luong native
// con sot). Modal xac nhan hien khi bam Xay; confirm moi tru tai nguyen.
const confirmOpen = ref(false)

function requestBuild() {
  confirmOpen.value = true
}

function build() {
  confirmOpen.value = false

  if (gameManager.buildingOps.buildBuilding(props.buildingId, player.$state)) {
    bumpState()
  }
}

</script>

<template>
  <div class="construction-gate">
    <div v-if="!instance" class="construction-gate__locked">
      <div class="construction-gate__icon">{{ template.name.charAt(0) }}</div>

      <h3 class="construction-gate__name">{{ template.name }}</h3>

      <p class="construction-gate__description">{{ template.description }}</p>

      <p class="construction-gate__cost">
        {{ t('panels.buildingPopover.costTitle') }}: {{ buildCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || t('buildingGate.free') }}
      </p>

      <GameButton class="construction-gate__build" size="sm" :disabled="!canBuild" @click="requestBuild">
        {{ t('panels.buildingPopover.build') }}
      </GameButton>
    </div>

    <div v-else class="construction-gate__content">
      <slot />
    </div>

    <!-- UI-007 - xac nhan xay qua ConfirmModal dung chung (thay window.confirm).
         Dat NGOAI cap v-if/v-else de khong pha adjacency cua chung. -->
    <ConfirmModal
      :open="confirmOpen"
      :title="t('buildingGate.confirmTitle', { name: template.name })"
      :message="t('buildingGate.confirmMessage', { cost: buildCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || t('buildingGate.free') })"
      :confirm-label="t('panels.buildingPopover.build')"
      @confirm="build"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<style scoped>
.construction-gate {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Overlay-canvas mounts (exploration fidelity surface) are
     click-through - the gate opts back into pointer interaction so the
     construction screen stays usable there. */
  pointer-events: auto;
}

.construction-gate__locked {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--paper-text);
  font-family: var(--font-body);
}

.construction-gate__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--chrome-500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-title);
}

.construction-gate__name {
  margin: 4px 0 0;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-lg);
}

.construction-gate__description {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  max-width: 280px;
}

.construction-gate__cost {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.construction-gate__build {
  margin-top: 10px;
  padding: 8px 20px;
}

.construction-gate__content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
