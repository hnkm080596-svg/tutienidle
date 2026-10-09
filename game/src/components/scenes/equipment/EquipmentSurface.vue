<script setup lang="ts">
// Scene 12 (Trang Bi / Khi Duong) production adapter -- mounts the real
// equipment surfaces inside the approved fidelity composition:
//   doll slot      -> EquipmentPaperdollStage (canonical socket select)
//   summary slot   -> stats contributed by equipped gear (equipmentOps)
//   workspace slot -> Trang Bi gear grid (unequipped bag items) + the
//                     authored Khi Duong op tabs (owner ruling 2026-10-04:
//                     rail = Trang Bi + Cuong Hoa/Tay Luyen/Tinh Luyen/
//                     Hoa Luyen; bag items that are NOT equipment live in
//                     Kho Vat, not here). Owner ruling 2026-10-08: Phan
//                     Giai (ore decompose) left the rail and lives on the
//                     Kho Vat surface instead - it is a materials op.
//
// Scope-hidden ops keep their tab SHELL in the rail (disabled seal -
// owner ruling: tab shown but the op stays locked); the op component
// only mounts when isBetaEquipmentTab admits it, so a flag flip lights
// the shell up with no extra wiring.
//
// HALL_SELECTION_KEY provide + tab ownership (Enhance slot-based,
// Wash/Refine shared selection, Dissolve's own multi-select) are
// ported verbatim from the old EquipmentScene.
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { BASE_STAT_LABELS, formatStat } from '@/core/stats/StatLabels'
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



// Dark nine-slice card the Codex home-equipment preview mounts for the
// workspace (EquipmentArtCard -> character-card-nine-slice-v2).
const cardArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
const tabBrush = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-tab-brush-v1.png')
const dividerBrush = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-divider-v1.png')
const secondaryButtonArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-secondary-v1.png')
const primaryButtonArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-primary-v1.png')

const { t } = useI18n()
const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Canonical authored op table: scope-hidden ops show a disabled shell
// and never mount their component (isBetaEquipmentTab still owns
// admission). Owner ruling 2026-10-08: 'decompose' left the rail for
// the Kho Vat surface - keep its id in BETA_EQUIPMENT_TAB_FEATURES so
// a feature flip re-admits it there.
const TABS = [
  { id: 'enhance' },
  { id: 'wash' },
  { id: 'refine' },
  { id: 'dissolve' },
] as const

type OpTabId = (typeof TABS)[number]['id']

/** 'equip' = Trang Bi gear grid (unequipped items); the ops follow. */
type EquipmentWorkspaceId = 'equip' | OpTabId

const visibleTabs = computed(() =>
  TABS.filter((tab) => isBetaEquipmentTab(tab.id)),
)

const workspaceModes = computed<readonly { id: EquipmentWorkspaceId; label: string; locked: boolean }[]>(() => [
  { id: 'equip', label: t('equipment.workspace.equip'), locked: false },
  ...TABS.map((tab) => ({
    id: tab.id as EquipmentWorkspaceId,
    label: t(`panels.equipmentHall.tabs.${tab.id}`),
    locked: !visibleTabs.value.some((admitted) => admitted.id === tab.id),
  })),
])

const activeWorkspace = ref<EquipmentWorkspaceId>('equip')

function selectWorkspace(id: EquipmentWorkspaceId) {
  // Defense in depth: a locked op tab is disabled in the nav, and the
  // surface itself also refuses to activate it - activeWorkspace can
  // only ever hold 'equip' or an admitted op id.
  if (id !== 'equip' && !visibleTabs.value.some((tab) => tab.id === id)) return
  activeWorkspace.value = id
}

// Shared selection -- only Wash/Refine inject it (old shell note kept):
// Enhance selects by SLOT; Dissolve keeps its own multi-select.
const selectedInstanceId = ref<string | null>(null)

function selectEquipped(instanceId: string) {
  // Socket click semantics per workspace (owner ruling 2026-10-08):
  // Trang Bi tab = unequip; op tabs = pick the item for the operation
  // (unequipOnSelect prop on the paperdoll).
  selectedInstanceId.value = instanceId
}

function clearSelection() {
  selectedInstanceId.value = null
}

provide(HALL_SELECTION_KEY, { selectedInstanceId, selectEquipped, clearSelection })

