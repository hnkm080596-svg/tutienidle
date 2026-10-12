<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
withDefaults(defineProps<{ icon: string; label: string; hint: string; selected: boolean; locked?: boolean }>(), { locked: false })
defineEmits<{click:[]}>()
const disc = computed(() => `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-disc-v1.png')}')`)
const banner = computed(() => `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-banner-v1.png')}')`)
</script>
<template><button :class="{selected, locked}" :style="{ '--qcat-disc': disc, '--qcat-banner': banner }" :aria-pressed="locked ? undefined : selected" :aria-disabled="locked || undefined" :disabled="locked" @click="$emit('click')"><i class="disc"><img :src="icon" alt=""></i><span><b>{{ label }}</b><small>{{ hint }}</small></span></button></template>
<style scoped>
button{position:relative;display:flex;align-items:center;height:72px;border:0;background:none;color:#f0dfb9;cursor:pointer;padding:0;transition:filter 140ms ease;text-align:left;}button:hover{filter:brightness(1.12) drop-shadow(0 0 2px #dfa94770);}button.selected{filter:brightness(1.22) drop-shadow(0 0 4px #dfa947);}button:active{filter:brightness(.95);}
.disc{position:relative;flex:none;width:64px;height:64px;margin-left:4px;background:var(--qcat-disc) center/contain no-repeat;}
.disc img{position:absolute;inset:0;margin:auto;width:58%;height:58%;object-fit:contain;}
span{flex:1;align-self:stretch;display:flex;flex-direction:column;justify-content:center;margin:10px 8px 10px -8px;padding-left:18px;background:var(--qcat-banner) center/100% 100% no-repeat;min-width:0;}
b{display:block;font:700 15px/18px var(--pc-font-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}small{display:block;font:9px/11px var(--pc-font-body);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
button.locked{filter:grayscale(.85) brightness(.55);cursor:not-allowed;}button.locked:hover{filter:grayscale(.85) brightness(.55);}
</style>
