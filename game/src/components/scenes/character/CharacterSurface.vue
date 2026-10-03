<script setup lang="ts">
// Nhan Vat production adapter: mounts the approved character fidelity
// surface inside the Dong Fu stage canvas and feeds it the real
// read-models (player store + finalStats + attribute cap + talents).
// Commands keep their owners - allocation goes through
// useProgressionActions (domain gate: points/cap/in-battle), navigation
// through the ui store / building navigation. No domain state lives here.
// The five element discs were removed - only the hand effect slot stays
// (CharacterFidelityFigure); element data keeps the summary row.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion, useGameManager } from '@/composables/useGameState'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { CULTIVATION_PATH_MODULES } from '@/core/player/CultivationPathKit'
import type { CultivationPathId } from '@/core/player/CultivationPathKit'
import { BASE_STAT_LABELS, formatStat, type StatCategory } from '@/core/stats/StatLabels'
import { MAIN_STAT_KEYS, type MainStatKey, type StatType } from '@/core/stats/StatTypes'
import type { ModifierSourceType } from '@/core/stats/StatCalculator'
import { resolvePlayerStatAssembly } from '@/core/player/Player'
import { buildStatSources, type StatSourceContext } from './fidelity/statSources'
import { getEffectiveMainStatCap } from '@/core/stats/StatCap'
import { ELEMENT_LABELS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { formatNumber } from '@/core/format/NumberFormatter'
import { getTalentDefinition } from '@/data/talent/Talents'
import { isBetaStatLabelVisible, isBetaTalentId } from '@/core/betaScope'
import type { Stats } from '@/core/stats/StatBlock'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import CharacterFidelityScene from './fidelity/CharacterFidelityScene.vue'
import type { CharacterUiModel, CharacterUiStat, CharacterUiStatSources } from './fidelity/characterUi'


const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { allocateAttributePoint } = useProgressionActions()
const { isBattleInProgress: inBattle } = useTurnBattleInfo()
const { items: navItems, navigate } = usePaperNavigation()

const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}
onBeforeUnmount(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })

// Stat row order + seals/colors from the approved ui-character layout.
const STAT_ORDER = ['vitality', 'strength', 'dexterity', 'attunement', 'intelligence'] as const
type StatId = (typeof STAT_ORDER)[number]
const STAT_LAYOUT: Record<StatId, { color: string; symbol: string }> = {
  vitality: { color: '#ad3f36', symbol: 'body' },
  strength: { color: '#b38b37', symbol: 'equipment' },
  dexterity: { color: '#477f47', symbol: 'exploration' },
  attunement: { color: '#357c97', symbol: 'realm' },
  intelligence: { color: '#77419b', symbol: 'skill' },
}

const DETAIL_CATEGORIES: Record<'combat' | 'other', readonly StatCategory[]> = {
  combat: ['combat', 'survival'],
  other: ['special', 'defense_advanced'],
}

const combatPower = computed(() => {
  const stats = player.finalStats
  return Math.round(
    stats.might * 2 +
    stats.defense * 1.5 +
    stats.maxHp * 0.1 +
    stats.maxMp * 0.05 +
    stats.criticalRate * 500 +
    stats.criticalDamage * 300 +
    stats.speed * 200,
  )
})

const pathName = computed(() => {
  const pathId = player.cultivationPath as CultivationPathId | undefined
  return (pathId && CULTIVATION_PATH_MODULES[pathId]?.name) ?? t('panels.skillPath.mortalName')
})

function detailRows(
  categories: readonly StatCategory[],
  stats: Stats,
  sourcesFor: (stat: StatType) => CharacterUiStatSources,
) {
  return BASE_STAT_LABELS
    .filter((stat) => categories.includes(stat.category) && isBetaStatLabelVisible(stat.key))
    .map((stat) => ({
      id: stat.key,
      label: stat.label,
      value: formatStat(stat.key, stats[stat.key]),
      description: stat.description,
      sources: sourcesFor(stat.key),
    }))
}

