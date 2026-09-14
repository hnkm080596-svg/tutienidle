<script setup lang="ts">
// Companion roster panel (companion-gacha Task 10, 2026-09-12) - standalone
// overlay listing owned companions grouped by grade, with a detail pane:
// realm/tier, EXP bar, resolved stats, 6 Cung Menh pips + perk states,
// skill list with unlock thresholds, and a feed control that calls
// gameManager.companionOps.feedCompanion(). Presentation only - the ops layer
// re-validates every commit; this panel never derives outcomes (A7).
//
// Gating uses ui.standalonePanel, the same OverlayPanel pattern as
// TranPhapPanel.vue/ArtifactPanel.vue. Opened via the command wheel slot
// 'companion_roster' (data/ui/commandWheelCatalog.ts).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'
import { COMPANIONS } from '@/data/companion/Companions'
import type {
  CompanionBaseStats,
  CompanionDefinition,
  CompanionInstance,
  CompanionSkillSlot,
  ConstellationPerk,
} from '@/data/companion/Companions'
import {
  companionExpRequiredForLevel,
  companionFeedExpValue,
  companionStatsAt,
  isCompanionFeedable,
  isCompanionLevelMaxed,
  isCompanionSkillUnlocked,
  resolveCompanionSkillKit,
  MAX_CONSTELLATION_RANK,
} from '@/core/companion/CompanionProgression'
import type { FeedCompanionResult } from '@/core/game/GameManagerCompanionOps'
import { ITEM_GRADE_LABELS, ITEM_GRADE_ORDER } from '@/core/item/ItemGrade'
import type { ItemGrade } from '@/core/item/ItemGrade'
import { realmLabel } from '@/core/presentation/labels'
import { formatNumber } from '@/core/format/NumberFormatter'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const SKILL_SLOTS: readonly CompanionSkillSlot[] = ['basic', 'special', 'ultimate']

interface RosterEntry {
  instance: CompanionInstance
  definition: CompanionDefinition
}

interface GradeGroup {
  grade: ItemGrade
  entries: RosterEntry[]
}

function definitionOf(instance: CompanionInstance): CompanionDefinition | undefined {
  return COMPANIONS.find((definition) => definition.id === instance.definitionId)
}

// Roster grouped by grade in ITEM_GRADE_ORDER order - same convention as
// worker-lodge/DuyenPhanTab.vue. Instances whose definitionId fell out of
// the registry are skipped (defensive; the save validator rejects them).
const groups = computed<GradeGroup[]>(() => {
  stateVersion.value

  return ITEM_GRADE_ORDER
    .map((grade) => ({
      grade,
      entries: player.companions.flatMap((instance) => {
        const definition = definitionOf(instance)
        return definition && definition.grade === grade ? [{ instance, definition }] : []
      }),
    }))
    .filter((group) => group.entries.length > 0)
})

const selectedInstanceId = ref<string | null>(null)

// Falls back to the first owned companion so the detail pane is never
// blank while the roster is non-empty.
const selected = computed<RosterEntry | null>(() => {
  stateVersion.value

  const instance =
    player.companions.find((entry) => entry.instanceId === selectedInstanceId.value) ??
    player.companions[0]

  if (!instance) {
    return null
  }

  const definition = definitionOf(instance)

  return definition ? { instance, definition } : null
})

const selectedStats = computed<CompanionBaseStats | null>(() => {
  const entry = selected.value

  return entry ? companionStatsAt(entry.definition, entry.instance) : null
})

// "Level-maxed" = top tier of the player's current realm - the cap rises
// when the player breaks through (isCompanionLevelMaxed, spec section 5).
const selectedMaxed = computed(() => {
  const entry = selected.value

  return entry ? isCompanionLevelMaxed(entry.instance, player.realmId) : false
})

const selectedExpRequired = computed(() => {
  const entry = selected.value

  return entry ? companionExpRequiredForLevel(entry.instance.realmId, entry.instance.realmLevel) : 1
})

const expPercent = computed(() => {
  const entry = selected.value

  if (!entry || selectedMaxed.value) {
    return 100
  }

  return Math.min(100, (entry.instance.exp / selectedExpRequired.value) * 100)
})

// Resolved kit (post skill_override perks) so the list shows effective
// values - e.g. a C-rank cooldown override - not raw definition data.
const selectedKit = computed(() => {
  const entry = selected.value

  return entry ? resolveCompanionSkillKit(entry.definition, entry.instance) : null
})

