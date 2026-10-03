<script setup lang="ts">
// Detail vista (ref: painted landscape banner across the top of the
// detail panel, cadence ribbon hanging over its left edge). No
// per-quest vista art exists in the model - temp ink scene + the
// cadence ribbon, both art-needed until Minh's quest art lands.
import { useI18n } from 'vue-i18n'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

defineProps<{ row: BetaQuestSurfaceModel }>()

const { t } = useI18n()
</script>

<template>
  <div class="quest-detail-vista">
    <span
      class="quest-detail-vista__art"
      art-needed
      data-art-id="quest-vista"
      aria-hidden="true"
    ><HuyenKimSymbol name="quest" class="quest-detail-vista__mark" /></span>
    <span
      class="quest-detail-vista__ribbon"
      art-needed
      data-art-id="quest-cadence-ribbon"
    >{{ t(`panels.quest.cadence.${row.cadence}`) }}</span>
  </div>
</template>

<style scoped>
.quest-detail-vista {
  position: relative;
  height: 168px;
  flex: 0 0 auto;
  border-radius: var(--hk-radius-sm, 6px);
  overflow: visible;
}

/* Temp ink valley: layered jade ridgelines + a gold halo - stands in
   for the painted quest landscape in the ref. */
.quest-detail-vista__art {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 40%, transparent);
  background:
    radial-gradient(ellipse at 78% 18%, color-mix(in srgb, var(--hk-gold-bright, #e3bd67) 55%, transparent) 0%, transparent 34%),
    linear-gradient(200deg, color-mix(in srgb, var(--hk-jade, #315f55) 58%, var(--ink-900, #101718)) 30%, var(--ink-900, #101718) 92%),
    var(--ink-900, #101718);
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--paper-text, #f2ead8) 30%, transparent);
  font-size: 42px;
}

.quest-detail-vista__mark {
  width: 52px;
  height: 52px;
}

/* Hanging ribbon tag like the ref's red cadence banner: vertical text,
   cinnabar token while the ribbon art is pending. */
.quest-detail-vista__ribbon {
  position: absolute;
  top: -6px;
  left: 14px;
  writing-mode: vertical-rl;
  padding: 10px 5px 14px;
  background: var(--cinnabar, #a8402f);
  color: var(--paper-text, #f7efdc);
  font: 700 var(--text-xs) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.14em;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
</style>
