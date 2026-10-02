<script setup lang="ts">
// Scene 11 recipe-list region (spec: 288/176/380/540, list family,
// scrollfade). Realm-filtered, non-retired recipe rows; category
// filter chips are INVALID for beta (no category field).
import { useI18n } from 'vue-i18n'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import AlchemyRecipeRow from './AlchemyRecipeRow.vue'

defineProps<{
  recipes: AlchemyRecipe[]
  selectedRecipeId: string | null
  gradeLabel: string
  gradeColor: string | undefined
  pillNameFor: (recipe: AlchemyRecipe) => string
}>()
const emit = defineEmits<{ select: [recipe: AlchemyRecipe] }>()
const { t } = useI18n()
</script>

<template>
  <div class="alchemy-view__recipes scrollfade" data-hk-region="recipe-list">
    <section class="alchemy-group">
      <p class="alchemy-group__eyebrow">{{ t('alchemy.currentCauldron') }}</p>
      <h4 class="alchemy-group__title" :style="{ color: gradeColor }">{{ gradeLabel }}</h4>

      <AlchemyRecipeRow
        v-for="(recipe, index) in recipes"
        :key="recipe.id"
        :index="index"
        :pill-name="pillNameFor(recipe)"
        :herb-amount-label="t('alchemy.herbCount', { amount: recipe.herbAmount })"
        :selected="recipe.id === selectedRecipeId"
        @select="emit('select', recipe)"
      />
    </section>
  </div>
</template>

<style scoped>
.alchemy-view__recipes {
  grid-area: recipes;
  overflow-y: auto;
  padding: 14px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-accent) 35%, var(--paper-line));
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.alchemy-group__eyebrow { margin: 0; color: var(--cinnabar); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-group__title {
  margin: 2px 0;
  color: var(--paper-text);
  font: 700 var(--text-lg) var(--font-display);
}
</style>
