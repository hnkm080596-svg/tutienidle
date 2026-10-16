<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import RealmTimeline from './RealmTimeline.vue'
import RealmFocusCard from './RealmFocusCard.vue'
import type { RealmUiModel } from './realmUi'
const props = withDefaults(defineProps<{ model: RealmUiModel; selected: number; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ selectFloor: [floor: number]; back: []; advance: []; breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

const activePassive = computed(() => props.model.passives[props.model.passives.length - 1] ?? null)
const effectLines = computed(() => props.model.passives.flatMap((passive) => passive.effectLines))
</script>
<template>
  <section ref="rootRef" class="rail-panel-scene realm-paper-scene" :aria-label="t('panels.wheel.slots.realm')" @click.self="emit('back')">
    <GamePanel :title="t('panels.wheel.slots.realm')">
    
    
    <div class="realm-timeline">
      <RealmTimeline :current="model.currentFloor" :selected="selected" :max="model.maxFloor" @select="emit('selectFloor', $event)">
        <RealmFocusCard :key="selected" :model="model" :selected="selected" @advance="emit('advance')" @breakthrough="emit('breakthrough')" @quan-khi="emit('quanKhi')" />
      </RealmTimeline>
    </div>
    <section v-if="activePassive" class="realm-earned">
      <h3>{{ activePassive.name }}</h3>
      <div class="realm-earned-effects">
        <span v-for="line in effectLines" :key="line" class="realm-earned-effect">{{ line }}</span>
      </div>
    </section>
    <p v-if="preview" class="realm-preview-label">{{ t('preview') }}</p>
    </GamePanel>
  </section>
</template>
<style scoped>
.realm-paper-scene { position:absolute; inset:0;  font-family:var(--font-display,Georgia,serif); color:#392c1d; }.realm-paper-scene :deep(*) { box-sizing:border-box; }
.realm-preview-label { position:absolute; left:372px; top:706px; font-size:10px; color:#7d6c48; }
.realm-timeline { position:absolute; left:372px; top:192px; width:1011px; height:378px; isolation:isolate; overflow:clip; }
.realm-earned { position:absolute; left:372px; top:574px; width:1011px; height:120px; border-top:1px solid #a98a4b; padding:10px 16px; background:linear-gradient(180deg, rgba(244, 233, 208, 0.82), rgba(244, 233, 208, 0.92)); border-radius:4px; text-shadow:0 1px 0 rgba(255, 250, 238, 0.75); display:flex; flex-direction:column; gap:6px; }
.realm-earned h3 { margin:0; font-size:18px; font-weight:700; color:#2f2213; }
.realm-earned-effects { display:flex; flex-wrap:wrap; align-items:center; gap:6px 24px; font-size:14px; font-weight:500; color:#4f4128; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#7f714c transparent; }
.realm-earned-effect { white-space:nowrap; }

/* Layout instances are relative to the owning panel content. */
.realm-paper-scene :deep(.game-panel__content .realm-timeline) { left: 0; top: 0; width: 100%; height: calc(100% - 124px); }
.realm-paper-scene :deep(.game-panel__content .realm-earned) { left: 0; top: auto; bottom: 0; width: 100%; height: 112px; }
</style>
