<script setup lang="ts">
// SkillPathPanel.vue redesign (2026-08-20) — trung tâm panel cho path
// KHÔNG có Node Tree (Kiếm Tu/Phàm Nhân, xem SkillPathList.vue) — đọc
// thông tin kỹ năng ĐÃ có sẵn (cố định theo kit/Trảm). Nâng cấp bằng
// Cảm ngộ Kỹ năng (skill-insight-and-auto-combat-hud-plan.md mục 5)
// ÁP DỤNG CHO MỌI skill đã học, không riêng nhánh spell — khác
// NodeTreePanel.vue/NodeInspector.vue vốn là nơi MỞ node (unlock), còn
// đây là nơi NÂNG CẤP skill đã mở.
// M-QI-05 - Skill-typed detail surface for learned Skill templates
// (spec D7: native TurnSkillDefinition actions render in
// NativeCoreDetail instead - no pseudo-Skill projection here). Level
// reads are canonical Core Node levels via progressionOps.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Skill } from '@/core/skill/Skill'
import { skillResourceTypeLabel } from '@/core/skill/SkillResourceLabels'
import { describeSkillMechanics } from '@/core/skill/SkillMechanicDescriptions'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import { CAST_LEVELING_THRESHOLDS } from '@/core/skill/SkillSystem'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const { t } = useI18n()

const props = defineProps<{
  skill: Skill | null
}>()

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

const resourceTypeLabel = computed(() => {
  return skillResourceTypeLabel(props.skill?.resourceType)
})

// M-QI-05 / QI-D3 - the displayed level is the canonical Core Node
// level (nodeLevels[core_<id>]), not the frozen authored Skill.level.
const currentLevel = computed(() => {
  stateVersion.value

  return props.skill
    ? Math.max(1, gameManager.progressionOps.getSkillLevel(props.skill.id, player.$state))
    : 0
})

const isMaxLevel = computed(() => !!props.skill && currentLevel.value >= props.skill.maxLevel)

// Task 12 (2026-09-03) — dòng cơ chế engine (hitCount/spread/zone/
// add_stack/remove_buff/stacksPerAffectedTarget) không có trong
// description tự do; helper thuần core-no-i18n trả text qua buff
// registry labels (buff name + ELEMENT_LABELS — cùng nguồn nhãn data).
const mechanicLines = computed(() => {
  stateVersion.value

  return props.skill ? describeSkillMechanics(props.skill, BUFF_REGISTRY) : []
})

const upgradeCost = computed(() => {
  stateVersion.value

  if (!props.skill) {
    return undefined
  }

  return gameManager.progressionOps.getSkillCoreUpgradeCost(props.skill.id, player.$state)
})

const canUpgrade = computed(() => {
  stateVersion.value

  return upgradeCost.value !== undefined && player.skillInsight >= upgradeCost.value
})

// Phap Tu Reimagined (Task 16) — cast-leveled skills (tram / linh_bao /
// huy_quyen) level by cast count, not Insight (the cast-channel core
// rejects Insight upgrades, INV-9): show the count -> next-level
// threshold instead of the upgrade button. player.skillCastCounts is
// the read-only mirror; the level read is the canonical core level.
const castProgress = computed(() => {
  stateVersion.value

  const thresholds = props.skill ? CAST_LEVELING_THRESHOLDS[props.skill.id] : undefined

  if (!props.skill || !thresholds) {
    return null
  }

  const count = player.skillCastCounts?.[props.skill.id] ?? 0
  const next = currentLevel.value < 2 ? thresholds.lv2 : currentLevel.value < 3 ? thresholds.lv3 : null

  return { count, next }
})

function onUpgrade() {
  if (!props.skill) {
    return
  }

  if (gameManager.progressionOps.levelUpSkill(props.skill.id, player.$state)) {
    bumpState()
  }
}
</script>

<template>
  <div class="skill-detail">
    <EmptyState v-if="!skill" size="lg">{{ t('panels.skillPath.detail.empty') }}</EmptyState>

    <template v-else>
      <h4 class="skill-detail__name">{{ skill.name }}</h4>

      <p v-if="skill.description" class="skill-detail__desc">{{ skill.description }}</p>

      <ul v-if="mechanicLines.length > 0" class="skill-detail__mechanics">
        <li v-for="line in mechanicLines" :key="line.key">{{ line.text }}</li>
      </ul>

      <div class="skill-detail__level">
        <span class="skill-detail__level-label">Lv. {{ currentLevel }}/{{ skill.maxLevel }}</span>

        <!-- Cast-leveled skill: progress to the next cast threshold
             instead of the Insight upgrade button (INV-9). -->
        <span v-if="castProgress" class="skill-detail__cast-progress">
          {{ castProgress.next !== null
            ? t('panels.skillPath.detail.castProgress', { count: castProgress.count, next: castProgress.next })
            : t('panels.skillPath.detail.castMaxed') }}
        </span>

        <GameButton
          v-else-if="!isMaxLevel"
          class="skill-detail__upgrade"
          variant="ghost"
          size="sm"
          :disabled="!canUpgrade"
          @click="onUpgrade"
        >
          {{ t('panels.skillPath.detail.upgrade', { cost: upgradeCost }) }}
        </GameButton>

        <span v-else class="skill-detail__level-label">{{ t('panels.skillPath.detail.maxed') }}</span>
      </div>

      <ul v-if="skill" class="skill-detail__rows">
        <StatRow :label="t('panels.skillPath.detail.cooldown')" bordered>{{ skill.cooldown }}s</StatRow>

        <StatRow
          v-if="skill.resourceType && skill.resourceType !== 'none' && (skill.cost ?? 0) > 0"
          :label="t('panels.skillPath.detail.cost')"
          bordered
        >
          {{ skill.cost }} {{ resourceTypeLabel }}
        </StatRow>

        <StatRow v-if="skill.execution?.kind === 'attack_speed'" :label="t('panels.skillPath.detail.type')" bordered>
          {{ t('panels.skillPath.detail.attackSpeed') }}
        </StatRow>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.skill-detail {
  padding: 4px;
}

.skill-detail .empty-state {
  padding: 40px 0;
}

.skill-detail__name {
  margin: 0 0 6px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--sys-text, var(--paper-text));
}

.skill-detail__desc {
  margin: 0 0 10px;
  font-size: var(--text-sm);
  color: var(--sys-text-muted, var(--paper-text-soft));
}

.skill-detail__mechanics {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: var(--text-sm);
  color: var(--sys-text-dim, var(--paper-text-muted));
}

.skill-detail__level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.skill-detail__level-label {
  flex: 0 0 auto;
  font-size: var(--text-sm);
  color: var(--sys-text-dim, var(--paper-text-muted));
}

.skill-detail__cast-progress {
  flex: 0 0 auto;
  font-size: var(--text-xs);
  color: var(--sys-warn, var(--gold-700));
}

.skill-detail__upgrade {
  flex: 0 0 auto;
  border-radius: 4px;
  color: var(--sys-warn, var(--gold-700));
  border-color: var(--sys-line, var(--chrome-500));
}

.skill-detail__upgrade:disabled {
  opacity: 0.4;
}

.skill-detail__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
}
</style>
