<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Building } from '@/core/building/Building'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import type { BuildingTooltipContent } from '@/composables/useTooltip'
import { useUiStore } from '@/stores/ui'
import {
  DONG_FU_BUILDING_ART,
  dongFuSeasonOverlayUrl,
  type DongFuBuildingArtEntry,
  type DongFuBuildingId,
} from '@/presentation/background/DongFuBuildingArt'
import type { ThanhVanVariant } from '@/presentation/background/BackgroundVariant'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'
import DongFuBuildingSprite from './DongFuBuildingSprite.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

interface SceneBuilding {
  art: DongFuBuildingArtEntry
  building: Building
}

const { variant } = defineProps<{
  variant: ThanhVanVariant
}>()

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const stageActive = useStageActive()
const navigation = useBuildingNavigation()
const ui = useUiStore()
const definitions = computed(() => gameManager.buildingOps.getBuildingDefinitions())
const reducedMotion = ref(false)
const assetErrors = ref<Set<DongFuBuildingId>>(new Set())

// Scene 03 spec: hotspots carry the building-plaque tag chrome.
const buildingPlaqueUrl = hkChromeUrl('building-plaque')

let reducedMotionQuery: MediaQueryList | undefined

// BETA SCOPE LOCK v2 (Phase-6): the hotspot layer consumes the
// canonical beta surface set - a scope-hidden building (chi_hien_quan)
// renders NO hotspot, nameplate or tooltip at all.
const sceneBuildings = computed<SceneBuilding[]>(() =>
  DONG_FU_BUILDING_ART.flatMap((art) => {
    if (!isBetaBuildingSurface(art.buildingId)) {
      return []
    }

    const building = definitions.value.find((entry) => entry.id === art.buildingId)
    return building ? [{ art, building }] : []
  }),
)
const seasonOverlayUrl = computed(() => dongFuSeasonOverlayUrl(variant.season))

function anchorStyle(entry: DongFuBuildingArtEntry) {
  return {
    left: `${entry.scenePlacement.xPercent}%`,
    top: `${entry.scenePlacement.yPercent}%`,
    width: `${entry.scenePlacement.scale * 100}%`,
    zIndex: entry.scenePlacement.zIndex,
    '--baseline-y': `${entry.baselineY / entry.canvas.height * 100}%`,
    '--baseline-offset': `${-entry.baselineY / entry.canvas.height * 100}%`,
    '--hit-left': `${entry.hitbox.x / entry.canvas.width * 100}%`,
    '--hit-top': `${entry.hitbox.y / entry.canvas.height * 100}%`,
    '--hit-width': `${entry.hitbox.width / entry.canvas.width * 100}%`,
    '--hit-height': `${entry.hitbox.height / entry.canvas.height * 100}%`,
  }
}

// T4-31 - these run inside the template's tracked render, but the domain
// objects they read are not reactive. Reading stateVersion makes the
// badge/nameplate/tooltip re-derive on every game-state bump.
function presentationFor(buildingId: string) {
  stateVersion.value
  return navigation.getBuildingPresentation(buildingId)
}

function statusFor(buildingId: string) {
  stateVersion.value
  return navigation.getBuildingStatus(buildingId)
}

function isSelected(building: Building): boolean {
  return ui.activeBuildingPopoverId === building.id
    || (building.functionType !== undefined && ui.leftPanelMode === building.functionType)
}

function tooltipFor(building: Building): BuildingTooltipContent {
  const presentation = presentationFor(building.id)
  return {
    kind: 'building',
    name: building.name,
    functionLabel: building.description,
    statusLabel: presentation.isBuilt
      ? t('homeBuildings.status.built', { level: presentation.level, max: building.maxLevel })
      : t('homeBuildings.status.notBuilt'),
    isBuilt: presentation.isBuilt,
  }
}

