// Pure helpers for the exploration reward cells (extracted from
// ExplorationSurface.vue so the mapping is unit-testable): the cell
// caption, the generic kind label, the tooltip's extra drop rows and
// the plain hover card. Registry probing stays in the surface - it
// owns gameManager.
import { formatNumber } from '@/core/format/NumberFormatter'
import type { AmountRange, DropEntry, DropKind } from '@/core/drop/DropTable'
import type { TooltipContent, TooltipStatRow } from '@/composables/useTooltip'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

type Translate = (key: string) => string

export const EQUIPMENT_ANY_ICON = resolveAssetUrl('/assets/ui/huyen-kim/symbols/equipment.svg')

const KIND_LABEL_KEYS: Record<DropKind, string> = {
  material: 'panels.stageSelect.rewards.kinds.material',
  equipment: 'panels.stageSelect.rewards.kinds.equipment',
  equipment_any: 'panels.stageSelect.rewards.kinds.equipmentAny',
  pill: 'panels.stageSelect.rewards.kinds.pill',
}

export function rangeLabel(range: AmountRange): string {
  return range.min === range.max
    ? formatNumber(range.min)
    : `${formatNumber(range.min)}–${formatNumber(range.max)}`
}

/** Kind label only - cells show the amount under the slot, so this
 * never embeds the range (the old dropEntryLabel doubled it). */
export function dropKindLabel(entry: DropEntry, t: Translate): string {
  return t(KIND_LABEL_KEYS[entry.kind])
}

/** Cell caption under the slot: the authored range for materials and
 * pills, the implied x1 for equipment kinds (resolveDrops mints
 * exactly one instance for both). */
export function dropAmountText(entry: DropEntry): string {
  if (entry.amount) {
    return `×${rangeLabel(entry.amount)}`
  }
  return entry.kind === 'equipment' || entry.kind === 'equipment_any' ? '×1' : ''
}

export function extraDropRows(entry: DropEntry, chance: number | undefined, t: Translate): TooltipStatRow[] {
  const rows: TooltipStatRow[] = []
  const amountText = dropAmountText(entry)
  if (amountText) {
    rows.push({ label: t('panels.stageSelect.rewards.dropAmount'), value: amountText })
  }
  if (chance !== undefined && chance < 1) {
    rows.push({ label: t('panels.stageSelect.rewards.dropChance'), value: `${Math.round(chance * 100)}%` })
  }
  return rows
}

export function plainRewardTooltip(title: string, description: string | undefined, rows: TooltipStatRow[]): TooltipContent {
  return {
    kind: 'plain',
    title,
    description: [description ?? '', ...rows.map(row => `${row.label}: ${row.value}`)].filter(Boolean).join('\n'),
  }
}
