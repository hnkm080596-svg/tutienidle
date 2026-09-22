<script setup lang="ts">
// Doi Duyen Phan tab (companion-gacha Task 9, 2026-09-12) - exchange
// Duyen Phan for a specific companion definition. Row button states
// mirror GameManagerCompanionOps.exchangeCompanion() gates in the same
// order: constellation_maxed rejects before the duyenPhan check runs.
// Presentation only - the ops layer re-validates everything on commit.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import { BETA_COMPANIONS } from '@/data/companion/Companions'
import type { CompanionDefinition } from '@/data/companion/Companions'
import { EXCHANGE_COST } from '@/core/game/GameManagerCompanionOps'
import type { ExchangeCompanionResult } from '@/core/game/GameManagerCompanionOps'
import { MAX_CONSTELLATION_RANK } from '@/core/companion/CompanionProgression'
import { ITEM_GRADE_ORDER, ITEM_GRADE_LABELS } from '@/core/item/ItemGrade'
import type { ItemGrade } from '@/core/item/ItemGrade'
import { formatNumber } from '@/core/format/NumberFormatter'

type DisabledReason = 'constellation_maxed' | 'insufficient_duyen_phan'

interface ExchangeRow {
  definition: CompanionDefinition
  cost: number
  // null = not owned; otherwise the live constellationRank of the
  // single owned instance (1-instance-per-definition invariant).
  constellationRank: number | null
  disabledReason: DisabledReason | null
}

interface GradeGroup {
  grade: ItemGrade
  rows: ExchangeRow[]
}

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const duyenPhan = computed(() => player.duyenPhan)

function buildRow(definition: CompanionDefinition): ExchangeRow {
  const owned = player.companions.find((instance) => instance.definitionId === definition.id)
  const cost = EXCHANGE_COST[definition.grade]

  let disabledReason: DisabledReason | null = null

  if (owned && owned.constellationRank >= MAX_CONSTELLATION_RANK) {
    disabledReason = 'constellation_maxed'
  } else if (duyenPhan.value < cost) {
    disabledReason = 'insufficient_duyen_phan'
  }

  return {
    definition,
    cost,
    constellationRank: owned?.constellationRank ?? null,
    disabledReason,
  }
}

const groups = computed<GradeGroup[]>(() => {
  stateVersion.value

  return ITEM_GRADE_ORDER
    .map((grade) => ({
      grade,
      // P7-M-G: rows mirror the Beta-acquirable pool - offering an
      // exchange row for a non-acquirable def would be a UI lie.
      rows: BETA_COMPANIONS.filter((definition) => definition.grade === grade).map(buildRow),
    }))
    .filter((group) => group.rows.length > 0)
})

function reasonText(row: ExchangeRow): string {
  if (row.disabledReason === 'constellation_maxed') {
    return t('duyenPhan.reason.constellationMaxed', { max: MAX_CONSTELLATION_RANK })
  }

  return t('duyenPhan.reason.insufficientDuyenPhan', { cost: row.cost })
}

function exchangeErrorMessage(reason: Extract<ExchangeCompanionResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'unknown_definition':
      return t('duyenPhan.errors.unknownDefinition')
    case 'constellation_maxed':
      return t('duyenPhan.errors.constellationMaxed', { max: MAX_CONSTELLATION_RANK })
    case 'insufficient_duyen_phan':
      return t('duyenPhan.errors.insufficientDuyenPhan')
    case 'realm_locked':
      return t('duyenPhan.errors.realmLocked')
    case 'no_active_player':
      return t('duyenPhan.errors.noActivePlayer')
  }
}

function onExchange(definitionId: string) {
  const result = gameManager.companionOps.exchangeCompanion(definitionId)

  if (!result.ok) {
    useNotificationStore().push('warning', exchangeErrorMessage(result.reason))

    return
  }

  bumpState()
}
</script>

<template>
  <section class="duyen-phan">
    <p class="duyen-phan__balance">
      {{ t('duyenPhan.balance', { count: formatNumber(duyenPhan) }) }}
    </p>

    <div v-for="group in groups" :key="group.grade" class="duyen-phan__group">
      <h4
        class="duyen-phan__grade"
        :style="{ color: `var(--grade-${group.grade})` }"
      >{{ ITEM_GRADE_LABELS[group.grade] }}</h4>

      <div
        v-for="row in group.rows"
        :key="row.definition.id"
        class="duyen-phan__row"
        :class="{ 'duyen-phan__row--owned': row.constellationRank !== null }"
        v-tooltip="row.disabledReason ? reasonText(row) : ''"
      >
        <span
          class="duyen-phan__name"
          :style="{ color: `var(--grade-${row.definition.grade})` }"
        >{{ row.definition.name }}</span>

        <span v-if="row.constellationRank !== null" class="duyen-phan__rank">
          {{ t('duyenPhan.constellationBadge', { rank: row.constellationRank }) }}
        </span>

        <span class="duyen-phan__cost">{{ t('duyenPhan.cost', { cost: row.cost }) }}</span>

        <small v-if="row.disabledReason" class="duyen-phan__reason">{{ reasonText(row) }}</small>

        <GameButton
          class="duyen-phan__exchange"
          size="sm"
          :disabled="row.disabledReason !== null"
          @click="onExchange(row.definition.id)"
        >
          {{ t('duyenPhan.exchange') }}
        </GameButton>
      </div>
    </div>

    <p v-if="groups.length === 0" class="duyen-phan__empty">{{ t('duyenPhan.empty') }}</p>
  </section>
</template>

<style scoped>
.duyen-phan {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.duyen-phan__balance {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--mineral-gold);
  font-weight: 700;
}

.duyen-phan__group {
  display: grid;
  gap: 6px;
}

.duyen-phan__grade {
  margin: 0;
  font: 700 var(--text-sm) var(--font-display);
}

.duyen-phan__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--mineral-gold) 6%, var(--paper-100));
  font-size: var(--text-xs);
}

/* Owned rows get the same jade tint convention as selected roster cards
   (CompanionPanel) - "already claimed" without looking disabled. */
.duyen-phan__row--owned {
  border-color: color-mix(in srgb, var(--jade) 45%, var(--paper-line));
  background: color-mix(in srgb, var(--jade) 8%, var(--paper-100));
}

.duyen-phan__name {
  font-weight: 700;
}

.duyen-phan__rank {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--jade) 18%, var(--paper-100));
  color: var(--jade);
  font-weight: 700;
}

.duyen-phan__cost {
  margin-left: auto;
  color: var(--paper-text-soft);
}

.duyen-phan__reason {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
}

.duyen-phan__empty {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  font-style: italic;
}
</style>
