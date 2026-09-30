<script setup lang="ts">
// SpellPathPanel plan muc 10/17/29 + node level (combat-skill-flow-element-
// power-dot-plan.md 6.2) -- bottom panel: chi tiet node dang CHON + nut
// mua/nang cap. Node nhieu cap hien thi `Cap x/max`, Power nhan moi cap
// + tong dang nhan, chi phi cap ke; nut "Linh Ngo" o level 0, "Nang
// Cap" tu level 1, trang thai "Toi da" khi dat maxLevel.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useProgressionActions } from '@/composables/useProgressionActions'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import type { BetaSkillTreeNode } from '@/core/betaScopeSkillDomain'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '@/data/progression/PhapTuNodes.builders'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { REALMS } from '@/data/realms/realm'
import type { NodePrerequisite, ProgressionNode } from '@/core/progression/ProgressionNode'

const { t } = useI18n()

const props = defineProps<{
  node: ProgressionNode | null
  /** Canonical model row for `node` (betaSkillTreeFor). Optional: the
      parent passes its already-computed row; absent, the inspector
      resolves the row itself through the same ops read-model - it
      never calls a NodeSystem predicate either way. */
  row?: BetaSkillTreeNode | null
  purchased: boolean
  purchasable: boolean
  inBattle?: boolean
}>()

const emit = defineEmits<{ unlocked: [node: ProgressionNode] }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { purchaseNode, upgradeNode } = useProgressionActions()

const ELEMENT_ROOT_ID_SET = new Set<string>(Object.values(PHAP_TU_ELEMENT_ROOT_IDS))

// BETA SCOPE LOCK v2 (phase-2) -- element roots are NEVER an
// individual purchase: they commit only inside the atomic
// commitFiveElementInitiation transaction (the element pick step of
// the initiation ritual). This affordance renders inert - the
// purchasable flag the parent computes already excludes roots.
const isElementRoot = computed(() => props.node !== null && ELEMENT_ROOT_ID_SET.has(props.node.id))

// The canonical row: the parent's when supplied, else resolved through
// the ops read-model over the full registry (same authority).
const resolvedRow = computed<BetaSkillTreeNode | null>(() => {
  stateVersion.value

  if (props.row !== undefined && props.row !== null) {
    return props.row
  }

  if (!props.node) {
    return null
  }

  return (
    gameManager.progressionOps
      .betaSkillTreeFor(player.$state, gameManager.nodeRegistry.getAll())
      .nodes.find((entry) => entry.nodeId === props.node!.id) ?? null
  )
})

// Level hien tai / max / cost cap ke cua node dang chon - resolved by
// the model row, not re-derived here.
const level = computed(() => {
  stateVersion.value

  return resolvedRow.value?.level ?? 0
})

const maxLevel = computed(() => resolvedRow.value?.maxLevel ?? 1)

const nextCost = computed(() => {
  stateVersion.value

  return resolvedRow.value?.nextLevelCost ?? null
})

const upgradable = computed(() => {
  stateVersion.value

  return resolvedRow.value?.canUpgrade ?? false
})

const isMaxed = computed(() => level.value >= maxLevel.value && maxLevel.value > 1)

// M-QI-06 - effective ceiling for the selected node (level-gate caps);
// used only to decide whether the upgrade is gate-blocked - the
// `x/max` display stays authored.
const effectiveMax = computed(() => {
  stateVersion.value

  return resolvedRow.value?.effectiveMaxLevel ?? 1
})

