<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import RealmTimeline from './RealmTimeline.vue'
import RealmFocusCard from './RealmFocusCard.vue'
import type { RealmUiModel } from './realmUi'
withDefaults(defineProps<{ model: RealmUiModel; selected: number; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ selectFloor: [floor: number]; back: []; advance: []; breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="rail-panel-scene realm-paper-scene" :aria-label="t('panels.wheel.slots.realm')" @click.self="emit('back')">
    <GamePanel :title="t('panels.wheel.slots.realm')">
    
    
    <div class="realm-timeline">
      <RealmTimeline :current="model.currentFloor" :selected="selected" :max="model.maxFloor" @select="emit('selectFloor', $event)">
        <RealmFocusCard :key="selected" :model="model" :selected="selected" @advance="emit('advance')" @breakthrough="emit('breakthrough')" @quan-khi="emit('quanKhi')" />
      </RealmTimeline>
    </div>
    <section class="realm-earned">
      <h3>{{ t('panels.realm.sections.passives', { realm: model.name }) }}</h3>
      <ul v-if="model.passives.length">
        <li v-for="passive in model.passives" :key="passive.id" v-tooltip="{title:passive.name,description:passive.description}">
          <strong>{{ passive.name }}</strong><small v-for="line in passive.effectLines" :key="line">{{ line }}</small>
        </li>
      </ul>
      <p v-else class="realm-earned-empty">{{ t('realm.noPassives') }}</p>
    </section>
    <p v-if="preview" class="realm-preview-label">{{ t('preview') }}</p>
    </GamePanel>
  </section>
</template>
<style scoped>
.realm-paper-scene { position:absolute; inset:0;  font-family:var(--font-display,Georgia,serif); color:#392c1d; }.realm-paper-scene :deep(*) { box-sizing:border-box; }
.realm-preview-label { position:absolute; left:372px; top:706px; font-size:10px; color:#7d6c48; }
.realm-timeline { position:absolute; left:372px; top:192px; width:1011px; height:378px; isolation:isolate; overflow:clip; }
.realm-earned { position:absolute; left:372px; top:574px; width:1011px; height:120px; border-top:1px solid #a98a4b; padding:6px 10px 4px; background:linear-gradient(180deg, rgba(244, 233, 208, 0.82), rgba(244, 233, 208, 0.92)); border-radius:4px; text-shadow:0 1px 0 rgba(255, 250, 238, 0.75); }
.realm-earned h3 { margin:0 0 5px; font-size:16px; font-weight:600; color:#2f2213; }
.realm-earned ul { margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(4,1fr); gap:4px 18px; max-height:84px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#7f714c transparent; }
.realm-earned li { display:flex; align-items:baseline; gap:8px; font-size:13px; }
.realm-earned li strong { font-weight:600; color:#2b1f11; white-space:nowrap; }
.realm-earned li small { color:#4f4128; font-weight:500; }
.realm-earned-empty { margin:6px 0 0; font-size:13px; color:#5a4b32; font-style:italic; }

/* Layout instances are relative to the owning panel content. */
.realm-paper-scene :deep(.game-panel__content .realm-timeline) { left: 0; top: 0; width: 100%; height: calc(100% - 124px); }
.realm-paper-scene :deep(.game-panel__content .realm-earned) { left: 0; top: auto; bottom: 0; width: 100%; height: 112px; }
</style>
