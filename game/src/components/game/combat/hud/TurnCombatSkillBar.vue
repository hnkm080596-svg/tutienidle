<script setup lang="ts">
// Slice 7 (2026-09-04) - role buttons for turn-based manual cast.
// BETA FE-CONTRACT sec.3: the rail shape comes from the canonical
// read-model progressionOps.betaCombatRolesFor - an entry with state
// 'scope-hidden' is absent from the rail entirely (the ultimate role
// is permanently scope-hidden in beta; never a locked or empty slot).
// Live slot state (ready/cooldown/empty) still comes from
// buildTurnSkillPresentation via slotList.
//
// Bang 9.5 #5 (2026-09-07) - real skill names/tooltips: entries carry
// skillName/skillDescription from TurnSkillDisplayMeta; the role label
// (Common/Special) is the empty-slot fallback. Tooltips go through
// CombatSkillSlot's tooltipOverride.
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { BetaPrecursorSurfaceId } from '@/core/betaScopeSkillDomain'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'
import type { TooltipContent } from '@/composables/useTooltip'
import { useAudioStore } from '@/stores/audio'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()

// Scene 13 spec: role orbs ride inside the skill-orb-frame chrome ring;
// the auto/manual toggle wears the toggle-track + slider-thumb chrome.
const skillOrbFrameUrl = hkChromeUrl('skill-orb-frame')
const toggleTrackUrl = hkChromeUrl('toggle-track')
const sliderThumbUrl = hkChromeUrl('slider-thumb')
const toggleChromeStyle = computed<Record<string, string> | undefined>(() =>
  toggleTrackUrl && sliderThumbUrl
    ? {
        '--hk-toggle-track': `url("${toggleTrackUrl}")`,
        '--hk-slider-thumb': `url("${sliderThumbUrl}")`,
      }
    : undefined,
)

function roleLabel(role: TurnSkillSlotRole): string {
  return t(`combat.overlay.skillBar.roles.${role}`)
}

// Bảng 9.5 #5 — nhãn hiển thị do CombatSkillSlot tự resolve qua
// displayLabel prop (skillName → fallback emptyLabel). Bar chỉ truyền
// metadata; tooltip qua tooltipFor() bên dưới.
function tooltipFor(entry: TurnSkillPresentationEntry): TooltipContent | undefined {
  if (!entry.skillName || !entry.skillDescription) {
    return undefined
  }

  return { title: entry.skillName, description: entry.skillDescription }
}

// Slice 7 master plan Task 9 — mode toggle đọc/ghi ui.combatInputMode
// (persist per-device), đồng bộ GameManager flag (plain class, không
// import Pinia — UI layer gọi setter, cùng pattern battleRunMode).
const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const {
  isAwaitingChoice,
  isBattleFighting,
  slotList,
  chooseSlot,
  dynamicBasicOptions,
  hasDynamicBasic,
  chooseDynamicBasic,
} = useTurnCombatManual()

// BETA FE-CONTRACT sec.3 - the combat rail read-model. Rendered only:
// entries with state 'scope-hidden' never reach the DOM.
const roleRail = computed(() => {
  stateVersion.value

  return gameManager.progressionOps.betaCombatRolesFor(player.$state)
})

// The two precursor combat surfaces (the sword orb picker and the An
// dao emblem) are verdicts on betaCombatSurfacesFor: they render only
// on an 'available' verdict and stay scope-hidden for every beta
// player shape.
const combatSurfaces = computed(() => {
  stateVersion.value

  return gameManager.progressionOps.betaCombatSurfacesFor(player.$state)
})

function surfaceAvailable(surface: BetaPrecursorSurfaceId): boolean {
  return (
    combatSurfaces.value.find((verdict) => verdict.surface === surface)?.state ===
    'available'
  )
}

const showOrbPicker = computed(
  () => hasDynamicBasic.value && surfaceAvailable('sword-dynamic-basic'),
)

// Phap Tu An (Task 16) - the ngo_dao_hon_don passive emblem is its own
// surface, not a role button; it renders only while its verdict is
// 'available'.
const showAnEmblem = computed(() => surfaceAvailable('an-ultimate-emblem'))

const anEmblemMeta = computed(() => turnSkillDisplayMetaOf('ngo_dao_hon_don'))

const anEmblemTooltip = computed<TooltipContent | undefined>(() => {
  const meta = anEmblemMeta.value

  return meta ? { title: meta.name, description: meta.description } : undefined
})

const isManualMode = computed(() => ui.combatInputMode === 'manual')

function setManualMode(enabled: boolean): void {
  ui.setCombatInputMode(enabled ? 'manual' : 'auto')

  gameManager.setBattleManualMode(enabled)
}

