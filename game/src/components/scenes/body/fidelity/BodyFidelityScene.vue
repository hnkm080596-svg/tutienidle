<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { provide, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import GameTabButton from '@/components/common/GameTabButton.vue'
import BodyPaperFigure from './BodyPaperFigure.vue'
import BodyPaperDetails from './BodyPaperDetails.vue'
import { BODY_POUR_VISUAL, type BodyPaperModel, type BodyPaperPour, type BodyPaperUnit } from './bodyUi'

withDefaults(defineProps<{
  model: BodyPaperModel
  unit: BodyPaperUnit | null
  notice: string
  pour?: BodyPaperPour | null
  preview?: boolean
}>(), { preview: false, pour: null })
const emit = defineEmits<{ back:[]; chapter:[id:string]; select:[id:string]; invest:[] }>()
const { t } = useI18n()

// Shared pour-visual channel between the details card (writer, owns the
// rAF) and the figure (reader, reveals tiers riding the fill edge).
provide(BODY_POUR_VISUAL, reactive({ spec: null, progressAbs: 0 }))

const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="rail-panel-scene body-scene body-paper-scene" :aria-label="t('body.title')" @click.self="emit('back')">
    <GamePanel :title="t('body.title')">
    <div class="body-panel">
      <!-- The global pack still sizes .body-heading/h1 to the old 370px
           title box (absolute-era design); this layout wants a full-width
           in-flow heading, so the two width overrides stay inline. -->
      
      <div class="body-layout">
        <nav class="body-family body-chapters" :aria-label="t('body.chapters')">
          <GameTabButton
            v-for="chapter in model.chapters"
            :key="chapter.id"
            class="family-pill"
            :class="{ 'is-locked': !chapter.unlocked }"
            :selected="model.chapter === chapter.id"
            @click="emit('chapter', chapter.id)"
          >
            <span class="family-text">{{ chapter.label }}</span>
          </GameTabButton>
        </nav>
        <BodyPaperFigure :model="model" :selected="unit?.id ?? ''" @select="emit('select', $event)" />
        <BodyPaperDetails :model="model" :unit="unit" :notice="notice" :pour="pour" @invest="emit('invest')" />
      </div>
    </div>
    <p v-if="preview" class="body-preview-label">{{ t('body.preview') }}</p>
    </GamePanel>
  </section>
</template>
<style scoped>
.body-scene { position:absolute; inset:0;  font-family:var(--font-display,Georgia,serif); color:#3b2f1d; line-height:1.3; }
.body-scene :deep(*) { box-sizing:border-box; }
/* Paper page geometry = HomeBodyArtPanel preview source verbatim
   (left:24% top:12.5% w74% h75% = 345,101,1065x608 at 1440x810 - same
   sheet rect as skill/equipment scenes; owner ruling 2026-10-09:
   backdrop was oversized/off-center). */
.body-panel { position:absolute; left:24%; top:12.5%; width:74%; height:75%; padding:14px 26px 12px; border:3px double #b28a43; background-color:#f2e4c8; background-position:center; background-size:cover; background-repeat:no-repeat; box-shadow:0 12px 15px #0009; overflow:hidden; }
.body-heading { border-bottom:1px solid #b28a43; }
/* h1 = same treatment as equipment/skill titles (owner ruling 2026-10-09:
   "giong cac panel tren") - 56px UTM OngDoGia dark-gold gradient inside
   the 58px box; overrides the shared tien-hiep-ui 72px rule. */
.body-heading__top { height:58px; display:flex; align-items:center; gap:24px; } .body-heading__col{display:flex;flex-direction:column}.body-heading__top .body-heading__col img{width:200px;margin-top:0;height:auto;object-fit:contain;opacity:.75}
:is(#app,body) .body-scene .body-heading h1 { margin:0; padding:0; width:370px; height:58px; font-family:'UTM OngDoGia','Ma Shan Zheng','ZCOOL XiaoWei',var(--font-display,Georgia,serif); font-size:56px; font-style:normal; font-weight:400; line-height:58px; text-align:center; color:transparent; background:linear-gradient(100deg,#241a0c 20%,#6b5224 40%,#fff6d8 50%,#6b5224 60%,#241a0c 80%); background-size:220% 100%; background-position:0% 0; -webkit-background-clip:text; background-clip:text; animation:none; }
.body-heading img { width:170px; height:21px; object-fit:contain; opacity:.65; }
.body-subtitle { margin:2px 0 4px; font-size:13px; color:#715627; }
.body-layout { height:calc(100% - 106px); display:grid; grid-template-columns:20% 50% 30%; gap:8px; min-height:0; }
.body-family { position:relative; display:flex; flex-direction:column; justify-content:flex-start; gap:6px; padding:6px 4px 4px 20px; isolation:isolate; }
.family-pill { width:100%; }
/* Medallion hangs off the capsule's left tip like the Codex preview
   (owner 2026-10-09: icon inside the pill + text starting inside its
   ring read as "two buttons stacked"). Negative left = protrude. */
.family-icon { position:absolute; left:-14px; top:50%; transform:translateY(-50%); width:43px; height:43px; object-fit:contain; }
.family-text small { display:block; margin-top:4px; font-size:10px; font-weight:400; }
.family-pill.is-locked { opacity:.55; }
.family-pill:focus-visible { outline:2px solid #315d48; outline-offset:3px; }
.body-preview-label { position:absolute; left:231px; top:718px; margin:0; color:#806b43; font-size:10px; }

/* Layout instances are relative to the owning panel content. */
.body-scene :deep(.game-panel__content .body-panel) { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; background: transparent; border: 0; box-shadow: none; }
.body-scene :deep(.game-panel__content .body-heading) { display: none; }
.body-scene :deep(.game-panel__content .body-layout) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; margin: 0; }
.body-scene :deep(.game-panel__content .body-layout) { grid-template-columns: 19% minmax(0,1fr) 29%; }
.body-scene :deep(.game-panel__content .body-stage) { transform: none; }
</style>