function skillUnlocked(slot: CompanionSkillSlot): boolean {
  const entry = selected.value

  return entry ? isCompanionSkillUnlocked(entry.definition, entry.instance, slot) : false
}

// unlockThresholds only carries special/ultimate keys - 'basic' has no
// gate, so indexing it directly would not type-check.
function thresholdOf(slot: CompanionSkillSlot): { realmId: string; realmLevel: number } | undefined {
  const entry = selected.value

  if (!entry || slot === 'basic') {
    return undefined
  }

  return entry.definition.unlockThresholds[slot]
}

function statName(stat: keyof CompanionBaseStats): string {
  return t(`companion.stats.${stat}`)
}

function slotName(slot: CompanionSkillSlot): string {
  return t(`companion.skills.slots.${slot}`)
}

// Perk text is display-only - the authoritative effects live in
// companionStatsAt()/resolveCompanionSkillKit().
function perkText(perk: ConstellationPerk): string {
  if (perk.kind === 'stat') {
    const parts: string[] = []

    if (perk.flat) {
      parts.push(t('companion.perks.statFlat', { stat: statName(perk.stat), value: formatNumber(perk.flat) }))
    }

    if (perk.percent) {
      parts.push(t('companion.perks.statPercent', { stat: statName(perk.stat), value: perk.percent }))
    }

    return parts.join(', ')
  }

  const parts: string[] = []

  if (perk.overrides.cooldownTurns !== undefined) {
    parts.push(t('companion.perks.cooldown', { turns: perk.overrides.cooldownTurns }))
  }

  if (perk.overrides.damageMultiplierPercent !== undefined) {
    parts.push(t('companion.perks.damage', { percent: perk.overrides.damageMultiplierPercent }))
  }

  if (perk.overrides.healPercentOfDamage !== undefined) {
    parts.push(t('companion.perks.heal', { percent: perk.overrides.healPercentOfDamage }))
  }

  return t('companion.perks.skillOverride', { slot: slotName(perk.slot), detail: parts.join(', ') })
}

// Pip tooltip: the perk authored at that rank when one exists (C2/C4/C6
// content), otherwise just the locked/unlocked state.
function pipTooltip(rank: number): string {
  const entry = selected.value

  if (!entry) {
    return ''
  }

  const perk = (entry.definition.constellationPerks ?? []).find((p) => p.atRank === rank)
  const state = rank <= entry.instance.constellationRank
    ? t('companion.constellation.unlocked')
    : t('companion.constellation.locked')

  return perk ? `${perkText(perk)} - ${state}` : state
}

// --- Feed control -----------------------------------------------------
// Material picker lists only feedable stacks - the eligibility rule is
// owned by isCompanionFeedable (A2); the ops layer re-checks on commit.
const feedMaterialId = ref('')
const feedCount = ref<number>(1)

const feedStacks = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAll().filter((stack) => isCompanionFeedable(stack.material))
})

// A stale selection (stack ran out after feeding) falls back to the first
// stack so the select never points at a missing option.
const selectedFeedStack = computed(() => {
  const stacks = feedStacks.value

  return stacks.find((stack) => stack.material.id === feedMaterialId.value) ?? stacks[0] ?? null
})

const feedDisabled = computed(() => {
  const stack = selectedFeedStack.value

  return (
    !selected.value ||
    selectedMaxed.value ||
    !stack ||
    !Number.isInteger(feedCount.value) ||
    feedCount.value < 1 ||
    feedCount.value > stack.amount
  )
})

const lastFeed = ref<{
  instanceId: string
  expGained: number
  clampedExp: number
  levelsGained: number
  realmBreakthroughs: string[]
} | null>(null)

// The result line belongs to the instance it was produced for - switching
// the selection hides it instead of showing a stale outcome.
const lastFeedVisible = computed(
  () => lastFeed.value !== null && lastFeed.value.instanceId === selected.value?.instance.instanceId,
)

function feedErrorMessage(reason: Extract<FeedCompanionResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'unknown_instance':
      return t('companion.feed.errors.unknownInstance')
    case 'unknown_material':
      return t('companion.feed.errors.unknownMaterial')
    case 'not_feedable':
      return t('companion.feed.errors.notFeedable')
    case 'level_maxed':
      return t('companion.feed.errors.levelMaxed')
    case 'insufficient_material':
      return t('companion.feed.errors.insufficientMaterial')
    case 'no_active_player':
      return t('companion.feed.errors.noActivePlayer')
  }
}

