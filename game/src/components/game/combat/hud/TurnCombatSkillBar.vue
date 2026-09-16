<script setup lang="ts">
// Slice 7 (2026-09-04) — 3 nút cố định basic/special/ultimate cho
// turn-based manual cast. Entry thứ tự [basic, special, ultimate] từ
// buildTurnSkillPresentation (slotList). Slot không sẵn sàng bị DISABLE
// (chặn trước, spec Slice 7 §4). Targeting vẫn hoàn toàn tự động.
//
// Bảng 9.5 #5 (2026-09-07) — tên/tooltip skill thật: entry mang
// skillName/skillDescription từ TurnSkillDisplayMeta (mapping skillId →
// display metadata); fallback nhãn role (Thường/Đặc Biệt/Tuyệt Kỹ) khi
// id không có trong map. Tooltip qua tooltipOverride của CombatSkillSlot.
import { computed, onMounted } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import { useGameManager } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { isPhapTuNgoDao } from '@/core/phap-tu/PhapTuPath'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillDefinition, TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'
import type { TooltipContent } from '@/composables/useTooltip'

const ROLE_ORDER: readonly TurnSkillSlotRole[] = ['basic', 'special', 'ultimate']

const ROLE_LABELS: Record<TurnSkillSlotRole, string> = {
  basic: 'Thường',
  special: 'Đặc Biệt',
  ultimate: 'Tuyệt Kỹ',
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
const player = usePlayerStore()
const gameManager = useGameManager()
const {
  isAwaitingChoice,
  isBattleFighting,
  slotList,
  chooseSlot,
  dynamicBasicOptions,
  hasDynamicBasic,
  chooseDynamicBasic,
} = useTurnCombatManual()

// Phap Tu An (Task 16) — the path owns no active ultimate: the slot is
// the always-on dao passive ngo_dao_hon_don, rendered as a passive
// emblem (spec §3.3 — "NOT a button"; its agency lives in the
// multicast storm). The emblem tooltip explains basic-slot-only
// multicast — the one place the rule surfaces in combat.
// M4 (R6): the hidden way drives the emblem — the WAY is the durable
// check (accepts both the 'phap_tu_an' transition id and the post-M7
// collapsed 'phap_tu' path id).
const isAnPath = computed(() => isPhapTuNgoDao(player))

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

// Hien owns the basic slot via the orb picker — drop it from the role
// row while keeping the original slotList indices for special/ultimate.
const visibleSlots = computed(() =>
  ROLE_ORDER.map((role, index) => ({ role, index })).filter(
    ({ role }) => !(role === 'basic' && hasDynamicBasic.value),
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
  chooseSlot(role)
}
</script>

<template>
  <div v-if="visible" class="turn-combat-skill-bar">
    <div class="turn-combat-skill-bar__slots">
      <!-- Kiem Tu Reimagined — the hien orb picker OWNS the basic slot:
           provider.manualOptions() are the only legal manual picks. -->
      <template v-if="hasDynamicBasic">
        <button
          v-for="orb in dynamicBasicOptions"
          :key="orb.id"
          type="button"
          class="turn-combat-skill-bar__slot-button turn-combat-skill-bar__slot-button--orb"
          :class="{ 'is-tappable': isAwaitingChoice }"
          :disabled="!isAwaitingChoice"
          :aria-label="`Dùng ${orbLabel(orb)}`"
          @click="chooseDynamicBasic(orb.id)"
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
        </button>
      </template>

      <template v-for="slot in visibleSlots" :key="slot.role">
        <!-- Phap Tu An — ult slot is the dao passive emblem, never a
             button (no dead ult control; spec §3.3). -->
        <div
          v-if="slot.role === 'ultimate' && isAnPath"
          class="turn-combat-skill-bar__emblem"
          :aria-label="anEmblemMeta?.name ?? 'Ngộ Đạo Hỗn Độn'"
          v-tooltip="anEmblemTooltip"
        >
          <span class="turn-combat-skill-bar__emblem-name">{{ anEmblemMeta?.name ?? 'Ngộ Đạo Hỗn Độn' }}</span>
          <span class="turn-combat-skill-bar__emblem-tag">Bị Động</span>
        </div>

        <button
          v-else
          type="button"
          class="turn-combat-skill-bar__slot-button"
          :class="{ 'is-tappable': isTappable(entryAt(slot.index)) }"
          :disabled="!isTappable(entryAt(slot.index))"
          :aria-label="`Dùng ${ROLE_LABELS[slot.role]}`"
          @click="tapSlot(slot.role)"
        >
          <CombatSkillSlot
            :empty-label="ROLE_LABELS[slot.role]"
            :display-label="entryAt(slot.index).skillName"
            :remaining="entryAt(slot.index).cooldownRemaining"
            :total="entryAt(slot.index).cooldownTotal"
            :is-masked="entryAt(slot.index).state === 'cooldown'"
            :resource-cost="entryAt(slot.index).resourceCost"
            :is-insufficient-resource="entryAt(slot.index).state === 'blocked_resource'"
            :tooltip-override="tooltipFor(entryAt(slot.index))"
          />
        </button>
      </template>
    </div>

    <label class="turn-combat-skill-bar__mode-toggle">
      <input
        type="checkbox"
        :checked="isManualMode"
        @change="setManualMode(($event.target as HTMLInputElement).checked)"
      />
      <span>Thủ công</span>
    </label>

    <span v-if="isAwaitingChoice" class="turn-combat-skill-bar__awaiting">Đến lượt bạn — chọn kỹ năng</span>
  </div>
</template>

<style scoped>
.turn-combat-skill-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.turn-combat-skill-bar__slots {
  display: flex;
  gap: 8px;
}

.turn-combat-skill-bar__slot-button {
  position: relative;
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

/* Phap Tu An (Task 16) — passive emblem replaces the ult slot button:
   always-on dao passive, reads as an emblem not a disabled control. */
.turn-combat-skill-bar__emblem {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 56px;
  min-height: 56px;
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

.turn-combat-skill-bar__awaiting {
  font-size: var(--text-xs, 12px);
  color: var(--jade, #4caf50);
}
</style>
