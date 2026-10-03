<script setup lang="ts">
// Scene 12 (Trang Bi / Khi Duong) production adapter -- mounts the real
// equipment surfaces inside the approved fidelity composition:
//   doll slot      -> EquipmentPaperdollStage (canonical socket select)
//   summary slot   -> real HP / attack / defense from player.finalStats
//   workspace slot -> Trang Bi detail + beta-admitted op tabs + Tui Do
//                     (the ref's right region is ONE rect: bag OR forge)
//   actions slot   -> quick-jump seals for the admitted ops
//
// HALL_SELECTION_KEY provide + detailInstanceId fallback + tab ownership
// (Enhance slot-based, Wash/Refine shared selection, Dissolve/Decompose
// own multi-select) are ported verbatim from the old EquipmentScene.
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatStat } from '@/core/stats/StatLabels'
import { isBetaEquipmentTab } from '@/core/betaScope'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { HALL_SELECTION_KEY } from '@/components/panels/equipment-hall/hallSelection'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import EquipmentFidelityScene from './fidelity/EquipmentFidelityScene.vue'
import EquipmentPaperdollStage from './paperdoll/EquipmentPaperdollStage.vue'
import EquipmentItemDetail from './detail/EquipmentItemDetail.vue'
import EquipmentBagPanel from './bag/EquipmentBagPanel.vue'
import EnhanceTab from '@/components/panels/equipment-hall/EnhanceTab.vue'
import WashTab from '@/components/panels/equipment-hall/WashTab.vue'
import RefineTab from '@/components/panels/equipment-hall/RefineTab.vue'
import DissolveTab from '@/components/panels/equipment-hall/DissolveTab.vue'
import DecomposeTab from '@/components/panels/equipment-hall/DecomposeTab.vue'
import type { Stats } from '@/core/stats/StatBlock'


const furnaceArtUrl = resolveAssetUrl('/assets/ui/huyen-kim/scene/forge-v2/furnace-v1.png')

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { items: navItems, navigate } = usePaperNavigation()
const { stateVersion } = useStateVersion()

// Canonical authored op table (same ids the old shell declared); the
// workspace renders only the ops isBetaEquipmentTab admits (beta:
// enhance + dissolve; wash/refine/decompose stay scope-hidden).
const TABS = [
  { id: 'enhance' },
  { id: 'wash' },
  { id: 'refine' },
  { id: 'dissolve' },
  { id: 'decompose' },
] as const

type OpTabId = (typeof TABS)[number]['id']

/** 'equip' = Trang Bi detail; 'bag' = canonical BagGrid workspace mode. */
type EquipmentWorkspaceId = 'equip' | 'bag' | OpTabId

const visibleTabs = TABS.filter((tab) => isBetaEquipmentTab(tab.id))

const workspaceModes = computed<readonly { id: EquipmentWorkspaceId; label: string }[]>(() => [
  { id: 'equip', label: t('equipment.workspace.equip') },
  ...visibleTabs.map((tab) => ({ id: tab.id as EquipmentWorkspaceId, label: t(`panels.equipmentHall.tabs.${tab.id}`) })),
  { id: 'bag', label: t('equipment.workspace.bag') },
])

const activeWorkspace = ref<EquipmentWorkspaceId>('equip')

function selectWorkspace(id: EquipmentWorkspaceId) {
  activeWorkspace.value = id
}

// The lò rèn hearth belongs to the forge op surfaces (enhance/wash/
// refine/dissolve/decompose); equip detail + bag keep the plain slab.
const showFurnaceArt = computed(() => activeWorkspace.value !== 'equip' && activeWorkspace.value !== 'bag')

// Shared selection -- only Wash/Refine inject it (old shell note kept):
// Enhance selects by SLOT; Dissolve/Decompose keep their own multi-select.
const selectedInstanceId = ref<string | null>(null)

function selectEquipped(instanceId: string) {
  selectedInstanceId.value = instanceId
}

function clearSelection() {
  selectedInstanceId.value = null
}

provide(HALL_SELECTION_KEY, { selectedInstanceId, selectEquipped, clearSelection })

// Detail-card instance: an explicit pick while it still exists, else the
// first filled socket in canonical slot order.
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

const SUMMARY_STATS: readonly { key: keyof Stats; labelKey: string }[] = [
  { key: 'maxHp', labelKey: 'equipment.stats.hp' },
  { key: 'might', labelKey: 'equipment.stats.attack' },
  { key: 'defense', labelKey: 'equipment.stats.defense' },
]

const summaryRows = computed(() => {
  stateVersion.value
  return SUMMARY_STATS.map((row) => ({
    key: row.key,
    label: t(row.labelKey),
    value: formatStat(row.key, player.finalStats[row.key]),
  }))
})

</script>

