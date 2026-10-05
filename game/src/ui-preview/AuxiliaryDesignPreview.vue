<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperDialog from '@/components/common/PcPaperDialog.vue'
import PcPaperTabs from '@/components/common/PcPaperTabs.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'

const { t } = useI18n()
const requested = new URLSearchParams(window.location.search).get('example')
const example = ['formation', 'tooltip', 'dialog', 'settings'].includes(requested ?? '') ? requested! : 'formation'
const category = ref('audio')
const hovered = ref<number | null>(1)
const volume = ref([65, 80, 55])
const reducedShake = ref(true)
const language = ref('vi')
const tabs = computed(() => (example === 'formation' ? ['formations', 'roster'] : ['equipment', 'material', 'pills']).map(id => ({ id, label: t(id) })))
const categories: { id: string; icon: PcPaperIcon }[] = [{ id: 'general', icon: 'settings' }, { id: 'audio', icon: 'settings' }, { id: 'display', icon: 'compass' }, { id: 'storage', icon: 'inventory' }, { id: 'support', icon: 'feedback' }]
const art = {
  sword: resolveAssetUrl('/assets/equipment/items/base-kiem/kiem-01.png'),
  crown: resolveAssetUrl('/assets/equipment/items/base-quan/quan-01.png'),
  stone: resolveAssetUrl('/assets/materials/linh_khoang.png'),
  herb: resolveAssetUrl('/assets/materials/herbs/tu_linh_thao/decade.png'),
  paper: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png'),
}
const positions = [{ x: 50, y: 10 }, { x: 82, y: 39 }, { x: 70, y: 77 }, { x: 30, y: 77 }, { x: 18, y: 39 }]
</script>

