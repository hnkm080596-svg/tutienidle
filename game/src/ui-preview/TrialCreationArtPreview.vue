<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const selected = ref(0)
const pathway = ref(0)
const name = ref('')
const notice = ref('')
const talents: { id: string; icon: PcPaperIcon }[] = [
  { id: 'fire', icon: 'body-flame' }, { id: 'water', icon: 'opportunity' }, { id: 'wind', icon: 'compass' },
  { id: 'earth', icon: 'realm' }, { id: 'lightning', icon: 'skill' }, { id: 'wood', icon: 'body-lungs' },
  { id: 'metal', icon: 'artifact' }, { id: 'void', icon: 'portal' }, { id: 'herb', icon: 'alchemy' },
]
const selectedTalent = computed(() => talents[selected.value]!)
const pathways = ['sword', 'manual', 'talisman', 'pill', 'forge']
const art = {
  panel: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/trial-creation-panel-v2.png'),
  frame: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png'),
  cloud: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/cloud-ornament@2x.png'),
}
const style = { '--trial-panel': `url('${art.panel}')`, '--trial-frame': `url('${art.frame}')` }
function randomName() { name.value = t('authPreview.trial.randomName'); notice.value = '' }
</script>

<template>
  <section class="trial-creation-art" :style="style" data-testid="trial-creation-art">
    <PcPaperButton class="trial-back" variant="secondary" data-testid="trial-back" @click="emit('back')">‹ {{ t('authPreview.back') }}</PcPaperButton>
    <header class="trial-heading"><img :src="art.cloud" alt=""></header>
    <div class="trial-brush-ring" aria-hidden="true"><svg viewBox="0 0 500 500"><circle cx="250" cy="250" r="222" fill="none" stroke="currentColor" stroke-width="9" stroke-dasharray="340 7 100 12 32 3 190 9"/><circle cx="250" cy="250" r="210" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="160 8 40 12"/><circle cx="250" cy="250" r="234" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 8 100 4"/></svg><img v-for="position in ['top','right','bottom','left']" :key="position" :class="`trial-cloud-${position}`" :src="art.cloud" alt=""></div>
    <section class="trial-creation-board">
      <div class="trial-name-row"><span class="trial-name-label">{{ t('authPreview.trial.setName') }}</span><input v-model="name" :aria-label="t('authPreview.name')" :placeholder="t('authPreview.trial.namePlaceholder')"><PcPaperButton icon variant="secondary" :aria-label="t('authPreview.trial.random')" @click="randomName">⚄</PcPaperButton></div>
      <h2 class="trial-section-title trial-path-title">{{ t('authPreview.trial.choosePath') }}</h2>
      <p class="trial-path-description">{{ t('authPreview.trial.pathDescription') }}</p>
      <div class="trial-paths"><PcPaperButton v-for="(path,index) in pathways" :key="path" :variant="pathway === index ? 'primary' : 'secondary'" :aria-pressed="pathway === index" @click="pathway = index">{{ t(`authPreview.trial.paths.${path}`) }}</PcPaperButton></div>
      <h2 class="trial-section-title trial-talent-title">{{ t('authPreview.trial.chooseTalent') }}</h2>
      <div class="trial-talent-workspace">
        <div class="trial-talent-grid">
          <button v-for="(talent,index) in talents" :key="talent.id" type="button" :class="{ selected: selected === index }" :aria-pressed="selected === index" :data-testid="`trial-talent-${talent.id}`" @click="selected = index"><span class="trial-talent-seal"><img :src="pcPaperIconUrl(talent.icon)" alt=""></span><b>{{ t(`authPreview.trial.talents.${talent.id}`) }}</b></button>
        </div>
        <aside class="trial-talent-detail"><span class="trial-talent-seal"><img :src="pcPaperIconUrl(selectedTalent.icon)" alt=""></span><h3>{{ t(`authPreview.trial.talents.${selectedTalent.id}`) }}</h3><p>{{ t('authPreview.trial.description', { talent: t(`authPreview.trial.talents.${selectedTalent.id}`) }) }}</p><h4 class="trial-section-title">{{ t('authPreview.trial.features') }}</h4><ul><li v-for="n in 3" :key="n">{{ t(`authPreview.trial.feature${n}`) }}</li></ul></aside>
      </div>
      <PcPaperButton variant="secondary" class="trial-begin" data-testid="trial-begin" @click="notice = t('authPreview.created')">{{ t('authPreview.create') }}</PcPaperButton>
      <p v-if="notice" class="trial-notice" role="status">{{ notice }}</p>
    </section>
  </section>
