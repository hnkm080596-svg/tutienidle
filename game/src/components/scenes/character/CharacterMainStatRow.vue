<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { formatStat, type StatLabelEntry } from '@/core/stats/StatLabels'
import { MAIN_STAT_KEYS, type MainStatKey } from '@/core/stats/StatTypes'
import { getEffectiveMainStatCap } from '@/core/stats/StatCap'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import GameButton from '@/components/common/GameButton.vue'

// One "Thuec Tinh Chinh" row: stat seal glyph, label + progress track,
// value (+ MAX when the base-stat cap is reached) and the allocate (+)
// affordance. UI Stat Cap plan: show the number + "MAX", never "24/30".
// The cap binds allocation only - equipment/pills can push finalStats
// past it normally.
const props = defineProps<{ stat: StatLabelEntry }>()

const { t } = useI18n()
const player = usePlayerStore()
const { allocateAttributePoint } = useProgressionActions()

// Attribute allocation rejects mid-battle (ops gate) - the + button
// disables up front so the affordance doesn't look live.
const { isBattleInProgress: inBattle } = useTurnBattleInfo()

const key = computed(() => props.stat.key)
const isMain = computed(() => (MAIN_STAT_KEYS as string[]).includes(key.value))
const capped = computed(
  () => isMain.value
    && player.baseStats[key.value as MainStatKey] >= getEffectiveMainStatCap(player),
)
const barRatio = computed(() =>
  isMain.value
    ? Math.min(1, player.baseStats[key.value as MainStatKey] / Math.max(1, getEffectiveMainStatCap(player)))
    : 0,
)

// Temp art: one hanh-seal glyph + hue per stat (artist replaces with
// painted seal icons - see art-request doc).
const STAT_GLYPH: Record<string, string> = {
  strength: '',
  dexterity: '',
  intelligence: '',
  attunement: '',
  vitality: '',
}
const STAT_HUE: Record<string, string> = {
  strength: '#b54432',
  dexterity: '#3f9e6f',
  intelligence: '#7a6fc4',
  attunement: '#4a8fc4',
  vitality: '#b98a3f',
}
</script>

<template>
  <div class="main-stat" :data-stat="stat.key" v-tooltip="stat.description">
    <span
      class="main-stat__seal art-needed"
      :data-art-id="`character-stat-seal-${stat.key}`"
      :style="{ '--seal-hue': STAT_HUE[stat.key] ?? '#b99a55' }"
      aria-hidden="true"
    >
      <span class="main-stat__glyph">{{ STAT_GLYPH[stat.key] ?? '·' }}</span>
    </span>

    <span class="main-stat__info">
      <span class="main-stat__label">{{ stat.label }}</span>
      <span class="main-stat__track">
        <span
          class="main-stat__bar"
          :style="{ width: `${barRatio * 100}%`, '--seal-hue': STAT_HUE[stat.key] ?? '#b99a55' }"
        />
      </span>
    </span>

    <span class="main-stat__side">
      <span class="main-stat__value-col">
        <span class="main-stat__value">{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
        <span v-if="capped" class="main-stat__max">{{ t('panels.character.labels.max') }}</span>
      </span>
      <GameButton
        v-if="isMain && player.attributePoints > 0 && !capped"
        class="main-stat__allocate"
        shape="circle"
        size="sm"
        :aria-label="stat.label"
        :disabled="inBattle"
        @click="allocateAttributePoint(stat.key as MainStatKey)"
      >
        +
      </GameButton>
    </span>
  </div>
</template>

<style scoped>
.main-stat {
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 10px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #7a6234) 45%, transparent);
  border-radius: var(--hk-radius-md, 8px);
  background:
    linear-gradient(170deg, rgba(185, 154, 85, 0.07), transparent 55%),
    color-mix(in srgb, var(--paper-50) 55%, transparent);
}

/* Temp art: octagonal element seal holding the stat glyph. */
.main-stat__seal {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
  background:
    radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--seal-hue) 85%, #fff 8%), color-mix(in srgb, var(--seal-hue) 45%, #101718) 82%);
}

.main-stat__glyph {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: #efe6d2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.main-stat__info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.main-stat__label {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-stat__track {
  position: relative;
  height: 5px;
  border-radius: 999px;
  background: rgba(237, 230, 214, 0.10);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.main-stat__bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--seal-hue) 60%, #101718), var(--seal-hue));
}

.main-stat__side {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--hk-space-2, 6px);
}

.main-stat__value-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}

.main-stat__value {
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--paper-text);
}

.main-stat__max {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--sys-warn, var(--gold-700));
}
</style>
