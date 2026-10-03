<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ label: string; value: string; percent: number; tone?: string }>()
const fill = computed(() => Number.isFinite(props.percent) ? Math.max(0, Math.min(100, props.percent)) : 0)
</script>
<template><div :class="['meter', tone]" role="progressbar" :aria-label="label" :aria-valuenow="fill" :aria-valuetext="value" :aria-valuemin="0" :aria-valuemax="100"><i class="fill" :style="{ width: `${fill}%` }" /><span class="value">{{ value }}</span></div></template>
<style scoped>
.meter { position:relative; height:17px; border:1px solid #bca469; background:#100e0dd9; overflow:hidden; box-shadow:0 1px 3px #0009; transform:skewX(-9deg); }
.fill { position:absolute; inset:0 auto 0 0; background:linear-gradient(#d05d48,#8b2723 60%,#5b1719); border-top:1px solid #ffcd8666; }
.meter.mana .fill { background:linear-gradient(#57b9c4,#216a83 65%,#16415b); }.meter.ward .fill { background:linear-gradient(#cdb875,#87754c); }
.value { position:relative; display:block; text-align:center; color:#fff8df; font:11px/15px var(--font-body,serif); text-shadow:0 1px 2px #000,0 0 3px #000; transform:skewX(9deg); }
</style>
