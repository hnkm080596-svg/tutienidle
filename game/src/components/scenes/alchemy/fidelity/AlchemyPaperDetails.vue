<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { AlchemyRecipeDisplay } from './alchemyUi'

defineProps<{ recipe: AlchemyRecipeDisplay; variant: string; notice: string }>()

const emit = defineEmits<{ variant: [id: string]; brew: [] }>()

const { t } = useI18n()

const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
</script>

<template>
  <aside class="alchemy-details" :style="{ borderImageSource: `url('${paper}')` }">
    <header class="recipe-header"><img class="recipe-icon" :src="recipe.icon" alt=""><div><h2 class="recipe-name">{{ recipe.name }}</h2><span class="recipe-grade" :style="recipe.gradeColor ? { color: recipe.gradeColor } : undefined">{{ recipe.grade }}</span></div></header>
    <div class="details-scroll"><p class="description">{{ recipe.description }}</p>
      <fieldset class="ingredients"><legend>{{ t('alchemy.herb') }}</legend><label v-for="herb in recipe.variants" :key="herb.id" :class="['herb-option', { selected: herb.id === variant, insufficient: !herb.enough }]"><input type="radio" name="alchemy-preview-herb" :value="herb.id" :checked="herb.id === variant" @change="emit('variant', herb.id)"><img :src="herb.icon" alt=""><span>{{ herb.name }}</span><strong>{{ herb.amount }}</strong></label></fieldset>
      <dl class="costs"><div v-for="cost in recipe.costs" :key="cost.id"><dt>{{ cost.label }}</dt><dd :class="{ insufficient: cost.enough === false }">{{ cost.value }}</dd></div><div><dt>{{ t('alchemy.durationLabel') }}</dt><dd>{{ recipe.duration }}</dd></div></dl>
      <section class="outcome"><h3>{{ t('alchemy.preview') }}</h3><p>{{ recipe.outcome }}</p></section>
    </div>
    <button class="brew-button" type="button" :disabled="recipe.brewDisabled" @click="emit('brew')">{{ t('alchemy.startBrewing') }}</button>
    <p v-if="recipe.blockReason" class="block-reason" role="note">{{ recipe.blockReason }}</p>
    <p class="notice" role="status">{{ notice }}</p>
  </aside>
</template>

<style scoped>
/* Bottom padding must clear the 35px frame band painted inside the
   border box - the last cost rows otherwise render on the paper's torn
   edge (audit: 'Linh Thach' +9px, 'Thoi gian luyen' +36px overflow). */
.alchemy-details { position:absolute; left:970px; top:154px; width:418px; height:575px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:35px; padding:24px 28px 34px; display:flex; flex-direction:column; }
.recipe-header { display:flex; gap:15px; align-items:center; padding-bottom:14px; border-bottom:1px solid #b39a6066; }
.recipe-icon { width:53px; height:53px; padding:6px; border:1px solid #a6894c; border-radius:5px; background:#e5d5af; object-fit:contain; }
.recipe-name { margin:0 0 7px; font-size:26px; font-weight:500; }
.recipe-grade { font-size:12px; color:#8d6b35; border:1px solid #b59b675c; padding:2px 8px; border-radius:3px; }
.details-scroll { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.description { font-size:14px; line-height:1.5; margin:12px 0 14px; }
.ingredients { border:0; padding:0; margin:0; }
.ingredients legend { font-size:17px; margin-bottom:9px; padding:0; }
.herb-option { display:flex; gap:8px; align-items:center; min-height:44px; margin-bottom:7px; padding:5px 7px; border:1px solid #ab915354; border-radius:3px; font-size:12px; cursor:pointer; background:#e6d4aa25; }
.herb-option.selected { border-color:#587e587f; background:#c6cfa74d; }
.herb-option.insufficient strong { color:#8a3d2c; }
.herb-option input { accent-color:#426c4c; margin:0; }
.herb-option img { width:29px; height:29px; object-fit:contain; }
.herb-option strong { margin-left:auto; font-size:12px; font-weight:500; color:#41654b; white-space:nowrap; }
.costs { margin:14px 0 0; font-size:14px; }
.costs div { display:flex; justify-content:space-between; gap:12px; margin-bottom:9px; }
.costs dd { margin:0; color:#785f33; }
.costs dd.insufficient { color:#8a3d2c; font-weight:600; }
.outcome { border-top:1px solid #aa8d4c55; margin-top:13px; padding-top:11px; }
.outcome h3 { margin:0 0 7px; font-size:16px; font-weight:500; }
.outcome p { margin:0; font-size:14px; color:#3f6b4b; }
.brew-button { flex:0 0 47px; margin-top:12px; background:#315f49; border:3px double #b69c60; color:#fff0c9; font:22px var(--font-display,Georgia,serif); cursor:pointer; }
.brew-button:hover:not(:disabled) { filter:brightness(1.08); }
.brew-button:disabled { opacity:.55; cursor:not-allowed; }
.brew-button:focus-visible { outline:2px solid #3c694e; outline-offset:2px; }
.block-reason { margin:6px 0 0; font-size:12px; color:#8a3d2c; }
.notice { margin:4px 0 0; min-height:16px; font-size:12px; color:#6d522b; }
</style>
