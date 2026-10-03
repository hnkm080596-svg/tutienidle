<script setup lang="ts">
import type { AlchemyRecipeChoice } from './alchemyUi'
import { useI18n } from 'vue-i18n'
defineProps<{ recipes: readonly AlchemyRecipeChoice[]; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <section class="recipe-list" :aria-label="t('alchemy.recipe')">
    <h2 class="list-title">{{ t('alchemy.recipe') }}</h2>
    <div class="recipe-scroll">
      <button v-for="recipe in recipes" :key="recipe.id" type="button" :class="['recipe-row', { selected: recipe.id === selected }]" :aria-pressed="recipe.id === selected" :data-recipe-id="recipe.id" @click="emit('select', recipe.id)">
        <span class="icon-frame"><img :src="recipe.icon" alt=""></span>
        <span class="recipe-label">{{ recipe.name }}<small :style="recipe.gradeColor ? { color: recipe.gradeColor } : undefined">{{ recipe.grade }}</small></span>
        <span class="selection-mark" aria-hidden="true">{{ recipe.id === selected ? '◆' : '›' }}</span>
      </button>
      <p v-if="recipes.length === 0" class="empty-recipes">{{ t('alchemy.emptyRecipes') }}</p>
    </div>
  </section>
</template>

<style scoped>
.recipe-list { position:absolute; left:231px; top:238px; width:253px; height:358px; display:flex; flex-direction:column; }
.list-title { font-size:17px; font-weight:500; margin:0 0 13px; color:#6d522b; border-bottom:1px solid #a98d4f66; padding-bottom:9px; }
.recipe-scroll { min-height:0; overflow:auto; scrollbar-width:thin; padding:3px; }
.recipe-row { display:flex; align-items:center; gap:11px; width:100%; min-height:61px; margin:0 0 6px; padding:8px 7px; border:1px solid #aa8d5044; border-radius:4px; color:#514025; background:#e8d9b452; text-align:left; font:17px var(--font-display,Georgia,serif); cursor:pointer; }
.recipe-row.selected { border-color:#9b763c; background:linear-gradient(90deg,#d5bb795e,#e9ddba22); box-shadow:inset 0 0 10px #bc98512b; }
.recipe-row:hover { background:#e2cfa977; }
.icon-frame { flex:0 0 39px; height:39px; border:1px solid #a38444; background:#ede2c4; padding:3px; border-radius:5px; }
.icon-frame img { width:100%; height:100%; object-fit:contain; }
.recipe-label { flex:1; min-width:0; }
.recipe-label small { display:block; margin-top:4px; font-size:11px; color:#8c744a; }
.selection-mark { color:#917440; font-size:12px; }
.recipe-row:focus-visible { outline:2px solid #375f47; outline-offset:1px; }
.empty-recipes { color:#8b7042; font-size:13px; text-align:center; margin:18px 4px; }
</style>
