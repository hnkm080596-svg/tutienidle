<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TechniqueUiModel } from './techniqueUi'
defineProps<{ model: TechniqueUiModel }>()
const { t } = useI18n()
</script>
<template>
  <article class="technique-info">
    <p class="technique-eyebrow">{{ t('technique.active') }}</p>
    <h1>{{ model.name }}</h1>
    <span v-if="model.quality" class="technique-quality">{{ model.quality }}</span>
    <p class="technique-description">{{ model.description }}</p>
    <section v-for="section in model.sections" :key="section.id" class="technique-section">
      <h2>{{ section.title }}</h2>
      <dl><div v-for="row in section.rows" :key="row.id"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
    </section>
  </article>
</template>
<style scoped>
.technique-info { position:absolute; left:232px; top:182px; width:290px; height:466px; overflow:auto; scrollbar-width:thin; scrollbar-color:#af914f transparent; padding-right:8px; }
.technique-eyebrow { margin:0 0 17px; color:#8a6c32; font-size:15px; letter-spacing:2px; }h1 { margin:0 0 18px; font-size:34px; line-height:1.25; font-weight:500; font-style:italic; }
.technique-quality { display:inline-block; border:1px solid #a45e3b; padding:4px 12px; color:#8a422c; font-size:14px; }.technique-description { margin:20px 0; font-size:16px; line-height:1.75; color:#6c5b3e; }
.technique-section { border-top:1px solid #a78a4c77; padding-top:16px; margin-top:20px; }h2 { margin:0 0 14px; font-size:21px; font-weight:500; }dl { margin:0; font-size:15px; }dl > div { display:flex; justify-content:space-between; gap:15px; padding:9px 0; border-bottom:1px solid #aa94582b; }dt { color:#6a593c; }dd { margin:0; text-align:right; color:#305d49; }
</style>
