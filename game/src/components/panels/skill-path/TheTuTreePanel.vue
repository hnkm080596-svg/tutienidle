<script setup lang="ts">
// The Tu beta (the-tu-body-pathway-design sec.59-61) - the body way's
// tree is NOT Ngu Kiem's evolution spine: TWO root cards (Cuong Chien /
// Tran The, an excludesNode mutex - the loser renders 'Da bo con duong
// nay' and is no longer a purchasable branch), each column reading
//   root -> -- Luyen Khi -- -> basic card + branch nodes
//       -> -- Truc Co --   -> special card + branch nodes
//       -> Kim Dan 'Phong an' placeholder (tree continues, no KD nodes).
// Skill cards carry role/realm/scaling headers per design sec.60 so the
// player reads the kit from the card. Pre-Truc Co the special card is a
// sealed silhouette (name shown as '???', mechanics locked - the realm
// gate itself still lives on the node's prerequisite, this is presentation).
// Same select contract as NodeTreePanel so NodeInspector purchases
// without a second seam.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { canPurchaseNode, getEffectiveNodeMaxLevel, getNodeLevel } from '@/core/progression/NodeSystem'
import { getSkillCoreLevel } from '@/core/progression/SkillCoreLevel'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

const props = defineProps<{
  selectedNodeId?: string | null
}>()

const emit = defineEmits<{
  select: [node: ProgressionNode, purchased: boolean, purchasable: boolean]
}>()

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// The beta layout is a fixed slot grid - node lookups by id, not a
// generic tree walk (the data topology is authored to match).
interface SkillCardDef {
  /** The purchasable major node the card selects (root basics select
      their root instead - the root grant delivers the core). */
  nodeId: string
  skillId: string
  scalingKeys: string[]
}

interface RootColumn {
  rootNodeId: string
  abandonedByNodeId: string
  basic: SkillCardDef
  basicBranchNodeIds: string[]
  special: SkillCardDef
  specialBranchNodeIds: string[]
}

const COLUMNS: RootColumn[] = [
  {
    rootNodeId: 'cuong_chien',
    abandonedByNodeId: 'tran_the',
    basic: { nodeId: 'cuong_chien', skillId: 'cuong_quyen', scalingKeys: ['might'] },
    basicBranchNodeIds: ['minor_trong_quyen', 'minor_pha_kinh'],
    special: { nodeId: 'major_loan_dau', skillId: 'loan_dau', scalingKeys: ['sacrifice', 'huyetCuong'] },
    specialBranchNodeIds: ['minor_huyet_sat', 'minor_cuong_y'],
  },
  {
    rootNodeId: 'tran_the',
    abandonedByNodeId: 'cuong_chien',
    basic: { nodeId: 'tran_the', skillId: 'tran_ap', scalingKeys: ['aoe', 'maxHp'] },
    basicBranchNodeIds: ['minor_trong_the', 'minor_tran_kinh'],
    special: { nodeId: 'major_phan_chan', skillId: 'phan_chan', scalingKeys: ['taunt', 'mark', 'reflect'] },
    specialBranchNodeIds: ['minor_chan_cot', 'minor_tran_an'],
  },
]

function nodeOf(nodeId: string): ProgressionNode | undefined {
  return gameManager.nodeRegistry.getAll().find(node => node.id === nodeId)
}

const tcReached = computed(() => {
  stateVersion.value
  return getRealmTier(player.realmId) >= getRealmTier('foundation_establishment')
})

const chosenRootId = computed(() => {
  stateVersion.value
  return COLUMNS.find(col => getNodeLevel(player.$state, col.rootNodeId) > 0)?.rootNodeId ?? null
})

function nodeState(nodeId: string) {
  stateVersion.value
  const node = nodeOf(nodeId)
  if (node === undefined) {
    return { node: undefined, level: 0, maxLevel: 0, purchased: false, purchasable: false }
  }
  const level = getNodeLevel(player.$state, node.id)
  return {
    node,
    level,
    maxLevel: getEffectiveNodeMaxLevel(player.$state, node),
    purchased: level >= 1,
    purchasable: canPurchaseNode(player.$state, node),
  }
}

function isAbandoned(col: RootColumn): boolean {
  stateVersion.value
  return getNodeLevel(player.$state, col.abandonedByNodeId) > 0
}

function coreLevel(skillId: string): number {
  stateVersion.value
  return getSkillCoreLevel(player.$state, skillId)
}

