<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { ExplorationChapter } from './explorationUi'
const props = defineProps<{ chapters: readonly ExplorationChapter[]; terrain: string; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const ring = resolveAssetUrl('/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png')
const lockIcon = resolveAssetUrl('/assets/ui/huyen-kim/symbols/lock.svg')
const bands = computed(() => props.chapters.map(chapter => ({
  ...chapter,
  lines: chapter.edges.flatMap(edge => {
    const from = chapter.nodes.find(node => node.id === edge.from)
    const to = chapter.nodes.find(node => node.id === edge.to)
    return from && to ? [{ id: `${from.id}-${to.id}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y }] : []
  }),
})))
</script>
<template>
  <div class="exploration-map">
    <img class="terrain" :src="terrain" alt="">
    <div class="exploration-map-scroll"><section v-for="chapter in bands" :key="chapter.id" :class="['chapter', chapter.tone]" :aria-label="chapter.label">
      <h2 class="chapter-label">{{ chapter.label }}</h2>
      <svg class="routes" viewBox="0 0 720 140" aria-hidden="true"><line v-for="line in chapter.lines" :key="line.id" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" /></svg>
      <button v-for="node in chapter.nodes" :key="node.id" type="button" :class="['stage-node', node.state, { selected: selected === node.id, boss: node.boss, perfect: node.perfect }]" :style="{ left: `${node.x}px`, top: `${node.y}px` }" :aria-label="t('exploration.stageLabel', { chapter: chapter.label, stage: node.label, state: t(`exploration.state.${node.state}`) })" :aria-pressed="selected === node.id" :aria-disabled="node.state === 'locked' ? 'true' : undefined" :title="node.state === 'locked' ? (node.lockedHint ?? t('exploration.state.locked')) : undefined" :data-stage-id="node.id" @click="node.state !== 'locked' && emit('select', node.id)">
        <img class="node-ring" :src="ring" alt=""><span class="node-number">{{ node.label }}</span><small v-if="node.boss" class="boss-label">{{ t('exploration.boss') }}</small><small v-else-if="node.enemy" class="node-enemy">{{ node.enemy }}</small><span v-if="node.state === 'cleared'" class="clear-mark" aria-hidden="true">✓</span><span v-if="node.perfect" class="perfect-mark" aria-hidden="true">★</span><img v-if="node.state === 'locked'" class="lock-mark" :src="lockIcon" alt="" aria-hidden="true">
      </button>
    </section></div>
  </div>
</template>
<style scoped>
.exploration-map { position:relative; width:720px; height:450px; overflow:hidden; }
.terrain { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none; }
.exploration-map-scroll { position:relative; height:100%; overflow-y:auto; scrollbar-width:thin; }
.chapter { position:relative; height:150px; --tone:#315f46; }.chapter.blue { --tone:#335875; }.chapter.violet { --tone:#665277; }
.chapter-label { position:absolute; left:10px; top:3px; margin:0; padding:6px 12px; border-left:3px solid var(--tone); background:linear-gradient(90deg,#f4e8ccd9,#f4e8cc00); color:var(--tone); font-size:23px; font-weight:500; z-index:1; }
.routes { position:absolute; inset:0; width:720px; height:140px; pointer-events:none; }.routes line { stroke:#81662e; stroke-width:2; stroke-dasharray:4 4; }
.stage-node { position:absolute; width:46px; height:46px; transform:translate(-50%,-50%); border:0; border-radius:50%; background:var(--tone); color:#fff1c9; cursor:pointer; font:16px var(--font-display,Georgia,serif); box-shadow:0 2px 5px #30281955; transition:box-shadow .15s ease; }
.node-ring { position:absolute; inset:-3px; width:52px; height:52px; pointer-events:none; }.node-number { position:relative; }.stage-node.locked { background:#ece0c7; color:#675e51; cursor:not-allowed; }
/* Lock badge mirrors .perfect-mark's corner stamp - locked nodes keep
   aria-disabled + click-guard (not `disabled`) so focus/hover still
   reach the state label, same convention as SlotView. */
.lock-mark { position:absolute; right:-3px; top:-3px; width:15px; height:15px; padding:2px; background:#efe2c6; border:1px solid #8f7a52; border-radius:50%; box-shadow:0 1px 3px #30281966; pointer-events:none; }.stage-node.available { background:#8a7a52; color:#f4ead0; }.stage-node.selected { outline:2px solid #b68527; outline-offset:5px; box-shadow:0 0 16px #edc15ccc; }.stage-node:hover { box-shadow:0 0 14px #f7d383; }.stage-node:focus-visible { outline:3px solid #245e4f; outline-offset:5px; }.stage-node.boss { border-radius:12px; background:#6c3d37; color:#ffebba; }.boss-label { position:absolute; left:50%; top:48px; transform:translateX(-50%); white-space:nowrap; color:#6b3827; font-size:11px; background:#f0e2c6d9; padding:1px 5px; z-index:1; }.node-enemy { position:absolute; left:50%; top:48px; transform:translateX(-50%); white-space:nowrap; color:#6a5636; font-size:10px; z-index:1; }.clear-mark { position:absolute; right:-2px; bottom:-1px; background:#315f46; border-radius:50%; padding:0 3px; font-size:11px; }.perfect-mark { position:absolute; left:-3px; top:-3px; color:#d4a017; text-shadow:0 0 3px #fff3cf; font-size:13px; }
@media (prefers-reduced-motion:reduce) { .stage-node { transition:none; } }
</style>