<template>
  <!-- `overlay` is the boolean prop - `mode="overlay"` is silently
       ignored, which left this as the opaque base variant (dark void
       behind the paper instead of the home vista). -->
  <SceneDesignCanvas overlay>
    <EquipmentFidelityScene
      :navigation="navItems"
      notice=""
      @navigate="navigate"
      @back="ui.closeHomeOverlays()"
    >
      <template #doll>
        <div class="equipment-doll">
          <EquipmentPaperdollStage @select="selectEquipped" />
        </div>
      </template>

      <template #summary>
        <div><template v-for="row in summaryRows" :key="row.key"><span>{{ row.label }}</span><strong>{{ row.value }}</strong></template></div>
      </template>

      <template #workspace>
        <section class="equipment-workspace" :aria-label="t('equipment.title')">
          <!-- LO REN hearth backdrop (ref forge workspace): decorative
               furnace art behind the op views only. -->
          <img
            v-if="showFurnaceArt"
            class="furnace-art"
            :src="furnaceArtUrl"
            alt=""
            aria-hidden="true"
          />
          <nav>
            <button
              v-for="mode in workspaceModes"
              :key="mode.id"
              :aria-pressed="activeWorkspace === mode.id"
              @click="selectWorkspace(mode.id)"
            >{{ mode.label }}</button>
          </nav>
          <div class="equipment-workspace__body">
            <EquipmentItemDetail v-if="activeWorkspace === 'equip'" :instance-id="detailInstanceId" />
            <EnhanceTab v-else-if="activeWorkspace === 'enhance'" />
            <WashTab v-else-if="activeWorkspace === 'wash'" />
            <RefineTab v-else-if="activeWorkspace === 'refine'" />
            <DissolveTab v-else-if="activeWorkspace === 'dissolve'" />
            <DecomposeTab v-else-if="activeWorkspace === 'decompose'" />
            <EquipmentBagPanel v-else />
          </div>
        </section>
      </template>

      <template #actions>
        <button v-for="tab in visibleTabs" :key="tab.id" @click="selectWorkspace(tab.id)">{{ t(`panels.equipmentHall.tabs.${tab.id}`) }}</button>
      </template>
    </EquipmentFidelityScene>
  </SceneDesignCanvas>
</template>

<style scoped>
.equipment-doll {
  position: absolute;
  left: 244px;
  top: 222px;
  width: 449px;
  height: 376px;
}
.equipment-doll :deep(.equipment-paperdoll-stage) {
  height: 100%;
}

/* Production workspace: same rect as the ref's bag/forge region; the tab
   bar mirrors the forge nav, the body mounts the real tabs verbatim. */
.equipment-workspace {
  position: absolute;
  left: 758px;
  top: 178px;
  width: 620px;
  height: 507px;
  padding-left: 20px;
  /* The workspace's right edge (x1378) sits ~33px onto the paper's 83px
     border frame - without matching padding right-side content (bag
     counts) renders under the torn rim. */
  padding-right: 40px;
  border-left: 1px solid #a0875166;
  display: flex;
  flex-direction: column;
}

/* Decorative forge hearth behind the forge op views - same asset +
   treatment the fidelity fixture uses (left, contained, dimmed). */
.furnace-art {
  position: absolute;
  left: -6px;
  bottom: 0;
  width: 200px;
  height: auto;
  object-fit: contain;
  opacity: 0.45;
  filter: drop-shadow(0 4px 7px #61451d33);
  pointer-events: none;
}
.equipment-workspace nav {
  display: flex;
  gap: 5px;
  margin-bottom: 16px;
  border-bottom: 1px solid #95734266;
  min-height: 38px;
  flex: 0 0 auto;
}
.equipment-workspace nav button {
  flex: 1;
  padding: 0 5px;
  border: 0;
  border-bottom: 3px solid transparent;
  color: #71532f;
  background: transparent;
  font: 700 14px var(--font-display, Georgia, serif);
  cursor: pointer;
}
.equipment-workspace nav button[aria-pressed='true'] {
  color: #28523a;
  border-color: #977337;
  background: #9e823422;
}
.equipment-workspace nav button:focus-visible {
  outline: 2px solid #47765f;
  outline-offset: 3px;
}
.equipment-workspace__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
}
.equipment-workspace__body > * {
  flex: 1;
  min-height: 0;
}

/* The action seal buttons render inside the #actions slot (this file's
   scope) - the scene only owns the .equipment-actions rect. */
.equipment-actions button {
  font-family: var(--font-display, Georgia, serif);
  font-size: 15px;
  font-weight: 700;
  padding: 7px 25px;
  border: 1px solid #a78745;
  color: #f6dfa6;
  background: linear-gradient(#3c5946, #173024);
  border-radius: 3px;
  cursor: pointer;
  box-shadow: inset 0 0 0 2px #d3b57633, 0 2px 4px #3f2d1455;
}
.equipment-actions button:hover {
  filter: brightness(1.15);
}
.equipment-actions button:focus-visible {
  outline: 2px solid #47765f;
  outline-offset: 3px;
}
</style>
