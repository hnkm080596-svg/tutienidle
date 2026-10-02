<script setup lang="ts">
// Scene 12 (Equipment / Khi Duong) scaffold per ref 12-equipment.jpg and
// huyen-kim-scene-layout-spec scene 12: ops rail | paperdoll | item-card
// | bag-grid across the imperial scroll content area (1244 x 610).
//
// Owner note: the ref puts the BAG grid with category tabs on the RIGHT;
// a previous pass swapped that column for the forge workspace. This
// scaffold restores the ref placement - ops rail on the left, selected
// item detail + ops workspace center-right, full bag grid on the right.
//
// Shared selection (HALL_SELECTION_KEY) is provided here verbatim from
// the old EquipmentHallPanel shell - only Wash/Refine tabs inject it.
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentOpsRail from './rail/EquipmentOpsRail.vue'
import EquipmentPaperdollStage from './paperdoll/EquipmentPaperdollStage.vue'
import EquipmentItemCard from './detail/EquipmentItemCard.vue'
import EquipmentItemDetail from './detail/EquipmentItemDetail.vue'
import EquipmentBagPanel from './bag/EquipmentBagPanel.vue'
import EnhanceTab from '@/components/panels/equipment-hall/EnhanceTab.vue'
import WashTab from '@/components/panels/equipment-hall/WashTab.vue'
import RefineTab from '@/components/panels/equipment-hall/RefineTab.vue'
import DissolveTab from '@/components/panels/equipment-hall/DissolveTab.vue'
import DecomposeTab from '@/components/panels/equipment-hall/DecomposeTab.vue'
import { HALL_SELECTION_KEY } from '@/components/panels/equipment-hall/hallSelection'
import { isBetaEquipmentTab } from '@/core/betaScope'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Canonical authored op table (same ids the old shell declared); the
// rail renders only the ops isBetaEquipmentTab admits (beta: enhance +
// dissolve; wash/refine/decompose stay scope-hidden).
const TABS = [
  { id: 'enhance', labelKey: 'panels.equipmentHall.tabs.enhance' },
  { id: 'wash', labelKey: 'panels.equipmentHall.tabs.wash' },
  { id: 'refine', labelKey: 'panels.equipmentHall.tabs.refine' },
  { id: 'dissolve', labelKey: 'panels.equipmentHall.tabs.dissolve' },
  { id: 'decompose', labelKey: 'panels.equipmentHall.tabs.decompose' },
] as const

type OpTabId = (typeof TABS)[number]['id']

/** 'equip' = the ref's Trang Bi view seal (item detail mode). */
type EquipmentWorkspaceId = 'equip' | OpTabId

const visibleTabs = TABS.filter((tab) => isBetaEquipmentTab(tab.id))

const activeWorkspace = ref<EquipmentWorkspaceId>('equip')

// The rail emits plain strings; the scene owns the workspace union and
// ignores ids outside it (unknown op, a hidden beta seal).
function selectWorkspace(id: string) {
  if (id !== 'equip' && !visibleTabs.some((tab) => tab.id === id)) return
  activeWorkspace.value = id as EquipmentWorkspaceId
}

// =========================
// Selection dung chung - CHI Wash/Refine inject (old shell note):
// Enhance selects by SLOT and Dissolve keeps its own multi-select.
// =========================
const selectedInstanceId = ref<string | null>(null)

function selectEquipped(instanceId: string) {
  selectedInstanceId.value = instanceId
}

function clearSelection() {
  selectedInstanceId.value = null
}

provide(HALL_SELECTION_KEY, { selectedInstanceId, selectEquipped, clearSelection })

// Detail-card instance: an explicit pick while it still exists, else the
// first filled socket in canonical slot order (weapon leads the order,
// matching the ref's selected sword).
const detailInstanceId = computed<string | null>(() => {
  stateVersion.value

  const selected = selectedInstanceId.value
  if (selected && gameManager.equipmentBag.get(selected)) return selected

  for (const slot of EQUIPMENT_SLOTS) {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slot)
    if (equipped) return equipped.instanceId
  }

  return null
})

const workspaceTitle = computed(() =>
  activeWorkspace.value === 'equip'
    ? undefined
    : t(`panels.equipmentHall.tabs.${activeWorkspace.value}`),
)
</script>

<template>
  <div class="equipment-scene">
    <EquipmentOpsRail
      class="equipment-scene__rail"
      :active="activeWorkspace"
      :tabs="visibleTabs"
      :on-select="selectWorkspace"
    />

    <EquipmentPaperdollStage
      class="equipment-scene__paperdoll"
      @select="selectEquipped"
    />

    <EquipmentItemCard class="equipment-scene__item-card" :title="workspaceTitle">
      <EquipmentItemDetail v-if="activeWorkspace === 'equip'" :instance-id="detailInstanceId" />
      <EnhanceTab v-else-if="activeWorkspace === 'enhance'" />
      <WashTab v-else-if="activeWorkspace === 'wash'" />
      <RefineTab v-else-if="activeWorkspace === 'refine'" />
      <DissolveTab v-else-if="activeWorkspace === 'dissolve'" />
      <DecomposeTab v-else-if="activeWorkspace === 'decompose'" />
      <EquipmentItemDetail v-else :instance-id="detailInstanceId" />
    </EquipmentItemCard>

    <EquipmentBagPanel class="equipment-scene__bag" />
  </div>
</template>

<style scoped>
.equipment-scene {
  position: relative;
  isolation: isolate;
  display: grid;
  /* Spec scene 12 columns on the 1244px content band: 132 | 380 | 330 | 354. */
  grid-template-columns: minmax(0, 132fr) minmax(0, 380fr) minmax(0, 330fr) minmax(0, 354fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 6px 2px;
  color: var(--hk-text-primary, var(--paper-text));
  font-family: var(--hk-font-ui, var(--font-body));
}

.equipment-scene > * {
  min-width: 0;
  min-height: 0;
}

@container (max-width: 900px) {
  .equipment-scene {
    grid-template-columns: 72px 1fr;
    grid-template-rows: minmax(220px, 38%) 1fr;
    overflow-y: auto;
  }
  .equipment-scene__rail { grid-row: 1 / -1; }
  .equipment-scene__item-card { grid-column: 2; }
  .equipment-scene__bag { grid-column: 1 / -1; }
}
</style>
