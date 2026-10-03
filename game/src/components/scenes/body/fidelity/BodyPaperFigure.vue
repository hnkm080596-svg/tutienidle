<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { BodyPaperModel } from './bodyUi'
const props = defineProps<{ model: BodyPaperModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const figure = computed(() => resolveAssetUrl(`/assets/ui/huyen-kim/scene/body-v2/${props.model.chapter === 'refinement' ? 'mortal-horse-stance-v1' : props.model.chapter === 'meridian' ? 'qi-taichi-v1' : 'zhou-meditation-v1'}.png`))
const ring = resolveAssetUrl('/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png')
const fill = computed(() => Number.isFinite(props.model.progress) ? Math.min(100,Math.max(0,props.model.progress)) : 0)
// Meridian orbs ring the figure: positions derive from the unit count so
// every authored meridian owns a distinct anchor (previously 8 fixed
// anchors collided once the catalog grew past eight).
const anchors = computed(() => props.model.units.map((_, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / props.model.units.length
  return { x: 50 + Math.cos(angle) * 38, y: 38 + Math.sin(angle) * 33 }
}))
</script>
<template>
  <section class="body-paper-figure" :aria-label="model.chapterLabel">
    <img class="body-figure-art" :src="figure" alt="">
    <template v-if="model.chapter === 'meridian'"><button v-for="(unit,index) in model.units" :key="unit.id" :class="['body-orb',unit.state,{selected:selected === unit.id}]" :style="{left:`${anchors[index]!.x}%`,top:`${anchors[index]!.y}%`}" :aria-pressed="selected === unit.id" @click="emit('select',unit.id)"><img :src="ring" alt=""><span>{{ unit.label }}</span></button></template>
    <div class="body-progress"><div><span>{{ model.chapterLabel }}</span><span>{{ model.progressLabel }}</span></div><div class="body-progress-track" role="progressbar" :aria-label="t('body.progress')" :aria-valuenow="fill" :aria-valuemin="0" :aria-valuemax="100"><span :style="{width:`${fill}%`}" /></div></div>
    <div class="body-unit-rail" :aria-label="t('body.units')"><button v-for="unit in model.units" :key="unit.id" :class="[unit.state,{selected:selected === unit.id}]" :aria-pressed="selected === unit.id" @click="emit('select',unit.id)">{{ unit.label }}<small>{{ t(`body.state.${unit.state}`) }}</small></button><span v-for="milestone in model.milestones" :key="milestone.id" :class="['body-milestone',{done:milestone.done}]">{{ milestone.label }}</span></div>
  </section>
</template>
<style scoped>
.body-paper-figure { position:absolute; left:404px; top:190px; width:540px; height:523px; }.body-halo { position:absolute; left:65px; top:10px; width:410px; height:370px; border:1px solid #b79a4c70; border-radius:50%; background:radial-gradient(ellipse,#e5c67e44,transparent 65%); }.body-halo::after { content:''; position:absolute; inset:18px; border:1px dashed #b2954a66; border-radius:50%; }.body-figure-art { position:absolute; top:26px; left:46px; width:448px; height:365px; object-fit:contain; pointer-events:none; }.body-meridian-art { mix-blend-mode:screen; }
.body-orb { position:absolute; transform:translate(-50%,-50%); width:64px; height:64px; border:0; background:#eee0bc; border-radius:50%; color:#6c542c; font:10px var(--font-display,Georgia,serif); cursor:pointer; }.body-orb img { position:absolute; inset:0; width:100%; height:100%; }.body-orb span { position:relative; display:block; padding:5px; line-height:1.2; overflow-wrap:break-word; }.body-orb.done { background:#c6d9b4; }.body-orb.selected { outline:2px solid #39876a; outline-offset:3px; }.body-orb.locked { opacity:.6; }
.body-progress { position:absolute; left:30px; right:30px; bottom:86px; font-size:14px; color:#725b30; }.body-progress > div:first-child { display:flex; justify-content:space-between; margin-bottom:9px; }.body-progress-track { height:10px; padding:2px; border:1px solid #ad8f49; border-radius:7px; background:#c7b58166; }.body-progress-track span { display:block; height:100%; background:linear-gradient(90deg,#466c4b,#c6a047); border-radius:4px; }
.body-unit-rail { position:absolute; left:0; bottom:0; width:100%; display:flex; gap:7px; justify-content:center; overflow-x:auto; padding:5px 4px; scrollbar-width:thin; }.body-unit-rail button { flex:1 0 51px; padding:7px 4px; border:1px solid #a88a4f88; border-radius:5px; background:#e7d8b16b; color:#74603c; font:12px/1.25 var(--font-display,Georgia,serif); cursor:pointer; }.body-unit-rail small { display:block; margin-top:5px; font-size:10px; }.body-unit-rail .selected { border-color:#357455; background:#cbd3ae88; color:#2d563f; }.body-unit-rail .locked { color:#998a6a; }button:focus-visible { outline:2px solid #315d48; outline-offset:3px; }
.body-milestone { align-self:center; flex:none; padding:7px 12px; border:1px solid #a88a4f66; border-radius:14px; background:#e7d8b155; color:#998a6a; font:12px var(--font-display,Georgia,serif); }.body-milestone.done { border-color:#3d7a56; background:#cbd3ae77; color:#2d563f; }
</style>
