<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
export interface PaperNavigationItem {
  id: string
  label: string
  icon: string
  /** Progression-gated entries stay on the rail dimmed but cannot open
   *  (navigate() refuses them too) - e.g. Tam Phap below Luyen Khi. */
  locked?: boolean
}
defineProps<{ items: readonly PaperNavigationItem[]; active: string; label: string; backLabel: string }>()
const emit = defineEmits<{ select: [id: string]; back: [] }>()
const backIcon = resolveAssetUrl('/assets/ui/huyen-kim/symbols/back.svg')
const navSealUrl = hkChromeUrl('nav-seal-vertical')
</script>
<template>
  <nav class="paper-navigation" :aria-label="label">
    <button class="paper-back" :aria-label="backLabel" :title="backLabel" @click="emit('back')"><img :src="backIcon" alt=""></button>
    <div class="paper-navigation-items">
      <button v-for="item in items" :key="item.id" class="paper-navigation-item" :class="{ active: active === item.id, 'is-locked': item.locked }" :aria-current="active === item.id ? 'page' : undefined" :aria-disabled="item.locked || undefined" :data-nav-id="item.id" @click="emit('select', item.id)">
        <span class="paper-navigation-icon"><img class="paper-navigation-icon__seal" :src="navSealUrl ?? undefined" alt=""><img class="paper-navigation-icon__glyph" :src="item.icon" alt=""></span><span>{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
<style scoped>
/* The rail must end above the paper's bottom-left corner ornament
   (its gold curls reach ~700 design px at the rail column): height
   535 keeps all 11 canonical items fully on the flat paper without
   scrolling (spec: scrollfade, no visible bar). */
.paper-navigation { position:absolute; left:123px; top:145px; width:78px; height:535px; display:flex; flex-direction:column; border-right:1px solid #96815255; color:#66502d; }
.paper-back { flex:none; height:30px; margin:0 12px 8px 0; border:0; background:none; color:inherit; font:29px Georgia,serif; cursor:pointer; }
.paper-back img { display:block; width:22px; height:22px; margin:auto; }
.paper-navigation-items { overflow-y:auto; overflow-x:hidden; scrollbar-width:none; padding:6px 8px 8px 0; display:flex; flex-direction:column; gap:4px; }
.paper-navigation-item { flex:none; display:grid; justify-items:center; gap:2px; width:65px; padding:0; border:0; background:none; color:inherit; font:12px/13px var(--font-display,Georgia,serif); cursor:pointer; }
/* wave B chrome: drawn nav-seal-vertical ribbon (96x128, slices:0) hangs
   behind the nav glyph - replaces the hand 45deg diamond. The art is a
   tall banner; it is rendered small (28x37) inside the 65px item cell. */
.paper-navigation-icon { position:relative; display:grid; place-items:center; width:28px; height:37px; }
.paper-navigation-icon__seal { position:absolute; inset:0; width:100%; height:100%; }
.paper-navigation-icon__glyph { position:relative; z-index:1; width:15px; height:15px; filter:invert(94%) sepia(24%) saturate(325%); }
.active .paper-navigation-icon__seal { filter:drop-shadow(0 0 8px #e9c36c) brightness(1.35); }
button:hover { color:#362407; }button:focus-visible { outline:2px solid #386b59; outline-offset:3px; }
.is-locked { opacity:.45; cursor:default; }
</style>