// Sync persisted mode → GameManager khi bar mount lần đầu (reload page:
// ui flag persist, GameManager flag mặc định false).
onMounted(() => {
  gameManager.setBattleManualMode(ui.combatInputMode === 'manual')
})

const visible = computed(() => isBattleFighting.value)

const SLOT_EMPTY: TurnSkillPresentationEntry = {
  skillId: '',
  cooldownRemaining: 0,
  cooldownTotal: 0,
  resourceCost: 0,
  state: 'empty',
}

function entryAt(index: number): TurnSkillPresentationEntry {
  return slotList.value[index] ?? SLOT_EMPTY
}

// Each rail entry's index is its slotList index (the model always
// emits [basic, special, ultimate] in order). Scope-hidden entries
// render nothing; when the orb picker owns the basic slot the basic
// role slot drops out of the row.
const visibleSlots = computed(() =>
  roleRail.value
    .map((entry, index) => ({ role: entry.role, index, state: entry.state }))
    .filter(
      (slot) =>
        slot.state !== 'scope-hidden' && !(slot.role === 'basic' && showOrbPicker.value),
    ),
)

// Kiem Tu Reimagined Task 7 — orb display names come from
// TurnSkillDisplayMeta (synced to the authored table). Fallback to the
// raw id only keeps an un-authored def visible rather than blank.
function orbLabel(def: TurnSkillDefinition): string {
  return turnSkillDisplayMetaOf(def.id)?.name ?? def.id
}

function orbTooltip(def: TurnSkillDefinition): TooltipContent | undefined {
  const meta = turnSkillDisplayMetaOf(def.id)

  return meta ? { title: meta.name, description: meta.description } : undefined
}

function isTappable(entry: TurnSkillPresentationEntry): boolean {
  return entry.state === 'ready' && isAwaitingChoice.value
}

function tapSlot(role: TurnSkillSlotRole): void {
  // W7: landed manual picks cue combat.select (the composable's reject
  // path owns ui.error).
  if (isAwaitingChoice.value) {
    useAudioStore().cue('combat.select')
  }
  chooseSlot(role)
}

function onDynamicBasicClick(defId: string): void {
  if (isAwaitingChoice.value) {
    useAudioStore().cue('combat.select')
  }
  chooseDynamicBasic(defId)
}
</script>

<template>
  <div v-if="visible" class="turn-combat-skill-bar">
    <div class="turn-combat-skill-bar__slots">
      <!-- Kiem Tu Reimagined - the sword_pathway orb picker OWNS the basic slot:
           provider.manualOptions() are the only legal manual picks. The
           surface itself is verdict-gated (scope-hidden in beta). -->
      <template v-if="showOrbPicker">
        <button
          v-for="orb in dynamicBasicOptions"
          :key="orb.id"
          type="button"
          class="turn-combat-skill-bar__slot-button turn-combat-skill-bar__slot-button--orb"
          :class="{ 'is-tappable': isAwaitingChoice }"
          :disabled="!isAwaitingChoice"
          :aria-label="t('combat.overlay.skillBar.use', { name: orbLabel(orb) })"
          @click="onDynamicBasicClick(orb.id)"
        >
          <CombatSkillSlot
            :empty-label="orbLabel(orb)"
            :display-label="orbLabel(orb)"
            :remaining="0"
            :total="0"
            :is-masked="false"
            :resource-cost="orb.resourceCost ?? 0"
            :is-insufficient-resource="false"
            :tooltip-override="orbTooltip(orb)"
          />
          <img v-if="skillOrbFrameUrl" class="turn-combat-skill-bar__orb-frame" :src="skillOrbFrameUrl" alt="" aria-hidden="true" />
        </button>
      </template>

      <template v-for="slot in visibleSlots" :key="slot.role">
        <button
          type="button"
          class="turn-combat-skill-bar__slot-button"
          :class="{ 'is-tappable': isTappable(entryAt(slot.index)) }"
          :disabled="!isTappable(entryAt(slot.index))"
          :aria-label="t('combat.overlay.skillBar.use', { name: roleLabel(slot.role) })"
          @click="tapSlot(slot.role)"
        >
          <CombatSkillSlot
            :empty-label="roleLabel(slot.role)"
            :display-label="entryAt(slot.index).skillName"
            :display-icon="entryAt(slot.index).skillIcon"
            :remaining="entryAt(slot.index).cooldownRemaining"
            :total="entryAt(slot.index).cooldownTotal"
            :is-masked="entryAt(slot.index).state === 'cooldown'"
            :resource-cost="entryAt(slot.index).resourceCost"
            :is-insufficient-resource="entryAt(slot.index).state === 'blocked_resource'"
            :tooltip-override="tooltipFor(entryAt(slot.index))"
          />
          <img v-if="skillOrbFrameUrl" class="turn-combat-skill-bar__orb-frame" :src="skillOrbFrameUrl" alt="" aria-hidden="true" />
        </button>
      </template>

      <!-- Phap Tu An - the dao passive emblem is a verdict-gated
           surface, never a button (spec S3.3). -->
      <div
        v-if="showAnEmblem"
        class="turn-combat-skill-bar__emblem"
        :aria-label="anEmblemMeta?.name ?? 'Ngộ Đạo Hỗn Độn'"
        v-tooltip="anEmblemTooltip"
      >
        <span class="turn-combat-skill-bar__emblem-name">{{ anEmblemMeta?.name ?? 'Ngộ Đạo Hỗn Độn' }}</span>
        <span class="turn-combat-skill-bar__emblem-tag">{{ t('combat.overlay.skillBar.passiveTag') }}</span>
      </div>
    </div>

    <label class="turn-combat-skill-bar__mode-toggle" :class="{ 'has-hk-toggle': Boolean(toggleChromeStyle) }" :style="toggleChromeStyle">
      <input
        type="checkbox"
        :checked="isManualMode"
        @change="setManualMode(($event.target as HTMLInputElement).checked)"
      />
      <span>{{ t('combat.overlay.skillBar.manualToggle') }}</span>
    </label>

    <span v-if="isAwaitingChoice" class="turn-combat-skill-bar__awaiting">{{ t('combat.overlay.skillBar.awaitingChoice') }}</span>
  </div>