// M-QI-06 - ONE prereq -> localized reason formatter shared by
// lockedReasons (level-0 purchase) and upgradeGateReasons (cap-
// blocked upgrade). Not a source of truth - a presentation of
// hasPrerequisite() outcomes.
function nodePrereqReason(prereq: NodePrerequisite): string {
  if (prereq.kind === 'node') {
    return t('panels.skillPath.nodeInspector.lockedReasons.prerequisiteNode', {
      name: gameManager.nodeRegistry.get(prereq.nodeId).name,
    })
  } else if (prereq.kind === 'realm') {
    // Three-path design (2026-09-25, ruling #16C) -- name the realm so a
    // dimmed node previews exactly where it opens ("mo o Kim Dan"). A stale
    // or unknown realm id falls back to the raw id instead of throwing.
    const realmName = REALMS.find((realm) => realm.id === prereq.realmId)?.name ?? prereq.realmId
    return t('panels.skillPath.nodeInspector.lockedReasons.realm', {
      realm: realmName,
    })
  } else if (prereq.kind === 'excludesNode') {
    return t('panels.skillPath.nodeInspector.lockedReasons.excludesNode', {
      name: gameManager.nodeRegistry.get(prereq.nodeId).name,
    })
  } else if (prereq.kind === 'nodeCount') {
    return t('panels.skillPath.nodeInspector.lockedReasons.nodeCount', {
      required: prereq.countRequired,
      total: prereq.nodeIds.length,
    })
  } else if (prereq.kind === 'skillCastCount') {
    const skillName = gameManager.skillManager.get(prereq.skillId)?.name ?? prereq.skillId
    const levelPart = prereq.level !== undefined
      ? t('panels.skillPath.nodeInspector.lockedReasons.skillLevel', { level: prereq.level })
      : undefined
    const countPart = prereq.count !== undefined
      ? t('panels.skillPath.nodeInspector.lockedReasons.skillCastCount', { count: prereq.count })
      : undefined
    const requirement = [levelPart, countPart]
      .filter(Boolean)
      .join(t('panels.skillPath.nodeInspector.lockedReasons.skillJoin'))

    return t('panels.skillPath.nodeInspector.lockedReasons.skill', {
      skill: skillName,
      requirement,
    })
  } else if (prereq.kind === 'techniqueRank') {
    return t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', {
      rank: prereq.rank,
    })
  } else if (prereq.kind === 'techniqueGrade') {
    return t('panels.skillPath.nodeInspector.lockedReasons.techniqueGrade', {
      grade: prereq.grade,
    })
  }

  return t('panels.skillPath.nodeInspector.lockedReasons.skillUpgrade')
}

// Ly do khoa -- gate verdicts read from the model row (its
// prerequisites/levelGates arrays preserve authored order, so row[i]
// pairs with node.prerequisites[i] for the reason text). KHONG phai
// nguon su that - the model is.
const lockedReasons = computed(() => {
  if (!props.node || !resolvedRow.value || props.purchased || props.purchasable || level.value >= 1) {
    return []
  }

  const row = resolvedRow.value
  const reasons: string[] = []

  // Phap Tu Reimagine -- element membership is not a prerequisite, so
  // authored gate rows cannot explain it; the model's scope-hidden
  // reason names it instead.
  if (row.reason === 'other-element-branch' && props.node.elementTag) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.elementMismatch', {
      element: ELEMENT_LABELS[props.node.elementTag],
    }))
  }

  // M3 -- way-membership gate is not a prerequisite either; surface the
  // real lock reason (normally the tree filter hides these nodes, but
  // the inspector still explains a stale/edge selection).
  if ((row.reason === 'foreign-stamp' || row.reason === 'non-beta-way') && props.node.requiredWay) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.wayMismatch'))
  }

  const cost = nextCost.value ?? props.node.insightCost

  if (player.skillInsight < cost) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.cost', {
      cost,
      current: player.skillInsight,
    }))
  }

  for (const [index, prereq] of (props.node.prerequisites ?? []).entries()) {
    if (row.prerequisites[index]?.met === false) {
      reasons.push(nodePrereqReason(prereq))
    }
  }

  return reasons
})

// M-QI-06 - upgrade-gate reasons: shown ONLY when the upgrade is
// gate-blocked (level >= 1, below authored max, at/above the
// effective cap). Renders the BINDING gate(s) - the same selection
// getBlockingNodeLevelGates owns (unmet relevant gates at the minimum
// atLevel), replayed over the model's gate rows - so frozen-surplus
// levels above the binding gate still explain themselves. Never a
// forecast of later gates.
const upgradeGateReasons = computed(() => {
  stateVersion.value

  if (!props.node || !resolvedRow.value || level.value < 1 || level.value >= maxLevel.value || level.value < effectiveMax.value) {
    return []
  }

  const authored = props.node.levelGates ?? []
  const unmet = authored
    .map((gate, index) => ({ authored: gate, row: resolvedRow.value!.levelGates[index] }))
    .filter(
      ({ authored, row }) =>
        row !== undefined &&
        !row.met &&
        authored.atLevel >= 2 &&
        authored.atLevel <= maxLevel.value,
    )

  if (unmet.length === 0) {
    return []
  }

  const minAtLevel = Math.min(...unmet.map(({ authored }) => authored.atLevel))

  return unmet
    .filter(({ authored }) => authored.atLevel === minAtLevel)
    .map(({ authored }) => nodePrereqReason(authored.prerequisite))
})

function onPurchase() {
  if (!props.node || !props.purchasable) {
    return
  }

  const node = props.node

  // Element root: not an ordinary purchase - the atomic initiation
  // transaction owns the commit (rendered unreachable by the
  // purchasable prop; this guard stays as the inert affordance).
  if (isElementRoot.value) {
    return
  }

  if (purchaseNode(node.id)) {
    emit('unlocked', node)
  }
}

function onUpgrade() {
  if (!props.node || !upgradable.value) {
    return
  }

  upgradeNode(props.node.id)
}
</script>

