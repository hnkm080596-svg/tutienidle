<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TechniqueUiModel } from './techniqueUi'
const props = defineProps<{ model: TechniqueUiModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const fill = computed(() => Number.isFinite(props.model.masteryPercent) ? Math.max(0, Math.min(100, props.model.masteryPercent)) : 0)
</script>
<template>
  <section class="technique-artifact" :aria-label="t('technique.artifact')">
    <div class="technique-orbit" aria-hidden="true" />
    <img class="technique-book" :src="model.art" :alt="t('technique.artifactAlt')">
    <p v-if="model.artTemporary" class="technique-art-caption">{{ t('technique.temporaryArt') }}</p>
    <div class="technique-track">
      <h2>{{ t('technique.training') }}</h2>
      <div class="technique-stages">
        <button v-for="stage in model.stages" :key="stage.id" :class="['technique-stage', stage.state, { selected: selected === stage.id }]" :aria-pressed="selected === stage.id" :aria-current="stage.state === 'current' ? 'step' : undefined" @click="emit('select', stage.id)"><span class="technique-stage-seal" aria-hidden="true">◇</span><span>{{ stage.label }}</span></button>
      </div>
      <div class="technique-mastery-label"><span>{{ model.rankLabel }}</span><span>{{ model.masteryLabel }}</span></div>
      <div class="technique-mastery" role="progressbar" :aria-label="t('technique.mastery')" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="fill"><span :style="{ width: `${fill}%` }" /></div>
    </div>
  </section>
</template>
<style scoped>
.technique-artifact { position:absolute; left:538px; top:166px; width:441px; height:553px; }.technique-orbit { position:absolute; left:40px; top:43px; width:360px; height:315px; border:1px solid #bf9d4d55; border-radius:50%; background:radial-gradient(ellipse,#e9c87548,transparent 68%); }.technique-orbit::after { content:''; position:absolute; inset:16px; border:1px dashed #bd944b50; border-radius:50%; }
.technique-book { position:absolute; width:433px; height:404px; left:4px; top:0; object-fit:contain; filter:drop-shadow(0 12px 8px #6a56322b); }.technique-art-caption { position:absolute; top:385px; width:100%; text-align:center; color:#8a774e; font-size:11px; margin:0; }
.technique-track { position:absolute; left:16px; right:16px; bottom:0; }h2 { margin:0 0 17px; display:flex; align-items:center; gap:12px; font-size:17px; font-weight:500; text-align:center; }h2::before,h2::after { content:''; flex:1; height:1px; background:#b5964d80; }.technique-stages { display:flex; position:relative; justify-content:space-between; }.technique-stages::before { content:''; position:absolute; top:19px; left:40px; right:40px; height:1px; background:#a68b46; }
.technique-stage { position:relative; display:grid; justify-items:center; gap:8px; background:none; border:0; padding:0 5px; color:#736344; font:14px var(--font-display,Georgia,serif); cursor:pointer; }.technique-stage-seal { display:grid; place-items:center; width:40px; height:40px; border:3px double #af914e; border-radius:50%; background:#ecdfbc; font-size:25px; }.reached .technique-stage-seal { color:#fff4ce; background:#a58339; }.current .technique-stage-seal { background:#286450; color:#fff2cb; box-shadow:0 0 15px #598c6555; }.selected .technique-stage-seal { outline:2px solid #806023; outline-offset:3px; }.technique-stage:hover { filter:brightness(1.15); }.technique-stage:focus-visible { outline:2px solid #38634b; outline-offset:4px; }
.technique-mastery-label { display:flex; justify-content:space-between; margin:18px 0 8px; font-size:13px; color:#665437; }.technique-mastery { height:8px; border:1px solid #a48845; background:#c9b88466; border-radius:5px; padding:1px; }.technique-mastery span { display:block; height:100%; background:linear-gradient(90deg,#b58229,#e5bd58); border-radius:4px; }
</style>