function onFeed() {
  const entry = selected.value
  const stack = selectedFeedStack.value

  if (!entry || !stack || feedDisabled.value) {
    return
  }

  const result = gameManager.companionOps.feedCompanion(entry.instance.instanceId, stack.material.id, Math.trunc(feedCount.value))

  if (!result.ok) {
    useNotificationStore().push('warning', feedErrorMessage(result.reason))
    return
  }

  lastFeed.value = {
    instanceId: entry.instance.instanceId,
    expGained: result.expGained,
    clampedExp: result.clampedExp,
    levelsGained: result.levelsGained,
    realmBreakthroughs: result.realmBreakthroughs,
  }

  bumpState()
}

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel
    :open="ui.standalonePanel === 'companion'"
    :title="t('companion.title')"
    width="min(980px, 94vw)"
    height="min(680px, 88vh)"
    @close="close"
  >
    <div class="companion-panel">
      <p v-if="groups.length === 0" class="companion-panel__empty">{{ t('companion.empty') }}</p>

      <div v-else class="companion-panel__body">
        <div class="companion-panel__roster">
          <div v-for="group in groups" :key="group.grade" class="companion-panel__grade-group">
            <h4 class="companion-panel__grade" :style="{ color: `var(--grade-${group.grade})` }">
              {{ ITEM_GRADE_LABELS[group.grade] }}
            </h4>

            <button
              v-for="entry in group.entries"
              :key="entry.instance.instanceId"
              type="button"
              class="companion-panel__card"
              :class="{ 'is-selected': selected?.instance.instanceId === entry.instance.instanceId }"
              @click="selectedInstanceId = entry.instance.instanceId"
            >
              <span
                class="companion-panel__card-name"
                :style="{ color: `var(--grade-${entry.definition.grade})` }"
              >{{ entry.definition.name }}</span>
              <span class="companion-panel__card-meta">
                {{ t('companion.constellationBadge', { rank: entry.instance.constellationRank }) }}
                · {{ realmLabel(entry.instance.realmId) }} {{ entry.instance.realmLevel }}
              </span>
            </button>
          </div>
        </div>

        <div v-if="selected && selectedStats" class="companion-panel__detail">
          <header class="companion-panel__detail-header">
            <strong
              class="companion-panel__name"
              :style="{ color: `var(--grade-${selected.definition.grade})` }"
            >{{ selected.definition.name }}</strong>
            <span
              class="companion-panel__grade-label"
              :style="{ color: `var(--grade-${selected.definition.grade})` }"
            >{{ ITEM_GRADE_LABELS[selected.definition.grade] }}</span>
            <span class="companion-panel__realm">
              {{ t('companion.realmLine', { realm: realmLabel(selected.instance.realmId), level: selected.instance.realmLevel }) }}
            </span>
          </header>

          <div class="companion-panel__exp">
            <div class="companion-panel__exp-track">
              <div class="companion-panel__exp-fill" :style="{ width: `${expPercent}%` }"></div>
            </div>
            <span class="companion-panel__exp-text">
              {{ selectedMaxed
                ? t('companion.exp.maxed')
                : t('companion.exp.value', { exp: formatNumber(selected.instance.exp), required: formatNumber(selectedExpRequired) }) }}
            </span>
          </div>

          <div class="companion-panel__stats">
            <span>{{ t('companion.stats.maxHp') }} {{ formatNumber(selectedStats.maxHp) }}</span>
            <span>{{ t('companion.stats.might') }} {{ formatNumber(selectedStats.might) }}</span>
            <span>{{ t('companion.stats.speed') }} {{ formatNumber(selectedStats.speed) }}</span>
          </div>

          <section class="companion-panel__constellation">
            <h4>{{ t('companion.constellation.title') }}</h4>
            <div class="companion-panel__pips">
              <span
                v-for="rank in MAX_CONSTELLATION_RANK"
                :key="rank"
                class="companion-panel__pip"
                :class="{ 'is-lit': rank <= selected.instance.constellationRank }"
                v-tooltip="pipTooltip(rank)"
              >C{{ rank }}</span>
            </div>
            <ul
              v-if="(selected.definition.constellationPerks ?? []).length > 0"
              class="companion-panel__perks"
            >
              <li
                v-for="perk in selected.definition.constellationPerks"
                :key="perk.atRank"
                class="companion-panel__perk"
                :class="{ 'is-locked': perk.atRank > selected.instance.constellationRank }"
              >
                <span class="companion-panel__perk-rank">C{{ perk.atRank }}</span>
                <span class="companion-panel__perk-text">{{ perkText(perk) }}</span>
                <span class="companion-panel__perk-state">
                  {{ perk.atRank <= selected.instance.constellationRank
                    ? t('companion.constellation.unlocked')
                    : t('companion.constellation.locked') }}
                </span>
              </li>
            </ul>
            <small v-else class="companion-panel__perk-empty">{{ t('companion.constellation.noPerks') }}</small>
          </section>

          <section class="companion-panel__skills">
            <h4>{{ t('companion.skills.title') }}</h4>
            <ul class="companion-panel__skill-list">
              <li v-for="slot in SKILL_SLOTS" :key="slot" class="companion-panel__skill">
                <span class="companion-panel__skill-slot">{{ slotName(slot) }}</span>
                <template v-if="selected.definition[slot]">
                  <span class="companion-panel__skill-id">{{ selected.definition[slot]!.id }}</span>
                  <span
                    class="companion-panel__skill-state"
                    :class="{ 'is-locked': !skillUnlocked(slot) }"
                  >{{ skillUnlocked(slot) ? t('companion.skills.unlocked') : t('companion.skills.locked') }}</span>
                  <small
                    v-if="!skillUnlocked(slot) && thresholdOf(slot)"
                    class="companion-panel__skill-threshold"
                  >
                    {{ t('companion.skills.unlockAt', { realm: realmLabel(thresholdOf(slot)!.realmId), level: thresholdOf(slot)!.realmLevel }) }}
                  </small>
                  <small
                    v-else-if="(selectedKit?.[slot]?.cooldownTurns ?? 0) > 0"
                    class="companion-panel__skill-threshold"
                  >
                    {{ t('companion.skills.cooldownTag', { turns: selectedKit![slot]!.cooldownTurns }) }}
                  </small>
                </template>
                <span v-else class="companion-panel__skill-absent">{{ t('companion.skills.absent') }}</span>
              </li>
            </ul>
          </section>

          <section class="companion-panel__feed">
            <h4>{{ t('companion.feed.title') }}</h4>
            <div class="companion-panel__feed-controls">
              <select
                class="companion-panel__feed-material"
                :value="selectedFeedStack?.material.id ?? ''"
                :disabled="feedStacks.length === 0"
                :aria-label="t('companion.feed.materialAria')"
                @change="feedMaterialId = ($event.target as HTMLSelectElement).value"
              >
                <option
                  v-for="stack in feedStacks"
                  :key="stack.material.id"
                  :value="stack.material.id"
                >
                  {{ t('companion.feed.materialOption', { name: stack.material.name, count: stack.amount, exp: companionFeedExpValue(stack.material) }) }}
                </option>
              </select>
              <input
                v-model.number="feedCount"
                class="companion-panel__feed-count"
                type="number"
                min="1"
                :max="selectedFeedStack?.amount ?? 1"
                :aria-label="t('companion.feed.countAria')"
              />
              <GameButton
                class="companion-panel__feed-button"
                size="sm"
                :disabled="feedDisabled"
                @click="onFeed"
              >
                {{ t('companion.feed.button') }}
              </GameButton>
            </div>
            <small v-if="selectedMaxed" class="companion-panel__feed-note">
              {{ t('companion.feed.maxedReason') }}
            </small>
            <small v-else-if="feedStacks.length === 0" class="companion-panel__feed-note">
              {{ t('companion.feed.noMaterial') }}
            </small>
            <!-- Net exp only: exp discarded at the player-realm ceiling
                 (clampedExp) never reached the companion. -->
            <small v-else-if="lastFeedVisible && lastFeed" class="companion-panel__feed-result">
              {{ lastFeed.levelsGained > 0
                ? t('companion.feed.success', { exp: formatNumber(lastFeed.expGained - lastFeed.clampedExp), levels: lastFeed.levelsGained })
                : t('companion.feed.successNoLevel', { exp: formatNumber(lastFeed.expGained - lastFeed.clampedExp) }) }}
              <template v-if="lastFeed.realmBreakthroughs.length > 0">
                · {{ t('companion.feed.breakthrough', { realm: realmLabel(lastFeed.realmBreakthroughs[lastFeed.realmBreakthroughs.length - 1]!) }) }}
              </template>
            </small>
          </section>

          <p class="companion-panel__formation-hint">{{ t('companion.formationHint') }}</p>
        </div>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.companion-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--paper-text);
}

