<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
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

const paper = {
  backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')`,
}
const divider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')
const bodyArt = (name: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/body/${name}-v1.png`)

// Preview nav art ids (ren/khai/dan) keyed by the ui chapter id.
const NAV_ART: Record<string, string> = { refinement: 'ren', meridian: 'khai', cycle: 'dan' }
const navArt = (id: string, lit: boolean) =>
  bodyArt(`navigation-${NAV_ART[id] ?? 'ren'}-${lit ? 'lit' : 'unlit'}`)

const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="body-scene body-paper-scene" :aria-label="t('body.title')" @click.self="emit('back')">
    <div class="body-panel" :style="paper">
      <!-- The global pack still sizes .body-heading/h1 to the old 370px
           title box (absolute-era design); this layout wants a full-width
           in-flow heading, so the two width overrides stay inline. -->
      <header class="body-heading" style="width:auto"><div class="body-heading__top"><div class="body-heading__col"><h1 style="width:auto;text-align:left">{{ t('body.title') }}</h1><img :src="divider" alt=""></div></div><p class="body-subtitle">{{ model.identity }}</p></header>
      <div class="body-layout">
        <nav class="body-family body-chapters" :aria-label="t('body.chapters')">
          <img class="family-spine" :src="bodyArt('meridian-tube-lit')" alt="">
          <EquipmentArtButton
            v-for="chapter in model.chapters"
            :key="chapter.id"
            class="family-pill"
            :class="{ 'is-locked': !chapter.unlocked }"
            :gold="model.chapter === chapter.id"
            :aria-pressed="model.chapter === chapter.id"
            @click="emit('chapter', chapter.id)"
          >
            <img class="family-icon" :src="navArt(chapter.id, model.chapter === chapter.id)" alt="">
            <span class="family-text">{{ chapter.label }}</span>
          </EquipmentArtButton>
        </nav>
        <BodyPaperFigure :model="model" :selected="unit?.id ?? ''" @select="emit('select', $event)" />
        <BodyPaperDetails :model="model" :unit="unit" :notice="notice" @invest="emit('invest')" />
      </div>
    </div>
    <p v-if="preview" class="body-preview-label">{{ t('body.preview') }}</p>
  </section>
</template>
<style scoped>
.body-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#3b2f1d; line-height:1.3; }
.body-scene :deep(*) { box-sizing:border-box; }
/* Paper page geometry = HomeBodyArtPanel preview source verbatim
   (left:24% top:12.5% w74% h75% = 345,101,1065x608 at 1440x810 - same
   sheet rect as skill/equipment scenes; owner ruling 2026-10-09:
   backdrop was oversized/off-center). */
.body-panel { position:absolute; left:24%; top:12.5%; width:74%; height:75%; padding:14px 26px 12px; border:3px double #b28a43; background-color:#f2e4c8; background-position:center; background-size:cover; background-repeat:no-repeat; box-shadow:0 12px 15px #0009; overflow:hidden; }
.body-heading { border-bottom:1px solid #b28a43; }
/* h1 = same treatment as equipment/skill titles (owner ruling 2026-10-09:
   "giống các panel trên") — 56px UTM OngDoGia dark-gold gradient inside
   the 58px box; overrides the shared tien-hiep-ui 72px rule. */
.body-heading__top { height:58px; display:flex; align-items:center; gap:24px; } .body-heading__col{display:flex;flex-direction:column}.body-heading__top .body-heading__col img{width:200px;margin-top:0;height:auto;object-fit:contain;opacity:.75}
:is(#app,body) .body-scene .body-heading h1 { margin:0; padding:0; width:370px; height:58px; font-family:'UTM OngDoGia','Ma Shan Zheng','ZCOOL XiaoWei',var(--font-display,Georgia,serif); font-size:56px; font-style:normal; font-weight:400; line-height:58px; text-align:center; color:transparent; background:linear-gradient(100deg,#241a0c 20%,#6b5224 40%,#fff6d8 50%,#6b5224 60%,#241a0c 80%); background-size:220% 100%; background-position:0% 0; -webkit-background-clip:text; background-clip:text; animation:none; }
.body-heading img { width:170px; height:21px; object-fit:contain; opacity:.65; }
.body-subtitle { margin:2px 0 4px; font-size:13px; color:#715627; }
.body-layout { height:calc(100% - 106px); display:grid; grid-template-columns:20% 50% 30%; gap:8px; min-height:0; }
.body-family { position:relative; display:flex; flex-direction:column; justify-content:space-evenly; padding:4px 4px 4px 20px; isolation:isolate; }
.family-spine { position:absolute; left:6px; top:50%; width:280px; height:13px; object-fit:fill; transform:translate(-50%,-50%) rotate(90deg); z-index:-1; }
.family-pill { height:60px; padding-left:42px; font-size:15px; white-space:nowrap; text-align:left; }
.family-icon { position:absolute; left:2px; top:50%; transform:translateY(-50%); width:46px; height:46px; object-fit:contain; }
.family-text small { display:block; margin-top:4px; font-size:10px; font-weight:400; }
.family-pill.is-locked { opacity:.55; }
.family-pill:focus-visible { outline:2px solid #315d48; outline-offset:3px; }
.body-preview-label { position:absolute; left:231px; top:718px; margin:0; color:#806b43; font-size:10px; }
</style>