<template>
  <SceneDesignCanvas>
    <div v-if="example === 'dialog'" class="aux-dialog-stage" :style="{ backgroundImage: `url('${art.paper}')` }">
      <div class="aux-dialog-shade" />
      <PcPaperDialog :title="t('dialog')" :width="760">
          <div class="aux-retreat"><img :src="pcPaperIconUrl('technique')" alt=""><p>{{ t('retreatHint') }}</p><dl><div><dt>{{ t('duration') }}</dt><dd>02:30:00</dd></div><div><dt>{{ t('cultivation') }}</dt><dd class="aux-positive">+12 480</dd></div><div><dt>{{ t('realm') }}</dt><dd>{{ t('realmValue') }}</dd></div></dl><small>{{ t('cultivationHint') }}</small></div>
          <template #footer><div class="aux-dialog-actions"><PcPaperButton variant="secondary">{{ t('close') }}</PcPaperButton><PcPaperButton>{{ t('continue') }}</PcPaperButton></div></template>
      </PcPaperDialog>
      <p class="aux-stage-note">{{ t('static') }}</p>
    </div>

    <PcPaperScene v-else :title="t(example)" :navigation="false" :data-auxiliary-example="example">
      <template #tabs><PcPaperTabs v-if="example !== 'settings'" :items="tabs" :selected="tabs[0]!.id" :label="t('tabs')" /></template>

      <div v-if="example === 'formation'" class="aux-formation-layout">
        <section class="aux-formation-map"><h2>{{ t('nguHanh') }}</h2><p>{{ t('formationHint') }}</p><div class="aux-formation-diagram"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="46" rx="34" ry="38" /><ellipse cx="50" cy="46" rx="32" ry="36" /><path d="M50 10 82 39 70 77 30 77 18 39Z M50 10 70 77 18 39 82 39 30 77Z" /></svg><div class="aux-formation-seal"><img :src="pcPaperIconUrl('formation')" alt=""></div><div v-for="(position,index) in positions" :key="index" class="aux-position" :style="{ left: `${position.x}%`, top: `${position.y}%` }"><span class="pc-paper-slot"><img :src="index % 2 ? art.crown : art.sword" alt=""></span><b>{{ t('position', { n: index + 1 }) }}</b><small>{{ t('equipped') }}</small></div></div><p class="aux-map-caption">{{ t('formationNote') }}</p></section>
        <aside class="pc-paper-inspector aux-formation-inspector"><h2>{{ t('nguHanh') }}</h2><p>{{ t('formationHint') }}</p><h3>{{ t('effects') }}</h3><dl><div v-for="(id,index) in ['attack','defense','speed']" :key="id"><dt>{{ t(id) }}</dt><dd>+{{ [6,6,4][index] }}%</dd></div></dl><h3>{{ t('costs') }}</h3><div class="aux-materials"><span class="pc-paper-slot"><img :src="art.stone" alt=""></span><span>{{ t('stone') }}<b>120 / 50</b></span></div><PcPaperButton class="aux-bottom-action">{{ t('apply') }}</PcPaperButton></aside>
      </div>

      <div v-else-if="example === 'tooltip'" class="aux-inventory">
        <div class="aux-filters"><label><span aria-hidden="true">⌕</span><input :placeholder="t('search')" :aria-label="t('search')"></label><PcPaperButton v-for="id in ['all','weapon','crown','robe','shoes','ring','pearl']" :key="id" :variant="id === 'all' ? 'primary' : 'secondary'">{{ t(id) }}</PcPaperButton><span>{{ t('count', { n: 2 }) }}</span></div>
        <div class="aux-inventory-grid"><button v-for="n in 48" :key="n" class="pc-paper-slot" :class="{ 'aux-slot-selected': hovered === n }" :aria-label="n < 3 ? t(n === 1 ? 'sword' : 'crown') : t('position', { n })" @mouseenter="hovered = n === 1 ? n : null" @focus="hovered = n === 1 ? n : null"><img v-if="n < 3" :src="n === 1 ? art.sword : art.crown" alt=""></button></div>
        <aside v-if="hovered" class="pc-paper-inspector aux-item-popup" role="tooltip"><header><span class="pc-paper-slot"><img :src="hovered === 1 ? art.sword : art.crown" alt=""></span><div><h2>{{ t(hovered === 1 ? 'sword' : 'crown') }}</h2><p>{{ t('grade') }}</p></div></header><div class="aux-item-meta"><span>{{ t('level') }}</span><span>{{ t('enhanced') }}</span></div><h3>{{ t('baseStats') }}</h3><dl><div><dt>{{ t('attack') }}</dt><dd>+42</dd></div><div><dt>{{ t('defense') }}</dt><dd>+8</dd></div></dl><h3>{{ t('bonusStats') }}</h3><dl><div><dt>{{ t('critical') }}</dt><dd>+3%</dd></div><div><dt>{{ t('speed') }}</dt><dd>+6</dd></div></dl><p>{{ t('swordDescription') }}</p><div class="aux-equipped-note">{{ t('equippedHint') }}</div></aside>
      </div>

      <div v-else class="aux-settings">
        <nav :aria-label="t('category')"><PcPaperButton v-for="item in categories" :key="item.id" :variant="category === item.id ? 'primary' : 'secondary'" :aria-pressed="category === item.id" @click="category = item.id"><img :src="pcPaperIconUrl(item.icon)" alt="">{{ t(item.id) }}</PcPaperButton></nav>
        <section class="pc-paper-inspector aux-settings-inspector" :aria-label="t('controls')"><h2>{{ t(category) }}</h2>
          <template v-if="category === 'audio' || category === 'general'"><p>{{ t('audioHint') }}</p><h3>{{ t('audio') }}</h3><label v-for="(id,index) in ['music','sfx','interface']" :key="id" class="aux-control"><span>{{ t(id) }}</span><input v-model="volume[index]" type="range" min="0" max="100" :aria-label="t(id)"><output>{{ volume[index] }}%</output></label></template>
          <template v-if="category === 'display'"><p>{{ t('displayHint') }}</p><h3>{{ t('display') }}</h3><label class="aux-control"><span>{{ t('language') }}</span><select v-model="language"><option value="vi">{{ t('vi') }}</option><option value="en">{{ t('en') }}</option></select></label><div class="aux-control"><span>{{ t('shake') }}</span><PcPaperButton :variant="reducedShake ? 'primary' : 'secondary'" :aria-pressed="reducedShake" @click="reducedShake = !reducedShake">{{ t(reducedShake ? 'on' : 'off') }}</PcPaperButton></div></template>
          <template v-if="category === 'storage'"><p>{{ t('storageHint') }}</p><h3>{{ t('storage') }}</h3><div class="aux-storage-actions"><PcPaperButton>{{ t('save') }}</PcPaperButton><PcPaperButton variant="secondary">{{ t('export') }}</PcPaperButton><PcPaperButton variant="secondary">{{ t('import') }}</PcPaperButton></div></template>
          <template v-if="category === 'support'"><p>{{ t('supportHint') }}</p><img class="aux-support-art" :src="pcPaperIconUrl('feedback')" alt=""><PcPaperButton class="aux-bottom-action">{{ t('feedback') }}</PcPaperButton></template>
        </section>
      </div>
      <template #footer><div class="aux-footer"><span>{{ t('static') }}</span><PcPaperButton v-if="example === 'tooltip'" variant="secondary">{{ t('sort') }}</PcPaperButton></div></template>
    </PcPaperScene>
  </SceneDesignCanvas>
