<script setup lang="ts">
import GameCard from '@/components/common/GameCard.vue'
import type { TechniqueUiModel } from './techniqueUi'
defineProps<{ model: TechniqueUiModel }>()
</script>
<template>
  <GameCard
    as="article"
    class="technique-info"
    :title="model.hasTechnique ? model.name : undefined"
    :style="{ '--technique-title-color': `var(--grade-${model.qualityKey ?? 'hoang'})` }"
  >
    <div class="technique-info__body">
      <p class="technique-description">{{ model.description }}</p>
      <section v-for="section in model.sections" :key="section.id" class="technique-section">
        <h2>{{ section.title }}</h2>
        <dl><div v-for="row in section.rows" :key="row.id"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
      </section>
    </div>
  </GameCard>
</template>
<style scoped>
.technique-info { position:absolute; left:232px; top:182px; width:290px; height:466px; display:flex; flex-direction:column; color:#f3e4c4; }
.technique-info :deep(.game-card-title) { width:auto; min-width:180px; max-width:100%; padding:0 20px; color:var(--technique-title-color, var(--grade-hoang)); }
.technique-info :deep(.game-card-title > span) { overflow:hidden; text-overflow:ellipsis; }
.technique-info__body { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#8a7444 transparent; padding-right:4px; }
.technique-description { margin:4px 0 18px; font-size:15px; line-height:1.75; color:#d6c5a3; }
.technique-section { border-top:1px solid #b28a4344; padding-top:16px; margin-top:18px; }h2 { margin:0 0 14px; font-size:19px; font-weight:500; color:#ebd49e; }dl { margin:0; font-size:14px; }dl > div { display:flex; justify-content:space-between; gap:15px; padding:8px 0; border-bottom:1px solid #b28a4333; }dt { color:#cfc09d; }dd { margin:0; text-align:right; color:#a3d793; }
</style>