// "Thuec Tinh Trang Bi" = stats CONTRIBUTED by equipped gear (owner
// ruling 2026-10-08: the card lists the stats equipment adds, shown in
// the same name/value pattern as the Tu Si derived-stats board - no
// icons). Sums the equipment-sourced modifiers per stat via
// equipmentOps.getEquipmentModifiers() (the authoritative list - the
// pinia player.modifiers array is only refreshed on equip actions).
// Only stats with a nonzero contribution render; rows follow
// BASE_STAT_LABELS order so the card matches Tu Si naming + tooltips.
const summaryRows = computed(() => {
  stateVersion.value
  const equipmentModifiers = gameManager.equipmentOps.getEquipmentModifiers()
  const rows = []
  for (const stat of BASE_STAT_LABELS) {
    let flat = 0
    let percent = 0
    for (const modifier of equipmentModifiers) {
      if (modifier.stat !== stat.key) continue
      flat += modifier.flat ?? 0
      percent += modifier.percent ?? 0
    }
    if (flat === 0 && percent === 0) continue
    const flatText = flat !== 0 ? `+${formatStat(stat.key, flat)}` : ''
    const percentText = percent !== 0 ? `+${percent}%` : ''
    const value = flatText && percentText ? `${flatText} (${percentText})` : flatText || percentText
    rows.push({ key: stat.key, label: stat.label, description: stat.description, value })
  }
  return rows
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
          <EquipmentPaperdollStage
            :unequip-on-select="activeWorkspace === 'equip'"
            @select="selectEquipped"
          />
        </div>
      </template>

      <template #summary>
        <!-- Same row pattern as the Tu Si derived-stats board
             (name + value, hairline separators, tooltip description) -
             minus icons, per owner ruling. -->
        <ul class="equipment-summary__list">
          <li
            v-for="row in summaryRows"
            :key="row.key"
            class="equipment-summary__row"
            :data-stat="row.key"
            v-tooltip="row.description"
          >
            <span class="equipment-summary__name">{{ row.label }}</span>
            <span class="equipment-summary__value">{{ row.value }}</span>
          </li>
        </ul>
      </template>

      <!-- Scene-level tab strip per the Codex preview: under the
           heading, above the doll column (left region). -->
      <template #tabs>
        <nav class="equipment-tabs" :aria-label="t('equipment.title')" :style="{ '--equipment-tab-brush': `url('${tabBrush}')`, '--equipment-btn-secondary': `url('${secondaryButtonArt}')`, '--equipment-btn-primary': `url('${primaryButtonArt}')` }">
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
  /* Nine-slice like the preview's EquipmentArtCard: corners preserved,
     edges stretch, center fills - replaces the background stretch that
     distorted the card corners (owner ruling: backdrop giong preview). */
  border: 15px solid transparent;
  border-image: var(--equipment-card-art) 160 / 15px stretch;
  clip-path: inset(5.1px 2.1px 5.7px 2.2px round 6px);
  background:linear-gradient(#000000d9,#000000d9) border-box 2px 5px/calc(100% - 4px) calc(100% - 11px) no-repeat;
  
  color: #f3e4c4;
  display: flex;
  flex-direction: column;
}

/* Scene-level tab strip (Codex preview treatment): ink labels on the
   paper; the active tab gets the brush streak behind the label and
   darkens to near-black. */
.equipment-tabs {
  position: absolute;
  right: 75px;
  top: 178px;
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
  color: #f4e4c0;
  background: transparent;
  font: 700 19px var(--pc-font-body, var(--font-display, Georgia, serif));
  cursor: pointer;
  white-space: nowrap;
}

/* Auth "Bat Dau Hanh Trinh" secondary-button art on every tab: the dark
   parchment pill mounts as a nine-slice ::before so the label sits on
   it; the active tab keeps the divider brush under it. */
.equipment-tabs button::before {
  content: '';
  position: absolute;
  inset: 0 -2px;
  z-index: -1;
  border: 9px solid transparent;
  border-image: var(--equipment-btn-secondary) 60 fill stretch;
  pointer-events: none;
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
  color: #2f2415;
  text-shadow: 0 1px #fff7;
}
.equipment-tabs button[aria-pressed='true']::before {
  border-image-source: var(--equipment-btn-primary);
}
.equipment-tabs button:disabled {
  cursor: default;
  opacity: 0.42;
}
.equipment-tabs button:not(:disabled):hover {
  color: #fff3d6;
}
.equipment-tabs button:not(:disabled):hover::before {
  filter: brightness(1.1);
}
.equipment-tabs button[aria-pressed='true']:not(:disabled):hover {
  color: #1d1408;
}
.equipment-tabs button[aria-pressed='true']:not(:disabled):hover::before {
  filter: brightness(1.06);
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

/* Stats card rows - same pattern as the Tu Si derived-stats board
   (name left / value right, hairline separators, tooltip per row),
   recolored for the dark card. The list scrolls invisibly: the scene
   gives it height:100% + overflow:auto, scrollbar stays hidden. */
/* Two-column grid (owner ruling 2026-10-08) - the scroll rules live on
   the scene's :deep(ul); this only shapes the columns. */
.equipment-summary__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 14px;
  align-content: start;
}
.equipment-summary__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px solid color-mix(in srgb, #d8b56a 22%, transparent);
  cursor: default;
}
.equipment-summary__row:last-child { border-bottom: 0; }
.equipment-summary__name {
  font-size: 12px;
  color: #c9b184;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.equipment-summary__value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 12px;
  color: #ebce84;
  white-space: nowrap;
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
