<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import ExplorationPaperMap from './ExplorationPaperMap.vue'
import ExplorationPaperDetails from './ExplorationPaperDetails.vue'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
const props = withDefaults(defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ select: [id: string]; zone: [id: string]; back: []; mode: [id: string]; stopFarm: []; openBuild: []; start: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')
const progress = computed(() => Number.isFinite(props.model.progress) ? Math.max(0, Math.min(100, props.model.progress)) : 0)

// Same dialog contract ImperialScrollScene carried: Escape closes,
// focus and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="exploration-scene" :aria-label="t('exploration.title')" @click.self="emit('back')">
    <div class="paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <header class="heading"><p class="eyebrow">{{ t('exploration.title') }}</p><h1 class="zone-title">{{ model.title }}</h1><img class="zone-divider" :src="titleDivider" alt=""><p class="subtitle">{{ model.subtitle }}</p>
      <div v-if="model.zones.length > 1" class="exploration-zones" role="group" :aria-label="t('exploration.zones')">
        <button v-for="zone in model.zones" :key="zone.id" :class="{ active: model.zone === zone.id, 'is-locked': !zone.unlocked }" :aria-pressed="model.zone === zone.id" :disabled="!zone.unlocked" @click="emit('zone', zone.id)">{{ zone.label }}</button>
      </div>
    </header>
    <div class="map-position"><ExplorationPaperMap :chapters="model.chapters" :terrain="model.terrain" :selected="stage?.id ?? ''" @select="emit('select', $event)" /></div>
    <div class="progress"><div class="progress-label"><span>{{ t('exploration.progress') }}</span><span>{{ model.progressLabel }}</span></div><div class="track" role="progressbar" :aria-label="t('exploration.progress')" :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${progress}%` }" /></div></div>
    <ExplorationPaperDetails :model="model" :stage="stage" :notice="notice" @mode="emit('mode', $event)" @stop-farm="emit('stopFarm')" @open-build="emit('openBuild')" @start="emit('start')" />
    <p v-if="preview" class="preview-label">{{ t('exploration.preview') }}</p>
  </section>
</template>
<style scoped>
.exploration-scene { position:absolute; inset:0; pointer-events:auto; color:#44331f; font-family:var(--font-display,Georgia,serif); line-height:1.3; }.exploration-scene :deep(*) { box-sizing:border-box; }.paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; filter:drop-shadow(0 12px 15px #0009); }.heading { position:absolute; left:237px; top:156px; right:440px; }.eyebrow { margin:0 0 3px; font-size:12px; letter-spacing:3px; color:#8b7348; }.zone-title { margin:0; font-size:34px; font-style:italic; font-weight:500; } .zone-divider{display:block;width:220px;margin:0;object-fit:contain;opacity:.9}.subtitle { margin:5px 0 0; font-size:13px; color:#78653f; }.exploration-zones { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }.exploration-zones button { padding:4px 12px; border:1px solid #a98a4b; border-radius:12px; background:#f2e6c8; color:#5a4a28; font:inherit; font-size:13px; cursor:pointer; }.exploration-zones button.active { background:#315f46; border-color:#315f46; color:#f4ead0; }.exploration-zones button.is-locked { opacity:.55; }.map-position { position:absolute; left:237px; top:246px; }.progress { position:absolute; left:249px; top:694px; width:690px; font-size:12px; }.progress-label { display:flex; justify-content:space-between; margin-bottom:6px; }.track { height:8px; border:1px solid #a88b4f; border-radius:4px; overflow:hidden; background:#b7a27244; }.track span { display:block; height:100%; background:linear-gradient(90deg,#315f46,#be984a); }.preview-label { position:absolute; left:235px; top:735px; margin:0; color:#806b43; font-size:9px; }
</style>
