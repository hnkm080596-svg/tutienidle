<script setup lang="ts">
// Scene 17 (Cai Dat / settings) paper surface: the approved fidelity
// composition - seal nav | settings workspace - now owning the shared
// paper chrome (nine-slice sheet + nav rail + title) exactly like the
// other migrated tabs. The fixture layout stays as the #workspace slot
// fallback for the preview; production mounts the real SettingsPanel
// (its own nav rail + sections) through that slot.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import SettingsFidelitySection, { type SettingsDisplayControl } from './SettingsFidelitySection.vue'

withDefaults(defineProps<{
  groups: readonly {id: string; label: string; controls: readonly SettingsDisplayControl[]}[]
  active: string
  notice: string
  preview?: boolean
}>(), { preview: false })

const emit = defineEmits<{select: [id: string]; update: [id: string, value: string | number | boolean]; action: [id: string]; back: []}>()
const { t } = useI18n()

const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')

// Same dialog contract the imperial scroll carried: focus/pointer stay
// inside the open surface and Escape closes through emit('back').
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>

<template>
  <section ref="rootRef" class="settings-scene" :aria-label="t('layout.functionOverlay.titles.settings')" @click.self="emit('back')">
    <div class="settings-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <h1 class="settings-title">{{ t('layout.functionOverlay.titles.settings') }}</h1>

    <div class="settings-content">
      <slot name="workspace"><div class="settings-layout"><nav :aria-label="t('settingsPreview.title')"><button v-for="id in ['all','audio','display','storage','support']" :key="id" :class="{active:active===id}" @click="emit('select',id)">{{t(`settingsPreview.group.${id}`)}}</button></nav><div class="settings-workspace"><SettingsFidelitySection v-for="group in groups" :key="group.id" :title="group.label" :controls="group.controls" @update="(id,value)=>emit('update',id,value)"/><section v-if="active==='all'||active==='storage'" class="settings-actions"><h2>{{t('settingsPreview.storage')}}</h2><p>{{t('settingsPreview.storageHint')}}</p><div><button v-for="id in ['save','export','import']" :key="id" @click="emit('action',id)">{{t(`settingsPreview.${id}`)}}</button></div></section><section v-if="active==='support'" class="settings-actions"><h2>{{t('settingsPreview.support')}}</h2><p>{{t('settingsPreview.supportHint')}}</p><button @click="emit('action','feedback')">{{t('settingsPreview.feedback')}}</button><p>{{t('settingsPreview.build')}} · {{t('settingsPreview.buildValue')}}</p></section></div></div></slot>
    </div>

    <p v-if="preview" class="settings-preview">{{ t('preview') }}</p>
    <p class="settings-notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.settings-scene{position:absolute;inset:0;pointer-events:auto;color:#4b3924;font-family:var(--font-display,Georgia,serif)}
.settings-scene :deep(*){box-sizing:border-box}
.settings-paper{position:absolute;left:94px;top:123px;width:1334px;height:633px;border:0 solid transparent;border-image-slice:300 fill;border-image-width:83px;filter:drop-shadow(0 12px 15px #0009)}
.settings-title{position:absolute;left:235px;top:165px;margin:0;font-size:32px;font-weight:700;color:#35250f;text-shadow:0 1px #fff7}
/* Interior region: clears the nav-rail column on the left and the
   paper's decorative frame all around (same rect the preview surface
   exposes). */
.settings-content{position:absolute;left:234px;top:227px;width:1143px;height:465px;display:flex;flex-direction:column}
.settings-layout { flex:1; min-height:0; display:grid; grid-template-columns:177px 1fr; gap:28px; }
.settings-layout nav { display:flex; flex-direction:column; gap:13px; border-right:1px solid #a88b4e66; padding-right:19px; }
.settings-layout nav button { padding:12px 10px; border:1px solid #a88b4e; background:linear-gradient(#2b402e,#14281b); color:#e4d0a1; font:16px var(--font-display,Georgia,serif); cursor:pointer; border-radius:3px; }
.settings-layout nav button.active { background:linear-gradient(#edd39a,#b7924e); color:#3c290d; box-shadow:0 0 8px #a0803344; font-weight:700; }
.settings-workspace { display:flex; flex-direction:column; gap:25px; overflow:auto; scrollbar-width:thin; padding-right:5px; }
.settings-actions h2 { margin:0 0 10px; padding-bottom:8px; border-bottom:1px solid #a88b4e66; font-size:18px; }
.settings-actions p { margin:8px 0 13px; font-size:13px; color:#76603b; }
.settings-actions div { display:flex; gap:15px; }
.settings-actions button { padding:9px 22px; border:1px solid #a88b4e; border-radius:3px; background:#263e2b; color:#f3dba3; font:14px var(--font-display,Georgia,serif); cursor:pointer; }
.settings-scene button:focus-visible { outline:2px solid #517858; outline-offset:3px; }
.settings-preview{position:absolute;left:235px;top:713px;margin:0;font-size:10px;line-height:15px;color:#7d6a45}
.settings-notice{position:absolute;left:700px;top:710px;width:675px;height:28px;margin:0;text-align:right;font-size:12px;color:#62512d}
</style>
