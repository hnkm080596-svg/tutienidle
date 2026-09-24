<script setup lang="ts">
// M-F-CHU-THIEN - Chu Thien (Heavenly Circuit) block inside RealmPanel,
// the Truc Co normal-Body track. Manual invest only (the meridian
// pattern): the button is a presentation convenience wired to
// realmAdvanceOps.investBodyChapter - the chapter stays the sole
// authority (sequential gate, realm-derived capacity, Phap essence
// cost are all re-validated on every call). NO tick auto-invest.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getBodyChapterProgress, isBodyChapterUnlocked } from '@/core/realm/body/BodyProgressionSystem'
import { getZhouTianCapacity, isDaiChuThienReached, isTieuChuThienReached } from '@/core/realm/body/ZhouTianChapter'
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID, ZHOU_TIAN_REALM_ID, zhouTianStepCost } from '@/data/realm/ZhouTian'
import {
  getNghichChuTianMechanic,
  isNghichChuTianEligible,
  isNghichChuTianRevealed,
  NGHICH_CHU_TIAN_TOTAL_STEPS,
  nghichChuTianEssenceCost,
  nghichChuTianPityLimit,
  nghichChuTianStoneCost,
  nghichChuTianSuccessChance,
} from '@/core/realm/hidden/NghichChuTian'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import { REALMS } from '@/data/realms/realm'
import GameButton from '@/components/common/GameButton.vue'
import Bar from '@/components/common/primitives/Bar.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const chapterProgress = computed(() => {
  stateVersion.value

  return getBodyChapterProgress(player.$state, 'zhou_tian')
})

const capacity = computed(() => {
  stateVersion.value

  return getZhouTianCapacity(player.$state)
})

// Sequential unlock mirror: meridian chapter complete is the authored
// prerequisite (transitively covering body_refinement).
const unlocked = computed(() => {
  stateVersion.value

  return isBodyChapterUnlocked(player.$state, 'zhou_tian')
})

const complete = computed(() => {
  stateVersion.value

  return isDaiChuThienReached(player.$state)
})

const tieuReached = computed(() => {
  stateVersion.value

  return isTieuChuThienReached(player.$state)
})

const ownedEssence = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
})

const nextStepCost = computed(() => {
  stateVersion.value

  const completed = chapterProgress.value.completed
  return completed < capacity.value ? zhouTianStepCost(completed) : 0
})

// HIDDEN-C - Nghich Chu Thien (design sec.12): revealed only once the
// realm record is discovered OR the player is presently eligible (36/36
// + open lineage). Without an active lineage this stays hidden - no
// hint of the continuation (sec.12.1).
const nghichRevealed = computed(() => {
  stateVersion.value

  return isNghichChuTianRevealed(player.$state)
})

const nghichMechanic = computed(() => {
  stateVersion.value

  return getNghichChuTianMechanic(player.$state)
})

const nghichLevel = computed(() => nghichMechanic.value?.completed ?? 0)

const nghichPity = computed(() => nghichMechanic.value?.pityByLevel[nghichLevel.value] ?? 0)

const nghichCosts = computed(() => ({
  essence: nghichChuTianEssenceCost(nghichLevel.value),
  stones: nghichChuTianStoneCost(nghichLevel.value),
}))

const nghichChancePercent = computed(() =>
  Math.round(nghichChuTianSuccessChance(nghichLevel.value) * 100),
)

const nghichPityLimitNow = computed(() => nghichChuTianPityLimit(nghichLevel.value))

const ownedStones = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

// Eligible-but-undiscovered stays actionable: the lineage can open after
// 36/36 already landed, and no further invest will ever consume (36 = cap
// -> consumed 0 -> the post-invest discovery hook cannot re-fire). The
// first attempt writes the record itself (attempt auto-discovers).
const nghichActive = computed(() =>
  nghichMechanic.value?.active === true ||
  (nghichMechanic.value === undefined && isNghichChuTianEligible(player.$state)),
)

const canAttemptNghich = computed(() =>
  nghichActive.value
  && ownedEssence.value >= nghichCosts.value.essence
  && ownedStones.value >= nghichCosts.value.stones,
)

function attemptNghich(): void {
  const result = gameManager.realmAdvanceOps.attemptNghichChuTian(player.$state)

  // 'insufficient' can still mutate state: a first attempt auto-discovers
  // the record (discovery + mechanic install) before the cost check
  // fails. Only 'ineligible' and 'complete' provably write nothing.
  if (result.outcome !== 'ineligible' && result.outcome !== 'complete') {
    bumpState()
  }
}

const zhouTianRealmName = computed(() =>
  REALMS.find((realm) => realm.id === ZHOU_TIAN_REALM_ID)?.name ?? ZHOU_TIAN_REALM_ID,
)

const status = computed(() => {
  if (complete.value) return 'complete'
  if (!unlocked.value) return 'locked'
  if (capacity.value <= 0) return 'realm_locked'
  return 'active'
})

const stateLabel = computed(() => {
  switch (status.value) {
    case 'complete': return t('panels.realm.zhouTian.stateComplete')
    case 'active': return t('panels.realm.zhouTian.stateActive')
    case 'realm_locked': return t('panels.realm.zhouTian.stateRealmLocked')
    default: return t('panels.realm.zhouTian.stateLocked')
  }
})

