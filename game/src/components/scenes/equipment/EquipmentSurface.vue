<script setup lang="ts">
// Scene 12 (Trang Bi / Khi Duong) production adapter -- mounts the real
// equipment surfaces inside the approved fidelity composition:
//   doll slot      -> EquipmentPaperdollStage (canonical socket select)
//   summary slot   -> real HP / attack / defense from player.finalStats
//   workspace slot -> Trang Bi gear grid (unequipped bag items) + the 5
//                     authored Khi Duong op tabs (owner ruling 2026-10-04:
//                     rail = Trang Bi + Cuong Hoa/Tay Luyen/Tinh Luyen/
//                     Hoa Luyen/Phan Giai; bag items that are NOT
//                     equipment live in Kho Vat, not here)
//
// Scope-hidden ops keep their tab SHELL in the rail (disabled seal -
// owner ruling: tab shown but the op stays locked); the op component
// only mounts when isBetaEquipmentTab admits it, so a flag flip lights
// the shell up with no extra wiring.
//
// HALL_SELECTION_KEY provide + tab ownership (Enhance slot-based,
// Wash/Refine shared selection, Dissolve/Decompose own multi-select)
// are ported verbatim from the old EquipmentScene.
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useStateVersion } from '@/composables/useGameState'
import { formatStat } from '@/core/stats/StatLabels'
import { isBetaEquipmentTab } from '@/core/betaScope'
import { HALL_SELECTION_KEY } from '@/components/panels/equipment-hall/hallSelection'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import EquipmentFidelityScene from './fidelity/EquipmentFidelityScene.vue'
import EquipmentPaperdollStage from './paperdoll/EquipmentPaperdollStage.vue'
import EquipmentBagSection from '@/components/panels/bag-sections/EquipmentBagSection.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
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
const { items: navItems, navigate } = usePaperNavigation()
const { stateVersion } = useStateVersion()

// Canonical authored op table (same ids the old shell declared): all 5
// seals render in the rail; scope-hidden ops show a disabled shell and
// never mount their component (isBetaEquipmentTab still owns admission).
const TABS = [
  { id: 'enhance' },
  { id: 'wash' },
  { id: 'refine' },
  { id: 'dissolve' },
  { id: 'decompose' },
] as const

type OpTabId = (typeof TABS)[number]['id']

/** 'equip' = Trang Bi gear grid (unequipped items); the ops follow. */
type EquipmentWorkspaceId = 'equip' | OpTabId

const visibleTabs = TABS.filter((tab) => isBetaEquipmentTab(tab.id))

const workspaceModes = computed<readonly { id: EquipmentWorkspaceId; label: string; locked: boolean }[]>(() => [
  { id: 'equip', label: t('equipment.workspace.equip'), locked: false },
  ...TABS.map((tab) => ({
    id: tab.id as EquipmentWorkspaceId,
    label: t(`panels.equipmentHall.tabs.${tab.id}`),
    locked: !visibleTabs.some((admitted) => admitted.id === tab.id),
  })),
])

const activeWorkspace = ref<EquipmentWorkspaceId>('equip')

function selectWorkspace(id: EquipmentWorkspaceId) {
  // Defense in depth: a locked op tab is disabled in the nav, and the
  // surface itself also refuses to activate it - activeWorkspace can
  // only ever hold 'equip' or an admitted op id.
  if (id !== 'equip' && !visibleTabs.some((tab) => tab.id === id)) return
  activeWorkspace.value = id
}

// The lo ren hearth belongs to the forge op surfaces (enhance/wash/
// refine/dissolve/decompose); the Trang Bi grid keeps the plain slab.
const showFurnaceArt = computed(() => activeWorkspace.value !== 'equip')

// Shared selection -- only Wash/Refine inject it (old shell note kept):
// Enhance selects by SLOT; Dissolve/Decompose keep their own multi-select.
const selectedInstanceId = ref<string | null>(null)

function selectEquipped(instanceId: string) {
  // Socket click = unequip lives in EquipmentPaperdoll.onSlotClick
  // (emits select AND unequips on every workspace - pre-existing).
  selectedInstanceId.value = instanceId
}

function clearSelection() {
  selectedInstanceId.value = null
}

provide(HALL_SELECTION_KEY, { selectedInstanceId, selectEquipped, clearSelection })

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
              :disabled="mode.locked"
              @click="selectWorkspace(mode.id)"
            >
              <!-- Active seal: tab-seal chrome art (huyen-kim manifest) -
                   drawn, not a CSS frame. -->
              <InkNineSlice
                v-if="activeWorkspace === mode.id"
                class="nav-seal"
                chrome-id="tab-seal"
                layer="surface"
              />
              <span class="nav-label">{{ mode.label }}</span>
            </button>
          </nav>
          <!-- Under-tab divider: drawn divider-ornament line + endcap
               diamonds (ref image 2 chrome), replaces the plain rule. -->
          <div class="equipment-workspace__divider" aria-hidden="true">
            <InkNineSlice chrome-id="divider-ornament" layer="surface" />
          </div>
          <div class="equipment-workspace__body">
            <!-- Trang Bi tab: the unequipped gear grid (equip-on-click).
                 The bag-panel container anchor gives the section's
                 @container bag-panel rules a real ancestor - same host
                 contract the Kho Vat surface uses. -->
            <div v-if="activeWorkspace === 'equip'" class="bag-anchor">
              <EquipmentBagSection />
            </div>
            <EnhanceTab v-else-if="activeWorkspace === 'enhance'" />
            <WashTab v-else-if="activeWorkspace === 'wash'" />
            <RefineTab v-else-if="activeWorkspace === 'refine'" />
            <DissolveTab v-else-if="activeWorkspace === 'dissolve'" />
            <DecomposeTab v-else-if="activeWorkspace === 'decompose'" />
          </div>
        </section>
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
  left: 700px;
  top: 178px;
  width: 678px;
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
  min-height: 34px;
  flex: 0 0 auto;
}
.equipment-workspace nav button {
  position: relative;
  flex: 1;
  padding: 0 5px;
  border: 0;
  color: #71532f;
  background: transparent;
  font: 700 14px var(--font-display, Georgia, serif);
  cursor: pointer;
}
.equipment-workspace nav button .nav-seal {
  /* tab-seal art is a dark seal tile - it needs a few px breathing room
     so the curved strokes stay inside the button. */
  inset: 2px 0;
}
.equipment-workspace nav .nav-label {
  position: relative;
  z-index: 2;
}
.equipment-workspace nav button[aria-pressed='true'] {
  color: #f0e3c0;
}
.equipment-workspace nav button:disabled {
  cursor: default;
  opacity: 0.42;
}
.equipment-workspace__divider {
  position: relative;
  height: 8px;
  margin-bottom: 4px;
  flex: 0 0 auto;
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
/* Trang Bi gear grid host: same bag-panel container contract the Kho
   Vat surface's .bag-anchor declares (container queries on the
   pagination/sort row key off this name). */
.bag-anchor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  container-type: inline-size;
  container-name: bag-panel;
}

</style>
