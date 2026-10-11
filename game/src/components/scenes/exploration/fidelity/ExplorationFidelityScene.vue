<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import ExplorationPaperMap from './ExplorationPaperMap.vue'
import ExplorationPaperDetails from './ExplorationPaperDetails.vue'
import type { ExplorationPaperModel, ExplorationDetail, ExplorationChapter } from './explorationUi'
const props = withDefaults(defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string; preview?: boolean; chapter?: string }>(), { preview: false, chapter: '' })
const emit = defineEmits<{ select: [id: string]; zone: [id: string]; back: []; mode: [id: string]; stopFarm: []; openBuild: []; start: []; chapter: [id: string] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')

// Same dialog contract ImperialScrollScene carried: Escape closes,
// focus and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

// Son Ha Do home-panel shape: one chapter visible at a time, picked
// from the left rail. Production drives the active chapter through the
// `chapter` prop (the surface re-picks the stage on rail clicks, same
// semantics as selectFirstStageInZone); preview mounts without the
// prop, so a local ref keeps the rail working there.
const localChapter = ref('')
const selectedChapter = computed(() =>
  props.model.chapters.find(chapter => chapter.nodes.some(node => node.id === props.stage?.id)) ?? null,
)
const activeChapterId = computed(() =>
  props.chapter || localChapter.value || selectedChapter.value?.id || props.model.chapters[0]?.id || '',
)
const activeChapter = computed<ExplorationChapter | null>(() =>
  props.model.chapters.find(chapter => chapter.id === activeChapterId.value) ?? props.model.chapters[0] ?? null,
)
watch(activeChapterId, id => { if (id) localChapter.value = id })

interface ChapterRailEntry {
  id: string
  label: string
  locked: boolean
  progressLabel: string
}
const chapterRail = computed<ChapterRailEntry[]>(() =>
  props.model.chapters.map(chapter => {
    const cleared = chapter.nodes.filter(node => node.state === 'cleared').length
    return {
      id: chapter.id,
      label: chapter.label,
      locked: chapter.nodes.length > 0 && chapter.nodes.every(node => node.state === 'locked'),
      progressLabel: `${cleared} / ${chapter.nodes.length}`,
    }
  }),
)
function pickChapter(id: string) {
  localChapter.value = id
  emit('chapter', id)
}
</script>
<template>
  <section ref="rootRef" class="exploration-scene" :aria-label="t('exploration.title')" @click.self="emit('back')">
    <div class="map-sheet" :style="{ backgroundImage: `url('${paper}')` }" aria-hidden="true" />
    <header class="map-head">
      <h1>{{ t('dongFu.nav.exploration') }}</h1>
      <div v-if="model.zones.length > 1" class="exploration-zones" role="group" :aria-label="t('exploration.zones')">
        <button v-for="zone in model.zones" :key="zone.id" :class="{ active: model.zone === zone.id, 'is-locked': !zone.unlocked }" :aria-pressed="model.zone === zone.id" :disabled="!zone.unlocked" @click="emit('zone', zone.id)">{{ zone.label }}</button>
      </div>
      <p class="map-identity">{{ model.title }}<template v-if="model.subtitle"> · {{ model.subtitle }}</template></p>
    </header>
    <div class="map-grid">
      <nav class="map-chapters" :aria-label="t('exploration.chapters')">
        <h2>{{ t('exploration.chapters') }}</h2>
        <button v-for="chapter in chapterRail" :key="chapter.id" type="button" :class="{ selected: chapter.id === activeChapterId, 'is-locked': chapter.locked }" :aria-pressed="chapter.id === activeChapterId" :data-chapter-id="chapter.id" @click="pickChapter(chapter.id)"><small>{{ t('panels.stageSelect.labels.chapterPrefix', { chapter: chapter.id }) }}</small><b>{{ chapter.label }}</b><span>{{ chapter.locked ? t('exploration.state.locked') : chapter.progressLabel }}</span></button>
      </nav>
      <ExplorationPaperMap :chapter="activeChapter" :terrain="model.terrain" :selected="stage?.id ?? ''" :caption="t('exploration.empty')" @select="emit('select', $event)" />
      <ExplorationPaperDetails :model="model" :stage="stage" :notice="notice" @mode="emit('mode', $event)" @stop-farm="emit('stopFarm')" @open-build="emit('openBuild')" @start="emit('start')" />
    </div>
    <p v-if="preview" class="preview-label">{{ t('exploration.preview') }}</p>
  </section>
</template>
<style scoped>
.exploration-scene { position:absolute; inset:0; pointer-events:auto; color:#44331f; font-family:var(--font-display,Georgia,serif); line-height:1.3; }.exploration-scene :deep(*) { box-sizing:border-box; }
.map-sheet { position:absolute; left:345px; top:101px; width:1065px; height:608px; background-color:#f2e4c8; background-size:cover; background-position:center; border:3px double #b28a43; box-sizing:border-box; }
.map-head { position:absolute; left:369px; top:113px; width:1017px; height:52px; border-bottom:1px solid #b28b4680; display:flex; align-items:center; gap:16px; }
.map-head h1 { margin:0; font:700 38px/1.2 var(--font-display,Georgia,serif); }
.map-identity { margin:0 0 0 auto; font-size:13px; color:#785c31; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:340px; }
.exploration-zones { display:flex; gap:6px; }
.exploration-zones button { padding:3px 10px; border:1px solid #a98a4b; border-radius:12px; background:#f2e6c8; color:#5a4a28; font:inherit; font-size:12px; cursor:pointer; }
.exploration-zones button.active { background:#315f46; border-color:#315f46; color:#f4ead0; }
.exploration-zones button.is-locked { opacity:.55; }
.map-grid { position:absolute; left:369px; top:179px; width:1017px; height:512px; display:grid; grid-template-columns:145px minmax(0,1fr) 235px; gap:14px; }
.map-chapters { min-height:0; overflow-y:auto; scrollbar-width:none; border-right:1px solid #b28b4650; padding-right:10px; }
.map-chapters::-webkit-scrollbar { display:none; }
.map-chapters h2 { margin:0 0 12px; font-size:21px; font-weight:600; }
.map-chapters button { width:100%; display:grid; gap:4px; padding:10px 6px; border:0; border-bottom:1px solid #b28b4650; background:transparent; color:#30271b; font:15px var(--font-display,Georgia,serif); text-align:left; cursor:pointer; }
.map-chapters button small { font-size:12px; color:#8a7448; }
.map-chapters button b { font-size:16px; font-weight:600; }
.map-chapters button span { font-size:13px; color:#6a5636; }
.map-chapters button.selected { background:#dcb86450; border:3px double #b28b46; }
.map-chapters button.is-locked { opacity:.6; }
.map-chapters button:focus-visible { outline:2px solid #765324; outline-offset:2px; }
.preview-label { position:absolute; left:369px; top:693px; margin:0; color:#806b43; font-size:9px; }
</style>
