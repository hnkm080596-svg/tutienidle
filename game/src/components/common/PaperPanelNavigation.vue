<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
export interface PaperNavigationItem { id: string; label: string; icon: string }
defineProps<{ items: readonly PaperNavigationItem[]; active: string; label: string; backLabel: string }>()
const emit = defineEmits<{ select: [id: string]; back: [] }>()
const backIcon = resolveAssetUrl('/assets/ui/huyen-kim/symbols/back.svg')
</script>
<template>
  <nav class="paper-navigation" :aria-label="label">
    <button class="paper-back" :aria-label="backLabel" :title="backLabel" @click="emit('back')"><img :src="backIcon" alt=""></button>
    <div class="paper-navigation-items">
      <button v-for="item in items" :key="item.id" class="paper-navigation-item" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" @click="emit('select', item.id)">
        <span class="paper-navigation-icon"><img :src="item.icon" alt=""></span><span>{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
<style scoped>
.paper-navigation { position:absolute; left:123px; top:151px; width:78px; height:565px; display:flex; flex-direction:column; border-right:1px solid #96815255; color:#66502d; }
.paper-back { flex:none; height:39px; margin:0 12px 12px 0; border:0; background:none; color:inherit; font:29px Georgia,serif; cursor:pointer; }
.paper-back img { display:block; width:25px; height:25px; margin:auto; }
.paper-navigation-items { overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; scrollbar-color:#ab8c4c transparent; padding:8px 8px 10px 0; display:flex; flex-direction:column; gap:18px; }
.paper-navigation-item { flex:none; display:grid; justify-items:center; gap:7px; width:65px; padding:0; border:0; background:none; color:inherit; font:13px var(--font-display,Georgia,serif); cursor:pointer; }
.paper-navigation-icon { display:grid; place-items:center; width:38px; height:38px; border:1px solid #997541; transform:rotate(45deg); border-radius:9px; background:#e0d0a77d; }
.paper-navigation-icon img { width:22px; height:22px; transform:rotate(-45deg); }
.active .paper-navigation-icon { background:#a47d30; box-shadow:0 0 12px #c49c4960; }.active img { filter:invert(94%) sepia(24%) saturate(325%); }
button:hover { color:#362407; }button:focus-visible { outline:2px solid #386b59; outline-offset:3px; }
</style>
