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
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID, ZHOU_TIAN_REALM_ID } from '@/data/realm/ZhouTian'
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
  && ownedEssence.value > 0
  && chapterProgress.value.completed < capacity.value,
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
        </div>
      </template>
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
  font: 700 var(--text-lg) var(--sys-font-display, var(--font-display));
  color: var(--sys-text, var(--paper-text));
}

.zhou-tian-section__state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sys-text-dim, var(--text-muted));
}

.zhou-tian-section__row--complete .zhou-tian-section__state,
.zhou-tian-section__milestone--reached {
  color: var(--sys-success, var(--jade));
}

.zhou-tian-section__row {
  padding: 8px 10px;
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0.55;
}

.zhou-tian-section__row--active {
  opacity: 1;
  border-color: var(--sys-text, var(--chrome-300));
}

.zhou-tian-section__row--complete {
  opacity: 1;
  border-color: var(--sys-success, var(--jade));
}

.zhou-tian-section__bar {
  border-radius: 3px;
}

.zhou-tian-section__milestones {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
}

.zhou-tian-section__gate {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--sys-danger, var(--crimson));
}

.zhou-tian-section__complete {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--sys-success, var(--jade));
}

.zhou-tian-section__capacity {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--sys-text-dim, var(--text-muted));
}

.zhou-tian-section__invest {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.zhou-tian-section__owned {
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
}
</style>
