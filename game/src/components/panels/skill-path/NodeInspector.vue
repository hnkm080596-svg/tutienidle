<script setup lang="ts">
// SpellPathPanel plan mục 10/17/29 + node level (combat-skill-flow-element-
// power-dot-plan.md §6.2) — bottom panel: chi tiết node đang CHỌN + nút
// mua/nâng cấp. Node nhiều cấp hiển thị `Cấp x/max`, Power nhận mỗi cấp
// + tổng đang nhận, chi phí cấp kế; nút "Lĩnh Ngộ" ở level 0, "Nâng
// Cấp" từ level 1, trạng thái "Tối đa" khi đạt maxLevel.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import {
  getNodeLevel,
  getNodeMaxLevel,
  getNextLevelCost,
  hasPrerequisite,
  canUpgradeNode,
  isNodeElementActive,
  isNodeRouteActive,
  nodeWayApplies,
} from '@/core/progression/NodeSystem'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '@/data/progression/PhapTuNodes.builders'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import type { ElementType } from '@/core/element/ElementType'
import type { SpellPathRoute } from '@/core/phap-tu/PhapTuState'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

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
const { purchaseNode, upgradeNode, selectSpellPathElement } = useLoadoutActions()

const ELEMENT_ROOT_ID_SET = new Set<string>(Object.values(PHAP_TU_ELEMENT_ROOT_IDS))
const SPELL_PATH_ROUTE_IDS: readonly SpellPathRoute[] = ['dot', 'no']

// Task 16 — element roots are NOT purchasable through purchaseNode()
// (the op rejects them): clicking one opens the blocking route pick,
// and the atomic selectSpellPathElement() transaction commits
// element+route together (INV-13 — no element-without-route state).
const isElementRoot = computed(() => props.node !== null && ELEMENT_ROOT_ID_SET.has(props.node.id))

const routePickOpen = ref(false)

// Level hiện tại / max / cost cấp kế của node đang chọn.
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

// Lý do khoá — thuần suy ra từ hasPrerequisite() đã có (không đụng
// core), chỉ để hiện gợi ý, KHÔNG phải nguồn sự thật.
const lockedReasons = computed(() => {
  if (!props.node || props.purchased || props.purchasable || level.value >= 1) {
    return []
  }

  const reasons: string[] = []

  // Task 16 — element/route membership gates (isNodeElementActive /
  // isNodeRouteActive) are not prerequisites, so hasPrerequisite()
  // cannot explain them; surface the real lock reason here.
  if (!isNodeElementActive(player.$state, props.node) && props.node.elementTag) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.elementMismatch', {
      element: ELEMENT_LABELS[props.node.elementTag],
    }))
  }

  if (!isNodeRouteActive(player.$state, props.node) && props.node.routeTag) {
    reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.routeMismatch', {
      route: t(`panels.nodeTree.routes.${props.node.routeTag}`),
    }))
  }

  // M3 — way-membership gate is not a prerequisite either; surface the
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
    if (hasPrerequisite(player.$state, prereq)) {
      continue
    }

    if (prereq.kind === 'node') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.prerequisiteNode', {
        name: gameManager.nodeRegistry.get(prereq.nodeId).name,
      }))
    } else if (prereq.kind === 'realm') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.realm'))
    } else if (prereq.kind === 'excludesNode') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.excludesNode', {
        name: gameManager.nodeRegistry.get(prereq.nodeId).name,
      }))
    } else if (prereq.kind === 'nodeCount') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.nodeCount', {
        required: prereq.countRequired,
        total: prereq.nodeIds.length,
      }))
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

      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.skill', {
        skill: skillName,
        requirement,
      }))
    } else if (prereq.kind === 'kiemDaoBelowCap') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.kiemDaoCap'))
    } else if (prereq.kind === 'techniqueRank') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', {
        rank: prereq.rank,
      }))
    } else if (prereq.kind === 'techniqueGrade') {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.techniqueGrade', {
        grade: prereq.grade,
      }))
    } else {
      reasons.push(t('panels.skillPath.nodeInspector.lockedReasons.skillUpgrade'))
    }
  }

  return reasons
})

