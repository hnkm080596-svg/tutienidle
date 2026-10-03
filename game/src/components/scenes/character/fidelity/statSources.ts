// Per-source attribution read-model for the character stat board.
// CharacterSurface feeds resolvePlayerStatAssembly()'s raw inputs here
// once per state bump; explainStatBreakdown() then replays the canonical
// 2-pass pipeline per stat so the hover lists exactly the sources that
// folded the shown value.
import type { BaseStats } from '@/core/stats/StatBlock'
import type { StatType } from '@/core/stats/StatTypes'
import { MAIN_STAT_KEYS } from '@/core/stats/StatTypes'
import { isPercentStat } from '@/core/stats/StatMetadata'
import {
  explainStatBreakdown,
  type ModifierSourceType,
  type StatModifier,
} from '@/core/stats/StatCalculator'
import { statLabel } from '@/core/stats/StatLabels'
import { formatStat } from '@/core/stats/StatLabels'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { getTalentDefinition } from '@/data/talent/Talents'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { REALM_PASSIVES } from '@/data/realm/RealmPassives'
import { MERIDIANS } from '@/data/realm/Meridians'
import { pills } from '@/data/pill/pills'
import { talismans } from '@/data/talisman/talismans'
import { formations } from '@/data/formation/formations'
import { SKILLS } from '@/data/skill/Skills'
import { PASSIVE_SKILLS } from '@/data/skill/PassiveSkills'
import { CORE_SKILLS } from '@/data/skill/CoreSkills'
import { PHAP_TU_SKILLS } from '@/data/skill/PhapTuSkills'
import { TALENT_PASSIVE_SKILLS } from '@/data/skill/TalentPassives'
import { BUFF_REGISTRY, PERSISTENT_BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import { getActiveWayDefinition } from '@/core/player/CultivationPathKit'
import { composeEquipmentDisplayName } from '@/core/equipment/EquipmentNaming'
import type { PlayerData } from '@/core/player/Player'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { Equipment } from '@/core/equipment/Equipment'
import type { ZoneRegistry } from '@/core/stage/ZoneRegistry'
import type { TooltipContent, TooltipStatRow } from '@/composables/useTooltip'
import type {
  CharacterUiStatSource,
  CharacterUiStatSources,
} from './characterUi'

/** The runtime facets buildStatSources needs - surfaced once per model
    rebuild by the surface (gameManager slices + the resolved assembly). */
export interface StatSourceContext {
  player: PlayerData
  pipelineBase: BaseStats
  bodyBaseDeltas: Partial<Record<StatType, number>>
  modifiers: readonly StatModifier[]
  nodeRegistry: { has(id: string): boolean; get(id: string): ProgressionNode }
  equipmentBag: { get(instanceId: string): EquipmentInstance | undefined }
  getEquipmentTemplate: (itemId: string) => Equipment | undefined
  zoneRegistry: ZoneRegistry
}

const SKILLS_BY_ID: { id: string; name: string }[] = [
  ...SKILLS,
  ...PASSIVE_SKILLS,
  ...CORE_SKILLS,
  ...PHAP_TU_SKILLS,
  ...TALENT_PASSIVE_SKILLS,
]

const ELEMENT_NAMES: Record<string, string> = ELEMENT_LABELS

// Resolves (sourceType, sourceId) to a concrete Vietnamese source name;
// undefined -> the caller falls back to the localized category label.
export function resolveStatSourceName(
  sourceType: ModifierSourceType,
  sourceId: string,
  modifierIds: readonly string[],
  context: StatSourceContext,
): string | undefined {
  switch (sourceType) {
    case 'attribute':
      return (MAIN_STAT_KEYS as readonly string[]).includes(sourceId)
        ? statLabel(sourceId as StatType)
        : getActiveWayDefinition(context.player)?.name
    case 'equipment': {
      const instance = context.equipmentBag.get(sourceId)
      if (instance === undefined) {
        return undefined
      }
      const template =
        context.getEquipmentTemplate(instance.itemId) ??
        ({ name: instance.itemId } as Equipment)
      return composeEquipmentDisplayName(instance, template, context.zoneRegistry)
    }
    case 'technique':
      return TECHNIQUES.find((entry) => entry.id === sourceId)?.name
    case 'talent':
      return (
        (context.nodeRegistry.has(sourceId)
          ? context.nodeRegistry.get(sourceId).name
          : undefined) ?? getTalentDefinition(sourceId)?.name
      )
    case 'realm':
      // Realm-sourced channels: authored passives (sourceId =
      // 'nhap_dao'/...), the meridian chapter, node-tree grants, and the
      // way-facet domain ids ('spell'/'body'/...) which name the way.
      return (
        REALM_PASSIVES.find((entry) => entry.sourceId === sourceId)?.name ??
        MERIDIANS.find((entry) => entry.id === sourceId)?.name ??
        (context.nodeRegistry.has(sourceId)
          ? context.nodeRegistry.get(sourceId).name
          : undefined) ??
        getActiveWayDefinition(context.player)?.name
      )
    case 'skill':
      return SKILLS_BY_ID.find((skill) => skill.id === sourceId)?.name
    case 'pill':
      return pills.find((pill) => pill.id === sourceId)?.name
    case 'talisman':
      return talismans.find((talisman) => talisman.id === sourceId)?.name
    case 'formation':
      return formations.find((formation) => formation.id === sourceId)?.name
    case 'buff':
    case 'debuff': {
      // Buff modifiers carry the caster in sourceId ('player'); the
      // definition id lives inside modifier.id ('buff:<defId>:...').
      const definitionId = modifierIds
        .find((id) => id.startsWith('buff:'))
        ?.split(':')[1]
      if (definitionId === undefined) {
        return undefined
      }
      return (
        BUFF_REGISTRY.tryGet(definitionId)?.name ??
        PERSISTENT_BUFF_REGISTRY.tryGet(definitionId)?.name
      )
    }
    default:
      return undefined
  }
}

/** Per-stat source read-model - one call per displayed stat id. */
export function buildStatSources(
  stat: StatType,
  context: StatSourceContext,
  categoryLabel: (sourceType: ModifierSourceType) => string,
): CharacterUiStatSources {
  const breakdown = explainStatBreakdown(
    context.pipelineBase,
    [...context.modifiers],
    stat,
  )

  const contributions: CharacterUiStatSource[] = breakdown.contributions.map(
    (contribution) => ({
      label:
        resolveStatSourceName(
          contribution.sourceType,
          contribution.sourceId,
          contribution.modifierIds,
          context,
        ) ?? categoryLabel(contribution.sourceType),
      ...(contribution.flat !== 0 ? { flat: contribution.flat } : {}),
      ...(contribution.percents.length > 0 ? { percents: contribution.percents } : {}),
      ...(contribution.multiplier !== 1 ? { multiplier: contribution.multiplier } : {}),
    }),
  )

  const bodyDelta = context.bodyBaseDeltas[stat]

  return {
    base: breakdown.base,
    ...(bodyDelta ? { bodyDelta } : {}),
    contributions,
  }
}

// ---------------- tooltip construction (shared stats + details) ----------------

function tagLabel(tag: string): string {
  return ELEMENT_NAMES[tag] ?? tag
}

// formatStat() rounds flat stats to integers - keep sub-unit grants
// readable ('+0.8' must not print as '+1').
function formatFlatAmount(stat: StatType, value: number): string {
  if (!isPercentStat(stat) && Math.abs(value) < 10 && !Number.isInteger(value)) {
    return (Math.round(value * 100) / 100).toString()
  }
  return formatStat(stat, value)
}

function contributionText(
  stat: StatType,
  source: CharacterUiStatSource,
): { value: string; sign: number } {
  const parts: string[] = []
  let sign = 0
  if (source.flat !== undefined && source.flat !== 0) {
    parts.push(`${source.flat > 0 ? '+' : ''}${formatFlatAmount(stat, source.flat)}`)
    sign += Math.sign(source.flat)
  }
  for (const pool of source.percents ?? []) {
    parts.push(
      `${pool.amount > 0 ? '+' : ''}${(pool.amount * 100).toFixed(1)}%${
        pool.tag ? ` ${tagLabel(pool.tag)}` : ''
      }`,
    )
    sign += Math.sign(pool.amount)
  }
  if (source.multiplier !== undefined && source.multiplier !== 1) {
    parts.push(`×${Math.round(source.multiplier * 100) / 100}`)
    sign += Math.sign(source.multiplier - 1)
  }
  return { value: parts.join('  '), sign }
}

/** Builds the aggregate-source tooltip for a stat/detail row. Without
    sources the row degrades to the previous plain description tip. */
export function buildStatSourceTooltip(
  stat: StatType,
  entry: { label: string; value: string; description?: string; sources?: CharacterUiStatSources },
  t: (key: string) => string,
): TooltipContent {
  const sources = entry.sources
  if (sources === undefined) {
    return { title: entry.label, description: entry.description }
  }

  const bodyDelta = sources.bodyDelta ?? 0
  const rows: TooltipStatRow[] = [
    {
      label: t('character.sources.base'),
      value: formatFlatAmount(stat, sources.base - bodyDelta),
    },
  ]

  if (bodyDelta !== 0) {
    rows.push({
      label: t('character.sources.bodyDelta'),
      value: `${bodyDelta > 0 ? '+' : ''}${formatFlatAmount(stat, bodyDelta)}`,
      tone: bodyDelta > 0 ? 'positive' : 'negative',
    })
  }

  for (const contribution of sources.contributions) {
    const { value, sign } = contributionText(stat, contribution)
    rows.push({
      label: contribution.label,
      value,
      tone: sign > 0 ? 'positive' : sign < 0 ? 'negative' : undefined,
    })
  }

  return {
    kind: 'stat',
    name: entry.label,
    total: entry.value,
    description: entry.description,
    sections: [{ label: t('character.sources.title'), rows }],
  }
}
