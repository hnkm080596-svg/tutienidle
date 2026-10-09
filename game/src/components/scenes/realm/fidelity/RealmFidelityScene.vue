<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import RealmPaperMap from './RealmPaperMap.vue'
import RealmPaperDetails from './RealmPaperDetails.vue'
import type { RealmUiModel } from './realmUi'
withDefaults(defineProps<{ model: RealmUiModel; selected: number; notice: string; preview?: boolean }>(), { preview: false })
const emit = defineEmits<{ selectFloor: [floor: number]; back: []; breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="realm-paper-scene" :aria-label="t('panels.wheel.slots.realm')" @click.self="emit('back')">
    <div class="realm-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <h1>{{ t('realm.title') }}</h1>
    <img class="realm-divider" :src="titleDivider" alt=""><p class="realm-subtitle">{{ t('realm.subtitle') }}</p>
    <RealmPaperMap :current="model.currentFloor" :selected="selected" :max="model.maxFloor" @select="emit('selectFloor', $event)" />
    <RealmPaperDetails :model="model" :selected="selected" :notice="notice" @breakthrough="emit('breakthrough')" @quan-khi="emit('quanKhi')" />
    <p v-if="preview" class="realm-preview-label">{{ t('preview') }}</p>
  </section>
</template>
<style scoped>
.realm-paper-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#392c1d; }.realm-paper-scene :deep(*) { box-sizing:border-box; }
.realm-paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; border-image-repeat:stretch; filter:drop-shadow(0 12px 15px #0009); }
h1 { position:absolute; left:231px; top:166px; margin:0; width:280px; font-size:30px; font-style:italic; font-weight:500; line-height:1.25; }.realm-subtitle { position:absolute; left:233px; top:246px; width:156px; padding-top:13px; border-top:1px solid #a98a4b; color:#88703e; font-size:15px; line-height:1.7; } .realm-divider{position:absolute;left:233px;top:180px;width:230px;object-fit:contain;opacity:.9}.realm-preview-label { position:absolute; left:230px; top:706px; font-size:10px; color:#7d6c48; }
</style>