// Presentation mirror of the chapter's invest preconditions -
// zhouTianChapter.invest re-validates all of them on click.
const canInvest = computed(() =>
  status.value === 'active'
  && ownedEssence.value >= nextStepCost.value
  && nextStepCost.value > 0,
)

function invest(): void {
  const consumed = gameManager.realmAdvanceOps.investBodyChapter(player.$state, 'zhou_tian')

  if (consumed > 0) {
    bumpState()
  }
}
</script>

<template>
  <section class="zhou-tian-section" :aria-label="t('panels.realm.zhouTian.title')">
    <div class="zhou-tian-section__summary">
      <span>{{ t('panels.realm.zhouTian.summary', { completed: chapterProgress.completed, total: chapterProgress.total }) }}</span>
      <span class="zhou-tian-section__state">{{ stateLabel }}</span>
    </div>

    <div
      class="zhou-tian-section__row"
      :class="`zhou-tian-section__row--${status}`"
    >
      <Bar
        class="zhou-tian-section__bar"
        :value="chapterProgress.completed"
        :max="capacity"
        :height="5"
      />

      <div class="zhou-tian-section__milestones">
        <span :class="{ 'zhou-tian-section__milestone--reached': tieuReached }">
          {{ t('panels.realm.zhouTian.tieuLabel') }}
        </span>
        <span :class="{ 'zhou-tian-section__milestone--reached': complete }">
          {{ t('panels.realm.zhouTian.daiLabel') }}
        </span>
      </div>

      <p v-if="status === 'locked'" class="zhou-tian-section__gate">
        {{ t('panels.realm.zhouTian.locked') }}
      </p>
      <p v-else-if="status === 'realm_locked'" class="zhou-tian-section__gate">
        {{ t('panels.realm.zhouTian.realmLocked', { realm: zhouTianRealmName }) }}
      </p>
      <p v-else-if="status === 'complete'" class="zhou-tian-section__complete">
        {{ t('panels.realm.zhouTian.complete') }}
      </p>

      <template v-else>
        <p class="zhou-tian-section__capacity">
          {{ t('panels.realm.zhouTian.capacity', { capacity }) }}
        </p>
        <div class="zhou-tian-section__invest">
          <GameButton
            size="sm"
            :disabled="!canInvest"
            @click="invest"
          >
            {{ t('panels.realm.zhouTian.invest') }}
          </GameButton>
          <span class="zhou-tian-section__owned">
            {{ t('panels.realm.zhouTian.owned', { count: ownedEssence }) }}
          </span>
          <span class="zhou-tian-section__owned">
            {{ t('panels.realm.zhouTian.stepCost', { cost: nextStepCost }) }}
          </span>
        </div>
      </template>

      <div
        v-if="nghichRevealed"
        class="zhou-tian-section__row zhou-tian-section__row--hidden"
        :class="{ 'zhou-tian-section__row--complete': !nghichActive && nghichMechanic }"
      >
        <div class="zhou-tian-section__nghich-summary">
          <span>{{ t('hidden.foundation.nghichName') }}</span>
          <span class="zhou-tian-section__state">
            {{ nghichActive ? t('hidden.foundation.stateActive') : t('hidden.foundation.stateDone') }}
          </span>
        </div>

        <Bar :value="nghichLevel" :max="NGHICH_CHU_TIAN_TOTAL_STEPS" :height="5" />

        <p v-if="nghichActive" class="zhou-tian-section__nghich-detail">
          {{
            t('hidden.foundation.detail', {
              essence: nghichCosts.essence,
              stones: nghichCosts.stones,
              chance: nghichChancePercent,
              pity: nghichPity,
              pityLimit: nghichPityLimitNow,
            })
          }}
        </p>

        <div v-if="nghichActive" class="zhou-tian-section__invest">
          <GameButton
            size="sm"
            :disabled="!canAttemptNghich"
            @click="attemptNghich"
          >
            {{ t('hidden.foundation.attempt') }}
          </GameButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zhou-tian-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zhou-tian-section__summary {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font: 700 var(--text-lg) var(--font-display);
  color: var(--paper-text);
}

.zhou-tian-section__state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.zhou-tian-section__row--complete .zhou-tian-section__state,
.zhou-tian-section__milestone--reached {
  color: var(--jade);
}

.zhou-tian-section__row {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.55;
}

.zhou-tian-section__row--active {
  opacity: 1;
  border-color: var(--chrome-300);
}

.zhou-tian-section__row--complete {
  opacity: 1;
  border-color: var(--jade);
}

.zhou-tian-section__bar {
  border-radius: 3px;
}

.zhou-tian-section__milestones {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.zhou-tian-section__gate {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--crimson);
}

.zhou-tian-section__complete {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--jade);
}

.zhou-tian-section__capacity {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.zhou-tian-section__invest {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.zhou-tian-section__owned {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.zhou-tian-section__row--hidden {
  margin-top: 4px;
  border-color: var(--violet, var(--ink-line-soft));
  opacity: 1;
}

.zhou-tian-section__nghich-summary {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--paper-text);
}

.zhou-tian-section__nghich-detail {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