function selectNode(nodeId: string) {
  const state = nodeState(nodeId)
  if (state.node !== undefined) {
    emit('select', state.node, state.purchased, state.purchasable)
  }
}

function onCardClick(col: RootColumn, card: SkillCardDef) {
  // A sealed/abandoned special still selects its major node - the
  // inspector surfaces the realm/prerequisite lock reasons.
  selectNode(card.nodeId)
}
</script>

<template>
  <div class="the-tu-tree" role="tree" :aria-label="t('panels.nodeTree.branchLabels.theTu')">
    <div
      v-for="col in COLUMNS"
      :key="col.rootNodeId"
      class="the-tu-tree__column"
      :class="{ 'is-abandoned': isAbandoned(col) }"
    >
      <div v-if="isAbandoned(col)" class="the-tu-tree__abandoned">
        {{ t('panels.theTuTree.abandoned') }}
      </div>

      <!-- Root card - the mutex choice itself -->
      <button
        type="button"
        class="the-tu-tree__card the-tu-tree__card--root"
        :class="{
          'is-selected': props.selectedNodeId === col.rootNodeId,
          'is-owned': nodeState(col.rootNodeId).purchased,
          'is-chosen': chosenRootId === col.rootNodeId,
          'is-locked': !nodeState(col.rootNodeId).purchased && !nodeState(col.rootNodeId).purchasable,
        }"
        @click="selectNode(col.rootNodeId)"
      >
        <span class="the-tu-tree__card-name">{{ nodeOf(col.rootNodeId)?.name }}</span>
        <span class="the-tu-tree__card-kind">{{ t('panels.theTuTree.roles.root') }}</span>
      </button>

      <div class="the-tu-tree__separator"><span>{{ t('panels.theTuTree.realms.luyenKhi') }}</span></div>

      <!-- Basic skill card - granted by the root, level = core level -->
      <button
        type="button"
        class="the-tu-tree__card the-tu-tree__card--skill"
        :class="{
          'is-selected': props.selectedNodeId === col.rootNodeId,
          'is-owned': coreLevel(col.basic.skillId) > 0,
          'is-locked': !nodeState(col.rootNodeId).purchased,
        }"
        @click="onCardClick(col, col.basic)"
      >
        <span class="the-tu-tree__card-name">{{ turnSkillDisplayMetaOf(col.basic.skillId)?.name }}</span>
        <span class="the-tu-tree__card-kind">
          {{ t('panels.theTuTree.roles.basic') }} · {{ t('panels.theTuTree.realms.luyenKhi') }}
          <template v-if="coreLevel(col.basic.skillId) > 0"> · Lv{{ coreLevel(col.basic.skillId) }}</template>
        </span>
        <span v-for="key in col.basic.scalingKeys" :key="key" class="the-tu-tree__card-scaling">
          {{ t(`panels.theTuTree.scaling.${key}`) }}
        </span>
      </button>

      <div class="the-tu-tree__branch">
        <button
          v-for="nodeId in col.basicBranchNodeIds"
          :key="nodeId"
          type="button"
          class="the-tu-tree__card the-tu-tree__card--node"
          :class="{
            'is-selected': props.selectedNodeId === nodeId,
            'is-owned': nodeState(nodeId).purchased,
            'is-locked': !nodeState(nodeId).purchasable && !nodeState(nodeId).purchased,
          }"
          @click="selectNode(nodeId)"
        >
          <span class="the-tu-tree__card-name">{{ nodeOf(nodeId)?.name }}</span>
          <span class="the-tu-tree__card-level">
            {{ nodeState(nodeId).level }}/{{ nodeState(nodeId).maxLevel }}
          </span>
        </button>
      </div>

      <div class="the-tu-tree__separator"><span>{{ t('panels.theTuTree.realms.trucCo') }}</span></div>

      <!-- Special card - sealed silhouette before Truc Co -->
      <button
        type="button"
        class="the-tu-tree__card the-tu-tree__card--skill"
        :class="{
          'is-selected': props.selectedNodeId === col.special.nodeId,
          'is-owned': nodeState(col.special.nodeId).purchased,
          'is-sealed': !tcReached && !nodeState(col.special.nodeId).purchased,
          'is-locked': tcReached && !nodeState(col.special.nodeId).purchased && !nodeState(col.special.nodeId).purchasable,
        }"
        @click="onCardClick(col, col.special)"
      >
        <span class="the-tu-tree__card-name">
          {{ !tcReached && !nodeState(col.special.nodeId).purchased
            ? t('panels.theTuTree.sealedName')
            : turnSkillDisplayMetaOf(col.special.skillId)?.name }}
        </span>
        <span class="the-tu-tree__card-kind">
          {{ t('panels.theTuTree.roles.special') }} · {{ t('panels.theTuTree.realms.trucCo') }}
          <template v-if="coreLevel(col.special.skillId) > 0"> · Lv{{ coreLevel(col.special.skillId) }}</template>
        </span>
        <template v-if="!tcReached && !nodeState(col.special.nodeId).purchased">
          <span class="the-tu-tree__card-scaling">{{ t('panels.theTuTree.sealed') }}</span>
        </template>
        <template v-else>
          <span v-for="key in col.special.scalingKeys" :key="key" class="the-tu-tree__card-scaling">
            {{ t(`panels.theTuTree.scaling.${key}`) }}
          </span>
        </template>
      </button>

      <div class="the-tu-tree__branch">
        <button
          v-for="nodeId in col.specialBranchNodeIds"
          :key="nodeId"
          type="button"
          class="the-tu-tree__card the-tu-tree__card--node"
          :class="{
            'is-selected': props.selectedNodeId === nodeId,
            'is-owned': nodeState(nodeId).purchased,
            'is-locked': !nodeState(nodeId).purchasable && !nodeState(nodeId).purchased,
          }"
          @click="selectNode(nodeId)"
        >
          <span class="the-tu-tree__card-name">{{ nodeOf(nodeId)?.name }}</span>
          <span class="the-tu-tree__card-level">
            {{ nodeState(nodeId).level }}/{{ nodeState(nodeId).maxLevel }}
          </span>
        </button>
      </div>

      <div class="the-tu-tree__separator"><span>{{ t('panels.theTuTree.realms.kimDan') }}</span></div>

      <div class="the-tu-tree__card the-tu-tree__card--seal">
        <span class="the-tu-tree__card-name">{{ t('panels.theTuTree.realms.kimDan') }}</span>
        <span class="the-tu-tree__card-kind">{{ t('panels.theTuTree.sealedNext') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.the-tu-tree {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 18px;
  justify-content: center;
  overflow-y: auto;
  padding: 6px 2px;
}

.the-tu-tree__column {
  flex: 0 1 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.the-tu-tree__column.is-abandoned {
  opacity: 0.45;
}

.the-tu-tree__abandoned {
  padding: 4px 10px;
  border: 1px dashed var(--ink-line);
  border-radius: 6px;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.the-tu-tree__card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}

button.the-tu-tree__card:hover {
  border-color: var(--chrome-300);
}

.the-tu-tree__card--root {
  border-color: var(--gold-700);
}

.the-tu-tree__card--skill {
  border-style: double;
}

.the-tu-tree__card--node {
  padding: 7px 12px;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
}

.the-tu-tree__card.is-selected {
  border-color: var(--chrome-300);
  box-shadow: 0 0 0 1px var(--chrome-300);
}

.the-tu-tree__card.is-owned {
  background: color-mix(in srgb, var(--gold-700) 14%, var(--ink-800));
}

.the-tu-tree__card.is-chosen {
  border-color: var(--gold-500, var(--gold-700));
}

.the-tu-tree__card.is-locked,
.the-tu-tree__card.is-sealed {
  color: var(--paper-text-muted);
}

.the-tu-tree__card.is-sealed {
  background: repeating-linear-gradient(
    45deg,
    var(--ink-800),
    var(--ink-800) 10px,
    color-mix(in srgb, var(--ink-800) 85%, #000) 10px,
    color-mix(in srgb, var(--ink-800) 85%, #000) 20px
  );
}

.the-tu-tree__card-name {
  font-size: var(--text-sm);
  font-weight: 600;
}

.the-tu-tree__card-kind {
  font-size: var(--text-xs);
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.the-tu-tree__card-scaling {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.the-tu-tree__card-level {
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
}

.the-tu-tree__card--seal {
  border-style: dashed;
  color: var(--paper-text-muted);
  cursor: default;
}

.the-tu-tree__separator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--paper-eyebrow);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.the-tu-tree__separator::before,
.the-tu-tree__separator::after {
  content: '';
  flex: 1 1 auto;
  border-top: 1px solid var(--ink-line);
}

.the-tu-tree__branch {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 18px;
  border-left: 1px dashed var(--ink-line-soft);
  margin-left: 8px;
}
</style>
