<script setup lang="ts">
// Settings nav rail: tien-hiep medallion buttons (QuestCategoryArtButton
// skin) in place of the old seal rows. The .settings-panel__nav +
// [data-section] + .is-active contract stays pinned for tests/e2e.
import QuestCategoryArtButton from '@/components/common/QuestCategoryArtButton.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

defineProps<{
  sections: Array<{ id: string; label: string }>
  activeId: string
  label: string
}>()

// Per-section nav icon (navigation-*-v2 set) - nearest icon per section;
// display/audio/update/support have no dedicated glyph yet so they ride
// the closest available one (provisional map, matches the old symbol map).
const SECTION_ICON: Record<string, string> = {
  general: 'settings',
  display: 'realm',
  audio: 'feedback',
  account: 'character',
  update: 'production',
  support: 'guild',
}
const iconFor = (id: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/icons/navigation-${SECTION_ICON[id] ?? 'settings'}-v2.png`)

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="settings-panel__nav" :aria-label="label" data-hk-region="nav-rail">
    <QuestCategoryArtButton
      v-for="section in sections"
      :key="section.id"
      class="settings-panel__nav-seal"
      :class="{ 'is-active': activeId === section.id }"
      :data-section="section.id"
      :icon="iconFor(section.id)"
      :label="section.label"
      hint=""
      :selected="activeId === section.id"
      @click="emit('select', section.id)"
    />
  </nav>
</template>

<style scoped>
.settings-panel__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}
.settings-panel__nav::-webkit-scrollbar { display: none; }

.settings-panel__nav-seal:focus-visible { outline: 2px solid var(--hk-gold, var(--gold-700)); outline-offset: 2px; }
</style>
