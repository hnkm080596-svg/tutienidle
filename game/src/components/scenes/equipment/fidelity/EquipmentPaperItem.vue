<script setup lang="ts">
import type { EquipmentDisplay } from './equipmentUi'
defineProps<{ item: EquipmentDisplay | null; label: string }>()
const emit = defineEmits<{ inspect: [item: EquipmentDisplay]; leave: [] }>()
</script>
<template>
  <button class="gear-item" :style="{ '--gear-tone': item?.tone ?? '#a68b57' }" :aria-label="item ? `${label} · ${item.name}` : label" :aria-describedby="item ? 'equipment-tooltip' : undefined" @pointerenter="item && emit('inspect', item)" @pointerleave="emit('leave')" @focus="item && emit('inspect', item)" @blur="emit('leave')" @keydown.esc="emit('leave')">
    <img v-if="item" :src="item.icon" alt=""><span v-else class="empty-mark" aria-hidden="true">◇</span>
    <span v-if="item" class="enhancement">{{ item.enhancement }}</span>
    <span v-if="item" class="level">{{ item.level }}</span>
  </button>
</template>
<style scoped>
.gear-item { position:relative; isolation:isolate; display:grid; place-items:center; width:74px; height:74px; padding:8px; border:1px solid #d1ac61; border-radius:3px; background:radial-gradient(ellipse at 50% 70%,color-mix(in srgb,var(--gear-tone) 32%,#102019),#081410 75%); box-shadow:inset 0 0 0 2px #342b16,inset 0 0 0 3px #b9934970,0 3px 6px #30200f66; cursor:pointer; }
.gear-item::before { content:''; position:absolute; inset:5px; z-index:-1; border:1px solid var(--gear-tone); box-shadow:inset 0 -8px 16px color-mix(in srgb,var(--gear-tone) 25%,transparent); pointer-events:none; }
.gear-item::after { content:''; position:absolute; inset:0; border:3px solid transparent; border-image:linear-gradient(135deg,#ffe6a2 0%,#8e632b 25%,#ddbf73 50%,#725020 75%,#f1d18a) 1; clip-path:polygon(0 0,18% 0,18% 4%,4% 4%,4% 18%,0 18%,0 82%,4% 82%,4% 96%,18% 96%,18% 100%,82% 100%,82% 96%,96% 96%,96% 82%,100% 82%,100% 18%,96% 18%,96% 4%,82% 4%,82% 0,100% 0,100% 100%,0 100%); pointer-events:none; }
.gear-item img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 3px #000) drop-shadow(0 0 4px color-mix(in srgb,var(--gear-tone) 55%,transparent)); }
.enhancement { position:absolute; top:3px; right:5px; color:#ffe4a0; text-shadow:0 1px 3px #000; font-size:13px; font-weight:700; }.level { position:absolute; bottom:3px; right:4px; color:#f0ddb0; background:#06140ee6; border-top:1px solid #b8974955; font-size:10px; padding:1px 4px; }.empty-mark { font-size:34px; color:#9c8555; }
.gear-item:hover,.gear-item:focus-visible { outline:2px solid #e8c37c; outline-offset:3px; box-shadow:0 0 14px color-mix(in srgb,var(--gear-tone) 50%,transparent),0 3px 6px #30200f66; }
</style>
