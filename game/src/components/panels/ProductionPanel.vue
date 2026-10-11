<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import BuildingUpgradeButton from '@/components/common/BuildingUpgradeButton.vue'
import ProductionSiteCard from '@/components/panels/production/ProductionSiteCard.vue'
import ProductionVeinCard from '@/components/panels/production/ProductionVeinCard.vue'
import ProductionWorkerAllocation from '@/components/panels/production/ProductionWorkerAllocation.vue'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useUiStore } from '@/stores/ui'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { formatDuration } from '@/core/format/formatDuration'

// San Xuat (2026-08-25, resource-professions-rework plan sec9.1) - thay
// ExplorationPanel: moi Dia Gioi hien thi dung ba card Lam/Quang/
// Dong Thien voi level + speed, trang thai idle/producing, dong ho
// cycle, normalized realm-tier weights, Auto toggle. Mission D
// (spec D3): sites produce on worker lanes only - no Start button;
// NO Claim button - completions go straight to Bag (sec 4.3).
// 2026-10-11 landscape port: inner pieces (worker allocation, linh
// mach vein card, per-source site cards) live in panels/production/*
// and render the LANDSCAPE preview shapes; this file keeps the sheet
// frame, the row projection and the 500ms tick clock.
const { t } = useI18n()

const KIND_META: Record<string, { labelKey: 'forest' | 'mine' | 'grotto' }> = {
  forest: { labelKey: 'forest' },
  mine: { labelKey: 'mine' },
  grotto: { labelKey: 'grotto' },
}

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const nowMs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

interface SiteRow {
  siteId: string

  kind: string

  kindLabel: string

  name: string

  description: string

  level: number

  maxLevel: number

  productionSpeedMultiplier: number

  nextProductionSpeedMultiplier?: number

  autoRestart: boolean

  activeWorkerSlots: number

  assignedWorkers?: number

  isProducing: boolean

  progress: number

  remainingLabel: string
}

const rows = computed<SiteRow[]>(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.buildingOps.getProductionViews(nowMs.value).map((view) => {
    const cycleRemainingMs = view.cycleRemainingMs ?? 0

    const totalMs = view.cycleTotalMs ?? 1

    const remainingSeconds = Math.ceil(cycleRemainingMs / 1000)

    const meta = KIND_META[view.definition.kind]

    const kindLabel = meta
      ? meta.labelKey === 'forest'
        ? t('panels.production.kinds.forest')
        : meta.labelKey === 'mine'
          ? t('panels.production.kinds.mine')
          : t('panels.production.kinds.grotto')
      : view.definition.kind

    return {
      siteId: view.definition.siteId,

      kind: view.definition.kind,

      kindLabel,

      name: view.definition.name,

      description: view.definition.description,

      level: view.state.level,

      maxLevel: view.definition.maxLevel,

      productionSpeedMultiplier: view.productionSpeedMultiplier,

      nextProductionSpeedMultiplier: view.nextProductionSpeedMultiplier,

      autoRestart: view.state.autoRestart,

      activeWorkerSlots: view.state.activeWorkerSlots,

      assignedWorkers: view.state.assignedWorkers,

      isProducing: (view.state.workerCycles?.length ?? 0) > 0 || view.state.activeWorkerSlots > 0,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? formatDuration(remainingSeconds) : t('panels.production.done'),
    }
  })
})

// ================= Panel chrome (landscape art port, 2026-10-11) =================

const OUTPOST_ID = 'gathering_outpost'

// Landscape art port (2026-10-11): panel gio tu chu chrome giay tren
// SceneDesignCanvas overlay nhu cac paper surface anh em - khong con
// nam trong imperial scroll. Close contract giong scene khac: click
// ngoai sheet hoac Escape -> closeHomeOverlays.
const ui = useUiStore()

const sceneRef = ref<HTMLElement | null>(null)

useDialogFocus(sceneRef, () => true, { onEscape: () => ui.closeHomeOverlays() })

function closeScene() {
  ui.closeHomeOverlays()
}

// Building identity bom thang vao heading trong sheet (preview: icon +
// ten 'Khai Vat Duong' + 'Cap x/9' + intro) thay dai #header cu cua
// scroll - cung read-model useBuildingHeaderState.
const outpostHeader = useBuildingHeaderState(ref(OUTPOST_ID))

const paperSheet = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')

