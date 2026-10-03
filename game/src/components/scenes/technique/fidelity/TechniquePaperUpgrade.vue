<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { TechniqueUiModel } from './techniqueUi'
defineProps<{ model: TechniqueUiModel; notice: string }>()
const emit = defineEmits<{ advance: [] }>()
const { t } = useI18n()
const symbol = resolveAssetUrl('/assets/ui/huyen-kim/symbols/technique.svg')
</script>
<template>
  <aside class="technique-upgrade">
    <h2>{{ t('technique.advance') }}</h2>
    <div class="technique-compare"><div><small>{{ t('technique.current') }}</small><strong>{{ model.currentGrade }}</strong></div><span aria-hidden="true">›</span><div><small>{{ t('technique.target') }}</small><strong>{{ model.nextGrade }}</strong></div></div>
    <p class="technique-upgrade-hint">{{ t('technique.upgradeHint') }}</p>
    <h3>{{ t('technique.materials') }}</h3>
    <div class="technique-material"><span class="technique-material-icon"><img :src="symbol" alt=""></span><div><p>{{ model.material.name }}</p><strong>{{ model.material.amountLabel }}</strong></div></div>
    <p v-if="model.materialNote" class="technique-material-note">{{ model.materialNote }}</p>
    <button class="technique-advance" :disabled="model.advanceDisabled" @click="emit('advance')">{{ t('technique.advance') }}</button>
    <p class="technique-notice" role="status" aria-live="polite">{{ notice || model.disabledReason }}</p>
  </aside>
</template>
<style scoped>
.technique-upgrade { position:absolute; left:1002px; top:178px; width:362px; height:543px; padding-left:28px; border-left:1px solid #aa8a4566; }h2 { margin:0 0 28px; font-size:29px; font-weight:500; }h3 { margin:26px 0 19px; padding-top:20px; border-top:1px solid #aa8a4577; font-size:21px; font-weight:500; }
.technique-compare { display:flex; align-items:center; justify-content:space-between; text-align:center; }.technique-compare div { display:grid; gap:10px; }.technique-compare small { color:#7a6947; font-size:14px; }.technique-compare strong { font-size:26px; font-weight:500; color:#6d5126; }.technique-compare > span { font-size:38px; color:#a37b2e; }.technique-upgrade-hint { color:#746348; font-size:15px; line-height:1.7; margin:22px 0 0; }
.technique-material { display:flex; gap:16px; align-items:center; padding:12px 0; }.technique-material-icon { width:49px; height:49px; display:grid; place-items:center; border:3px double #ac8a46; border-radius:8px; background:#d5ba7655; }.technique-material-icon img { width:29px; height:29px; }.technique-material p { margin:0 0 7px; font-size:17px; }.technique-material strong { color:#33624c; font-size:17px; font-weight:500; }.technique-material-note { font-size:12px; color:#837253; line-height:1.6; }
.technique-advance { position:absolute; left:28px; bottom:44px; width:calc(100% - 28px); height:49px; border:3px double #ba9a4e; border-radius:6px; background:linear-gradient(100deg,#174d3d,#307059,#174d3d); color:#fff1ca; font:23px var(--font-display,Georgia,serif); cursor:pointer; }.technique-advance:hover { filter:brightness(1.12); }.technique-advance:focus-visible { outline:2px solid #315b43; outline-offset:3px; }.technique-advance:disabled { cursor:default; filter:grayscale(.55) opacity(.75); }.technique-notice { position:absolute; left:28px; bottom:0; width:calc(100% - 28px); height:35px; margin:0; color:#715d3b; font-size:12px; line-height:16px; }
</style>
