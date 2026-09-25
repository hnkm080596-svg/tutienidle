import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'

// Ngu Kiem Beta -- Ngu Kiem Dao combat defs.
//
// `ngu_kiem_thuat` is the path's ONLY action -- ONE evolving skill, not
// a kit: a multi-instance basic where each phi kiem resolves through
// the normal landed-hit pipeline via the `instances` contract. The
// live multiplier (kiemDaoBase), instance count (kiemDaoCount), and
// owned evolution layers (momentum on Lien) are injected by
// NguKiemDaoProvider at resolve time -- THIS def carries the base
// shape only. 'metal_slash' keeps phi kiem VFX distinct from the
// Kiem Pho swing preset (design sec.44-48).

export const NGU_KIEM_THUAT: TurnSkillDefinition = {
  id: 'ngu_kiem_thuat',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
  presetId: 'ngu_kiem_flight',
}
