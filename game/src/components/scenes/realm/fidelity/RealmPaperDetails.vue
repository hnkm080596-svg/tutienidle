<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { RealmUiModel } from './realmUi'
const props = defineProps<{ model: RealmUiModel; selected: number; notice: string }>()
const emit = defineEmits<{ breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()
const fill = computed(() => Number.isFinite(props.model.progress) ? Math.min(100, Math.max(0, props.model.progress)) : 0)
const seal = resolveAssetUrl('/assets/ui/huyen-kim/symbols/realm.svg')
</script>
<template>
  <section class="realm-details">
    <header class="realm-identity"><span class="realm-seal"><img :src="seal" alt=""></span><div><h2>{{ model.name }}</h2><p>{{ t('realm.floorCount', { floor: model.currentFloor, total: model.maxFloor }) }}</p></div></header>
    <h3>{{ t('panels.realm.sections.progress') }}</h3>
    <div class="realm-progress"><div class="realm-progress-track" role="progressbar" :aria-label="t('panels.realm.sections.progress')" :aria-valuenow="fill" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${fill}%` }" /></div><strong>{{ model.progressLabel }}</strong></div>
    <dl class="realm-values"><div><dt>{{ t('realm.cultivation') }}</dt><dd>{{ model.cultivation }}</dd></div><div><dt>{{ t('panels.realm.meta.rateLabel') }}</dt><dd>{{ model.rate }}</dd></div></dl>
    <section v-if="model.passives.length" class="realm-passives">
      <h3>{{ t('panels.realm.sections.passives', { realm: model.name }) }}</h3>
      <ul><li v-for="passive in model.passives" :key="passive.id" :title="passive.description"><strong>{{ passive.name }}</strong><small v-for="line in passive.effectLines" :key="line">{{ line }}</small></li></ul>
    </section>
    <div v-if="model.ctaVisible" class="realm-breakthrough"><h3>{{ t('realm.breakthroughTitle', { target: model.nextRealmName || model.name }) }}</h3><dl class="realm-values"><div v-for="row in model.requirements" :key="row.id" :class="{ met: row.met }"><dt>{{ row.label }}</dt><dd>{{ row.met ? t('panels.realm.requirements.met') : t('panels.realm.requirements.unmet') }}</dd></div></dl></div>
    <p class="realm-selection">{{ t('realm.viewing', { floor: selected }) }}</p>
    <button v-if="model.ctaVisible" class="realm-cta" :disabled="!model.ctaEnabled" @click="emit('breakthrough')">{{ model.ctaLabel }}</button>
    <!-- R13: Quan Khi re-entry lives in Canh Gioi now (was Nhan Vat's
         action rail) - sword-path players only. -->
    <button v-if="model.quanKhiEntry" class="realm-quan-khi" @click="emit('quanKhi')">{{ t('panels.character.actions.quanKhi') }}</button>
    <p class="realm-notice" role="status" aria-live="polite">{{ notice }}</p>
  </section>
</template>
<style scoped>
.realm-details { position:absolute; left:933px; top:170px; width:430px; height:557px; padding-left:29px; border-left:1px solid #aa8a4566; line-height:1.2; overflow:hidden; }
.realm-identity { display:flex; align-items:center; gap:22px; padding-bottom:23px; border-bottom:1px solid #a98a4b; }.realm-identity h2 { margin:0; font-size:46px; font-weight:500; }.realm-identity p { margin:7px 0 0; font-size:22px; }.realm-seal { flex:none; width:66px; height:66px; display:grid; place-items:center; border:3px double #ad873a; border-radius:50%; background:#d7bb7466; }.realm-seal img { width:38px; height:38px; }
h3 { font-size:23px; font-weight:500; margin:24px 0 15px; }.realm-progress { display:flex; align-items:center; gap:17px; }.realm-progress strong { color:#256651; font-size:30px; font-style:italic; font-weight:500; }.realm-progress-track { flex:1; height:17px; padding:2px; border:3px double #ac8133; background:#85724b; border-radius:10px; overflow:hidden; box-sizing:content-box; }.realm-progress-track span { display:block; height:100%; border-radius:5px; background:linear-gradient(90deg,#145846,#92c9a4); }
.realm-values { margin:15px 0; font-size:17px; }.realm-values > div { display:flex; justify-content:space-between; gap:15px; padding:8px 0; border-bottom:1px solid #ad955d33; }.realm-values dd { margin:0; text-align:right; }.realm-values > div.met dd { color:#256651; }
.realm-passives { border-top:1px solid #a98a4b; margin-top:16px; }.realm-passives h3 { margin-top:15px; font-size:19px; }
.realm-passives ul { margin:0; padding:0; list-style:none; max-height:120px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#7f714c transparent; }
.realm-passives li { display:flex; align-items:baseline; gap:8px; padding:5px 0; font-size:13px; }.realm-passives li strong { font-weight:500; }.realm-passives li small { color:#6b5f42; }
.realm-breakthrough { border-top:1px solid #a98a4b; margin-top:16px; }.realm-breakthrough h3 { margin-top:15px; font-size:19px; }
.realm-quan-khi { margin-top:12px; padding:7px 16px; border:1px solid #a5762e; background:linear-gradient(#ffe9ae,#d3a952); color:#4a2f0c; font-size:14px; cursor:pointer; border-radius:4px; }
.realm-selection { position:absolute; left:29px; bottom:90px; margin:0; font-size:13px; color:#6b654d; }
.realm-cta { position:absolute; left:29px; bottom:35px; width:calc(100% - 29px); height:48px; background:linear-gradient(100deg,#164f40,#28775d,#164f40); border:3px double #c0a35e; border-radius:6px; color:#fff3cf; font:23px var(--font-display,Georgia,serif); cursor:pointer; box-shadow:inset 0 0 0 2px #2d3c2b,0 3px 8px #74603b33; }.realm-cta:hover:not(:disabled) { filter:brightness(1.12); }.realm-cta:focus-visible { outline:2px solid #23604d; outline-offset:3px; }.realm-cta:disabled { opacity:.45; filter:grayscale(.6); cursor:default; }
.realm-notice { position:absolute; left:29px; bottom:0; width:calc(100% - 29px); margin:0; height:29px; font-size:12px; line-height:14px; color:#665738; }
</style>
