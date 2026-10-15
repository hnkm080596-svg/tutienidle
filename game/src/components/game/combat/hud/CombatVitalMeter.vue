<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const props = withDefaults(defineProps<{
  label: string
  text: string
  percent: number
  tone?: 'hp' | 'mp' | 'resource'
  wardPercent?: number
  frameSrc?: string
}>(), { tone: 'hp', wardPercent: 0 })
const frame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/player-card/meter-frame-v1.png')
const fill = computed(() => Math.max(0, Math.min(100, props.percent)))
const ward = computed(() => Math.max(0, Math.min(100, props.wardPercent)))
</script>

<template>
  <div class="combat-vital-meter" :class="`combat-vital-meter--${tone}`">
    <span class="combat-vital-meter__label">{{ label }}</span>
    <div class="combat-vital-meter__track" role="progressbar" :aria-label="label" :aria-valuenow="fill" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="text">
      <div class="combat-vital-meter__interior">
        <span class="combat-vital-meter__fill" :style="{ width: `${fill}%` }" />
        <span v-if="ward > 0" class="combat-vital-meter__ward" :style="{ width: `${ward}%` }" />
      </div>
      <img class="combat-vital-meter__frame" :src="frameSrc ?? frame" alt="" aria-hidden="true" />
    </div>
    <span class="combat-vital-meter__value">{{ text }}</span>
  </div>
</template>

<style scoped>
.combat-vital-meter { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 4px; min-width: 0; color: #f1dba9; font: 600 11px/1.2 var(--font-body); }
.combat-vital-meter__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.combat-vital-meter__value { min-width: 58px; text-align: right; font-variant-numeric: tabular-nums; }
.combat-vital-meter__track { position: relative; height: 22px; min-width: 0; overflow: clip; }
.combat-vital-meter__interior { position: absolute; inset: 5px 9%; overflow: hidden; background: #16120e; clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 50%, calc(100% - 4px) 100%, 4px 100%, 0 50%); }
.combat-vital-meter__fill,.combat-vital-meter__ward { position: absolute; inset: 0 auto 0 0; transition: width 150ms linear; }
.combat-vital-meter__fill { background: linear-gradient(#ee7953, #ba3124 50%, #631819); }
.combat-vital-meter--mp .combat-vital-meter__fill { background: linear-gradient(#68c4eb, #167eb2 50%, #123953); }
.combat-vital-meter--resource .combat-vital-meter__fill { background: linear-gradient(#ead394, #ae8738 50%, #584421); }
.combat-vital-meter__ward { left: auto; right: 0; background: #e1ca89; opacity: .8; }
.combat-vital-meter__frame { position: absolute; width: 100%; height: 480%; object-fit: fill; top: 50%; left: 0; transform: translateY(-50%); pointer-events: none; }
</style>