</template>

<style scoped>
.trial-creation-art { position: absolute; inset: 0; }
.trial-back { position: absolute; top: 20px; left: 22px; min-width: 125px; z-index: 2; font-size: 19px; }
.trial-heading { position: absolute; left: 175px; right: 40px; top: 20px; height: 82px; border-bottom: 1px solid #b08a47; }
.trial-heading img { position: absolute; right: 20px; top: -7px; width: 280px; height: 95px; object-fit: contain; opacity: .5; }
.trial-brush-ring { position: absolute; left: 82px; top: 170px; width: 550px; height: 550px; color: #ae813c; opacity: .6; pointer-events: none; }
.trial-brush-ring svg { width: 100%; height: 100%; }
.trial-brush-ring img { position: absolute; width: 190px; height: 90px; object-fit: contain; }
.trial-cloud-top { top: 5px; right: 25px; }.trial-cloud-right { right: -40px; top: 180px; }.trial-cloud-bottom { bottom: 20px; left: 15px; }.trial-cloud-left { left: -45px; top: 140px; }
.trial-creation-board { position: absolute; top: 110px; right: 40px; width: 700px; height: 650px; padding: 38px 28px 22px; color: #f1e2c0; background: var(--trial-panel) center / contain no-repeat; }
.trial-creation-board::before { display: none; }
.trial-section-title { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 0 0 8px; font: 700 22px var(--pc-font-body); }
.trial-section-title::before, .trial-section-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg,transparent,#b6934c); }
.trial-section-title::after { transform: rotate(180deg); }
.trial-talent-workspace { display: grid; grid-template-columns: 350px 1fr; gap: 18px; height: 260px; }
.trial-talent-grid { display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,minmax(0,1fr)); gap: 9px; }
.trial-talent-grid button { min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 3px double #8c794f; background: linear-gradient(145deg,#323025,#181e19); color: #f1e2c0; cursor: pointer; font: 15px var(--pc-font-body); }
.trial-talent-grid button.selected { border-color: #e2b257; background: radial-gradient(#b48b3d,#382b17); box-shadow: inset 0 0 12px #deb35b70,0 0 7px #cf9e4a60; }
.trial-talent-grid button:hover:not(.selected) { border-color: #c3a464; background: #403b2b; }
.trial-talent-seal { display: grid; place-items: center; width: 49px; height: 49px; border-radius: 50%; border: 3px double #c7ad78; background: radial-gradient(#463d28,#1b211a); }
.trial-talent-seal img { width: 35px; height: 35px; object-fit: contain; }
.trial-talent-detail { padding: 12px 16px; border: 3px double #9c844f; background: #161b17b0; text-align: center; }
.trial-talent-detail .trial-talent-seal { margin: 0 auto; }
.trial-talent-detail h3 { font-size: 24px; margin: 7px 0; }.trial-talent-detail p { font-size: 14px; line-height: 1.35; margin: 7px 0 14px; }
.trial-talent-detail h4 { font-size: 18px; }.trial-talent-detail ul { text-align: left; padding-left: 16px; font-size: 14px; line-height: 1.35; margin: 0; }.trial-talent-detail li { margin-bottom: 4px; }.trial-talent-detail li::marker { color: #dbb260; }
.trial-name-row { display: flex; align-items: center; gap: 12px; padding: 0 55px; margin: 8px 0 4px; }
.trial-name-label { flex: 0 0 auto; color: #e8cf9e; font: 700 22px var(--pc-font-body); white-space: nowrap; }
.trial-name-row input { min-width: 0; flex: 1; height: 42px; padding: 8px 16px; border: 1px solid #b49860; background: #1b211a; color: #f1e2c0; font: 15px var(--pc-font-body); }.trial-name-row input::placeholder { color: #aaa18b; }.trial-name-row button { min-height: 42px; font-size: 28px; transform: translateY(-4px); }
.trial-path-title { margin: 14px 0 4px; font-size: 18px; }.trial-path-description { margin: 0 0 8px; font-size: 14px; text-align: center; }
.trial-talent-title { margin-top: 18px; }
.trial-paths { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }.trial-paths button { padding: 7px 8px; min-height: 44px; font-size: 15px; }
.trial-begin { position: absolute; left: 50%; bottom: 28px; transform: translate(-50%, 50%); display: block; width: 345px; min-height: 56px; margin: 9px auto 0; font-size: 27px; }.trial-notice { position: absolute; bottom: -35px; left: 0; right: 0; text-align: center; color: #543d21; font-size: 16px; }
</style>





