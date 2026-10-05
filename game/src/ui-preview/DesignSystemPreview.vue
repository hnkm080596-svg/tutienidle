<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperTabs from '@/components/common/PcPaperTabs.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import PcBodyDiagram from '@/components/common/PcBodyDiagram.vue'


import PaperArchetypePreview from './PaperArchetypePreview.vue'
import PaperSceneDesigns from './PaperSceneDesigns.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'

const { t } = useI18n()
const requested = new URLSearchParams(window.location.search).get('example')
const examples = ['inventory', 'body', 'equipment', 'graph', 'map', 'progression', 'list', 'settings', 'crafting']
const example = shallowRef(requested && examples.includes(requested) ? requested : 'inventory')
const selected = shallowRef('equipment')
const title = computed(() => t(example.value))
const tabs = computed(() => (example.value === 'progression' ? [] : example.value === 'graph' ? ['pathway', 'fiveElements'] : example.value === 'map' ? ['mortalWorld', 'spiritWorld', 'immortalWorld'] : examples.slice(3).includes(example.value) ? ['designOverview', 'designDetails'] : example.value === 'inventory' ? ['equipment', 'material', 'pill'] : example.value === 'body' ? ['body', 'meridian', 'essence'] : ['equipment', 'enhance', 'refine', 'bag']).map(id => ({ id, label: t(id === 'material' ? 'materialTab' : id === 'pill' ? 'pillTab' : id) })))
const activeTab = computed(() => tabs.value.some(item => item.id === selected.value) ? selected.value : tabs.value[0]?.id ?? '')
const nav = ['character', 'realm', 'technique', 'skill', 'body', 'bag', 'map']
const iconNames: readonly PcPaperIcon[] = ['character', 'realm', 'technique', 'skill', 'body', 'inventory', 'exploration']
const icon = pcPaperIconUrl
const sword = resolveAssetUrl('/assets/equipment/items/base-kiem/kiem-01.png')
const crown = resolveAssetUrl('/assets/equipment/items/base-quan/quan-01.png')
const robe = resolveAssetUrl('/assets/equipment/items/base-bao/bao-01.png')
const ore = resolveAssetUrl('/assets/materials/linh_khoang.png')
const herb = resolveAssetUrl('/assets/materials/herbs/tu_linh_thao/decade.png')
const playerArt = resolveAssetUrl('/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')
const bodyUnits = ['skin', 'flesh', 'bone', 'blood', 'organ', 'channels'] as const
const slotLabels = ['weapon', 'robe', 'crown', 'shoes', 'ring', 'pearl']
function navigate(id: string) {
  if (id === 'body' || id === 'equipment') example.value = id
  else if (id === 'bag') example.value = 'inventory'
}
</script>

