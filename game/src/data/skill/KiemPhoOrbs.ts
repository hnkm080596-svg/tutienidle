import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { OrbId } from '../../core/kiem-tu/KiemTuState'
import { GRID_COLUMN_COUNT } from '../../core/battle/BattleGrid'

// Kiem Tu Reimagined Task 3 (spec 2026-09-15 §3) — the five Kiem Pho
// orbs. OrbId is canonically declared in KiemTuState.ts (Task 1) and
// re-exported here so data consumers import from the data layer.
// Orbs are kind:'physical' damage scaled off might — no cooldowns, no
// resource: the preset loop IS the pacing mechanism (spec §4.1).
//
// presetId choice (Kiem Pho Beta, design sec.3): the two beta orbs
// carry their authored stroke-identity presets (point->line->converge
// for Dam, crescent->arc->scar for Chem); Bo/Hat/Quet keep the
// generic 'slash' until their design window lands. DATA ONLY.
// Orb identity is player-known via the preset strip/picker (Task 7).
export type { OrbId }

export const ORB_UNLOCK_REALM: Record<OrbId, number> = {
  orb_dam: 1,   // qi_refining — path start
  orb_chem: 2,  // foundation_establishment
  orb_bo: 3,    // golden_core
  orb_hat: 4,   // nascent_soul
  orb_quet: 5,  // soul_transformation
}

/** Orbs the realm has unlocked, in unlock order. realmIndex is the
 *  existing 0-based realm index (mortal=0, qi_refining=1, ...). */
export function unlockedOrbs(realmIndex: number): OrbId[] {
  return (Object.keys(ORB_UNLOCK_REALM) as OrbId[]).filter(
    orb => ORB_UNLOCK_REALM[orb] <= realmIndex,
  )
}

export const KIEM_PHO_ORBS: Record<OrbId, TurnSkillDefinition> = {
  orb_dam: {
    id: 'orb_dam',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
    targeting: { shape: 'single' },
    presetId: 'kiem_orb_dam',
  },
  orb_chem: {
    id: 'orb_chem',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1.2, levelScaling: 0.05 },
    targeting: { shape: 'single' },
    appliesAilments: [{ buffDefinitionId: 'kiem_thuong', chance: 1, stacks: 1 }],
    presetId: 'kiem_orb_chem',
  },
  orb_bo: {
    id: 'orb_bo',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1.8, levelScaling: 0.05 },
    targeting: { shape: 'single' },
    // Simplest existing defense-down lever (spec §3: reuse, no new
    // mechanic) — suy_nhuoc: defense -25%, 5 turns, refresh.
    appliesAilments: [{ buffDefinitionId: 'suy_nhuoc', chance: 1, stacks: 1 }],
    presetId: 'slash',
  },
  orb_hat: {
    id: 'orb_hat',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 0.6, levelScaling: 0.05 },
    targeting: { shape: 'single' },
    // Authored chance ~0.2 (spec §3, balance-tunable).
    appliesAilments: [{ buffDefinitionId: 'choang', chance: 0.2, stacks: 1 }],
    presetId: 'slash',
  },
  orb_quet: {
    id: 'orb_quet',
    cooldownTurns: 0,
    // ×0.8 per target — full AoE, no split (spec §3).
    damage: { kind: 'physical', multiplier: 0.8, levelScaling: 0.05 },
    targeting: { shape: 'all_lanes', columnRadius: GRID_COLUMN_COUNT },
    presetId: 'slash',
  },
}