<template>
  <div class="node-inspector">
    <EmptyState v-if="!node" size="lg">{{ t('panels.skillPath.nodeInspector.empty') }}</EmptyState>

    <template v-else>
      <div class="node-inspector__header">
        <span class="node-inspector__name">{{ node.name }}</span>

        <!-- Badge `Cấp x/max` cho node nhiều cấp (plan §6.2). -->
        <span v-if="maxLevel > 1" class="node-inspector__level">{{ level }}/{{ maxLevel }}</span>

        <span
          class="node-inspector__state"
          :class="{ 'is-purchased': purchased, 'is-purchasable': !purchased && purchasable }"
        >
          {{ isMaxed
            ? t('panels.skillPath.nodeInspector.status.maxed')
            : purchased
              ? t('panels.skillPath.nodeInspector.status.purchased')
              : purchasable
                ? t('panels.skillPath.nodeInspector.status.purchasable')
                : t('panels.skillPath.nodeInspector.status.locked') }}
        </span>
      </div>

      <p v-if="node.description" class="node-inspector__desc">{{ node.description }}</p>

      <ul v-if="lockedReasons.length > 0 && level === 0" class="node-inspector__reasons">
        <li v-for="reason in lockedReasons" :key="reason">{{ reason }}</li>
      </ul>

      <!-- M-QI-06 - binding level-gate reasons (upgrade-blocked only). -->
      <div v-if="upgradeGateReasons.length > 0" class="node-inspector__gate-block">
        <p class="node-inspector__gate-header">
          {{ t('panels.skillPath.nodeInspector.upgradeGateHeader') }}
        </p>
        <ul class="node-inspector__gate-reasons">
          <li v-for="reason in upgradeGateReasons" :key="reason">{{ reason }}</li>
        </ul>
      </div>

      <div class="node-inspector__actions">
        <!-- Hide the cost content when it is already shown in the lock
             reason list above (2026-08-30 frontend-design pass: two spots
             repeated the same 'needs X Insight' text when a node was
             point-locked) - keep the empty span so the space-between
             layout with the button does not shift. M-QI-06: a
             gate-blocked level (nextCost null below authored max) never
             interpolates an upgrade cost either. -->
        <span class="node-inspector__cost">
          {{ lockedReasons.length > 0 && level === 0
            ? ''
            : level === 0
              ? t('panels.skillPath.nodeInspector.cost.initial', { cost: nextCost ?? node.insightCost })
              : isMaxed
                ? t('panels.skillPath.nodeInspector.cost.maxed')
                : nextCost === null
                  ? ''
                  : t('panels.skillPath.nodeInspector.cost.upgrade', { cost: nextCost }) }}
        </span>

        <GameButton
          v-if="level === 0"
          class="node-inspector__buy"
          size="sm"
          :disabled="!purchasable || inBattle"
          @click="onPurchase"
        >
          {{ t('panels.skillPath.nodeInspector.actions.unlock') }}
        </GameButton>

        <GameButton
          v-else-if="!isMaxed"
          class="node-inspector__buy"
          size="sm"
          :disabled="!upgradable || inBattle"
          @click="onUpgrade"
        >
          {{ t('panels.skillPath.nodeInspector.actions.upgrade') }}
        </GameButton>
      </div>
    </template>

  </div>
</template>

<style scoped>
.node-inspector {
  padding: 10px 14px;
  min-height: 64px;
  background: var(--ink-800);
  border-top: 1px solid var(--ink-line);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.node-inspector .empty-state {
  padding: 8px 0;
}

.node-inspector__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

/* Ten node la "hero" cua khoi inspector -- truoc day chi 14px, gan nhu
   cung co mo ta ben duoi (2026-08-30 frontend-design pass). */
.node-inspector__name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--chrome-100);
}

/* Badge `Cap x/max` -- node nhieu cap (plan 6.2). */
.node-inspector__level {
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--chrome-300) 55%, transparent);
  font-size: var(--text-xs);
  color: var(--chrome-100);
}

.node-inspector__state {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.node-inspector__state.is-purchased {
  color: var(--jade);
}

.node-inspector__state.is-purchasable {
  color: var(--chrome-100);
}

.node-inspector__desc {
  margin: 4px 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.node-inspector__reasons {
  margin: 4px 0;
  padding-left: 16px;
  font-size: var(--text-sm);
  color: var(--crimson);
}

.node-inspector__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
}

/* Dong chi phi dung ngay canh nut hanh dong -- nang co de dan mat toi
   quyet dinh thay vi chim cung co voi mo ta (2026-08-30 pass). */
.node-inspector__cost {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-secondary);
}

.node-inspector__buy {
  padding: 6px 16px;
  border: 1px solid var(--chrome-100);
}

.node-inspector__buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

</style>
