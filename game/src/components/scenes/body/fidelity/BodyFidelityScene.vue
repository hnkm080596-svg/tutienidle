<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import BodyPaperFigure from './BodyPaperFigure.vue'
import BodyPaperDetails from './BodyPaperDetails.vue'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'
withDefaults(defineProps<{
  model: BodyPaperModel
  unit: BodyPaperUnit | null
  notice: string
  preview?: boolean
}>(), { preview: false })
const emit = defineEmits<{ back:[]; chapter:[id:string]; select:[id:string]; invest:[] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const bodyIcon = resolveAssetUrl('/assets/ui/huyen-kim/symbols/body.svg')

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="body-paper-scene" :aria-label="t('body.title')" @click.self="emit('back')">
    <div class="body-paper" :style="{borderImageSource:`url('${paper}')`}" aria-hidden="true" />
    <header class="body-heading"><h1>{{ t('body.title') }}</h1><p>{{ model.identity }}</p></header>
    <div class="body-chapters" role="group" :aria-label="t('body.chapters')">
      <button v-for="chapter in model.chapters" :key="chapter.id" :class="{active:model.chapter === chapter.id, 'is-locked':!chapter.unlocked}" :aria-pressed="model.chapter === chapter.id" @click="emit('chapter',chapter.id)"><img :src="bodyIcon" alt=""><span>{{ chapter.label }}<small>{{ chapter.hint }}</small></span></button>
    </div>
    <Transition name="body-page" mode="out-in">
      <BodyPaperFigure :key="model.chapter" :model="model" :selected="unit?.id ?? ''" @select="emit('select',$event)" />
    </Transition>
    <BodyPaperDetails :model="model" :unit="unit" :notice="notice" @invest="emit('invest')" />
    <p v-if="preview" class="body-preview-label">{{ t('body.preview') }}</p>
  </section>
</template>
<style scoped>
.body-paper-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#3b2f1d; line-height:1.3; }.body-paper-scene :deep(*) { box-sizing:border-box; }.body-paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; border-image-repeat:stretch; filter:drop-shadow(0 12px 15px #0009); }.body-heading { position:absolute; left:231px; top:177px; max-width:250px; }.body-heading h1 { margin:0 0 9px; font-size:34px; font-weight:500; font-style:italic; }.body-heading p { margin:0; font-size:15px; color:#8a713c; }.body-chapters { position:absolute; left:229px; top:270px; width:168px; display:grid; gap:24px; }.body-chapters button { display:flex; align-items:center; gap:11px; padding:14px 8px; border:1px solid #ac8e4866; border-radius:6px; background:#e6d6ab44; color:#775d32; text-align:left; font:18px var(--font-display,Georgia,serif); cursor:pointer; }.body-chapters img { width:32px; height:32px; }.body-chapters small { display:block; margin-top:7px; font-size:11px; }.body-chapters .active { background:#d2d7b588; border-color:#447b5c; color:#305a43; }.body-chapters .is-locked { opacity:.55; }.body-chapters button:focus-visible { outline:2px solid #315d48; outline-offset:3px; }.body-preview-label { position:absolute; left:231px; top:718px; margin:0; color:#806b43; font-size:10px; }
.body-page-enter-active,.body-page-leave-active { transition:transform .24s ease,opacity .24s ease; transform-origin:left center; backface-visibility:hidden; pointer-events:none; }
.body-page-enter-from { transform:perspective(1400px) rotateY(35deg); opacity:0; }
.body-page-leave-to { transform:perspective(1400px) rotateY(-45deg); opacity:0; }
@media (prefers-reduced-motion:reduce) { .body-page-enter-active,.body-page-leave-active { transition:none; }.body-page-enter-from,.body-page-leave-to { transform:none; } }
</style>
