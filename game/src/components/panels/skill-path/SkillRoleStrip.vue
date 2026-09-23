<script setup lang="ts">
// P7-M4 - resolved-role display replacing the retired slot-selection
// surface. The three combat roles come straight from
// progressionOps.getResolvedSkillRoles - the same override-aware seam
// combat consumes, so what renders here is what fights. No slot count,
// no locked tiers, no equip/unequip.
//
// The ONLY write left in the strip: a MORTAL player picks which learned
// precursor fights as their basic (setMortalBasicSkill - the game's
// single role write, pre-path only). Sword ways show their provider
// label (Kiem Pho / Ngu Kiem Dao); special/ultimate that resolve to
// nothing render muted.
import { computed, ref } from 'vue'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { usePlayerStore } from '@/stores/player'
import { MORTAL_DEFAULT_BASIC_ID, MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'
import type { Skill } from '@/core/skill/Skill'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { selectSkillSpecialization, setMortalBasicSkill } = useProgressionActions()

type RoleKey = 'basic' | 'special' | 'ultimate'

const ROLE_KEYS: readonly RoleKey[] = ['basic', 'special', 'ultimate']
const ROLE_LABELS: Record<RoleKey, string> = {
  basic: 'Cơ Bản',
  special: 'Đặc Biệt',
  ultimate: 'Tuyệt Kỹ',
}

const roles = computed(() => {
  stateVersion.value

  return gameManager.progressionOps.getResolvedSkillRoles(player.$state)
})

// The chooser is mortal-only - the write op rejects post-path anyway,
// but the card shouldn't offer a dead affordance.
const isMortal = computed(() => player.cultivationPath === undefined)

const mortalChoices = computed<Skill[]>(() => {
  stateVersion.value

  return MORTAL_PRECURSOR_SKILL_IDS
    .map((id) => gameManager.skillManager.get(id))
    .filter((skill): skill is Skill => skill !== undefined)
})

interface RoleCard {
  key: RoleKey
  /** Display name (accessor-resolved: learned > template > id). */
  name?: string
  /** Learned instance - present iff the role def is learned. */
  skill?: Skill
  /** Provider-backed basic (sword ways) - display label, no def. */
  dynamicLabel?: string
  empty: boolean
}

const roleCards = computed<Record<RoleKey, RoleCard>>(() => {
  const resolved = roles.value
  const card = (entry: { name: string; skill?: Skill } | undefined, key: RoleKey): RoleCard =>
    entry === undefined
      ? { key, empty: true }
      : { key, name: entry.name, skill: entry.skill, empty: false }

  return {
    basic:
      resolved.basic.kind === 'dynamic'
        ? { key: 'basic', dynamicLabel: resolved.basic.label, empty: false }
        : { key: 'basic', name: resolved.basic.name, skill: resolved.basic.skill, empty: false },
    special: card(resolved.special, 'special'),
    ultimate: card(resolved.ultimate, 'ultimate'),
  }
})

const openRole = ref<RoleKey | null>(null)

function skillOf(key: RoleKey): Skill | undefined {
  return roleCards.value[key].skill
}

function isEmptyRole(key: RoleKey): boolean {
  return roleCards.value[key].empty
}

// A card opens when it has something to show beneath it: the mortal
// basic card opens the precursor chooser; a def-backed card with a
// learned specialization-bearing skill opens its chips.
function roleHasPanel(key: RoleKey): boolean {
  if (key === 'basic') {
    if (isMortal.value) {
      return mortalChoices.value.length > 0
    }
  }

  return (skillOf(key)?.specializations?.length ?? 0) > 0
}

function toggleRole(key: RoleKey) {
  if (!roleHasPanel(key)) {
    return
  }

  openRole.value = openRole.value === key ? null : key
}

const openedSkill = computed(() => {
  if (openRole.value === null) {
    return undefined
  }

  return skillOf(openRole.value)
})

function isPickedPrecursor(skillId: string): boolean {
  // Absent pick = the runtime's default basic.
  return (player.mortalBasicSkillId ?? MORTAL_DEFAULT_BASIC_ID) === skillId
}
</script>

<template>
  <div class="skill-role-strip">
    <div class="skill-roles">
      <button
        v-for="key in ROLE_KEYS"
        :key="key"
        type="button"
        class="skill-role"
        :class="{ 'is-empty': isEmptyRole(key), 'is-open': openRole === key }"
        :disabled="!roleHasPanel(key)"
        @click="toggleRole(key)"
      >
        <span class="skill-role__label">{{ ROLE_LABELS[key] }}</span>

        <template v-if="roleCards[key].dynamicLabel">
          <span class="skill-role__dynamic">{{ roleCards[key].dynamicLabel }}</span>
        </template>

        <template v-else-if="isEmptyRole(key)">
          <span class="skill-role__empty">—</span>
        </template>

        <template v-else>
          <SlotView
            class="skill-role__icon"
            :item="roleCards[key].skill ?? null"
            :label="roleCards[key].name ?? ''"
          />
          <span v-if="roleCards[key].skill" class="skill-role__level">
            Lv. {{ roleCards[key].skill!.level }}/{{ roleCards[key].skill!.maxLevel }}
          </span>
        </template>
      </button>
    </div>

    <!-- Mortal precursor chooser - under the opened basic card only. -->
    <div
      v-if="openRole === 'basic' && isMortal && mortalChoices.length"
      class="role-specializations"
    >
      <Chip
        v-for="skill in mortalChoices"
        :key="skill.id"
        class="role-specializations__btn"
        :active="isPickedPrecursor(skill.id)"
        v-tooltip="{ title: skill.name, description: skill.description }"
        @click="setMortalBasicSkill(skill.id)"
      >
        {{ skill.name }}
      </Chip>
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
        v-tooltip="{ title: spec.name, description: spec.description }"
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
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--sys-font-body, var(--font-body));
  color: var(--sys-text, var(--text-primary));
}

.skill-role:hover:not(:disabled) {
  border-color: var(--sys-text, var(--chrome-300));
}

.skill-role:disabled {
  cursor: default;
}

.skill-role.is-empty {
  opacity: 0.45;
}

.skill-role.is-open {
  border-color: var(--sys-text, var(--chrome-300));
}

.skill-role__label {
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
}

.skill-role__icon {
  width: 100%;
}

.skill-role__level {
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
}

.skill-role__empty {
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
  padding: 10px 0;
}

.skill-role__dynamic {
  font-size: var(--text-xs);
  color: var(--sys-text-muted, var(--paper-text-soft));
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
  --chip-active-bg: var(--sys-bg-1, var(--ink-700));
}

.role-specializations__btn.is-active {
  color: var(--sys-bg-0, var(--paper-50));
}
</style>
