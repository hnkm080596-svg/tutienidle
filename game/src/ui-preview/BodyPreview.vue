<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import BodyFidelityScene from '@/components/scenes/body/fidelity/BodyFidelityScene.vue'
import type { BodyPaperModel } from '@/components/scenes/body/fidelity/bodyUi'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
type Chapter = 'refinement' | 'meridian' | 'cycle'
const chapter = shallowRef<Chapter>('refinement')
const selection = shallowRef('1')
const notice = shallowRef('')
const pointer = shallowRef({x:0,y:0})
const navigation = computed(() => previewPaperNavigation(t))
const model = computed<BodyPaperModel>(() => {
  const count = chapter.value === 'refinement' ? 6 : chapter.value === 'meridian' ? 9 : 1
  const key = chapter.value === 'refinement' ? 'tier' : chapter.value === 'meridian' ? 'vessel' : 'milestone'
  const label = t(`chapter.${chapter.value}`)
  return {
    chapter: chapter.value,
    chapterLabel: label,
    identity: t(`chapterHint.${chapter.value}`),
    chapters: (['refinement','meridian','cycle'] as const).map(id => ({ id, label: t(`chapter.${id}`), hint: t(`chapterHint.${id}`), unlocked: true })),
    milestones: chapter.value === 'cycle' ? [{ id: 'm1', label: 'Tiểu Chu Thiên', done: true }, { id: 'm2', label: 'Đại Chu Thiên', done: false }] : [],
    extra: null,
    progress: 32,
    progressLabel: '320 / 1.000',
    units: Array.from({length:count},(_,i) => ({
      id:String(i+1),
      label:t(key,{n:i+1}),
      title:t('unitTitle',{chapter:label,unit:t(key,{n:i+1})}),
      description:t('description'),
      state:i === 0 ? 'current' : 'locked' as const,
      rows:[{label:t('hp'),value:'+320'},{label:t('might'),value:'+24'},{label:t('defense'),value:'+16'}],
      costs:[{id:'c1',name:t(`resource.${chapter.value}`),amountLabel:'12 / 20',met:i === 0}],
      gates:i === 0 ? [] : [t('lockedHint')],
      progressLabel:i === 0 ? '320 / 1.000' : undefined,
      actionLabel:t('invest'),
      actionDisabled:i !== 0,
    })),
  }
})
const unit = computed(() => model.value.units.find(entry => entry.id === selection.value) ?? model.value.units[0] ?? null)
function chooseChapter(id:string) { if(id === 'refinement' || id === 'meridian' || id === 'cycle') {chapter.value=id;selection.value='1';notice.value=''} }
function navigate(id: string) {
  if (id === 'inventory') { window.location.assign('/ui-inventory.html'); return }
  const routes:Record<string,string>={character:'/ui-character.html',realm:'/ui-realm.html',skill:'/ui-skill.html',technique:'/ui-technique.html',exploration:'/ui-exploration.html',alchemy:'/ui-alchemy.html',equipment:'/ui-equipment.html'}; const route=routes[id]; if(route) window.location.assign(route); else if(id !== 'body') notice.value=t('navNotice',{name:t(`nav.${id}`)})
}
function back() { window.location.assign('/ui-dong-fu.html') }
function move(event:PointerEvent) { const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(); pointer.value={x:Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1)),y:Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1))} }
</script>
<template><SceneDesignCanvas><div class="body-preview" :style="{'--df-x':pointer.x,'--df-y':pointer.y}" @pointermove="move" @pointerleave="pointer={x:0,y:0}"><DongFuVista /><BodyFidelityScene :model="model" :unit="unit" :navigation="navigation" :notice="notice" preview @chapter="chooseChapter" @select="selection=$event" @navigate="navigate" @back="back" @invest="notice=t('notice')" /></div></SceneDesignCanvas></template>
<style scoped>.body-preview {position:relative;width:100%;height:100%;}</style>