function markAssetError(buildingId: DongFuBuildingId): void {
  assetErrors.value = new Set(assetErrors.value).add(buildingId)
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotion.value = reducedMotionQuery?.matches ?? false
  reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange)
})

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange)
})
</script>

<template>
  <div v-if="!stageActive" class="home-building-hotspots" data-canonical-layer="L3">
    <div class="home-building-hotspots__art-space">
      <div
        v-for="scene in sceneBuildings"
        :key="scene.art.buildingId"
        class="building-hotspot-anchor"
        :class="{ 'has-asset-error': assetErrors.has(scene.art.buildingId) }"
        :style="anchorStyle(scene.art)"
        :data-building-id="scene.art.buildingId"
      >
        <button
          type="button"
          class="building-hotspot"
          :class="{
            'is-built': presentationFor(scene.building.id).isBuilt,
            'is-upgradeable': presentationFor(scene.building.id).isUpgradeable,
            'is-selected': isSelected(scene.building),
          }"
          :aria-label="presentationFor(scene.building.id).isBuilt
            ? t('homeBuildings.aria.open', { name: scene.building.name })
            : t('homeBuildings.aria.viewRequirements', { name: scene.building.name })"
          v-tooltip="tooltipFor(scene.building)"
          @click.stop="navigation.openBuilding(scene.building.id)"
        >
          <DongFuBuildingSprite
            :art="scene.art"
            :status="statusFor(scene.building.id)"
            :selected="isSelected(scene.building)"
            :disabled="false"
            :season="variant.season"
            :time="variant.time"
            :reduced-motion="reducedMotion"
            @asset-error="markAssetError"
          />
          <span class="building-hotspot__hitbox" />
        </button>

        <!-- Nameplate LUÔN hiện, style pill/paper-flat dời từ hover-label
             cũ (2026-08-30 bug report: 2 label cùng vị trí đè lên nhau khi
             hover — giữ label sẵn, xoá hẳn label hover riêng, mượn style
             đẹp hơn của nó thay vào đây, kèm luôn "Cấp X/Chưa mở" mà
             trước đây CHỈ hover mới thấy). -->
        <span
          class="building-nameplate"
          :class="`building-nameplate--${statusFor(scene.building.id)}`"
          :data-hk-region="`hotspot-${scene.art.buildingId}`"
          aria-hidden="true"
        >
          <span v-if="statusFor(scene.building.id) === 'locked'" class="building-nameplate__lock" />
          <span v-else-if="statusFor(scene.building.id) === 'ready'" class="building-nameplate__ready" />
          <span v-else-if="statusFor(scene.building.id) === 'active'" class="building-nameplate__active" />
          <span v-else-if="statusFor(scene.building.id) === 'upgradeable'" class="building-nameplate__upgradeable" />
          <span class="building-nameplate__tag">
            <img v-if="buildingPlaqueUrl" class="building-nameplate__plaque" :src="buildingPlaqueUrl" alt="" aria-hidden="true" />
            <span class="building-nameplate__text">{{ scene.building.name }}</span>
          </span>
          <small class="building-nameplate__level">{{ presentationFor(scene.building.id).isBuilt
            ? t('homeBuildings.level', { level: presentationFor(scene.building.id).level })
            : t('homeBuildings.notBuilt') }}</small>
        </span>
      </div>

      <img
        class="home-building-hotspots__season-overlay"
        :src="seasonOverlayUrl"
        :data-season="variant.season"
        alt=""
        draggable="false"
        aria-hidden="true"
      >
    </div>
  </div>
</template>

<style scoped>
.home-building-hotspots {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
}

.home-building-hotspots__art-space {
  position: relative;
  aspect-ratio: 1672 / 941;
  min-width: 100%;
  min-height: 100%;
  pointer-events: none;
}

.building-hotspot-anchor {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, var(--baseline-offset));
  pointer-events: none;
}

.building-hotspot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--paper-text);
  pointer-events: none;
  -webkit-tap-highlight-color: transparent;
}