</template>

<style scoped>
:global(html), :global(body), :global(#app) { margin: 0; width: 100%; height: 100%; background: #f4e7cc; }
.aux-formation-layout { height: 100%; display: grid; grid-template-columns: minmax(0,1.55fr) minmax(0,1fr); gap: 32px; }
.aux-formation-map { position: relative; text-align: center; }
.aux-formation-map h2 { font-size: 28px; margin: 0 0 5px; }
.aux-formation-map > p { margin: 0; font-size: 17px; }
.aux-formation-diagram { position: relative; height: 420px; margin-top: 15px; }
.aux-formation-diagram svg { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: #ad8238; stroke-width: .15; opacity: .7; }
.aux-formation-diagram svg path { stroke-width: .2; }
.aux-formation-seal { position: absolute; left: 50%; top: 48%; transform: translate(-50%,-50%); width: 120px; height: 120px; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(ellipse,#e5be6855,transparent 70%); }
.aux-formation-seal img { width: 88px; height: 88px; object-fit: contain; }
.aux-position { position: absolute; transform: translate(-50%,-39px); display: grid; justify-items: center; gap: 4px; }
.aux-position .pc-paper-slot { width: 78px; height: 78px; }
.aux-position b { font-size: 17px; }.aux-position small { font-size: 14px; color: #725c31; }
.aux-formation-map .aux-map-caption { position: absolute; bottom: 0; left: 0; right: 0; font-size: 13px; color: #735a32; }
.aux-formation-inspector { height: 100%; display: flex; flex-direction: column; }
.aux-materials { display: flex; gap: 16px; align-items: center; }.aux-materials .pc-paper-slot { width: 70px; height: 70px; }.aux-materials b { display: block; margin-top: 7px; color: #b7d589; }
.aux-bottom-action { margin-top: auto; width: 100%; }
.aux-inventory { position: relative; height: 100%; }.aux-filters { display: flex; gap: 7px; align-items: center; height: 45px; margin-bottom: 16px; }
.aux-filters label { display: flex; align-items: center; flex: 1; min-width: 0; gap: 9px; padding: 8px 12px; background: #24251e; color: #f0ddb2; border: 3px double #b08b4d; }.aux-filters label > span { font-size: 26px; }.aux-filters input { min-width: 0; width: 100%; color: #f0ddb2; background: transparent; border: 0; font: 16px var(--pc-font-body); }.aux-filters input::placeholder { color: #d9c49a; }.aux-filters .pc-paper-button { padding: 8px 12px; font-size: 14px; min-height: 42px; }.aux-filters > span { font-size: 14px; white-space: nowrap; }
.aux-inventory-grid { display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: 9px; }.aux-inventory-grid .pc-paper-slot { width: 100%; height: auto; aspect-ratio: 1; cursor: pointer; }.aux-slot-selected { filter: brightness(1.2); }
.aux-item-popup { position: absolute; z-index: 2; width: 352px; left: 200px; top: 85px; padding: 22px; box-shadow: 0 9px 24px #201a1566; }.aux-item-popup header { display: flex; gap: 14px; align-items: center; }.aux-item-popup header .pc-paper-slot { width: 67px; height: 67px; flex-shrink: 0; }.aux-item-popup h2 { font-size: 23px; text-align: left; }.aux-item-popup header p { text-align: left; margin: 5px 0 0; font-size: 14px; color: #d6ae65; }.aux-item-meta { display: flex; justify-content: space-between; margin-top: 14px; font-size: 14px; color: #d9c59b; }.aux-item-popup h3 { font-size: 18px; margin: 13px 0 7px; padding: 8px 0; }.aux-item-popup dl > div { font-size: 16px; padding: 7px 0; }.aux-item-popup p { margin: 12px 0; font-size: 14px; }.aux-equipped-note { text-align: right; color: #b7d589; font-size: 14px; }
.aux-settings { height: 100%; display: grid; grid-template-columns: 230px minmax(0,1fr); gap: 30px; }.aux-settings nav { display: flex; flex-direction: column; gap: 15px; }.aux-settings nav button { display: flex; align-items: center; gap: 16px; text-align: left; min-height: 67px; }.aux-settings nav img { width: 35px; height: 35px; object-fit: contain; }.aux-settings-inspector { display: flex; flex-direction: column; height: 100%; }.aux-settings-inspector h2 { text-align: left; font-size: 30px; }.aux-settings-inspector p { text-align: left; }.aux-settings-inspector h3 { text-align: left; }.aux-control { display: flex; align-items: center; gap: 25px; min-height: 62px; border-bottom: 1px solid #b08b4d30; font-size: 19px; }.aux-control > span { width: 210px; flex-shrink: 0; }.aux-control input { flex: 1; accent-color: #cfa758; }.aux-control output { width: 55px; text-align: right; color: #e8cb87; }.aux-control select { color: #302718; background: #eee0bf; padding: 8px 15px; border: 1px solid #b08b4d; font: 18px var(--pc-font-body); }.aux-control button { margin-left: auto; min-width: 115px; }.aux-storage-actions { display: grid; gap: 20px; width: 330px; margin-top: 20px; }.aux-support-art { width: 150px; height: 150px; object-fit: contain; margin: 30px auto; }
.aux-footer { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #735a32; }
.aux-dialog-stage { position: absolute; inset: 0; background-size: 100% 100%; font-family: var(--pc-font-body); }.aux-dialog-shade { position: absolute; inset: 0; background: #231c15aa; }.aux-retreat { position: relative; padding-left: 145px; color: #312618; }.aux-retreat > img { position: absolute; left: 0; top: 45px; width: 125px; height: 125px; object-fit: contain; }.aux-retreat p { font-size: 18px; margin: 0 0 15px; line-height: 1.5; }.aux-retreat dl { margin: 0; }.aux-retreat dl > div { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #b08b4d55; font-size: 19px; }.aux-retreat dd { margin: 0; font-weight: bold; }.aux-positive { color: #426332; }.aux-retreat small { display: block; margin-top: 18px; font-size: 13px; color: #735a32; }.aux-dialog-actions { width: 100%; display: flex; justify-content: space-between; gap: 20px; }.aux-dialog-actions button { flex: 1; font-size: 18px; padding-inline: 15px; }.aux-stage-note { position: absolute; bottom: 34px; left: 0; right: 0; text-align: center; color: #f3deb3; font-size: 15px; }
</style>
