<script setup lang="ts">
// M-QI-05 / QI-D3 (D7) - detail surface for OWNED native cores:
// TurnSkillDefinition actions granted via kit roots (cuong_chien /
// tran_the) or way.coreSkillIds. Presentation comes entirely from the
// SkillPathEntry native view-model (name/desc/Lv/max/upgradeCost/
// canUpgrade) so no fake Skill objects exist and SkillDetailView stays
// Skill-typed. Native actions level only through the Insight channel
// (levelUpSkill) - there is no cast-progress lane here. Affordance
// styling mirrors SkillDetailView's upgrade/max rows.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NativeSkillPathEntry } from './SkillPathEntry'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { usePlayerStore } from '@/stores/player'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const { t } = useI18n()

const props = defineProps<{
  entry: NativeSkillPathEntry | null
}>()

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

// parity with the node-tree panels: the upgrade writes through
// progressionOps.levelUpSkill, which rejects mid-battle -- disable the
// affordance rather than dead-click.
const { isBattleInProgress: inBattle } = useTurnBattleInfo()

const isMaxLevel = computed(() => !!props.entry && props.entry.level >= props.entry.maxLevel)

function onUpgrade() {
  if (!props.entry) {
    return
  }

  if (gameManager.progressionOps.levelUpSkill(props.entry.id, player.$state)) {
    bumpState()
  }
}
</script>

<template>
  <div class="native-core-detail">
    <EmptyState v-if="!entry" size="lg">{{ t('panels.skillPath.detail.empty') }}</EmptyState>

    <template v-else>
      <h4 class="native-core-detail__name">{{ entry.name }}</h4>

      <p v-if="entry.description" class="native-core-detail__desc">{{ entry.description }}</p>

      <div class="native-core-detail__level">
        <span class="native-core-detail__level-label">Lv. {{ entry.level }}/{{ entry.maxLevel }}</span>

        <GameButton
          v-if="!isMaxLevel"
          class="native-core-detail__upgrade"
          variant="ghost"
          size="sm"
          :disabled="!entry.canUpgrade || inBattle"
          @click="onUpgrade"
        >
          {{ t('panels.skillPath.detail.upgrade', { cost: entry.upgradeCost }) }}
        </GameButton>

        <span v-else class="native-core-detail__level-label">{{ t('panels.skillPath.detail.maxed') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.native-core-detail {
  padding: 4px;
}

.native-core-detail .empty-state {
  padding: 40px 0;
}

.native-core-detail__name {
  margin: 0 0 6px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--paper-text);
}

.native-core-detail__desc {
  margin: 0 0 10px;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
}

.native-core-detail__level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.native-core-detail__level-label {
  flex: 0 0 auto;
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.native-core-detail__upgrade {
  flex: 0 0 auto;
  border-radius: 4px;
  color: var(--gold-700);
  border-color: var(--chrome-500);
}

.native-core-detail__upgrade:disabled {
  opacity: 0.4;
}
</style>
