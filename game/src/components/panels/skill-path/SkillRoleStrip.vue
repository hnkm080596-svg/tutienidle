<script setup lang="ts">
// P7-M4 - resolved-role display replacing the retired slot-selection
// surface. No slot count, no locked tiers, no equip/unequip.
//
// BETA SCOPE LOCK v2 (phase-2): the mortal precursor chooser is gone -
// the starter pick is fixed to 'linh_bao' at creation and the
// setMortalBasicSkill write admits only that id, so a repick affordance
// could only ever fail.
//
// BETA FE-CONTRACT sec.3 - the cards render the canonical combat rail
// read-model (progressionOps.betaCombatRolesFor): a scope-hidden entry
// never becomes a card, so the strip cannot re-emit a role the model
// hid (the third role is permanently scope-hidden in beta).
// Progression-locked roles still render muted via their empty card.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { usePlayerStore } from '@/stores/player'
import { specializationClaimingNodes } from '@/core/progression/NodeSystem'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { BetaCombatRole, BetaSkillTreeNode } from '@/core/betaScopeSkillDomain'
import type { Skill } from '@/core/skill/Skill'
import type { SkillSpecialization } from '@/core/skill/SkillSpecialization'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { selectSkillSpecialization } = useProgressionActions()
const { t } = useI18n()

const ROLE_LABELS: Partial<Record<BetaCombatRole, string>> = {
  basic: 'Cơ Bản',
  special: 'Đặc Biệt',
}

function roleLabel(role: BetaCombatRole): string {
  return ROLE_LABELS[role] ?? role
}

const roleRail = computed(() => {
  stateVersion.value

  return gameManager.progressionOps.betaCombatRolesFor(player.$state)
})

// BETA FE-CONTRACT (relayed scope): node ownership reads resolve
// through the canonical skill-tree model over the registry - level >= 1
// is the same owned check ownedNodeIds used to provide, without any
// NodeSystem predicate call in the component.
const nodeRows = computed(() => {
  stateVersion.value

  return new Map(
    gameManager.progressionOps
      .betaSkillTreeFor(player.$state, gameManager.nodeRegistry.getAll())
      .nodes.map((row: BetaSkillTreeNode) => [row.nodeId, row]),
  )
})

function owned(nodeId: string): boolean {
  return (nodeRows.value.get(nodeId)?.level ?? 0) >= 1
}

// Specialization writes reject mid-battle (ops gate) - the chips
// disable up front so the affordance doesn't look live.
const { isBattleInProgress: inBattle } = useTurnBattleInfo()

interface RoleCard {
  role: BetaCombatRole
  /** Display name (meta-resolved; falls back to the learned name). */
  name?: string
  /** Learned instance - present iff the role skill is learned. */
  skill?: Skill
  empty: boolean
}

// Cards come from the rail verdicts: scope-hidden roles are dropped,
// a null skillId renders the muted empty card, and a named skillId
// resolves its display name through the canonical meta table.
const roleCards = computed<RoleCard[]>(() =>
  roleRail.value
    .filter((entry) => entry.state !== 'scope-hidden')
    .map((entry) => {
      if (entry.skillId === null) {
        return { role: entry.role, empty: true }
      }

      const skill = gameManager.skillManager.get(entry.skillId)

      return {
        role: entry.role,
        name: turnSkillDisplayMetaOf(entry.skillId)?.name ?? skill?.name ?? entry.skillId,
        skill,
        empty: false,
      }
    }),
)

const openRole = ref<BetaCombatRole | null>(null)

function cardOf(role: BetaCombatRole): RoleCard | undefined {
  return roleCards.value.find((card) => card.role === role)
}

function skillOf(role: BetaCombatRole): Skill | undefined {
  return cardOf(role)?.skill
}

// A card opens when it has something to show beneath it: a def-backed
// card with a learned specialization-bearing skill opens its chips.
function roleHasPanel(role: BetaCombatRole): boolean {
  return (skillOf(role)?.specializations?.length ?? 0) > 0
}

function toggleRole(role: BetaCombatRole) {
  if (!roleHasPanel(role)) {
    return
  }

  openRole.value = openRole.value === role ? null : role
}

const openedSkill = computed(() => {
  if (openRole.value === null) {
    return undefined
  }

  return skillOf(openRole.value)
})