const productionIcon = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/icons/navigation-production-v2.png')

</script>

<template>
  <!-- Landscape art port: panel tu chu chrome giay tren overlay canvas
       (cung rect sheet 345/101/1065/608 voi cac paper surface anh em) -
       FunctionOverlayPanel mount thang mode 'exploration' nhu paperMode. -->
  <SceneDesignCanvas overlay>
    <section
      ref="sceneRef"
      class="production-panel"
      :aria-label="t('layout.functionOverlay.titles.exploration')"
      tabindex="-1"
      @click.self="closeScene"
    >
      <div
        class="production-panel__sheet"
        :style="{ backgroundImage: `url('${paperSheet}')` }"
        aria-hidden="true"
      />

      <div class="production-panel__frame">
        <header class="production-panel__title">
          <h1>{{ t('layout.functionOverlay.titles.exploration') }}</h1>
        </header>

        <div class="production-heading">
          <img class="production-heading__icon" :src="productionIcon" alt="" />

          <div class="production-heading__text">
            <h2>{{ outpostHeader.template.value?.name }}</h2>

            <span>{{ t('layout.functionOverlay.levelRange', { level: outpostHeader.instance.value?.level ?? 0, max: outpostHeader.template.value?.maxLevel ?? 0 }) }}</span>
          </div>

          <p class="production-panel__summary">
            {{ t('panels.production.summary') }}
          </p>

          <!-- Preview khong ve nut nang cap cong trinh - giu affordance
               canonical neo cuoi hang heading, cho owner ruling. -->
          <BuildingUpgradeButton :building-id="OUTPOST_ID" class="production-heading__upgrade" />
        </div>

      <!-- Chieu Hien Quan - phan bo nhan cong (2026-09-02). FINAL
           POLICY (sec.4C): component tu gate scope-hidden bang
           manualWorkforce - hidden, not merely disabled. -->
      <ProductionWorkerAllocation :rows="rows" :now-ms="nowMs" />

      <!-- Linh mach Khai Vat Duong - claim Linh Thach (the Linh Tuyen),
           preview .production-vein shape ben trong component. -->
      <ProductionVeinCard :now-ms="nowMs" />

      <div class="production-panel__grid production-sources">
        <ProductionSiteCard v-for="row in rows" :key="row.siteId" :row="row" />
      </div>

        <!-- Preview khai bao dai status line; canonical chua co nguon
             notice - element trong, owner wire feed sau. -->
        <p class="production-notice" role="status"></p>
      </div>
    </section>
  </SceneDesignCanvas>
</template>

<style scoped>
/* Landscape art port: scene root phu full overlay canvas (close bang
   click-outside + Escape) - noi dung nam trong sheet + frame. */
.production-panel {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  color: #30271b;
  font-family: var(--font-display);
}

.production-panel :deep(*) {
  box-sizing: border-box;
}

/* SHARED-PANEL-01: cung rect + nen giay voi cac fidelity scene anh em
   (.equipment-sheet) - 24%/12.5%/74%/75% tren canvas 1440x810. */
.production-panel__sheet {
  position: absolute;
  left: 345px;
  top: 101px;
  width: 1065px;
  height: 608px;
  background-color: #f2e4c8;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 3px double #b28a43;
}

.production-panel__frame {
  position: absolute;
  left: 345px;
  top: 101px;
  width: 1065px;
  height: 608px;
  box-sizing: border-box;
  padding: 12px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.production-panel__title {
  flex: none;
  height: 44px;
  border-bottom: 1px solid #b28a4370;
}

.production-panel__title h1 {
  margin: 0;
  font-size: 35px;
  line-height: 1.15;
}

.production-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  height: 55px;
}

.production-heading__icon {
  width: 50px;
  height: 50px;
  object-fit: contain;
}

.production-heading__text h2 {
  margin: 0;
  font-size: 24px;
}

.production-heading__text span {
  font-size: 13px;
}

.production-panel__summary {
  margin: 0 0 0 20px;
  max-width: 470px;
  font-size: 14px;
  font-style: italic;
  line-height: 1.5;
  color: #5a4526;
}

.production-heading__upgrade {
  flex: none;
  margin-left: auto;
}

.production-sources {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.production-notice {
  flex: none;
  height: 12px;
  margin: 0;
  font-size: 11px;
  text-align: center;
  color: #62512d;
}


</style>
