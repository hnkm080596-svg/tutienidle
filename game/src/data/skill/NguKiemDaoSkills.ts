import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'

// Kiem Tu Reimagined Task 9 (spec §5) — Ngu Kiem Dao combat defs.
//
// `ngu_kiem_thuat` is the path's ONLY action: a multi-instance basic —
// each phi kiem resolves through the normal landed-hit pipeline via the
// Task-2 `instances` contract. The live multiplier (kiemDaoBase) and
// instance count (kiemDaoCount) are injected by NguKiemDaoProvider at
// resolve time — THIS def carries the base shape only.
//
// `tu_kiem_y` / `kiem_dao_cascade` are EMBLEM defs (spec §5.4): they
// occupy the special/ultimate slots purely as HUD markers — the
// `emblemOnly` flag makes action selection skip them so they can never
// resolve as real casts.

export const NGU_KIEM_THUAT: TurnSkillDefinition = {
  id: 'ngu_kiem_thuat',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
  presetId: 'slash',
}

export const TU_KIEM_Y_EMBLEM: TurnSkillDefinition = {
  id: 'tu_kiem_y',
  cooldownTurns: 0,
  targetScope: 'self',
  targeting: { shape: 'single' },
  emblemOnly: true,
}

export const KIEM_DAO_CASCADE_EMBLEM: TurnSkillDefinition = {
  id: 'kiem_dao_cascade',
  cooldownTurns: 0,
  targetScope: 'self',
  targeting: { shape: 'single' },
  emblemOnly: true,
}
