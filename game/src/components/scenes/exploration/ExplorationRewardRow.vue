<script setup lang="ts">
// Scene 09 scaffold - "Thuong Vuot Ai" reward slots of the detail panel.
// Source: model.rewardPreview (per-kill drop-table hint, weights
// stripped) - currency ranges render verbatim; drop entries resolve
// names through the material/equipment catalogs, never invented.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { StageSurfaceRewardPreview } from '@/core/game/GameManagerStageOps'
import type { AmountRange, DropEntry } from '@/core/drop/DropTable'
import { materials } from '@/data/materials/materials'
import { equipment } from '@/data/equipment/equipment'

const props = defineProps<{
  preview: StageSurfaceRewardPreview | undefined
}>()

const { t } = useI18n()

const KIND_LABEL_KEYS: Record<string, string> = {
  material: 'panels.stageSelect.rewards.kinds.material',
  equipment: 'panels.stageSelect.rewards.kinds.equipment',
  equipment_any: 'panels.stageSelect.rewards.kinds.equipmentAny',
  pill: 'panels.stageSelect.rewards.kinds.pill',
}

// Lazy id->name lookups across the two catalogs drop entries can hit.
const itemNames = new Map<string, string>()
for (const item of materials) {
  itemNames.set(item.id, item.name)
}
for (const item of equipment) {
  itemNames.set(item.id, item.name)
}

function rangeLabel(range: AmountRange): string {
  return range.min === range.max
    ? formatNumber(range.min)
    : `${formatNumber(range.min)}–${formatNumber(range.max)}`
}

function entryLabel(entry: DropEntry): string {
  if (entry.kind === 'equipment_any') {
    return t(KIND_LABEL_KEYS['equipment_any'] ?? 'panels.stageSelect.rewards.kinds.equipmentAny')
  }
  const name = entry.itemId ? itemNames.get(entry.itemId) : undefined
  const label = name ?? t(KIND_LABEL_KEYS[entry.kind] ?? 'panels.stageSelect.rewards.kinds.material')
  return entry.amount ? `${label} ×${rangeLabel(entry.amount)}` : label
}

const slots = computed(() => {
  const preview = props.preview
  if (!preview) {
    return []
  }

  const out: { key: string; label: string; value: string }[] = [
    {
      key: 'spirit-stone',
      label: t('combat.rewards.spiritStone'),
      value: rangeLabel(preview.spiritStone),
    },
    {
      key: 'technique-mastery',
      label: t('combat.rewards.techniqueMastery'),
      value: rangeLabel(preview.techniqueMastery),
    },
  ]

  for (const [index, entry] of preview.guaranteed.entries()) {
    out.push({ key: `guaranteed-${index}`, label: entryLabel(entry), value: '' })
  }

  for (const [index, entry] of preview.poolItems.entries()) {
    out.push({ key: `pool-${index}`, label: entryLabel(entry), value: '' })
  }

  return out
})
</script>

<template>
  <section v-if="slots.length" class="exploration-rewards">
    <h5 class="exploration-section-label">{{ t('panels.stageSelect.sections.rewards') }}</h5>
    <ul class="exploration-rewards__slots">
      <li
        v-for="slot in slots"
        :key="slot.key"
        class="exploration-rewards__slot art-needed"
        data-art-id="exploration-reward-slot"
      >
        <strong>{{ slot.label }}</strong>
        <small v-if="slot.value">{{ slot.value }}</small>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.exploration-rewards { display: flex; flex-direction: column; gap: 6px; }

.exploration-section-label {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  letter-spacing: .1em;
  text-transform: uppercase;
}

.exploration-rewards__slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exploration-rewards__slot {
  display: flex;
  min-height: 46px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 5px 4px;
  border: 1px solid color-mix(in srgb, var(--hk-gold, #b99a55) 45%, var(--paper-line));
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--hk-gold, #b99a55) 14%, transparent), transparent 70%),
    color-mix(in srgb, var(--paper-100) 90%, var(--hk-gold, #b99a55) 5%);
  text-align: center;
}

.exploration-rewards__slot strong {
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--paper-text-soft);
}

.exploration-rewards__slot small {
  font-size: 10px;
  font-weight: 700;
  color: color-mix(in srgb, var(--hk-gold, #b99a55) 60%, var(--brush-950));
}
</style>
