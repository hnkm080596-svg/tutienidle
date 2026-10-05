<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DongFuArtFrame from './DongFuArtFrame.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import { pcPaperResourceUrl, type PcPaperResource } from '@/presentation/assets/PcPaperControls'
import { symbolUrl, type DongFuUiModel } from './dongFuUi'
defineProps<{ model: DongFuUiModel }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()
function resourceArt(id: string): string | null {
  const resources: Record<string, PcPaperResource> = { spirit_stone: 'jade', spirit_stone_ha_pham: 'jade', gold: 'coin', spirit_stone_trung_pham: 'coin', crystal: 'crystal', spirit_stone_thuong_pham: 'crystal', essence: 'essence' }
  return resources[id] ? pcPaperResourceUrl(resources[id]) : null
}
</script>
<template>
  <header class="df-hud">
    <button class="df-identity" @click="emit('action', 'character')">
      <DongFuArtFrame :border-width="34" />
      <span class="df-portrait"><PlayerPortrait variant="cultivate" animation-mode="idle" height="100%" /></span>
      <span class="df-identity__body"><strong>{{ model.name }}</strong><span>{{ model.realm }}</span><span class="df-progress"><i :style="{ width: `${Math.min(100, Math.max(0, model.progressPercent))}%` }" /></span><small>{{ model.progressLabel }}</small></span>
    </button>
    <div class="df-resources">
      <div v-for="resource in model.resources" :key="resource.id" class="df-resource" :title="resource.label">
        <img v-if="resourceArt(resource.id)" class="df-resource-art" :src="resourceArt(resource.id)!" alt=""><i v-else class="df-gem" :class="`df-gem--${resource.id}`" aria-hidden="true" /><span>{{ resource.value }}</span>
      </div>
    </div>
    <div class="df-utilities">
      <slot name="utilities-extra" />
      <button v-for="utility in model.utilities" :key="utility.id" class="df-utility" @click="emit('action', utility.id)"><span class="df-utility__seal"><img :src="symbolUrl(utility.symbol)" alt=""></span><span>{{ t(utility.labelKey) }}</span></button>
    </div>
  </header>
</template>
<style scoped>
.df-hud { position: absolute; inset: 10px 18px auto 10px; height: 85px; z-index: 5; display: flex; align-items: flex-start; pointer-events: none; }
.df-hud button, .df-resources, .df-utilities :deep(*) { pointer-events: auto; }
.df-identity { position: relative; width: 296px; height: 87px; background: none; border: 0; display: flex; text-align: left; padding: 8px 14px 8px 87px; cursor: pointer; color: var(--df-ivory); }
.df-portrait { position: absolute; left: 5px; top: -3px; width: 78px; height: 87px; border-radius: 48%; border: 2px solid var(--df-gold); box-shadow: 0 0 0 3px #0b1018, 0 0 0 4px #957540; overflow: hidden; background: #15202a; }
.df-portrait img { width: 235px; max-width: none; position: absolute; left: -99px; top: -16px; }
.df-identity__body { position: relative; width: 100%; display: flex; flex-direction: column; }
.df-identity__body strong { font-size: 21px; line-height: 23px; font-weight: 500; }
.df-identity__body span { font-size: 13px; line-height: 19px; }
.df-identity__body small { font-size: 11px; line-height: 15px; }
.df-progress { height: 4px; background: #010509; border: 1px solid #a58b4e; margin-top: 3px; }
.df-progress i { display: block; height: 100%; background: #ddc984; }
.df-resources { display: flex; gap: 12px; margin-left: auto; margin-right: 30px; padding-top: 3px; }
.df-resource { position: relative; width: 139px; height: 34px; display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 15px; }
.df-resource > span:not(.df-art-frame), .df-gem { position: relative; }
.df-gem { width: 18px; height: 22px; clip-path: polygon(50% 0,100% 28%,85% 80%,50% 100%,15% 80%,0 28%); background: conic-gradient(from 20deg,#e9ffe7,#137151,#a2f6d6,#195141,#efffed); filter: drop-shadow(0 0 4px #8ce8c8); }
.df-gem--gold, .df-gem--spirit_stone_trung_pham { border-radius: 50%; clip-path: none; width: 21px; height: 21px; background: radial-gradient(circle,#302717 15%,#f6dc87 20%,#b27c25 60%,#ffecad 68%,#9b6e21); }
.df-gem--crystal, .df-gem--spirit_stone_thuong_pham { background: conic-gradient(#e5f7ff,#3765aa,#c3ebff,#31578e,#d7f4ff); }
.df-gem--companion_pull_token, .df-gem--duyen_phan { background: conic-gradient(#ffe3ef,#a93a6e,#ffc6dd,#7e2a55,#ffe9f2); border-radius: 50%; clip-path: none; width: 20px; height: 20px; }
.df-utilities { display: flex; gap: 12px; align-items: flex-start; }
.df-utility { border: 0; background: none; color: var(--df-ivory); width: 52px; padding: 0; cursor: pointer; display: grid; justify-items: center; gap: 3px; font-size: 12px; }
.df-utility__seal { border: 1px solid #bda571; border-radius: 50%; width: 30px; height: 30px; padding: 5px; background: #111713e6; box-shadow: inset 0 0 0 2px #252518; }
.df-utility img { width: 100%; filter: invert(85%) sepia(33%) saturate(595%) hue-rotate(350deg); }
.df-utilities :deep(.auto-farm-indicator) { border: 1px solid #bda571; border-radius: 16px; padding: 5px 12px; background: #111713e6; box-shadow: inset 0 0 0 2px #252518; display: flex; align-items: center; gap: 8px; }
.df-utilities :deep(.auto-farm-indicator__label) { font-size: 12px; color: var(--df-ivory); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
