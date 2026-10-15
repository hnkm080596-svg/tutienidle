<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import RealmTimeline from './RealmTimeline.vue'
import RealmFocusCard from './RealmFocusCard.vue'
import type { RealmUiModel } from './realmUi'
withDefaults(defineProps<{ model: RealmUiModel; selected: number; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ selectFloor: [floor: number]; back: []; advance: []; breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')

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
/* Shared paper chrome - same sheet box + backdrop the other ported panels
   use (inventory-sheet convention): x345 y101 w1065 h608. */
.realm-sheet { position:absolute; left:345px; top:101px; width:1065px; height:608px; background-color:#f2e4c8; background-size:cover; background-position:center; background-repeat:no-repeat; border:3px double #b28a43; }
.realm-head { position:absolute; left:372px; top:123px; width:1011px; height:61px; display:flex; align-items:flex-start; justify-content:flex-start; padding-left:54px; background:linear-gradient(#b28a43,#b28a43) left bottom/64px 1px no-repeat,linear-gradient(#b28a43,#b28a43) right bottom/calc(100% - 448px) 1px no-repeat; }
.realm-head__title { display:flex; flex-direction:column; align-items:center; }
:is(#app,body) .realm-head h1 { margin:0; padding:0; font-family:'UTM OngDoGia','Ma Shan Zheng','ZCOOL XiaoWei',var(--font-display,Georgia,serif); font-size:56px; font-style:normal; font-weight:400; line-height:58px; color:transparent; background:linear-gradient(100deg,#241a0c 20%,#6b5224 40%,#fff6d8 50%,#6b5224 60%,#241a0c 80%); background-size:220% 100%; background-position:0% 0; -webkit-background-clip:text; background-clip:text; animation:none; }
.realm-divider { width:300px; object-fit:contain; opacity:.9; position:relative; top:-39px; pointer-events:none; }
.realm-subtitle { position:absolute; right:0; top:50%; transform:translateY(-50%); margin:0; color:#88703e; font-size:15px; line-height:1.35; width:180px; text-align:right; }
.realm-preview-label { position:absolute; left:372px; top:706px; font-size:10px; color:#7d6c48; }
.realm-timeline { position:absolute; left:372px; top:192px; width:1011px; height:378px; isolation:isolate; overflow:clip; }
.realm-earned { position:absolute; left:372px; top:574px; width:1011px; height:120px; border-top:1px solid #a98a4b; padding-top:6px; }
.realm-earned h3 { margin:0 0 5px; font-size:16px; font-weight:500; }
.realm-earned ul { margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(4,1fr); gap:3px 18px; max-height:84px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#7f714c transparent; }
.realm-earned li { display:flex; align-items:baseline; gap:8px; font-size:13px; }
.realm-earned li strong { font-weight:500; white-space:nowrap; }
.realm-earned li small { color:#6b5f42; }
.realm-earned-empty { margin:6px 0 0; font-size:13px; color:#7a6a4d; font-style:italic; }

/* Layout instances are relative to the owning panel content. */
.realm-paper-scene :deep(.game-panel__content :is(.realm-sheet,.realm-head)) { display: none; }
.realm-paper-scene :deep(.game-panel__content .realm-timeline) { left: 0; top: 0; width: 100%; height: calc(100% - 124px); }
.realm-paper-scene :deep(.game-panel__content .realm-earned) { left: 0; top: auto; bottom: 0; width: 100%; height: 112px; }
</style>
