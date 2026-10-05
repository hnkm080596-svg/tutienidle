<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { pcPaperIconUrl } from '@/presentation/assets/PcPaperIcons'
defineProps<{ kind: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="paper-archetype">
    <section class="paper-archetype__content">
      <template v-if="kind === 'crafting'">
        <div class="paper-archetype__recipes"><button v-for="n in 4" :key="n" :class="{ selected: n === 1 }"><img :src="pcPaperIconUrl('alchemy')" alt=""><span>{{ t('sampleRecipe', { n }) }}</span></button></div>
        <div class="paper-archetype__craft"><img :src="pcPaperIconUrl('forge')" alt=""><h2>{{ t('sampleRecipe', { n: 1 }) }}</h2><div class="paper-archetype__materials"><span v-for="n in 3" :key="n" class="pc-paper-slot"><img :src="pcPaperIconUrl('artifact')" alt=""><b>{{ n }}/5</b></span></div><PcPaperButton>{{ t('designAction') }}</PcPaperButton></div>
      </template>
      <div v-else class="paper-archetype__rows"><article v-for="n in 5" :key="n"><img :src="pcPaperIconUrl(kind === 'settings' ? 'settings' : 'quest')" alt=""><div><h2>{{ t('sampleRow', { n }) }}</h2><p>{{ t('designDescription') }}</p></div><span v-if="kind === 'settings'" class="paper-archetype__value">{{ t('sampleValue') }}</span><PcPaperButton v-else variant="secondary">{{ t('detail') }}</PcPaperButton></article></div>
    </section>
    <aside class="pc-paper-inspector paper-archetype__inspector"><h2>{{ t('designInspector') }}</h2><p>{{ t('designDescription') }}</p><h3>{{ t('designInformation') }}</h3><dl><div v-for="n in 3" :key="n"><dt>{{ t('sampleAttribute', { n }) }}</dt><dd>—</dd></div></dl><div class="paper-archetype__preview"><img :src="pcPaperIconUrl(kind === 'crafting' ? 'alchemy' : kind === 'map' ? 'compass' : 'artifact')" alt=""></div><PcPaperButton>{{ t('designAction') }}</PcPaperButton><p class="paper-archetype__note">{{ t('designOnly') }}</p></aside>
  </div>
</template>

<style>
.paper-archetype { height: 100%; display: grid; grid-template-columns: minmax(0,1.8fr) minmax(0,1fr); gap: 26px; }
.paper-archetype__content { position: relative; min-width: 0; }
.paper-archetype__inspector { display: flex; flex-direction: column; }
.paper-archetype__inspector p { line-height: 1.6; }
.paper-archetype__preview { flex: 1; display: grid; place-items: center; }
.paper-archetype__preview img { width: 112px; height: 112px; object-fit: contain; }
.paper-archetype__note { font-size: 14px; opacity: .8; text-align: center; margin-bottom: 0; }
.paper-archetype__rows { display: flex; flex-direction: column; gap: 16px; }
.paper-archetype__rows article { display: flex; align-items: center; gap: 18px; min-height: 87px; border-bottom: 1px solid #b38b4360; padding: 5px 12px; }
.paper-archetype__rows article > img { width: 48px; height: 48px; object-fit: contain; }
.paper-archetype__rows article > div { flex: 1; }
.paper-archetype__rows h2 { font-size: 23px; margin: 0 0 6px; }
.paper-archetype__rows p { margin: 0; font-size: 16px; }
.paper-archetype__rows .pc-paper-button { font-size: 18px; }
.paper-archetype__value { border: 3px double #ae8841; padding: 8px 16px; background: #322e23; color: #ead4a4; }
.paper-archetype__recipes { width: 31%; display: flex; flex-direction: column; gap: 12px; }
.paper-archetype__recipes button { border: 1px solid #b38b4380; background: #f3dca442; display: flex; gap: 12px; align-items: center; padding: 15px; color: #302619; font: 20px var(--pc-font-body); }
.paper-archetype__recipes button.selected { border: 3px double #b38b43; background: #d9b46944; }
.paper-archetype__recipes img { width: 44px; height: 44px; object-fit: contain; }
.paper-archetype__craft { position: absolute; left: 35%; right: 0; inset-block: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 24px; }
.paper-archetype__craft > img { width: 170px; height: 170px; object-fit: contain; }
.paper-archetype__craft h2 { margin: 0; font-size: 29px; }
.paper-archetype__materials { display: flex; gap: 14px; }
</style>