.building-hotspot__hitbox {
  position: absolute;
  left: var(--hit-left);
  top: var(--hit-top);
  width: var(--hit-width);
  height: var(--hit-height);
  cursor: pointer;
  pointer-events: auto;
}

.building-hotspot:focus-visible { outline: none; }
.building-hotspot:focus-visible .building-hotspot__hitbox {
  outline: 2px solid var(--gold-500);
  outline-offset: 3px;
  border-radius: 42%;
}

/* Nameplate always visible. Huyen Kim S03 (2026-10-02): the plate is a
   VERTICAL hanging tag using the `building-plaque` chrome art (96x160)
   instead of the old horizontal pill - name runs top-to-bottom
   (vertical-rl, wrapping into columns for long names), level sits under
   the tag, status is the dot at the tag top. */
.building-nameplate {
  position: absolute;
  left: 50%;
  top: calc(var(--baseline-y) + 2px);
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transform: translateX(-50%);
  pointer-events: none;
}

.building-nameplate__tag {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 30px;
  min-height: 58px;
  padding: 8px 6px;
  /* Pending/fallback surface - the plaque PNG owns the tag face when
     the chrome slot resolves. */
  border: 1px solid color-mix(in srgb, var(--gold-500) 55%, var(--frame-outer));
  border-radius: 4px;
  background: linear-gradient(180deg, var(--paper-50), color-mix(in srgb, var(--paper-50) 88%, var(--gold-500)));
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  color: var(--paper-text);
  font: 600 10px var(--font-body);
  line-height: var(--lh-tight);
}

.building-nameplate__tag:has(.building-nameplate__plaque) {
  border-color: transparent;
  background: none;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

.building-nameplate__plaque {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.building-nameplate__text {
  position: relative;
  z-index: 1;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 76px;
  overflow: hidden;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 1px 0 rgba(255, 248, 220, 0.35));
}

.building-nameplate__level {
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-950) 78%, transparent);
  color: var(--surface-text-soft);
  font-size: 9px;
  font-weight: 400;
  white-space: nowrap;
}
.building-nameplate__lock {
  position: relative;
  flex: 0 0 auto;
  width: 0.58em;
  height: 0.5em;
  border: 1px solid currentColor;
  border-radius: 2px;
}
.building-nameplate__lock::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.55em;
  width: 0.36em;
  height: 0.55em;
  border: 1px solid currentColor;
  border-bottom: 0;
  border-radius: 0.36em 0.36em 0 0;
  transform: translateX(-50%);
}
.building-nameplate__ready,
.building-nameplate__active,
.building-nameplate__upgradeable {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.building-nameplate--locked { color: var(--paper-text-muted); opacity: 0.85; }
.building-nameplate--locked .building-nameplate__lock { border-color: var(--paper-text-muted); }
.building-nameplate--ready { color: var(--jade-on-paper, var(--jade)); }
.building-nameplate--ready .building-nameplate__ready { background: var(--jade); box-shadow: 0 0 6px var(--jade); }
.building-nameplate--active { color: var(--el-fire); }
.building-nameplate--active .building-nameplate__active { background: var(--el-fire); box-shadow: 0 0 6px var(--el-fire); }
.building-nameplate--upgradeable { color: var(--gold-700-on-paper, var(--mineral-gold)); }
.building-nameplate--upgradeable .building-nameplate__upgradeable { background: var(--gold-500); box-shadow: 0 0 6px var(--gold-500); }

.home-building-hotspots__season-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  width: 100%;
  height: 100%;
  object-fit: fill;
  /* Giảm 50% (2026-08-30, bug report: khung trúc/lá che building Truyền
     Tống Trận quá đậm) — vẫn giữ khung trang trí, chỉ nhạt bớt. */
  opacity: 0.5;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .building-hotspot__hover-label { transition: none; }
}
</style>
