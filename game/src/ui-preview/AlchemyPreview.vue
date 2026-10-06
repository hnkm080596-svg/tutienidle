<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import AlchemyFidelityScene from '@/components/scenes/alchemy/fidelity/AlchemyFidelityScene.vue'
import type { AlchemyRecipeDisplay, AlchemyJobDisplay } from '@/components/scenes/alchemy/fidelity/alchemyUi'
const { t } = useI18n()
const selected = shallowRef('tu_linh_dan')
const variant = shallowRef('decade')
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const content = [
  { id: 'tu_linh_dan', herb: 'tu_linh_thao' }, { id: 'thoi_the_dan', herb: 'thoi_the_thao' },
  { id: 'hoi_xuan_dan', herb: 'hoi_xuan_thao' }, { id: 'hoi_linh_dan', herb: 'hoi_linh_thao' },
  { id: 'duong_than_dan', herb: 'duong_than_thao' }, { id: 'to_cot_dan', herb: 'to_cot_thao' },
] as const
const recipes = computed<AlchemyRecipeDisplay[]>(() => content.map((entry, index) => ({
  id: entry.id, name: t(`pills.${entry.id}`), icon: resolveAssetUrl(`/assets/pills/${entry.id}.png`), grade: t('grade', { n: index + 1 }), description: t(`descriptions.${entry.id}`),
  variants: ['decade', 'century'].map(age => ({ id: age, name: t('herbName', { name: t(`herbs.${entry.herb}`), age: t(`age.${age}`) }), icon: resolveAssetUrl(`/assets/materials/herbs/${entry.herb}/${age}.png`), amount: age === 'decade' ? '12 / 10' : '8 / 5', enough: age === 'decade' })),
  costs: [{ id: 'fuel', label: t('fuel'), value: t('fuelValue'), enough: true }, { id: 'stone', label: t('stone'), value: '500', enough: false }], duration: t('durationValue'), outcome: t('outcomeValue', { name: t(`pills.${entry.id}`) }),
  brewDisabled: false, blockReason: '',
})))
const recipe = computed(() => recipes.value.find(entry => entry.id === selected.value) ?? null)
const jobs = computed<AlchemyJobDisplay[]>(() => [
  { id: 'sample-job-1', name: t('pills.tu_linh_dan'), icon: resolveAssetUrl('/assets/pills/tu_linh_dan.png'), progress: 58, remaining: '00:12:36' },
  { id: 'sample-job-2', name: t('pills.hoi_xuan_dan'), icon: resolveAssetUrl('/assets/pills/hoi_xuan_dan.png'), progress: 23, remaining: '00:23:06' },
])
function choose(id: string) { if (recipes.value.some(entry => entry.id === id)) { selected.value = id; variant.value = 'decade'; notice.value = '' } }
function chooseVariant(id: string) { if (recipe.value?.variants.some(entry => entry.id === id)) { variant.value = id; notice.value = '' } }
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template><SceneDesignCanvas><div class="alchemy-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><AlchemyFidelityScene :recipes="recipes" :recipe="recipe" :variant="variant" :jobs="jobs" :capacity="3" :notice="notice" preview @select="choose" @variant="chooseVariant" @back="back" @brew="notice = t('notice')" @cancel="notice = t('cancelNotice')" /></div></SceneDesignCanvas></template>
<style scoped>.alchemy-preview { position:relative; width:100%; height:100%; }</style>
