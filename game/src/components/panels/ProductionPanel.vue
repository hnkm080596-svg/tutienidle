<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import ProductionSiteCard from '@/components/panels/production/ProductionSiteCard.vue'
import ProductionVeinCard from '@/components/panels/production/ProductionVeinCard.vue'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useUiStore } from '@/stores/ui'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { formatDuration } from '@/core/format/formatDuration'
import { TERRITORY_THANH_VAN } from '@/core/production/ProductionCatalog'

// San Xuat (2026-08-25, resource-professions-rework plan sec9.1) - thay
// ExplorationPanel: moi Dia Gioi hien thi dung ba card Lam/Quang/
// Dong Thien voi level + speed, trang thai idle/producing, dong ho
// cycle, normalized realm-tier weights and Auto toggle. Production runs
// independently for each enabled site; completions go straight to Bag.
const { t } = useI18n()

const KIND_META: Record<string, { labelKey: 'forest' | 'mine' | 'grotto' }> = {
  forest: { labelKey: 'forest' },
  mine: { labelKey: 'mine' },
  grotto: { labelKey: 'grotto' },
}

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const nowMs = ref(gameManager.time.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = gameManager.time.now()
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

  isProducing: boolean

  progress: number

  remainingLabel: string
  cycleSeconds: number
  baseOutputPerSecond?: { min: number; max: number }
}

const rows = computed<SiteRow[]>(() => {
  stateVersion.value

  void nowMs.value

  const ids = TERRITORY_THANH_VAN.productionSiteIds
  const order = [ids.mine, ids.forest, ids.grotto]
  return gameManager.buildingOps.getProductionViews(nowMs.value).filter(view => order.includes(view.definition.siteId)).sort((a,b) => order.indexOf(a.definition.siteId) - order.indexOf(b.definition.siteId)).map((view) => {
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

      isProducing: view.state.autoRestart || (view.state.productionCycles?.length ?? 0) > 0,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? formatDuration(remainingSeconds) : t('panels.production.done'),
      cycleSeconds: totalMs / 1000,
      baseOutputPerSecond: view.baseOutputPerSecond,
    }
  })
})

// ================= Linh mach Khai Vat Duong (the Linh Tuyen, 2026-09-02) =================

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
  <SceneDesignCanvas overlay>
    <section
      ref="sceneRef"
      class="production-panel rail-panel-scene"
      :aria-label="t('layout.functionOverlay.titles.exploration')"
      tabindex="-1"
      @click.self="closeScene"
    >
      <GamePanel :title="t('layout.functionOverlay.titles.exploration')">

      <div class="production-panel__frame">

        <div class="production-panel__grid production-sources">
          <ProductionVeinCard :now-ms="nowMs" />
          <ProductionSiteCard v-for="row in rows" :key="row.siteId" :row="row" />
        </div>
        <p class="production-notice" role="status"></p>
      </div>
      </GamePanel>
    </section>
  </SceneDesignCanvas>
</template>

<style scoped>
/* Landscape art port: scene root phu full overlay canvas (close bang
   click-outside + Escape) - noi dung nam trong sheet + frame. */
.production-panel {
  position: absolute;
  inset: 0;
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

/* Linh mach Khai Vat Duong */
.lin-mach__title {
  margin: 0;
  color: var(--paper-text-soft);
  font: 700 var(--text-sm) var(--font-display);
}

.lin-mach__card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--scene-water-accent) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-water-accent) 12%, var(--paper-50)), color-mix(in srgb, var(--scene-water-accent) 5%, var(--paper-100)));
}

.lin-mach__rate {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.lin-mach__collect {
  justify-self: start;
  padding: 6px 12px;
  background: var(--scene-water-accent);
  border: 0;
  color: var(--ink-950);
}

.lin-mach__collect:disabled {
  background: var(--paper-200);
  color: var(--paper-text-muted);
}

.lin-mach__progress {
  --bar-from: var(--scene-water-accent);
  --bar-to: var(--jade);
}

:is(#app, body) .production-panel .production-panel__grid.production-sources {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 0;
  box-sizing: border-box;
  border: 0;
  background: transparent;
}

:is(#app, body) .production-panel .production-sources > :deep(.production-source-card) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  gap: 0;
}

.production-sources :deep(.source-body strong) {
  color: #a5cfac;
}

.production-sources :deep(.site-card__reward) {
  color: #cfbc95;
}

.site-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.site-card__art {
  position: relative;
  min-height: 92px;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin: -12px -12px 2px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--scene-forest-accent) 25%, transparent), transparent 48%),
    linear-gradient(130deg, var(--scene-forest-deep), var(--scene-forest-deep-2));
}

.site-card__art[data-kind='mine'] { background: radial-gradient(circle, color-mix(in srgb, var(--scene-mine-accent) 24%, transparent), transparent 48%), linear-gradient(130deg, var(--scene-mine-deep), var(--scene-mine-deep-2)); }
.site-card__art[data-kind='grotto'] { background: radial-gradient(circle, color-mix(in srgb, var(--scene-grotto-accent) 25%, transparent), transparent 48%), linear-gradient(130deg, var(--scene-grotto-deep), var(--scene-grotto-deep-2)); }
.site-card__art span {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  color: color-mix(in srgb, var(--scene-forest-accent) 40%, var(--text-primary));
  font: 700 var(--text-display) var(--font-display);
  border: 1px solid color-mix(in srgb, var(--scene-forest-accent) 38%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--scene-forest-deep-2) 58%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--scene-forest-accent) 20%, transparent), inset 0 0 16px color-mix(in srgb, var(--scene-forest-accent) 8%, transparent);
}

.site-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}

.site-card__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.site-card__kind {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ink-700);
  font-size: var(--text-xs);
  color: var(--chrome-500);
}

.site-card__description {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.site-card__reward {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__progress {
  border-radius: 4px;
}

.site-card__progress :deep(.bar__fill) {
  transition: width 0.5s linear;
}

.site-card__status {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
  cursor: pointer;
}


/* Layout instances are relative to the owning panel content. */
.production-panel :deep(.game-panel__content .production-panel__frame) { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; background: transparent; border: 0; box-shadow: none; }
.production-panel :deep(.game-panel__content :is(.production-panel__title,.production-panel__sheet)) { display: none; }
</style>
