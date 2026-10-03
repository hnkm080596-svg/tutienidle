<script setup lang="ts">
// One quest row inside the list: thumb tile (art-needed - no per-quest
// vista art exists), name + cadence chip + one-line description, and a
// right-side state read: green check when complete/claimed, progress
// n/m otherwise. list-row chrome per spec; selected = jade border +
// gold name like the ref's picked row.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  row: BetaQuestSurfaceModel
  selected?: boolean
  onSelect: () => void
}>()

const { t } = useI18n()

const rowSlice = computed(() => chromeSlice('list-row'))
const chipSlice = computed(() => chromeSlice('seal-chip'))

const complete = computed(
  () => props.row.claim.claimed || props.row.progress >= props.row.target,
)
const claimable = computed(() => props.row.claim.available && !props.row.claim.claimed)
</script>

<template>
  <button
    type="button"
    class="quest-row"
    :class="{ 'is-selected': selected, 'is-claimable': claimable, 'is-claimed': row.claim.claimed }"
    :aria-pressed="selected"
    @click="onSelect()"
  >
    <InkNineSlice
      chrome-id="list-row"
      layer="surface"
      class="quest-row__surface"
      :art-needed="!rowSlice || undefined"
      data-art-id="list-row"
    />

    <!-- Scenic thumb per row in the ref; per-quest art is unassigned, so
         a jade ink tile with the stable quest glyph stands in (the tile
         itself is still art-needed). -->
    <span
      class="quest-row__thumb"
      art-needed
      data-art-id="quest-row-thumb"
      aria-hidden="true"
    ><HuyenKimSymbol name="quest" class="quest-row__thumb-mark" /></span>

    <span class="quest-row__body">
      <span class="quest-row__topline">
        <span class="quest-row__name">{{ row.name }}</span>
        <span class="quest-row__cadence">
          <InkNineSlice
            chrome-id="seal-chip"
            layer="surface"
            class="quest-row__cadence-chrome"
            :art-needed="!chipSlice || undefined"
            data-art-id="seal-chip"
          />
          <span class="quest-row__cadence-text">{{ t(`panels.quest.cadence.${row.cadence}`) }}</span>
        </span>
        <span v-if="row.claim.claimed" class="quest-row__done">{{ t('panels.quest.scene.done') }}</span>
      </span>
      <span class="quest-row__desc">{{ row.description }}</span>
    </span>

    <span class="quest-row__state">
      <span v-if="complete" class="quest-row__check" aria-hidden="true">✓</span>
      <span v-else class="quest-row__progress">{{ Math.min(row.progress, row.target) }}/{{ row.target }}</span>
    </span>
  </button>
</template>

<style scoped>
.quest-row {
  position: relative;
  isolation: isolate;
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-md, 8px);
  background: transparent;
  color: var(--hk-text-secondary, var(--paper-text-soft));
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.quest-row > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.quest-row:hover { border-color: var(--hk-border-active, var(--paper-line)); }
.quest-row.is-selected {
  border-color: var(--hk-jade, #315f55);
  color: var(--hk-text-primary, var(--paper-text));
}
.quest-row.is-selected .quest-row__name { color: var(--hk-gold, #e3bd67); }
.quest-row.is-claimable .quest-row__check { color: var(--hk-gold, #e3bd67); }
.quest-row.is-claimed { opacity: 0.75; }

.quest-row__thumb {
  width: 58px;
  height: 44px;
  border-radius: var(--hk-radius-sm, 5px);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 45%, transparent);
  background:
    radial-gradient(ellipse at 30% 75%, color-mix(in srgb, var(--hk-jade, #315f55) 70%, transparent) 20%, transparent 65%),
    linear-gradient(160deg, color-mix(in srgb, var(--hk-jade, #315f55) 45%, var(--ink-900, #101718)), var(--ink-900, #101718));
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--hk-gold-bright, #e3bd67) 65%, transparent);
  font-size: 16px;
}

.quest-row__thumb-mark {
  width: 20px;
  height: 20px;
}

.quest-row__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.quest-row__topline {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.quest-row__name {
  font: 700 var(--text-sm) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quest-row__cadence {
  position: relative;
  isolation: isolate;
  flex: 0 0 auto;
  padding: 0 10px;
  /* The seal-chip slice's 14+14px border art is taller than this
     topline box (18px): the abs nine-slice renders ~28px and paints
     over the description line. Clip it to the slot. */
  overflow: hidden;
  border-radius: 7px;
}
.quest-row__cadence > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.quest-row__cadence-text {
  font-size: var(--text-xs, 10px);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--hk-gold, #e3bd67);
}

.quest-row__done {
  flex: 0 0 auto;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--hk-jade-soft, #8fb8a8);
}

.quest-row__desc {
  font-size: var(--text-xs);
  color: var(--hk-text-muted, #b8ad97);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quest-row__state { display: flex; align-items: center; }

.quest-row__check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--hk-jade, #315f55);
  color: var(--hk-jade-soft, #8fb8a8);
  font-weight: 700;
  font-size: var(--text-xs);
  background: color-mix(in srgb, var(--hk-jade, #315f55) 30%, transparent);
}

.quest-row__progress {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--hk-text-muted, #b8ad97);
}
</style>
