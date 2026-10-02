<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { getActiveWayDefinition } from '@/core/player/CultivationPathKit'
import { getActiveElement } from '@/core/player/CultivationPathSystem'

// figure-wheel region: the Ngu Hanh formation wheel orbiting the standing
// figure - formation rings + pentagram + five element medallions on the
// pentagon points, the Hon Nguyen taiji resting at the dantian, and the
// player's hero-element disc glowing behind the portrait.
const { t } = useI18n()
const player = usePlayerStore()

// M5 - the active way (cultivationWay authoritative) drives the kit
// element; getActiveWayDefinition resolves the persisted (path, way)
// pair and fails closed on a way-less/corrupt save.
const chosenKit = computed(() => getActiveWayDefinition(player))
const heroElement = computed(() => getActiveElement(player) ?? chosenKit.value?.element ?? null)
const heroDiscUrl = computed(() =>
  resolveAssetUrl(
    heroElement.value
      ? `/assets/ui/elements/el-${heroElement.value}.png`
      : '/assets/ui/elements/el-formation-ring.png',
  ),
)

// No sinh/khac cycle - each hanh is independent (Last Epoch style).
const elementRows = computed(() =>
  ELEMENT_ORDER.map(element => ({
    element,
    label: ELEMENT_LABELS[element],
    color: ELEMENT_COLOR_VARS[element],
    power: player.finalStats[`${element}Power`],
    resistance: player.finalStats[`${element}Resistance`],
    penetration: player.finalStats[`${element}Penetration`],
  })),
)

// Hon Nguyen (Void) - only Power, no Armor/Resistance at all.
const PRIMORDIAL_COLOR = 'var(--el-primordial)'
const primordialDiscUrl = resolveAssetUrl('/assets/ui/elements/el-primordial.png')

// 3 concentric formation rings from the same sprite sheet.
const formationRingUrl = resolveAssetUrl('/assets/ui/elements/el-formation-ring.png')
const formationOrbsUrl = resolveAssetUrl('/assets/ui/elements/el-formation-orbs.png')
const formationStarUrl = resolveAssetUrl('/assets/ui/elements/el-formation-star.png')

const PORTRAIT_HEIGHT = 230
</script>

<template>
  <figure class="character-panel__figure figure-wheel" data-hk-region="figure-wheel">
    <!-- Temp art: ink vista backdrop - moon, clouds, standing dais. -->
    <div class="figure-wheel__backdrop art-needed" data-art-id="character-figure-backdrop" aria-hidden="true">
      <span class="figure-wheel__moon" />
      <span class="figure-wheel__cloud figure-wheel__cloud--a" />
      <span class="figure-wheel__cloud figure-wheel__cloud--b" />
      <span class="figure-wheel__dais" />
    </div>

    <div class="figure-wheel__orbit element-wheel">
      <img class="element-wheel__ring element-wheel__ring--orbs" :src="formationOrbsUrl" alt="" aria-hidden="true" />
      <img class="element-wheel__ring element-wheel__ring--band" :src="formationRingUrl" alt="" aria-hidden="true" />
      <img class="element-wheel__ring element-wheel__ring--inner" :src="formationStarUrl" alt="" aria-hidden="true" />
      <svg class="element-wheel__star" viewBox="0 0 100 100" aria-hidden="true">
        <polygon class="element-wheel__star-line" points="50,15 73,76 14,40 86,40 27,76" />
      </svg>

      <div
        v-for="row in elementRows"
        :key="row.element"
        class="element-node"
        :data-element="row.element"
        :class="[`element-node--${row.element}`, { 'element-node--hero': row.element === heroElement }]"
        :style="{ '--node-color': row.color }"
        v-tooltip="{ kind: 'element', element: row.element, title: row.label, description: t('panels.character.tooltips.elementStat', { power: Math.round(row.power), resistance: Math.round(row.resistance), penetration: Math.round(row.penetration) }) }"
      >
        <img class="element-node__disc" :src="resolveAssetUrl(`/assets/ui/elements/el-${row.element}.png`)" :alt="row.label" />
        <span class="element-node__tag">{{ row.label }}</span>
      </div>
    </div>

    <img class="figure-wheel__disc" :src="heroDiscUrl" alt="" aria-hidden="true" />
    <PlayerPortrait
      class="figure-wheel__sprite"
      variant="portrait"
      :height="PORTRAIT_HEIGHT"
    />

    <div
      class="element-node element-node--primordial"
      :style="{ '--node-color': PRIMORDIAL_COLOR }"
      v-tooltip="{ kind: 'element', element: 'primordial', title: t('panels.character.tooltips.primordialTitle'), description: t('panels.character.tooltips.primordialStat', { power: formatNumber(Math.round(player.finalStats.primordialPower)) }) }"
    >
      <img class="element-node__disc" :src="primordialDiscUrl" :alt="t('panels.character.tooltips.primordialTitle')" />
      <span class="element-node__core">{{ formatNumber(Math.round(player.finalStats.primordialPower)) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.figure-wheel {
  position: relative;
  min-height: 0;
  margin: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* ---- temp art: the painted backdrop (ink vista + dais) ---- */
.figure-wheel__backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #7a6234) 55%, transparent);
  border-radius: var(--hk-radius-md, 8px);
  background:
    radial-gradient(ellipse 90% 55% at 50% 108%, rgba(49, 95, 85, 0.5), transparent 70%),
    radial-gradient(ellipse 70% 60% at 50% 0%, rgba(185, 154, 85, 0.10), transparent 65%),
    linear-gradient(180deg, #17211f 0%, #101718 60%, #0c1213 100%);
}

.figure-wheel__moon {
  position: absolute;
  left: 50%;
  top: 9%;
  width: 62%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 44% 40%, rgba(237, 230, 214, 0.16), rgba(237, 230, 214, 0.05) 55%, transparent 72%);
}

.figure-wheel__cloud {
  position: absolute;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(185, 154, 85, 0.5), transparent);
}
.figure-wheel__cloud--a { left: 8%; right: 18%; top: 34%; }
.figure-wheel__cloud--b { left: 24%; right: 6%; top: 64%; }

.figure-wheel__dais {
  position: absolute;
  left: 50%;
  bottom: 3%;
  width: 58%;
  height: 9%;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 40%, rgba(49, 95, 85, 0.85), rgba(16, 23, 24, 0.95) 72%);
  border: 1px solid rgba(185, 154, 85, 0.4);
}

