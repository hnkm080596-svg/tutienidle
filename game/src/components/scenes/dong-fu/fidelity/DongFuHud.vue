<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import { DONG_FU_ART, symbolUrl, type DongFuUiModel } from './dongFuUi'

const avatarFrameUrl = hkChromeUrl('avatar-frame')
defineProps<{ model: DongFuUiModel }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()
</script>
<template>
  <header class="df-hud">
    <button class="df-identity" @click="emit('action', 'character')">
      <InkNineSlice chrome-id="identity-plate" layer="surface" />
      <span class="df-portrait"><img class="df-portrait__art" :src="DONG_FU_ART.cultivator" alt=""><img class="df-portrait__frame" :src="avatarFrameUrl ?? undefined" alt=""></span>
      <span class="df-identity__body"><strong>{{ model.name }}</strong><span>{{ model.realm }}</span><span class="df-progress"><i :style="{ width: `${Math.min(100, Math.max(0, model.progressPercent))}%` }" /></span><small>{{ model.progressLabel }}</small></span>
    </button>
    <div class="df-resources">
      <div v-for="resource in model.resources" :key="resource.id" class="df-resource" :title="resource.label">
        <InkNineSlice chrome-id="resource-pill" layer="surface" /><i class="df-gem" :class="`df-gem--${resource.id}`" aria-hidden="true" /><span>{{ resource.value }}</span>
      </div>
    </div>
    <div class="df-utilities">
      <slot name="utilities-extra" />
      <button v-for="utility in model.utilities" :key="utility.id" class="df-utility" @click="emit('action', utility.id)"><span class="df-utility__seal"><InkNineSlice chrome-id="icon-button-utility" layer="surface" /><img :src="symbolUrl(utility.symbol)" alt=""></span><span>{{ t(utility.labelKey) }}</span></button>
    </div>
  </header>
</template>
<style scoped>
.df-hud { position: absolute; inset: 10px 18px auto 10px; height: 85px; z-index: 5; display: flex; align-items: flex-start; pointer-events: none; }
.df-hud button, .df-resources, .df-utilities :deep(*) { pointer-events: auto; }
.df-identity { position: relative; isolation: isolate; width: 296px; height: 87px; background: none; border: 0; display: flex; text-align: left; padding: 8px 14px 8px 87px; cursor: pointer; color: var(--df-ivory); }
/* wave B chrome: avatar-frame (slices:0) renders as a plain img over the
   clipped portrait - the hand ring/border is gone. */
.df-portrait { position: absolute; left: 5px; top: -1px; width: 78px; height: 78px; border-radius: 50%; overflow: hidden; background: #15202a; }
.df-portrait__art { width: 235px; max-width: none; position: absolute; left: -99px; top: -12px; }
.df-portrait__frame { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; pointer-events: none; }
.df-identity__body { position: relative; width: 100%; display: flex; flex-direction: column; }
.df-identity__body strong { font-size: 21px; line-height: 23px; font-weight: 500; }
.df-identity__body span { font-size: 13px; line-height: 19px; }
.df-identity__body small { font-size: 11px; line-height: 15px; }
.df-progress { height: 4px; background: #010509; border: 1px solid #a58b4e; margin-top: 3px; }
.df-progress i { display: block; height: 100%; background: #ddc984; }
.df-resources { display: flex; gap: 12px; margin-left: auto; margin-right: 30px; padding-top: 3px; }
.df-resource { position: relative; width: 139px; height: 34px; display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 15px; }
.df-resource > span:not(.ink-nine-slice), .df-gem { position: relative; z-index: 2; }
.df-gem { width: 18px; height: 22px; clip-path: polygon(50% 0,100% 28%,85% 80%,50% 100%,15% 80%,0 28%); background: conic-gradient(from 20deg,#e9ffe7,#137151,#a2f6d6,#195141,#efffed); filter: drop-shadow(0 0 4px #8ce8c8); }
.df-gem--gold, .df-gem--spirit_stone_trung_pham { border-radius: 50%; clip-path: none; width: 21px; height: 21px; background: radial-gradient(circle,#302717 15%,#f6dc87 20%,#b27c25 60%,#ffecad 68%,#9b6e21); }
.df-gem--crystal, .df-gem--spirit_stone_thuong_pham { background: conic-gradient(#e5f7ff,#3765aa,#c3ebff,#31578e,#d7f4ff); }
.df-gem--companion_pull_token, .df-gem--duyen_phan { background: conic-gradient(#ffe3ef,#a93a6e,#ffc6dd,#7e2a55,#ffe9f2); border-radius: 50%; clip-path: none; width: 20px; height: 20px; }
.df-utilities { display: flex; gap: 12px; align-items: flex-start; }
.df-utility { border: 0; background: none; color: var(--df-ivory); width: 52px; padding: 0; cursor: pointer; display: grid; justify-items: center; gap: 3px; font-size: 12px; }
/* wave B chrome: icon-button-utility slice (min 32px) inside the seal
   box; the seal keeps only size + relative positioning. */
.df-utility__seal { position: relative; display: grid; place-items: center; width: 34px; height: 34px; padding: 7px; }
.df-utility img { position: relative; z-index: 2; width: 100%; filter: invert(85%) sepia(33%) saturate(595%) hue-rotate(350deg); }
.df-utilities :deep(.auto-farm-indicator) { border: 1px solid #bda571; border-radius: 16px; padding: 5px 12px; background: #111713e6; box-shadow: inset 0 0 0 2px #252518; display: flex; align-items: center; gap: 8px; }
.df-utilities :deep(.auto-farm-indicator__label) { font-size: 12px; color: var(--df-ivory); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