const model = computed<CharacterUiModel>(() => {
  stateVersion.value
  const realm = getCurrentRealm(player.realmId)
  const cap = getEffectiveMainStatCap(player)

  // One assembly resolve per state bump feeds BOTH the shown values
  // and the per-source breakdown (same modifier set the formula ran).
  const assembly = resolvePlayerStatAssembly(player.$state, player.externalModifiers)
  const resolved = assembly.stats
  const sourceContext: StatSourceContext = {
    player: player.$state,
    pipelineBase: assembly.pipelineBase,
    bodyBaseDeltas: assembly.bodyBaseDeltas,
    modifiers: assembly.modifiers,
    nodeRegistry: gameManager.nodeRegistry,
    equipmentBag: gameManager.equipmentBag,
    getEquipmentTemplate: (itemId) => gameManager.equipmentOps.getEquipmentTemplate(itemId),
    zoneRegistry: gameManager.zoneRegistry,
  }
  const sourcesFor = (stat: StatType) =>
    buildStatSources(stat, sourceContext, (sourceType: ModifierSourceType) =>
      t(`character.sources.${sourceType}`),
    )

  const stats: CharacterUiStat[] = STAT_ORDER.map((id) => {
    const entry = BASE_STAT_LABELS.find((stat) => stat.key === id)
    const isMain = (MAIN_STAT_KEYS as string[]).includes(id)
    const capped = isMain && player.baseStats[id as MainStatKey] >= cap
    return {
      id,
      label: entry?.label ?? id,
      description: entry?.description,
      value: formatStat(id as keyof Stats, resolved[id as keyof Stats]),
      fill: isMain ? Math.min(100, (player.baseStats[id as MainStatKey] / Math.max(1, cap)) * 100) : 0,
      color: STAT_LAYOUT[id].color,
      symbol: STAT_LAYOUT[id].symbol,
      sources: sourcesFor(id),
      capped,
      allocatable: isMain && player.attributePoints > 0 && !capped && !inBattle.value,
    }
  })

  const powers = ELEMENT_ORDER.map((element) => Math.max(0, resolved[`${element}Power` as keyof Stats] ?? 0))
  const totalPower = powers.reduce((sum, power) => sum + power, 0)

  return {
    name: player.name,
    realm: `${realm.name} · ${t('panels.character.labels.realmFloor')} ${player.realmLevel}`,
    path: pathName.value,
    combatPower: formatNumber(combatPower.value),
    stats,
    elements: ELEMENT_ORDER.map((element, index) => ({
      id: element,
      name: ELEMENT_LABELS[element],
      share: `${totalPower > 0 ? Math.round(((powers[index] ?? 0) / totalPower) * 100) : 0}%`,
      power: formatNumber(powers[index] ?? 0),
      resistance: formatStat(`${element}Resistance` as keyof Stats, resolved[`${element}Resistance` as keyof Stats] ?? 0),
      penetration: formatStat(`${element}Penetration` as keyof Stats, resolved[`${element}Penetration` as keyof Stats] ?? 0),
    })),
    talents: player.selectedTalentIds.flatMap((talentId) => {
      const talent = getTalentDefinition(talentId)
      return talent && isBetaTalentId(talent.id)
        ? [{ id: talent.id, name: talent.name, description: talent.description, rarity: talent.rarity }]
        : []
    }),
    combat: detailRows(DETAIL_CATEGORIES.combat, resolved, sourcesFor),
    other: detailRows(DETAIL_CATEGORIES.other, resolved, sourcesFor),
    attributePoints: player.attributePoints,
  }
})

function onSelect(id: string) {
  const stat = model.value.stats.find((entry) => entry.id === id)
  if (stat) {
    flashNotice(t('character.statNotice', { name: stat.label, value: stat.value }))
    return
  }
  if (id.startsWith('talent.')) {
    const talent = model.value.talents.find((entry) => `talent.${entry.id}` === id)
    if (talent) flashNotice(`${talent.name} — ${talent.description}`)
    return
  }
  if (id.startsWith('element.')) {
    onElement(id.slice('element.'.length))
    return
  }
  flashNotice(id)
}

function onElement(id: string) {
  const element = model.value.elements.find((entry) => entry.id === id)
  if (element) {
    flashNotice(t('character.elementNotice', { name: element.name, power: element.power, resistance: element.resistance, penetration: element.penetration }))
  }
}

function onAllocate(id: string) {
  allocateAttributePoint(id as MainStatKey)
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <CharacterFidelityScene
      :model="model"
      :notice="notice"
      :navigation="navItems"
      @select="onSelect"
      @navigate="navigate"
      @allocate="onAllocate"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
