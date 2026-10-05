<script setup lang="ts">
import { ref } from 'vue'
import '@/assets/tien-hiep-progression.css'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperSceneActions from '@/components/common/PcPaperSceneActions.vue'
import RealmPaperMap from './RealmPaperMap.vue'
import RealmPaperDetails from './RealmPaperDetails.vue'
import type { RealmUiModel } from './realmUi'
withDefaults(defineProps<{ model: RealmUiModel; selected: number; notice: string; navigation: readonly PaperNavigationItem[]; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ selectFloor: [floor: number]; navigate: [id: string]; back: []; breakthrough: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" role="dialog" aria-modal="true" tabindex="-1" class="progression-scene pc-progression pc-progression--realm realm-paper-scene" :aria-label="t('panels.wheel.slots.realm')" @click.self="emit('back')">
    <PcPaperScene :title="t('panels.wheel.slots.realm')" :subtitle="t('realm.subtitle')">
      <div class="progression-workspace realm-workspace"><RealmPaperMap :current="model.currentFloor" :selected="selected" :max="model.maxFloor" @select="emit('selectFloor', $event)" /><RealmPaperDetails :model="model" :selected="selected" :notice="notice" @breakthrough="emit('breakthrough')" /></div>
      <template #footer><p v-if="preview" class="progression-preview-label">{{ t('preview') }}</p></template>
      <template #actions><PcPaperSceneActions :items="navigation" active="realm" @navigate="emit('navigate', $event)" @back="emit('back')" /></template>
    </PcPaperScene>
  </section>
</template>
