import type { OrbId } from './KiemTuState'
import type { PlayerData } from '../player/Player'
import type { ActionTargeting, CombatVfxPresetId } from '../battle/CombatAction'
import { getRealmIndex } from '../realm/realmSystem'
import { unlockedOrbs } from '../../data/skill/KiemPhoOrbs'

// Kiem Tu Reimagined Task 4 (spec 2026-09-15 §4) — KiemPhoSystem: the
// hien battle-runtime matcher. Owns preset snapshot + cursor + cast log
// + tail-match. State here is BATTLE-RUNTIME only (A3): the preset is
// persisted on PlayerData.kiemTu.preset, the cursor/log are not — each
// battle starts at slot 1 with an empty log.
//
// The combo TABLE is data (Task 5, data/skill/KiemPhoCombos.ts) — this
// file never imports it (A6). recordCastAndMatch takes the table as a
// parameter so the mechanism stays below the content layer.

/** Spec §4.2 — combo definition shape. `presetId` is REQUIRED and
 *  unique per combo: the fired payload is the ONLY discovery signal
 *  (K11/INV-7) — two combos sharing a preset are indistinguishable.
 *  `name` is the Vietnamese readout presentation flashes on fire. */
export interface KiemPhoCombo {
  id: string
  name: string
  pattern: OrbId[]
  presetId: CombatVfxPresetId
  damage?: { multiplier: number }
  appliesBuff?: { definitionId: string; target: 'self' | 'target'; stacks?: number }
  targeting?: ActionTargeting
}

/** Spec §4.2 — the ONLY way a node may alter a combo. Run order is
 *  priority ASC then nodeId ASC — never purchase order (same build,
 *  same result regardless of history). apply() returns a DERIVED copy —
 *  mutating the canonical combo would leak the buff into later casts. */
export interface KiemPhoComboModifier {
  nodeId: string
  priority: number
  matches(combo: KiemPhoCombo): boolean
  apply(combo: KiemPhoCombo): KiemPhoCombo
}

export interface KiemPhoBattleState {
  /** Snapshot of PlayerData.kiemTu.preset at battle start. */
  preset: OrbId[]
  /** 0-based auto-cast cursor — each battle starts at 0. */
  cursor: number
  /** Last-5 orb cast log; cleared entirely on combo fire. */
  log: OrbId[]
  /** Realm-gated max combo length this battle (K12). */
  comboMaxLength: 3 | 4 | 5
}

/** K12 — combo length cap by realm: <3→3, 3..5→4, >=6→5. realmIndex is
 *  the existing 0-based index (mortal=0, qi_refining=1, ...). */
export function realmComboMax(realmIndex: number): 3 | 4 | 5 {
  if (realmIndex < 3) return 3
  if (realmIndex <= 5) return 4
  return 5
}

/** Preset legality (spec §6): 1..9 orbs, every orb unlocked at the
 *  player's realm. Enforced by the setKiemPhoPreset op (Task 7). */
export function validatePreset(preset: OrbId[], realmIndex: number): boolean {
  if (preset.length < 1 || preset.length > 9) return false
  const unlocked = new Set(unlockedOrbs(realmIndex))
  return preset.every(orb => unlocked.has(orb))
}

/** Battle-start snapshot. Hien-only — callers must check
 *  kiemTu.mode === 'hien' before constructing. */
export function initKiemPhoBattle(player: PlayerData): KiemPhoBattleState {
  const kiemTu = player.kiemTu
  return {
    preset: [...(kiemTu?.preset ?? [])],
    cursor: 0,
    log: [],
    comboMaxLength: realmComboMax(getRealmIndex(player.realmId)),
  }
}

/** Auto-cast pick (spec §4.1): preset[cursor], cursor advances mod
 *  preset.length. Manual picks do NOT call this — they leave the cursor
 *  where auto left it. */
export function nextOrb(state: KiemPhoBattleState): OrbId {
  const orb = state.preset[state.cursor % state.preset.length]!
  state.cursor = (state.cursor + 1) % state.preset.length
  return orb
}

const LOG_MAX = 5

function tailEquals(log: OrbId[], pattern: OrbId[]): boolean {
  if (pattern.length > log.length) return false
  const offset = log.length - pattern.length
  for (let i = 0; i < pattern.length; i++) {
    if (log[offset + i] !== pattern[i]) return false
  }
  return true
}

/** Append the cast orb to the log, then longest-first tail-match down
 *  to len 3, capped by realmComboMax. First match fires and CLEARS the
 *  whole log — a combo can never chain into a second combo on the same
 *  cast (one fire per cast by construction, spec §4.1).
 *
 *  `combos` is the authored table — injected, not imported (A6).
 *  `modifiers` are the purchased-node capstone hooks (spec §4.2): on a
 *  match they run sorted `priority ASC, nodeId ASC`, each `apply`
 *  receiving the running DERIVED copy — the canonical table entry is
 *  never mutated. */
export function recordCastAndMatch(
  state: KiemPhoBattleState,
  orb: OrbId,
  combos: readonly KiemPhoCombo[],
  modifiers: readonly KiemPhoComboModifier[] = [],
): KiemPhoCombo | null {
  state.log.push(orb)
  if (state.log.length > LOG_MAX) {
    state.log.splice(0, state.log.length - LOG_MAX)
  }

  const maxLen = Math.min(LOG_MAX, state.comboMaxLength)
  for (let len = maxLen; len >= 3; len--) {
    for (const combo of combos) {
      if (combo.pattern.length !== len) continue
      if (tailEquals(state.log, combo.pattern)) {
        state.log = []
        return applyModifiers(combo, modifiers)
      }
    }
  }
  return null
}

function applyModifiers(
  combo: KiemPhoCombo,
  modifiers: readonly KiemPhoComboModifier[],
): KiemPhoCombo {
  const ordered = [...modifiers].sort(
    (a, b) => a.priority - b.priority || a.nodeId.localeCompare(b.nodeId),
  )
  let derived: KiemPhoCombo = { ...combo, pattern: [...combo.pattern] }
  for (const modifier of ordered) {
    if (modifier.matches(derived)) {
      derived = modifier.apply(derived)
    }
  }
  return derived
}
