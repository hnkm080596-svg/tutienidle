<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import BodyFidelityScene from '@/components/scenes/body/fidelity/BodyFidelityScene.vue'
import type { BodyPaperModel } from '@/components/scenes/body/fidelity/bodyUi'
const { t, tm } = useI18n()
type Chapter = 'refinement' | 'meridian' | 'cycle'
// ?locked renders the mortal-era state: the Bat Mach + Chu Thien seals
// stay shut (tabs refuse the flip, the meridian page shows only its
// unlock gate) and Luyen The lists just the tiers within reach.
const locked = new URLSearchParams(window.location.search).has('locked')
const LOCKED_CHAPTERS: ReadonlySet<Chapter> = locked ? new Set(['meridian', 'cycle']) : new Set()
const chapter = shallowRef<Chapter>('refinement')
const selection = shallowRef('1')
const notice = shallowRef('')
const pointer = shallowRef({x:0,y:0})
const model = computed<BodyPaperModel>(() => {
  const tierNames = tm('tierNames') as readonly string[]
  const vesselNames = tm('vesselNames') as readonly string[]
  const namesByChapter: Record<Chapter, readonly string[]> = {
    refinement: locked ? tierNames.slice(0, 2) : tierNames,
    meridian: locked ? [] : vesselNames,
    cycle: locked ? [] : [t('tieu')],
  }
  const names = namesByChapter[chapter.value]
  const lockHintByChapter: Record<Chapter, string | undefined> = {
    refinement: undefined,
    meridian: locked ? t('meridianGate') : undefined,
    cycle: locked ? t('cycleGate') : undefined,
  }
  const label = t(`chapter.${chapter.value}`)
  const lockHint = lockHintByChapter[chapter.value]
  return {
    chapter: chapter.value,
    chapterLabel: label,
    identity: t(`chapterHint.${chapter.value}`),
    chapters: (['refinement','meridian','cycle'] as const).map(id => ({ id, label: t(`chapter.${id}`), hint: t(`chapterHint.${id}`), unlocked: !LOCKED_CHAPTERS.has(id) })),
    milestones: chapter.value === 'cycle' && !locked ? [{ id: 'm1', label: 'Tiểu Chu Thiên', done: true }, { id: 'm2', label: 'Đại Chu Thiên', done: false }] : [],
    extra: null,
    lockHint,
    progress: 32,
    progressLabel: '320 / 1.000',
    units: names.map((name, i) => ({
      id:String(i+1),
      label:name,
      title:name,
      description:t('description'),
      state:i === 0 ? 'done' as const : i === 1 ? 'current' as const : 'locked' as const,
      rows:[{label:t('hp'),value:'+320'},{label:t('might'),value:'+24'},{label:t('defense'),value:'+16'}],
      costs:[{id:'c1',name:t(`resource.${chapter.value}`),amountLabel:'12 / 20',met:i <= 1}],
      gates:i > 1 ? [t('lockedHint')] : [],
      progressLabel:i === 1 ? '320 / 1.000' : undefined,
      actionLabel:t('invest'),
      actionDisabled:i !== 1,
    })),
  }
})
const unit = computed(() => model.value.units.find(entry => entry.id === selection.value) ?? model.value.units[0] ?? null)
function chooseChapter(id:string) { if((id === 'refinement' || id === 'meridian' || id === 'cycle') && !LOCKED_CHAPTERS.has(id)) {chapter.value=id;selection.value='1';notice.value=''} }
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
function move(event:PointerEvent) { const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(); pointer.value={x:Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1)),y:Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1))} }
</script>
<template><SceneDesignCanvas><div class="body-preview" :style="{'--df-x':pointer.x,'--df-y':pointer.y}" @pointermove="move" @pointerleave="pointer={x:0,y:0}"><DongFuVista /><BodyFidelityScene :model="model" :unit="unit" :notice="notice" preview @chapter="chooseChapter" @select="selection=$event" @back="back" @invest="notice=t('notice')" /></div></SceneDesignCanvas></template>
<style scoped>.body-preview {position:relative;width:100%;height:100%;}</style>