function onPurchase() {
  if (!props.node || !props.purchasable) {
    return
  }

  // Element root → the blocking route pick collects the second half of
  // the atomic commit (spec §3.3: "blocking choice, no dismiss").
  if (isElementRoot.value) {
    routePickOpen.value = true
    return
  }

  const node = props.node

  if (purchaseNode(node.id)) {
    emit('unlocked', node)
  }
}

function onRoutePick(route: SpellPathRoute) {
  const node = props.node

  routePickOpen.value = false

  if (!node?.elementTag) {
    return
  }

  if (selectSpellPathElement(node.elementTag, route)) {
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

      <div class="node-inspector__actions">
        <!-- Ẩn NỘI DUNG chi phí khi ĐÃ hiện trong danh sách lý do khoá
             phía trên (2026-08-30 frontend-design pass: 2 chỗ cùng nói
             "Cần X Cảm Ngộ" khi node đang khoá vì thiếu điểm) — giữ span
             rỗng để layout space-between với nút không bị lệch. -->
        <span class="node-inspector__cost">
          {{ lockedReasons.length > 0 && level === 0
            ? ''
            : level === 0
              ? t('panels.skillPath.nodeInspector.cost.initial', { cost: nextCost ?? node.insightCost })
              : isMaxed
                ? t('panels.skillPath.nodeInspector.cost.maxed')
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

    <!-- Blocking route pick (spec §3.3 + plan Task 16: "blocking
         choice, no dismiss") — element+route commit atomically via
         selectSpellPathElement; the modal only collects input, it is not
         the guarantee. No cancel: the element root was clicked
         deliberately, the route half is mandatory. -->
    <Teleport to="body">
      <div v-if="routePickOpen" class="route-pick" :style="{ zIndex: OVERLAY_LAYERS.modal }">
        <section class="route-pick__card" role="alertdialog" aria-modal="true">
          <h3 class="route-pick__title">{{ t('panels.skillPath.nodeInspector.routePick.title') }}</h3>
          <p class="route-pick__hint">{{ t('panels.skillPath.nodeInspector.routePick.hint') }}</p>

          <div class="route-pick__options">
            <GameButton
              v-for="route in SPELL_PATH_ROUTE_IDS"
              :key="route"
              class="route-pick__option"
              variant="ghost"
              @click="onRoutePick(route)"
            >
              <span class="route-pick__option-name">{{ t(`panels.nodeTree.routes.${route}`) }}</span>
              <span class="route-pick__option-desc">{{ t(`panels.skillPath.nodeInspector.routePick.${route}Desc`) }}</span>
            </GameButton>
          </div>
        </section>
      </div>
    </Teleport>
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

/* Tên node là "hero" của khối inspector — trước đây chỉ 14px, gần như
   cùng cỡ mô tả bên dưới (2026-08-30 frontend-design pass). */
.node-inspector__name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--chrome-100);
}

/* Badge `Cấp x/max` — node nhiều cấp (plan §6.2). */
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

/* Dòng chi phí đứng ngay cạnh nút hành động — nâng cỡ để dẫn mắt tới
   quyết định thay vì chìm cùng cỡ với mô tả (2026-08-30 pass). */
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

/* Blocking route pick — no dismiss affordance by design (spec §3.3);
   the card itself is a plain overlay since ConfirmModal always renders
   a cancel action. */
.route-pick {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 62%, transparent);
}

.route-pick__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, 88vw);
  padding: 20px 24px;
  background: var(--ink-800);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-md);
}

.route-pick__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--chrome-100);
}

.route-pick__hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.route-pick__options {
  display: flex;
  gap: 10px;
}

.route-pick__option {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  text-align: left;
}

.route-pick__option-name {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--gold-700);
}

.route-pick__option-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>
