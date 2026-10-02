<script setup lang="ts">
// Scene 08 detail content for Chu Thien (zhou_tian): the next-step unit
// card plus the milestone line and the discovery-gated Nghich Chu Thien
// hidden block (HIDDEN-C / AUTH-2 port - renders only once revealed,
// attempt wiring preserved verbatim).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
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
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '@/data/realm/ZhouTian'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import type { BodyChapterModel } from './useBodySceneModel'
import type { BodyUnitView } from './bodySceneModel'
import BodyDetailPanel from './BodyDetailPanel.vue'

defineProps<{
  chapter: BodyChapterModel
  unit: BodyUnitView | null
}>()

const emit = defineEmits<{ invest: [] }>()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

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

const ownedEssence = computed(() => {
  stateVersion.value
  return gameManager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
})
const ownedStones = computed(() => {
  stateVersion.value
  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

// Eligible-but-undiscovered stays actionable: the lineage can open after
// 36/36 already landed; the first attempt writes the record itself.
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

// SS20 ignition feedback - a landed nghich step flashes the block once.
const ignitingNghich = ref(false)
let igniteNghichTimer: ReturnType<typeof setTimeout> | undefined

watch(() => nghichLevel.value, (now, before) => {
  if (now <= before) return
  ignitingNghich.value = true
  clearTimeout(igniteNghichTimer)
  igniteNghichTimer = setTimeout(() => {
    ignitingNghich.value = false
  }, 1400)
})

onBeforeUnmount(() => clearTimeout(igniteNghichTimer))
</script>

<template>
  <BodyDetailPanel
    :unit="unit"
    :cta-label="t('panels.realm.zhouTian.invest')"
    :chapter-unlocked="chapter.unlocked"
    :chapter-gate="t('panels.realm.zhouTian.locked')"
    @invest="emit('invest')"
  >
    <div
      v-if="nghichRevealed"
      class="zhou-tian-hidden body-refinement__tier--hidden zhou-tian-section__row--hidden"
      :class="{ 'zhou-tian-hidden--complete': !nghichActive && nghichMechanic, 'is-ignited': ignitingNghich }"
    >
      <div class="zhou-tian-hidden__head">
        <span class="zhou-tian-hidden__name">{{ t('hidden.foundation.nghichName') }}</span>
        <span class="zhou-tian-hidden__state">
          {{ nghichActive ? t('hidden.foundation.stateActive') : t('hidden.foundation.stateDone') }}
        </span>
      </div>

      <Bar :value="nghichLevel" :max="NGHICH_CHU_TIAN_TOTAL_STEPS" :height="5" />

      <p v-if="nghichActive" class="zhou-tian-hidden__detail">
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

      <div v-if="nghichActive" class="zhou-tian-hidden__attempt">
        <GameButton
          size="sm"
          :disabled="!canAttemptNghich"
          @click="attemptNghich"
        >
          {{ t('hidden.foundation.attempt') }}
        </GameButton>
      </div>
    </div>
  </BodyDetailPanel>
</template>

<style scoped>
.zhou-tian-hidden {
  padding: 8px 10px;
  border: 1px solid var(--hk-jade, var(--jade));
  border-radius: var(--hk-radius-sm, 6px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.zhou-tian-hidden--complete .zhou-tian-hidden__state {
  color: var(--hk-jade, var(--jade));
}
.zhou-tian-hidden.is-ignited {
  animation: body-ignite-flash 1400ms var(--hk-ease-standard, ease) 1;
}
@keyframes body-ignite-flash {
  0% { box-shadow: inset 0 0 0 0 var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  35% { box-shadow: inset 0 0 26px 4px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  100% { box-shadow: inset 0 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .zhou-tian-hidden.is-ignited { animation: none; }
}
.zhou-tian-hidden__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.zhou-tian-hidden__name {
  font-weight: 600;
  font-size: var(--text-md);
  color: var(--hk-text-primary, var(--chrome-100));
}
.zhou-tian-hidden__state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hk-jade, var(--jade));
}
.zhou-tian-hidden__detail {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.zhou-tian-hidden__attempt { display: flex; }
</style>
