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
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatStat } from '@/core/stats/StatLabels'
import { isBetaEquipmentTab } from '@/core/betaScope'
import { HALL_SELECTION_KEY } from '@/components/panels/equipment-hall/hallSelection'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentFidelityScene from './fidelity/EquipmentFidelityScene.vue'
import EquipmentPaperdollStage from './paperdoll/EquipmentPaperdollStage.vue'
import EquipmentBagSection from '@/components/panels/bag-sections/EquipmentBagSection.vue'
import EnhanceTab from '@/components/panels/equipment-hall/EnhanceTab.vue'
import WashTab from '@/components/panels/equipment-hall/WashTab.vue'
import RefineTab from '@/components/panels/equipment-hall/RefineTab.vue'
import DissolveTab from '@/components/panels/equipment-hall/DissolveTab.vue'
import DecomposeTab from '@/components/panels/equipment-hall/DecomposeTab.vue'
import type { Stats } from '@/core/stats/StatBlock'


const furnaceArtUrl = resolveAssetUrl('/assets/ui/huyen-kim/scene/forge-v2/furnace-v1.png')
// Dark nine-slice card the Codex home-equipment preview mounts for the
// workspace (EquipmentArtCard -> character-card-nine-slice-v2).
const cardArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
const tabBrush = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-tab-brush-v1.png')
const dividerBrush = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-divider-v1.png')

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
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

const SUMMARY_STATS: readonly { key: keyof Stats; labelKey: string; glyph: string }[] = [
  { key: 'maxHp', labelKey: 'equipment.stats.hp', glyph: '\u2665' },
  { key: 'might', labelKey: 'equipment.stats.attack', glyph: '\u2694' },
  { key: 'defense', labelKey: 'equipment.stats.defense', glyph: '\u25C8' },
  { key: 'maxMp', labelKey: 'equipment.stats.mana', glyph: '\u262F' },
  { key: 'criticalRate', labelKey: 'equipment.stats.critical', glyph: '\u2727' },
  { key: 'speed', labelKey: 'equipment.stats.speed', glyph: '\u27B6' },
]

// "Thuec Tinh Trang Bi" = stats CONTRIBUTED by equipped gear (the
// preview's +1.800 / +5% rows), not the character's totals: sum the
// equipment-sourced modifiers per stat - flat for flat stats, % for
// percent stats. The authoritative list lives on equipmentOps - the
// pinia player.modifiers array does not carry equipment entries.
const summaryRows = computed(() => {
  stateVersion.value
  const equipmentModifiers = gameManager.equipmentOps.getEquipmentModifiers()
  return SUMMARY_STATS.map((row) => {
    let flat = 0
    let percent = 0
    for (const modifier of equipmentModifiers) {
      if (modifier.stat !== row.key) continue
      flat += modifier.flat ?? 0
      percent += modifier.percent ?? 0
    }
    const value = flat !== 0
      ? `+${formatStat(row.key, flat)}`
      : percent !== 0
        ? `+${percent}%`
        : '0'
    return { key: row.key, label: t(row.labelKey), glyph: row.glyph, value }
  })
})

</script>

