<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
withDefaults(defineProps<{ icon: string; label: string; hint: string; selected: boolean; locked?: boolean }>(), { locked: false })
defineEmits<{click:[]}>()
const medallion = computed(() => `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png')}')`)
</script>
<template><button :class="{selected, locked}" :style="{ '--qcat-medallion': medallion }" :aria-pressed="locked ? undefined : selected" :aria-disabled="locked || undefined" :disabled="locked" @click="$emit('click')"><img :src="icon" alt=""><span><b>{{ label }}</b><small>{{ hint }}</small></span></button></template>
<style scoped>
button{position:relative;display:block;height:72px;border:0;background:var(--qcat-medallion) center/100% 100% no-repeat;color:#f0dfb9;cursor:pointer;padding:0;transition:filter 140ms ease;}button:hover{filter:brightness(1.12) drop-shadow(0 0 2px #dfa94770);}button.selected{filter:brightness(1.22) drop-shadow(0 0 4px #dfa947);}button:active{filter:brightness(.95);}img{position:absolute;left:7px;top:50%;transform:translateY(-50%);width:46px;height:46px;object-fit:contain;}span{position:absolute;left:78px;right:10px;top:50%;transform:translateY(-54%);display:flex;flex-direction:column;justify-content:center;text-align:left;}b{display:block;font:700 15px/18px var(--pc-font-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}small{display:block;font:9px/11px var(--pc-font-body);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}button.locked{filter:grayscale(.85) brightness(.55);cursor:not-allowed;}button.locked:hover{filter:grayscale(.85) brightness(.55);}
</style>
