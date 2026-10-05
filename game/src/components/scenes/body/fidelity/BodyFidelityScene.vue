<script setup lang="ts">
import { ref } from 'vue'
import '@/assets/tien-hiep-progression.css'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
import BodyPaperFigure from './BodyPaperFigure.vue'
import BodyPaperDetails from './BodyPaperDetails.vue'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'
withDefaults(defineProps<{
  model: BodyPaperModel
  unit: BodyPaperUnit | null
  navigation: readonly PaperNavigationItem[]
  notice: string
  preview?: boolean
}>(), { preview: false })
const emit = defineEmits<{ navigate:[id:string]; back:[]; chapter:[id:string]; select:[id:string]; invest:[] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="progression-scene pc-progression pc-progression--body body-paper-scene" :aria-label="t('body.title')" @click.self="emit('back')">
    <PcPaperScene :title="t('body.title')" :subtitle="model.identity">
      <template #tabs><div class="pc-paper-tabs body-chapters" role="group" :aria-label="t('body.chapters')"><button v-for="chapter in model.chapters" :key="chapter.id" :class="{'is-locked':!chapter.unlocked}" :aria-pressed="model.chapter === chapter.id" @click="emit('chapter',chapter.id)">{{ chapter.label }}<small>{{ chapter.hint }}</small></button></div></template>
      <div class="progression-workspace body-workspace"><Transition name="body-page" mode="out-in"><BodyPaperFigure :key="model.chapter" :model="model" :selected="unit?.id ?? ''" @select="emit('select',$event)" /></Transition><BodyPaperDetails :model="model" :unit="unit" :notice="notice" @invest="emit('invest')" /></div>
      <template #footer><p v-if="preview" class="progression-preview-label">{{ t('body.preview') }}</p></template>
      <template #actions><PcPaperSceneActions :items="navigation" active="body" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
    </PcPaperScene>
  </section>
</template>