<template>
  <SceneDesignCanvas>
    <PcPaperScene :title="title" :navigation="false" :data-design-example="example">
      <template #navigation>
        <button class="design-back" :aria-label="t('back')">‹</button>
        <nav class="design-nav">
          <button v-for="(id, index) in nav" :key="id" :class="{ active: id === (example === 'inventory' ? 'bag' : example) }" @click="navigate(id)"><img :src="icon(iconNames[index]!)" alt=""><span>{{ t(id) }}</span></button>
          <button v-if="example === 'equipment'" class="active" @click="navigate('equipment')"><img :src="icon('equipment')" alt=""><span>{{ t('equipment') }}</span></button>
        </nav>
      </template>
      <template #tabs><PcPaperTabs v-if="tabs.length" :items="tabs" :selected="activeTab" :label="t('tabs')" @select="selected = $event" /></template>

      <PaperSceneDesigns v-if="['graph','map','progression'].includes(example)" :kind="example" />
      <PaperArchetypePreview v-else-if="examples.slice(3).includes(example)" :kind="example" />
      <div v-else-if="example === 'inventory'" class="design-inventory">
        <div class="design-filters">
          <label><span aria-hidden="true">⌕</span><input type="search" :placeholder="t('search')" :aria-label="t('search')"></label>
          <PcPaperButton v-for="id in ['all','weapon','crown','robe','shoes','ring','pearl']" :key="id" :variant="id === 'all' ? 'primary' : 'secondary'">{{ t(id) }}</PcPaperButton>
          <span class="design-count">{{ t('count') }}</span>
        </div>
        <div class="design-inventory-grid"><div v-for="n in 48" :key="n" class="pc-paper-slot"><img v-if="n < 3" :src="n === 1 ? sword : crown" alt=""></div></div>
      </div>

      <div v-else-if="example === 'body'" class="design-body">
        <div class="design-body-figure"><PcBodyDiagram class="design-body-art" /><div v-for="(id,index) in bodyUnits" :key="id" class="design-body-unit" :style="{ left: index % 2 ? '77%' : '4%', top: `${5 + Math.floor(index / 2) * 31}%` }"><span class="design-body-medallion">{{ t(id) }}</span><b>{{ t(id) }}</b><small>{{ t('level') }}</small></div></div>
        <aside class="pc-paper-inspector design-inspector"><h2>{{ t('bodyStage') }}</h2><p>{{ t('bodyDescription') }}</p><h3>{{ t('stats') }}</h3><dl><div v-for="(id,index) in ['hp','attack','defense','mana']" :key="id"><dt>{{ t(id) }}</dt><dd>{{ ['+120','+12','+10','+30'][index] }} <strong>▲ {{ ['+20','+2','+1','+5'][index] }}</strong></dd></div></dl><h3>{{ t('costs') }}</h3><div class="design-materials"><div><span class="pc-paper-slot"><img :src="ore" alt=""></span><span>{{ t('stone') }}<b>12/5</b></span></div><div><span class="pc-paper-slot"><img :src="herb" alt=""></span><span>{{ t('ginseng') }}<b>3/2</b></span></div></div><PcPaperButton class="design-main-action">{{ t('cultivate') }}</PcPaperButton></aside>
      </div>

      <div v-else class="design-equipment">
        <div class="design-equipment-figure"><img :src="playerArt" alt=""><div v-for="(id,index) in slotLabels" :key="id" class="design-equipment-slot" :style="{ left: index % 2 ? '78%' : '1%', top: `${4 + Math.floor(index / 2) * 29}%` }"><span class="pc-paper-slot"><img v-if="index < 3" :src="index === 0 ? sword : index === 1 ? robe : crown" alt=""></span><b>{{ t(id) }}</b></div><h3>{{ t('equipmentStats') }}</h3></div>
        <aside class="pc-paper-inspector design-equipment-inspector"><h2>{{ t('equipmentBag') }}</h2><div class="design-equipment-grid"><span v-for="n in 24" :key="n" class="pc-paper-slot"><img v-if="n < 4" :src="n === 2 ? crown : sword" alt=""></span></div><p>{{ t('equipmentHint') }}</p><PcPaperButton variant="secondary">{{ t('sort') }}</PcPaperButton></aside>
      </div>

      <template #footer><div v-if="example === 'inventory'" class="design-pagination"><span>{{ t('count') }}</span><div><PcPaperButton variant="secondary" icon>‹</PcPaperButton><PcPaperButton icon>1</PcPaperButton><PcPaperButton variant="secondary" icon>›</PcPaperButton></div><PcPaperButton variant="secondary">↕ {{ t('sort') }}</PcPaperButton></div></template>
    </PcPaperScene>
  </SceneDesignCanvas>
</template>