/* ---- the Ngu Hanh orbit (element medallions on pentagon points) ---- */
.figure-wheel__orbit {
  position: absolute;
  left: 50%;
  top: 4%;
  width: min(100%, 48cqh);
  max-width: 340px;
  aspect-ratio: 1;
  transform: translateX(-50%);
}

.element-wheel__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.element-wheel__ring--orbs { width: 96%; opacity: 0.45; }
.element-wheel__ring--band { width: 80%; opacity: 0.5; }
.element-wheel__ring--inner { width: 56%; opacity: 0.5; }

.element-wheel__star {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.element-wheel__star-line {
  fill: none;
  stroke: var(--mineral-gold, #b79653);
  stroke-width: 0.55;
  opacity: 0.45;
}

.element-node {
  position: absolute;
  width: 22%;
  transform: translate(-50%, -50%);
  cursor: default;
  z-index: 2;
}

.element-node__disc {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--node-color) 45%, transparent));
  transition: transform 0.15s ease, filter 0.15s ease;
}

.element-node:hover .element-node__disc {
  transform: scale(1.07);
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--node-color) 70%, transparent));
}

/* Pentagon points - disc centers match the star polygon vertices. */
.element-node--fire { left: 50%; top: 15%; }
.element-node--earth { left: 86%; top: 40%; }
.element-node--metal { left: 73%; top: 76%; }
.element-node--water { left: 27%; top: 76%; }
.element-node--wood { left: 14%; top: 40%; }

/* The player's committed element reads as the wheel's anchor: slightly
   larger disc + lit tag + halo. */
.element-node--hero {
  width: 27%;
  z-index: 3;
}
.element-node--hero .element-node__disc {
  filter: drop-shadow(0 0 14px color-mix(in srgb, var(--node-color) 80%, transparent));
}
.element-node--hero .element-node__tag {
  color: var(--node-color);
  border-color: color-mix(in srgb, var(--node-color) 65%, transparent);
}

/* Spec a11y: elements carry text labels, not color alone. */
.element-node__tag {
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translate(-50%, 100%);
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #7a6234) 60%, transparent);
  border-radius: 999px;
  background: rgba(12, 18, 19, 0.82);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--paper-text-soft);
  white-space: nowrap;
  pointer-events: none;
}

/* ---- the standing figure over the formation hub ---- */
.figure-wheel__disc {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 62%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  opacity: 0.8;
  filter: drop-shadow(0 0 12px rgba(185, 154, 85, 0.3));
  pointer-events: none;
  z-index: 1;
}

.figure-wheel__sprite {
  position: relative;
  z-index: 2;
  pointer-events: none;
}

/* Hon Nguyen taiji at the dantian, in front of the figure. */
.element-node--primordial {
  left: 50%;
  top: 74%;
  width: 15%;
  min-width: 44px;
  z-index: 4;
}

.element-node__core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--mineral-gold, #b79653) 60%, transparent);
  border-radius: 999px;
  background: rgba(16, 14, 10, 0.78);
  color: var(--gold-300, #ffd54f);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