</template>

<style scoped>
.turn-combat-skill-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.turn-combat-skill-bar__slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* The button owns the slot's footprint: SlotView inside is
   width:100%+aspect-ratio:1 of a shrink-to-fit parent, so without an
   explicit size here the whole control collapses to ~2x2px. */
.turn-combat-skill-bar__slot-button {
  position: relative;
  flex: none;
  width: var(--combat-skill-slot-size, 64px);
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.turn-combat-skill-bar__slot-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.turn-combat-skill-bar__slot-button.is-tappable {
  outline: 2px solid var(--jade, #4caf50);
  outline-offset: 2px;
}

/* skill-orb-frame chrome ring -- slightly oversized so the ring hugs the
   slot edge; purely decorative, never intercepts the button. */
.turn-combat-skill-bar__orb-frame {
  position: absolute;
  inset: -7%;
  width: 114%;
  height: 114%;
  object-fit: fill;
  pointer-events: none;
  z-index: 2;
}

/* Phap Tu An (Task 16) — passive emblem replaces the ult slot button:
   always-on dao passive, reads as an emblem not a disabled control. */
.turn-combat-skill-bar__emblem {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: var(--combat-skill-slot-size, 64px);
  min-height: var(--combat-skill-slot-size, 64px);
  padding: 4px 6px;
  border: 1px solid var(--gold-700, #d4a72c);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gold-700, #d4a72c) 14%, transparent);
  text-align: center;
}

.turn-combat-skill-bar__emblem-name {
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  color: var(--gold-700, #d4a72c);
  line-height: 1.2;
}

.turn-combat-skill-bar__emblem-tag {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, #999);
}

.turn-combat-skill-bar__mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #999);
  cursor: pointer;
}

/* toggle-track + slider-thumb chrome (scene 13 / settings grammar). */
.turn-combat-skill-bar__mode-toggle.has-hk-toggle input[type='checkbox'] {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  width: 46px;
  height: 23px;
  margin: 0;
  background: var(--hk-toggle-track) center / 100% 100% no-repeat;
  cursor: pointer;
}

.turn-combat-skill-bar__mode-toggle.has-hk-toggle input[type='checkbox']::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 3px;
  width: 19px;
  height: 19px;
  transform: translateY(-50%);
  background: var(--hk-slider-thumb) center / contain no-repeat;
  transition: left 0.16s ease;
}

.turn-combat-skill-bar__mode-toggle.has-hk-toggle input[type='checkbox']:checked::after {
  left: 24px;
}

.turn-combat-skill-bar__mode-toggle.has-hk-toggle input[type='checkbox']:focus-visible {
  outline: 2px solid var(--hk-gold, #d8b45a);
  outline-offset: 2px;
}

.turn-combat-skill-bar__awaiting {
  font-size: var(--text-xs, 12px);
  color: var(--jade, #4caf50);
  text-align: center;
}
</style>