<template>
  <!-- `overlay` is the boolean prop - `mode="overlay"` is silently
       ignored, which left this as the opaque base variant (dark void
       behind the paper instead of the home vista). -->
  <SceneDesignCanvas overlay>
    <EquipmentFidelityScene
     
      notice=""
      @back="ui.closeHomeOverlays()"
    >
      <template #doll>
        <div class="equipment-doll">
          <EquipmentPaperdollStage @select="selectEquipped" />
        </div>
      </template>

      <template #summary>
        <dl>
          <div v-for="row in summaryRows" :key="row.key">
            <dt><span>{{ row.glyph }}</span>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </template>

      <!-- Scene-level tab strip per the Codex preview: under the
           heading, above the doll column (left region). -->
      <template #tabs>
        <nav class="equipment-tabs" :aria-label="t('equipment.title')" :style="{ '--equipment-tab-brush': `url('${tabBrush}')` }">
          <button
            v-for="mode in workspaceModes"
            :key="mode.id"
            :aria-pressed="activeWorkspace === mode.id"
            :disabled="mode.locked"
            @click="selectWorkspace(mode.id)"
          >
            <span class="nav-label">{{ mode.label }}</span>
            <img v-if="activeWorkspace === mode.id" :src="dividerBrush" alt="" />
          </button>
        </nav>
      </template>

      <template #workspace>
        <section
          class="equipment-workspace"
          :style="{ '--equipment-card-art': `url('${cardArt}')`, '--equipment-tab-brush': `url('${tabBrush}')`, '--equipment-divider': `url('${dividerBrush}')` }"
          :aria-label="t('equipment.title')"
        >
          <!-- LO REN hearth backdrop (ref forge workspace): decorative
               furnace art behind the op views only. -->
          <img
            v-if="showFurnaceArt"
            class="furnace-art"
            :src="furnaceArtUrl"
            alt=""
            aria-hidden="true"
          />
          <div class="equipment-workspace__body">
            <!-- Trang Bi tab: the unequipped gear grid (equip-on-click).
                 The bag-panel container anchor gives the section's
                 @container bag-panel rules a real ancestor - same host
                 contract the Kho Vat surface uses. -->
            <div v-if="activeWorkspace === 'equip'" class="bag-anchor">
              <EquipmentBagSection @open-dissolve="selectWorkspace('dissolve')" />
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
/* Left 36% column inside the shared sheet (content x372-1390):
   doll stage above the contributed-stats card. */
.equipment-doll {
  position: absolute;
  left: 365px;
  top: 215px;
  width: 369px;
  height: 348px;
}
.equipment-doll :deep(.equipment-paperdoll-stage) {
  height: 100%;
}

/* Production workspace: same rect as the ref's bag/forge region; the tab
   bar mirrors the preview's brush rail, and the body mounts the real
   tabs verbatim inside the dark card frame. */
.equipment-workspace {
  position: absolute;
  left: 748px;
  top: 215px;
  width: 642px;
  height: 476px;
  padding: 14px 16px;
  /* The inspector art stretches full-size like the design preview (its
     painted gold border + mountain corners stay sharp at any size). */
  border: 0;
  background: var(--equipment-card-art) center / 100% 100% no-repeat;
  color: #f3e4c4;
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
/* Scene-level tab strip (Codex preview treatment): ink labels on the
   paper; the active tab gets the brush streak behind the label and
   darkens to near-black. */
.equipment-tabs {
  position: absolute;
  left: 365px;
  top: 165px;
  width: 620px;
  height: 42px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.equipment-tabs button {
  position: relative;
  isolation: isolate;
  flex: 1;
  min-height: 33px;
  padding: 3px 12px 5px;
  border: 0;
  color: #423019;
  background: transparent;
  font: 700 19px var(--pc-font-body, var(--font-display, Georgia, serif));
  cursor: pointer;
  white-space: nowrap;
}
.equipment-tabs button > img {
  position: absolute;
  left: 0;
  bottom: -3px;
  width: 100%;
  height: 12px;
  object-fit: contain;
  pointer-events: none;
}
.equipment-tabs button[aria-pressed='true'] {
  color: #231b0c;
}
.equipment-tabs button[aria-pressed='true']::before {
  content: '';
  position: absolute;
  inset: 0 -4px;
  z-index: -1;
  background: var(--equipment-tab-brush) center / contain no-repeat;
  pointer-events: none;
}
.equipment-tabs button:disabled {
  cursor: default;
  opacity: 0.42;
}
.equipment-tabs button:not(:disabled):hover {
  color: #9a6527;
}
.equipment-workspace__divider {
  position: relative;
  height: 21px;
  margin-bottom: 4px;
  flex: 0 0 auto;
  background: var(--equipment-divider) center / contain no-repeat;
  opacity: 0.8;
}
.equipment-workspace nav button:focus-visible {
  outline: 2px solid #d6ad5d;
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
