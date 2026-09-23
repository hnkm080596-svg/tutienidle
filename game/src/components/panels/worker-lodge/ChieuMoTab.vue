<script setup lang="ts">
// Chieu Mo tab (companion-gacha Task 9, 2026-09-12) - the companion
// gacha pull surface inside WorkerLodgePanel. Presentation only: calls
// gameManager.companionOps.pullCompanion() and renders the returned
// PullCompanionResult verbatim - never re-rolls or re-derives the
// outcome (A7).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import { companionAcquirablePool } from '@/core/companion/CompanionAvailability'
import { COMPANION_PULL_TOKEN_ID } from '@/core/game/GameManagerCompanionOps'
import type { PullCompanionResult } from '@/core/game/GameManagerCompanionOps'
import { PITY_THRESHOLD } from '@/core/companion/CompanionGacha'
import { ITEM_GRADE_LABELS } from '@/core/item/ItemGrade'
import { materialLabel } from '@/core/presentation/labels'
import { formatNumber } from '@/core/format/NumberFormatter'

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

// Token display name resolves through the material registry (data-driven,
// not a hardcoded label).
const tokenName = computed(() => materialLabel(COMPANION_PULL_TOKEN_ID, gameManager.materialRegistry))

const tokenCount = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(COMPANION_PULL_TOKEN_ID)
})

// PlayerData fields are Pinia-reactive via the player store - the ops
// layer mutates player.$state in place.
const pullsSinceRare = computed(() => player.companionPullsSinceRare)

const duyenPhan = computed(() => player.duyenPhan)

const pullInFlight = ref(false)

// M-F-COMPANION-GIFT - an empty acquirable pool (closed flag or an
// authored-empty future pool) is an explicit valid state: the surface
// says WHY instead of leaving a dead button, and points at the gift
// tab where Beta companions actually arrive.
const poolEnabled = computed(() => companionAcquirablePool().length > 0)

const pullDisabled = computed(
  () => pullInFlight.value || !poolEnabled.value || tokenCount.value < 1,
)

// The reveal card binds ONLY to the last result the ops layer returned.
const lastResult = ref<PullCompanionResult | null>(null)

function pullErrorMessage(reason: Extract<PullCompanionResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'missing_token':
      return t('chieuMo.errors.missingToken', { token: tokenName.value })
    case 'pool_unavailable':
      return t('chieuMo.errors.poolUnavailable')
    case 'realm_locked':
      return t('chieuMo.errors.realmLocked')
    case 'no_active_player':
      return t('chieuMo.errors.noActivePlayer')
  }
}

function onPull() {
  if (pullDisabled.value) {
    return
  }

  pullInFlight.value = true

  try {
    const result = gameManager.companionOps.pullCompanion()

    if (!result.ok) {
      useNotificationStore().push('warning', pullErrorMessage(result.reason))

      return
    }

    lastResult.value = result

    bumpState()
  } finally {
    pullInFlight.value = false
  }
}
</script>

<template>
  <section class="chieu-mo">
    <div class="chieu-mo__status">
      <span class="chieu-mo__status-item">
        {{ t('chieuMo.tokens', { name: tokenName, count: formatNumber(tokenCount) }) }}
      </span>
      <span class="chieu-mo__status-item">
        {{ t('duyenPhan.balance', { count: formatNumber(duyenPhan) }) }}
      </span>
      <span class="chieu-mo__status-item chieu-mo__status-item--pity">
        {{ t('chieuMo.pity', { count: pullsSinceRare, max: PITY_THRESHOLD }) }}
      </span>
    </div>

    <p v-if="!poolEnabled" class="chieu-mo__unavailable">
      {{ t('chieuMo.unavailable') }}
    </p>

    <GameButton class="chieu-mo__pull" :disabled="pullDisabled" @click="onPull">
      {{ t('chieuMo.pull', { token: tokenName }) }}
    </GameButton>

    <div v-if="lastResult?.ok" class="chieu-mo__result">
      <strong
        class="chieu-mo__result-name"
        :style="{ color: `var(--grade-${lastResult.outcome.grade})` }"
      >{{ lastResult.outcome.definition.name }}</strong>

      <span
        class="chieu-mo__result-grade"
        :style="{ color: `var(--grade-${lastResult.outcome.grade})` }"
      >{{ ITEM_GRADE_LABELS[lastResult.outcome.grade] }}</span>

      <span v-if="lastResult.outcome.kind === 'new'" class="chieu-mo__result-note">
        {{ t('chieuMo.result.new') }}
      </span>
      <span v-else-if="lastResult.outcome.kind === 'constellation_up'" class="chieu-mo__result-note">
        {{ t('chieuMo.result.constellationUp', { rank: lastResult.outcome.constellationRankAfter ?? 0 }) }}
      </span>
      <span v-else class="chieu-mo__result-note">
        {{ t('chieuMo.result.constellationMaxed', { bonus: lastResult.outcome.duyenPhanBonus }) }}
      </span>

      <span v-if="lastResult.outcome.pityTriggered" class="chieu-mo__result-pity">
        {{ t('chieuMo.result.pity') }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.chieu-mo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chieu-mo__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chieu-mo__status-item {
  padding: 4px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--jade) 8%, var(--paper-50));
  font-size: var(--text-xs);
  color: var(--paper-text);
}

.chieu-mo__status-item--pity {
  border-color: color-mix(in srgb, var(--mineral-gold) 45%, var(--paper-line));
}

.chieu-mo__unavailable {
  margin: 0;
  padding: 12px 14px;
  border: 1px dashed color-mix(in srgb, var(--jade) 45%, var(--paper-line));
  border-radius: var(--radius-md);
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
}

.chieu-mo__pull {
  align-self: flex-start;
}

.chieu-mo__result {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--jade) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--jade) 14%, var(--paper-50)), color-mix(in srgb, var(--jade) 6%, var(--paper-100)));
}

.chieu-mo__result-name {
  font: 700 var(--text-lg) var(--font-display);
}

.chieu-mo__result-grade {
  font-size: var(--text-xs);
  font-weight: 700;
}

.chieu-mo__result-note {
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
}

.chieu-mo__result-pity {
  color: var(--mineral-gold);
  font-size: var(--text-xs);
  font-weight: 700;
}
</style>
