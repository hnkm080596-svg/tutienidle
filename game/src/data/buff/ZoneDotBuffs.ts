// [M13 STATUS: PARKED] Content anchor for the blocked zone-as-dot
// cutover (see the header below): the turn engine does not yet apply
// these definitions, and they are NOT registered in data/buff/buffs.ts.
// Only the module test consumes them. Kept deliberately per the
// mission's parked-modules rule.
import type { BuffDefinition } from '../../core/buff2/BuffDefinition'

// Completion plan Task 7 Step 1 - dot buff definition thay zone-as-dot:
//   - "Dung Nham" (thach_hoa + bong, ReactionManager.spawnLavaZone ->
//     HazardZoneSystem.spawnLavaZone): he song spawn Lava Zone 6 tick x
//     damagePerTick 20 CO DINH (ElementReaction.ts spawnsLavaZone data,
//     khong might-scaling). Turn-based dot pipeline damage/tick =
//     power x coefficient (DamageSystem, physical dung stats.might).
//     coefficient = 20/10 = 2.0 quy doi tai baseline might 10
//     (StatBlock.ts) - damage/tick tai baseline giu nguyen 20.
//   - "Kiem Tran" anchor REMOVED (Kiem Tu Reimagined spec 2026-09-15
//     sec7) - the sword-zone keystone no longer exists.
//
// Duration giu nguyen SO (no-rebalance policy Completion plan secGlobal
// Constraints): 6 luot.
//
// CUTOVER NOTE (Task 7 Step 3-4 BLOCKED): TurnBattleSystem/
// TurnSkillAction currently does NOT call ReactionManager (the turn
// engine has not wired real reaction/skill-effect handling) - there is
// no call site to swap. This definition is the standard anchor for when
// the real content migration wires reactions into the turn engine: at
// that point apply() these 2 definitions instead of spawning zones (see
// the roadmap's "skill-effect conversion" line - SkillEffectResolver
// retired M13).
//
// buff2 migration (M4): refresh -> keep/refresh; dot -> periodic legacy_dot.

export const DUNG_NHAM_BURN_DEFINITION: BuffDefinition = {
  id: 'dung_nham_burn',
  name: 'Dung Nham Bỏng',
  description: 'Dung Nham — nham thạch nóng chảy thiêu đốt (dot thay Lava Zone)',
  kind: 'ailment',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  periodic: [
    {
      id: 'dung_nham_burn.dot',
      type: 'damage',
      element: 'fire',
      damageProfile: 'legacy_dot',
      coefficient: 2.0,
      scaling: 'dynamic',
      timing: 'holder_turn_end',
      stackScaling: 'multiply',
      canCrit: false,
      canMiss: false,
      hitCount: 1,
    },
  ],
  dispellable: true,
}
