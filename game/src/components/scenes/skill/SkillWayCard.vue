<script setup lang="ts">
// Scene 07 way-card region (spec: 288/176/212/610, shell-panel family,
// surface-m-panel). Ref: flaming way emblem + "Phap Tu • Hoa Hanh"
// identity line + '?' help orb + way flavor paragraph.
// The canonical way model has NO description field (PathWayDefinition =
// name/element/kit only) — the flavor paragraph is omitted and flagged
// in the art doc rather than invented.
import { computed } from 'vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import type { ElementType } from '@/core/element/ElementType'

const props = defineProps<{
  wayIdentity: string
  /** Base path display name (CULTIVATION_PATH_MODULES[pathId].name). */
  pathName: string | null
  committedElement: ElementType | null
}>()

const elementLabel = computed(() =>
  props.committedElement ? ELEMENT_LABELS[props.committedElement] : null,
)
</script>

<template>
  <div class="skill-way-card" data-hk-region="way-card">
    <!-- Way emblem (art-needed): flaming way glyph in an ornate ring;
         temp uses the delivered 'skill' symbol. -->
    <span class="skill-way-card__emblem art-needed" data-art-id="skill-way-emblem" aria-hidden="true">
      <HuyenKimSymbol name="skill" />
    </span>
    <div class="skill-way-card__identity">
      <strong>{{ wayIdentity }}</strong>
      <span v-if="pathName || elementLabel" class="skill-way-card__path">
        {{ pathName }}<template v-if="elementLabel"> • {{ elementLabel }} Hành</template>
      </span>
    </div>
    <!-- Help orb (art-needed): the ref's '?' dot next to the identity. -->
    <span class="skill-way-card__help art-needed" data-art-id="skill-help-orb" aria-hidden="true">?</span>
  </div>
</template>

<style scoped>
.skill-way-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
}
.skill-way-card__emblem {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--hk-gold-muted, #7a6234);
  background: radial-gradient(circle at 42% 32%, #3a2420, #101718 72%);
  box-shadow: 0 0 0 3px var(--hk-surface-base, #0b0f0d), 0 0 10px rgba(0, 0, 0, 0.5);
}
.skill-way-card__emblem .hk-symbol { width: 55%; height: 55%; background: var(--hk-gold, #c99a4a); }
.skill-way-card__identity { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.skill-way-card__identity strong {
  color: var(--hk-text-primary, #ede6d6);
  font: 700 var(--text-sm) var(--font-display, serif);
}
.skill-way-card__path { color: var(--hk-gold, #c99a4a); font-size: var(--text-xs); }
.skill-way-card__help {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--hk-border-muted, #2a352f);
  color: var(--hk-text-muted, #7a7260);
  font: 700 var(--text-xs) var(--font-display, serif);
  align-self: flex-start;
}
</style>