.companion-panel__empty {
  margin: 0;
  padding: 24px 0;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  font-style: italic;
  text-align: center;
}

.companion-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: var(--space-4, 16px);
}

.companion-panel__roster {
  flex: 0 0 240px;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.companion-panel__grade-group {
  display: grid;
  gap: 6px;
}

.companion-panel__grade {
  margin: 0;
  font: 700 var(--text-sm) var(--font-display);
}

.companion-panel__card {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--mineral-gold) 6%, var(--paper-100));
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.companion-panel__card.is-selected {
  border-color: var(--jade);
  background: color-mix(in srgb, var(--jade) 10%, var(--paper-100));
}

.companion-panel__card-name {
  font-weight: 700;
}

.companion-panel__card-meta {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.companion-panel__detail {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.companion-panel__detail-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.companion-panel__name {
  font: 700 var(--text-lg) var(--font-display);
}

.companion-panel__grade-label {
  font-size: var(--text-xs);
  font-weight: 700;
}

.companion-panel__realm {
  margin-left: auto;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
}

.companion-panel__exp {
  display: flex;
  align-items: center;
  gap: 10px;
}

.companion-panel__exp-track {
  flex: 1 1 auto;
  height: 8px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--paper-line) 55%, var(--paper-100));
  overflow: hidden;
}

