<script setup lang="ts">
// Scene 02 card medallion - the circular painted motif at each talent
// card's crown in the ref (moon/ember/beast vignette). TEMP ART: one
// placeholder disc per card; Minh paints per-talent variants.
import { computed } from 'vue'
import type { TalentRarity } from '@/core/talent/Talent'

const props = defineProps<{ rarity: TalentRarity }>()

// Rarity rim tint reads through the placeholder so the grid keeps its
// informational spread even before art lands.
const rimVar = computed(() => `var(--rank-color-${{ pham: 1, linh: 3, dia: 5, thien: 7, di: 8 }[props.rarity]}, var(--hk-gold-muted))`)
</script>

<template>
  <span
    class="talent-card-emblem art-needed"
    :class="`talent-card-emblem--${rarity}`"
    data-art-id="talent-card-emblem"
    :style="{ '--emblem-rim': rimVar }"
    aria-hidden="true"
  />
</template>

<style scoped>
.talent-card-emblem {
  display: block;
  width: clamp(26px, 3.4vh, 36px);
  aspect-ratio: 1;
  margin: 0 auto 2px;
  border-radius: 50%;
  background:
    /* crescent-moon motif echoing the ref's luminous card centres */
    radial-gradient(38% 38% at 62% 36%, rgba(237, 230, 214, 0.9) 30%, transparent 34%),
    radial-gradient(75% 75% at 50% 62%, #315f55 20%, #101718 78%);
  box-shadow:
    inset 0 0 0 1.5px var(--emblem-rim, var(--hk-gold-muted, #7a6234)),
    0 0 10px color-mix(in srgb, var(--emblem-rim, #7a6234) 45%, transparent),
    inset 0 -4px 8px rgba(5, 8, 9, 0.55);
}
</style>
