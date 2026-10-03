<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import PaperPanelNavigation, { type PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import AlchemyPaperRecipes from './AlchemyPaperRecipes.vue'
import AlchemyPaperCauldron from './AlchemyPaperCauldron.vue'
import AlchemyPaperDetails from './AlchemyPaperDetails.vue'
import AlchemyPaperQueue from './AlchemyPaperQueue.vue'
import type { AlchemyRecipeChoice, AlchemyRecipeDisplay, AlchemyJobDisplay } from './alchemyUi'

const props = withDefaults(defineProps<{
  recipes: readonly AlchemyRecipeChoice[]
  recipe: AlchemyRecipeDisplay | null
  variant: string | null
  jobs: readonly AlchemyJobDisplay[]
  capacity: number
  navigation: readonly PaperNavigationItem[]
  notice: string
  preview?: boolean
}>(), { preview: false })

const emit = defineEmits<{
  select: [id: string]
  variant: [id: string]
  brew: []
  cancel: [id: string]
  navigate: [id: string]
  back: []
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

const herb = computed(() => props.recipe?.variants.find(item => item.id === props.variant) ?? null)

const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
</script>

<template>
  <section ref="rootRef" class="alchemy-scene" :aria-label="t('alchemy.title')" @click.self="emit('back')">
    <div class="paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <PaperPanelNavigation :items="navigation" active="alchemy" :label="t('alchemy.navigation')" :back-label="t('dongFu.aria')" @select="emit('navigate', $event)" @back="emit('back')" />
    <h1 class="title">{{ t('alchemy.title') }}</h1>
    <span class="subtitle">{{ t('alchemy.subtitle') }}</span>
    <AlchemyPaperRecipes :recipes="recipes" :selected="recipe?.id ?? ''" @select="emit('select', $event)" />
    <AlchemyPaperCauldron :herb="herb" />
    <AlchemyPaperDetails v-if="recipe" :recipe="recipe" :variant="variant ?? ''" :notice="notice" @variant="emit('variant', $event)" @brew="emit('brew')" />
    <aside v-else class="alchemy-details-empty" :style="{ borderImageSource: `url('${paper}')` }"><p class="empty-copy">{{ t('alchemy.emptyDetail') }}</p></aside>
    <AlchemyPaperQueue :jobs="jobs" :capacity="capacity" @cancel="emit('cancel', $event)" />
    <p v-if="preview" class="preview-label">{{ t('alchemy.previewStamp') }}</p>
  </section>
</template>

<style scoped>
/* pointer-events:auto on the scene root: the overlay canvas disables
   pointer events so scenes may sit above the DongFu vista - each
   fidelity root opts back in (same contract as .cf-scene/.body-paper-scene). */
.alchemy-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#46351f; line-height:1.3; }
.alchemy-scene :deep(*) { box-sizing:border-box; }
.paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; filter:drop-shadow(0 12px 15px #0009); }
.title { position:absolute; left:231px; top:174px; margin:0; font-size:34px; font-weight:500; font-style:italic; }
.subtitle { position:absolute; left:519px; top:192px; color:#8b7042; font-size:13px; letter-spacing:2px; }
.preview-label { position:absolute; left:235px; top:724px; margin:0; color:#806b43; font-size:9px; }
.alchemy-details-empty { position:absolute; left:970px; top:154px; width:418px; height:575px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:35px; padding:24px 28px; display:flex; align-items:center; justify-content:center; }
.empty-copy { color:#8b7042; font-size:15px; text-align:center; }
</style>
