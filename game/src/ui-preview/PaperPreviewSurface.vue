<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PaperPanelNavigation from '@/components/common/PaperPanelNavigation.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import { previewPaperNavigation } from './paperNavigation'
import { previewRoutes } from './previewRoutes'
defineProps<{ title:string; active:string; notice:string }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const pointer = shallowRef({x:0,y:0})
const navigation = computed(()=>previewPaperNavigation(t))
function navigate(id:string) { const route=previewRoutes[id]; if(route)window.location.assign(route) }
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
function move(event:PointerEvent) { const r=(event.currentTarget as HTMLElement).getBoundingClientRect(); pointer.value={x:Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),y:Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1))} }
</script>
<template><SceneDesignCanvas><div class="paper-preview-host" :style="{'--df-x':pointer.x,'--df-y':pointer.y}" @pointermove="move" @pointerleave="pointer={x:0,y:0}"><DongFuVista/><section class="paper-preview-panel" :aria-label="title"><div class="paper-surface" :style="{borderImageSource:`url('${paper}')`}" aria-hidden="true"/><PaperPanelNavigation :items="navigation" :active="active" :label="t('navigation')" :back-label="t('home')" @select="navigate" @back="back"/><h1>{{ title }}</h1><button class="paper-close" :aria-label="t('close')" @click="back">×</button><div class="paper-content"><slot/></div><p class="paper-preview-note">{{ t('preview') }}</p><p class="paper-notice" role="status">{{ notice }}</p></section></div></SceneDesignCanvas></template>
<style scoped>
.paper-preview-host { position:relative; width:100%; height:100%; }.paper-preview-panel { position:absolute; inset:0; color:#352914; font-family:var(--font-display,Georgia,serif); }.paper-preview-panel :deep(*) { box-sizing:border-box; }.paper-surface { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; filter:drop-shadow(0 12px 15px #0009); }.paper-preview-panel h1 { position:absolute; left:235px; top:165px; margin:0; font-size:32px; font-weight:700; }.paper-content { position:absolute; left:234px; top:227px; width:1143px; height:465px; }.paper-close { position:absolute; left:1340px; top:163px; width:35px; height:35px; border:1px solid #a18244; border-radius:50%; background:#173023; color:#eed59c; font:26px Georgia,serif; cursor:pointer; }.paper-preview-note { position:absolute; left:234px; top:713px; margin:0; font-size:10px; color:#7d6a45; }.paper-notice { position:absolute; left:600px; top:706px; width:770px; height:33px; text-align:right; margin:0; font-size:12px; color:#584524; }.paper-close:focus-visible { outline:2px solid #47765f; outline-offset:3px; }
</style>
