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
import {
  getNodeLevel,
  getNodeMaxLevel,
  getEffectiveNodeMaxLevel,
  getBlockingNodeLevelGates,
  hasPrerequisite,
  canUpgradeNode,
  isNodeElementActive,
  nodeWayApplies,
} from '@/core/progression/NodeSystem'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '@/data/progression/PhapTuNodes.builders'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { REALMS } from '@/data/realms/realm'
import type { NodePrerequisite, ProgressionNode } from '@/core/progression/ProgressionNode'

const { t } = useI18n()

const props = defineProps<{
  node: ProgressionNode | null
  purchased: boolean
  purchasable: boolean
}>()

const emit = defineEmits<{ unlocked: [node: ProgressionNode] }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { purchaseNode, upgradeNode, selectSpellPathElement } = useProgressionActions()

const ELEMENT_ROOT_ID_SET = new Set<string>(Object.values(PHAP_TU_ELEMENT_ROOT_IDS))

// Phap Tu Reimagine (spec D5) -- element roots are NOT purchasable
// through purchaseNode() (the op rejects them): clicking one commits
// the element directly via selectSpellPathElement() -- routes are
// retired, no pick modal.
const isElementRoot = computed(() => props.node !== null && ELEMENT_ROOT_ID_SET.has(props.node.id))

// Level hien tai / max / cost cap ke cua node dang chon.
const level = computed(() => {
  stateVersion.value

  return props.node ? getNodeLevel(player.$state, props.node.id) : 0
})

const maxLevel = computed(() => (props.node ? getNodeMaxLevel(props.node) : 1))

const nextCost = computed(() => {
  stateVersion.value

  if (!props.node) {
    return null
  }

  return gameManager.progressionOps.getNextNodeCost(props.node.id, player.$state) ?? null
})

const upgradable = computed(() => {
  stateVersion.value

  return props.node ? canUpgradeNode(player.$state, props.node) : false
})

const isMaxed = computed(() => level.value >= maxLevel.value && maxLevel.value > 1)

// M-QI-06 - effective ceiling for the selected node (level-gate caps);
// used only to decide whether the upgrade is gate-blocked - the
// `x/max` display stays authored.
const effectiveMax = computed(() => {
  stateVersion.value

  return props.node ? getEffectiveNodeMaxLevel(player.$state, props.node) : 1
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
  } else if (prereq.kind === 'kiemDaoBelowCap') {
    return t('panels.skillPath.nodeInspector.lockedReasons.kiemDaoCap')
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

// Ly do khoa -- thuan suy ra tu hasPrerequisite() da co (khong dung
// core), chi de hien goi y, KHONG phai nguon su that.
const lockedReasons = computed(() => {
  if (!props.node || props.purchased || props.purchasable || level.value >= 1) {
    return []
  }

  const reasons: string[] = []

  // Phap Tu Reimagine -- element membership (isNodeElementActive) is
  // not a prerequisite, so hasPrerequisite() cannot explain it;
  // surface the real lock reason here. Route membership is retired.
  if (!isNodeElementActive(player.$state, props.node) && props.node.elementTag) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.elementMismatch', {
      element: ELEMENT_LABELS[props.node.elementTag],
    }))
  }

  // M3 -- way-membership gate is not a prerequisite either; surface the
  // real lock reason (normally the tree filter hides these nodes, but
  // the inspector still explains a stale/edge selection).
  if (!nodeWayApplies(player.$state, props.node) && props.node.requiredWay) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.wayMismatch'))
  }

  const cost = nextCost.value ?? props.node.insightCost

  if (player.skillInsight < cost) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.cost', {
      cost,
      current: player.skillInsight,
    }))
  }

  for (const prereq of props.node.prerequisites ?? []) {
    if (!hasPrerequisite(player.$state, prereq)) {
      reasons.push(nodePrereqReason(prereq))
    }
  }

  return reasons
})

// M-QI-06 - upgrade-gate reasons: shown ONLY when the upgrade is
// gate-blocked (level >= 1, below authored max, at/above the
// effective cap). Renders the BINDING gate(s) via
// getBlockingNodeLevelGates - the same authority that sets the
// effective max - so frozen-surplus levels above the binding gate
// still explain themselves. Never a forecast of later gates.
const upgradeGateReasons = computed(() => {
  stateVersion.value

  if (!props.node || level.value < 1 || level.value >= maxLevel.value || level.value < effectiveMax.value) {
    return []
  }

  return getBlockingNodeLevelGates(player.$state, props.node).map((gate) =>
    nodePrereqReason(gate.prerequisite),
  )
})

function onPurchase() {
  if (!props.node || !props.purchasable) {
    return
  }

  const node = props.node

  // Element root -> element-only commit (spec D5); purchaseNode() does
  // not accept roots.
  if (isElementRoot.value) {
    if (node.elementTag && selectSpellPathElement(node.elementTag)) {
      emit('unlocked', node)
    }
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
          :disabled="!purchasable"
          @click="onPurchase"
        >
          {{ t('panels.skillPath.nodeInspector.actions.unlock') }}
        </GameButton>

        <GameButton
          v-else-if="!isMaxed"
          class="node-inspector__buy"
          size="sm"
          :disabled="!upgradable"
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