// Three-path design (2026-09-25) -- capstone/variant nodes own the
// claim on the specialization they select. A claimed-but-unowned spec
// renders locked instead of a chip that silently no-ops (the op
// rejects it anyway); unclaimed specs stay free-switch.
function specLocked(skillId: string, specId: string): boolean {
  // Reads the same ownership as the authoritative gate: any owned
  // claimant unlocks the spec, not just the first registry hit - the
  // model's level >= 1 is the owned check (nodeLevels authority).
  const claimants = specializationClaimingNodes(gameManager.nodeRegistry, skillId, specId)

  return claimants.length > 0 && !claimants.some((claimant) => owned(claimant.id))
}

function specTooltip(skill: Skill, spec: SkillSpecialization) {
  // Same plural-claimant + ownership read as specLocked: the locked
  // tooltip names an unowned claimant, and any owned claimant frees the spec.
  const claimants = specializationClaimingNodes(gameManager.nodeRegistry, skill.id, spec.id)

  const lockedClaimant = claimants.find((node) => !owned(node.id))
  const anyOwned = claimants.some((node) => owned(node.id))

  if (claimants.length > 0 && !anyOwned && lockedClaimant !== undefined) {
    const permanentlyExcluded = (lockedClaimant.prerequisites ?? []).some(
      (prereq) => prereq.kind === 'excludesNode' && owned(prereq.nodeId),
    )

    if (permanentlyExcluded) {
      return { title: spec.name, description: t('panels.skillPath.roleStrip.lockedByRival') }
    }

    return { title: spec.name, description: t('panels.skillPath.roleStrip.unlockedByNode', { name: lockedClaimant.name }) }
  }

  return { title: spec.name, description: spec.description }
}
</script>

<template>
  <div class="skill-role-strip">
    <div class="skill-roles">
      <button
        v-for="card in roleCards"
        :key="card.role"
        type="button"
        class="skill-role"
        :class="{ 'is-empty': card.empty, 'is-open': openRole === card.role }"
        :disabled="!roleHasPanel(card.role)"
        @click="toggleRole(card.role)"
      >
        <span class="skill-role__label">{{ roleLabel(card.role) }}</span>

        <template v-if="card.empty">
          <span class="skill-role__empty">—</span>
        </template>

        <template v-else>
          <!-- Phap Tu Reimagine (D17) -- the special card's tooltip must
               carry the authored Trang lines (cost %MaxLL + duration +
               effect + the Ho The consequence); the Skill description is
               the authored channel, previously dropped here. -->
          <SlotView
            class="skill-role__icon"
            :item="card.skill ?? null"
            :label="card.name ?? ''"
            :description="card.skill?.description"
          />
          <span v-if="card.skill" class="skill-role__level">
            Lv. {{ card.skill!.level }}/{{ card.skill!.maxLevel }}
          </span>
        </template>
      </button>
    </div>

    <!-- Specialization chips - under the opened role card only. -->
    <div
      v-if="openedSkill?.specializations?.length"
      class="role-specializations"
    >
      <Chip
        v-for="spec in openedSkill.specializations"
        :key="spec.id"
        class="role-specializations__btn"
        :active="openedSkill.selectedSpecializationId === spec.id"
        :disabled="inBattle || specLocked(openedSkill.id, spec.id)"
        v-tooltip="specTooltip(openedSkill, spec)"
        @click="selectSkillSpecialization(openedSkill.id, spec.id)"
      >
        {{ spec.name }}
      </Chip>
    </div>
  </div>
</template>

<style scoped>
.skill-role-strip {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-role {
  flex: 1 1 30%;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.skill-role:hover:not(:disabled) {
  border-color: var(--chrome-300);
}

.skill-role:disabled {
  cursor: default;
}

.skill-role.is-empty {
  opacity: 0.45;
}

.skill-role.is-open {
  border-color: var(--chrome-300);
}

.skill-role__label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.skill-role__icon {
  width: 100%;
}

.skill-role__level {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.skill-role__empty {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 10px 0;
}

.skill-role__dynamic {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
  padding: 10px 0;
}

.role-specializations {
  display: flex;
  gap: 4px;
  padding: 0 8px 6px;
}

.role-specializations__btn {
  flex: 1 1 auto;
  padding: 3px 6px;
  --chip-active-bg: var(--ink-700);
}

.role-specializations__btn.is-active {
  color: var(--paper-50);
}
</style>