<style>
html, body, #app { margin: 0; width: 100%; height: 100%; background: #f4e7cc; }
.design-back { width: 70px; height: 46px; border: 1px solid #b08b4d; background: #171e19; color: #ead7a8; font: 38px/1 var(--pc-font-body); margin: 0 7px 24px; }
.design-nav { display: flex; flex-direction: column; gap: 13px; }
.design-nav button { border: 0; border-block: 1px solid #a98b4830; background: transparent; color: #ead7a8; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 10px 0; font: 16px var(--pc-font-body); cursor: pointer; }
.design-nav button.active { background: radial-gradient(ellipse,#caa94b55,transparent); border-color: #a98b48; }
.design-nav img { width: 40px; height: 40px; object-fit: contain; }
.design-inventory { height: 100%; display: flex; flex-direction: column; gap: 17px; }
.design-filters { display: flex; align-items: center; gap: 8px; height: 45px; flex: 0 0 auto; }
.design-filters label { flex: 1; display: flex; align-items: center; gap: 9px; padding: 7px 12px; border: 3px double #b28d49; background: #26281f; color: #f4dfb4; min-width: 0; }
.design-filters label span { font: 29px/1 var(--pc-font-body); }
.design-filters input { min-width: 0; width: 100%; border: 0; background: transparent; color: #f4dfb4; font: 16px var(--pc-font-body); outline: none; }
.design-filters input::placeholder { color: #d8c49b; }
.design-filters .pc-paper-button { min-height: 42px; padding: 8px 13px; font-size: 14px; }
.design-count { white-space: nowrap; font-size: 13px; margin-left: 8px; }
.design-inventory-grid { display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: 9px; min-height: 0; }
.design-inventory-grid .pc-paper-slot { width: 100%; height: auto; aspect-ratio: 1; }
.design-pagination { display: flex; align-items: center; justify-content: space-between; font-size: 19px; }
.design-pagination > div { display: flex; gap: 8px; }
.design-body { display: grid; grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); gap: 24px; height: 100%; }
.design-body-figure { position: relative; overflow: hidden; }
.design-body-art { position: absolute; left: 8%; top: 0; width: 84%; height: 100%; object-fit: contain; pointer-events: none; }
.design-body-unit { position: absolute; width: 92px; display: flex; flex-direction: column; align-items: center; color: #211b12; }
.design-body-unit > span { width: 78px; height: 78px; display: grid; place-items: center; border: 4px double #d0a256; border-radius: 50%; background: radial-gradient(ellipse,#5b4a2b,#30291e); box-shadow: 0 0 13px #cdb27355; }
.design-body-unit img { width: 52px; height: 52px; object-fit: contain; }
.design-body-unit > .design-body-medallion { color: #e7c47a; font-size: 23px; font-weight: 600; }
.design-body-unit b { margin-top: 3px; font-size: 20px; }
.design-body-unit small { font-size: 18px; }
.design-inspector { height: 100%; display: flex; flex-direction: column; }
.design-inspector h2 { font-size: 27px; }
.design-inspector p { margin: 10px 0; }
.design-inspector h3 { margin: 12px 0; }
.design-inspector strong { margin-left: 10px; color: #a7d46e; font-size: 17px; }
.design-materials { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.design-materials > div { display: flex; align-items: center; gap: 12px; }
.design-materials .pc-paper-slot { width: 68px; height: 68px; flex-shrink: 0; }
.design-materials b { display: block; margin-top: 5px; font-size: 18px; }
.design-main-action { display: block; margin: auto 26px 0; font-size: 27px; }
.design-equipment { display: grid; grid-template-columns: 450px minmax(0,1fr); gap: 38px; height: 100%; }
.design-equipment-figure { position: relative; }
.design-equipment-figure > img { position: absolute; left: 14%; top: 3%; width: 72%; height: 87%; object-fit: contain; }
.design-equipment-slot { position: absolute; text-align: center; }
.design-equipment-slot b { display: block; font-size: 17px; padding-top: 5px; }
.design-equipment-figure h3 { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 20px; border-top: 1px solid #b28d4960; padding-top: 10px; }
.design-equipment-inspector { display: flex; flex-direction: column; align-items: flex-start; }
.design-equipment-inspector h2 { margin-bottom: 23px; }
.design-equipment-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 9px; width: 100%; }
.design-equipment-grid .pc-paper-slot { width: 100%; height: auto; aspect-ratio: 1; }
.design-equipment-inspector .pc-paper-button { margin: auto 0 0 auto; }
</style>






<style>
.pc-paper-scene[data-design-example='inventory'] .pc-paper-scene__workspace { top: 164px; }
.pc-paper-scene[data-design-example='body'] .pc-paper-scene__workspace { top: 165px; }
</style>






