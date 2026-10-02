<script setup lang="ts">
// Spec SS12 Thien Co Bang (scene 03, canonical layer L8): right-side
// opportunity surface answering "what is worth doing right now". Pure
// navigation chrome - entries come from useThienCoEntries (read-only
// derivations), each CTA opens an existing surface. Collapsed chip by
// default; expanding opens the right-edge drawer.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThienCoEntries } from '@/composables/useThienCoEntries'
import DongFuThienCoChip from './DongFuThienCoChip.vue'
import DongFuThienCoDrawer from './DongFuThienCoDrawer.vue'

const { t } = useI18n()
const { entries } = useThienCoEntries()

const open = ref(false)
</script>

<template>
  <aside
    class="thien-co-rail"
    :class="{ 'is-open': open }"
    role="complementary"
    :aria-label="t('home.thienCo.aria')"
    data-canonical-layer="L8"
  >
    <DongFuThienCoChip
      :open="open"
      :count="entries.length"
      @toggle="open = !open"
    />

    <DongFuThienCoDrawer
      v-if="open"
      :entries="entries"
      @collapse="open = false"
    />
  </aside>
</template>

<style scoped>
/* Spec thien-co-collapsed 1388/856/268/52: right 16, bottom 33
   design px on the 1672x941 canvas. */
.thien-co-rail {
  position: absolute;
  right: 0.96vw;
  bottom: 3.51vh;
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--hk-space-3, 8px);
  pointer-events: none;
}

.thien-co-rail > * {
  pointer-events: auto;
}
</style>