.companion-panel__exp-fill {
  height: 100%;
  background: var(--jade);
  transition: width 150ms ease;
}

.companion-panel__exp-text {
  flex: 0 0 auto;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.companion-panel__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.companion-panel__stats span {
  padding: 4px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--jade) 8%, var(--paper-50));
  font-size: var(--text-xs);
}

.companion-panel__constellation h4,
.companion-panel__skills h4,
.companion-panel__feed h4 {
  margin: 0 0 6px;
  color: var(--jade);
  font: 700 var(--text-sm) var(--font-display);
}

.companion-panel__pips {
  display: flex;
  gap: 6px;
}

.companion-panel__pip {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--paper-line);
  border-radius: 50%;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
}

.companion-panel__pip.is-lit {
  border-color: var(--mineral-gold);
  background: color-mix(in srgb, var(--mineral-gold) 22%, var(--paper-50));
  color: var(--paper-text);
}

.companion-panel__perks {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}

.companion-panel__perk {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--text-xs);
}

.companion-panel__perk.is-locked {
  opacity: 0.55;
}

.companion-panel__perk-rank {
  font-weight: 700;
  color: var(--mineral-gold);
}

.companion-panel__perk-state {
  margin-left: auto;
  color: var(--paper-text-muted);
}

.companion-panel__perk-empty {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
}

.companion-panel__skill-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}

.companion-panel__skill {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: var(--text-xs);
}

.companion-panel__skill-slot {
  font-weight: 700;
  min-width: 64px;
}

.companion-panel__skill-id {
  color: var(--paper-text-soft);
}

.companion-panel__skill-state {
  color: var(--jade);
  font-weight: 700;
}

.companion-panel__skill-state.is-locked {
  color: var(--paper-text-muted);
}

.companion-panel__skill-threshold {
  color: var(--paper-text-muted);
}

.companion-panel__skill-absent {
  color: var(--paper-text-muted);
}

.companion-panel__feed-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.companion-panel__feed-material {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: var(--paper-50);
  color: var(--paper-text);
  font-family: inherit;
  font-size: var(--text-xs);
}

.companion-panel__feed-count {
  flex: 0 0 72px;
  padding: 6px 8px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: var(--paper-50);
  color: var(--paper-text);
  font-family: inherit;
  font-size: var(--text-xs);
}

.companion-panel__feed-note {
  display: block;
  margin-top: 6px;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
}

.companion-panel__feed-result {
  display: block;
  margin-top: 6px;
  color: var(--jade);
  font-size: var(--text-xs);
  font-weight: 700;
}

.companion-panel__formation-hint {
  margin: 0;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  font-style: italic;
}
</style>
