<script setup lang="ts">
defineProps<{ icon: string; label: string; hint: string; selected: boolean }>()
defineEmits<{click:[]}>()
</script>
<template><button :class="{selected}" :aria-pressed="selected" @click="$emit('click')"><img :src="icon" alt=""><span><b>{{ label }}</b><small>{{ hint }}</small></span></button></template>
<style scoped>
button{position:relative;display:flex;align-items:center;gap:5px;height:65px;border:0;background:url('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png') center/100% 100% no-repeat;color:#f0dfb9;cursor:pointer;padding:5px;transition:filter 140ms ease;}button:hover{filter:brightness(1.12) drop-shadow(0 0 2px #dfa94770);}button.selected{filter:brightness(1.22) drop-shadow(0 0 4px #dfa947);}button:active{filter:brightness(.95);}img{width:42px;height:42px;object-fit:contain;}span{text-align:left;}b{display:block;font:700 17px var(--pc-font-body);}small{font:10px var(--pc-font-body);}
</style>
