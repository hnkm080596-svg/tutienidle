import type { PlayerData } from '../player/Player'
import type { CombatEntity } from '../combat/CombatEntity'
import type { DynamicBasicProvider, TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { HitResolveOptions } from '../battle/ActionImpactSystem'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { nodeWayApplies } from '../progression/NodeSystem'
import { LIEN_MOMENTUM_RATE, gainKiemY } from './NguKiemDao'
import { NGU_KIEM_THUAT } from '../../data/skill/NguKiemDaoSkills'

// Ngu Kiem Beta — the hidden_sword_pathway (Ngu Kiem Dao)
// DynamicBasicProvider. resolveBasic live-reads kiemDaoBase /
// kiemDaoCount from PlayerData EVERY cast — a mid-battle forge is
// immediately reflected (there is no battle-scoped state to reset:
// count/base are persisted domain state, not runtime).
//
// Khởi (design sec.7): every Kiem Dao spawns one phi kiem — each a REAL
// ordered damage instance through the standard pipeline. NO
// guaranteedHit, no execute, no crit/armor privilege: a Khởi-only def
// carries just `instances.count`.
//
// Liên (Trúc Cơ): Kiem Thế momentum — each LANDED sword stacks +1;
// later swords of the same cast multiply their coefficient by
// (1 + LIEN_MOMENTUM_RATE * stacks). The stack is pure cast-local
// runtime state — `each.momentumPerLandedInstance` expresses it
// declaratively for the plan lane while `perInstanceOptions` receives
// the same cast-local landed count as its third argument for the
// engine-unit lane. Never persisted, never a buff, never a player stat.

/**
 * Owned evolution layers (design sec.52): any node carrying
 * `effect.evolutionId` contributes its id when owned — the authored
 * node ids live in KiemTuNodes data, not here; future realms add a
 * node, not a code branch.
 */
export function collectOwnedEvolutionIds(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): ReadonlySet<string> {
  const owned = new Set<string>()

  for (const node of nodes) {
    const evolutionId = node.effect.evolutionId

    // M3 — the way-membership gate applies here too (this collector
    // reads nodeLevels directly): a wrong-way level must not unlock an
    // evolution layer.
    if (evolutionId !== undefined && (player.nodeLevels?.[node.id] ?? 0) > 0 && nodeWayApplies(player, node)) {
      owned.add(evolutionId)
    }
  }

  return owned
}

/**
 * Display name of the hidden way's single evolving skill (design
 * sec.41-42): the name of the NEWEST owned evolution node — nodes are
 * registered in spine order, so the last owned match is the newest
 * layer. 'Ngự Kiếm' is the pre-evolution fallback.
 */
export function resolveNguKiemSkillName(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): string {
  let name = 'Ngự Kiếm'

  for (const node of nodes) {
    if (node.effect.evolutionId !== undefined && (player.nodeLevels?.[node.id] ?? 0) > 0 && nodeWayApplies(player, node)) {
      name = node.name
    }
  }

  return name
}

export function buildNguKiemDaoProvider(
  player: PlayerData,
  evolutions: ReadonlySet<string>,
): DynamicBasicProvider {
  const lienOwned = evolutions.has('lien')

  // Engine-unit lane authority for Kiem Thế: `priorLandedInstances` is
  // the cast-local count of landed prior swords supplied by the
  // instance loop — the same stack the declarative
  // `each.momentumPerLandedInstance` models for the plan lane.
  const perInstanceOptions = lienOwned
    ? (
        _instanceIndex: number,
        _target: CombatEntity,
        priorLandedInstances: number,
      ): Partial<HitResolveOptions> =>
        priorLandedInstances > 0
          ? { damageMultiplier: 1 + LIEN_MOMENTUM_RATE * priorLandedInstances }
          : {}
    : undefined

  const resolveDef = (): TurnSkillDefinition => ({
    ...NGU_KIEM_THUAT,
    // M-QI-05 - spread the authored damage so adapter metadata
    // (levelScaling) survives; only the live multiplier is overridden.
    damage: NGU_KIEM_THUAT.damage
      ? { ...NGU_KIEM_THUAT.damage, multiplier: player.swordPath?.kiemDaoBase ?? 1 }
      : undefined,
    instances: {
      count: player.swordPath?.kiemDaoCount ?? 1,
      ...(perInstanceOptions !== undefined ? { perInstanceOptions } : {}),
      ...(lienOwned
        ? { each: { momentumPerLandedInstance: LIEN_MOMENTUM_RATE } }
        : {}),
    },
  })

  return {
    resolveBasic: () => resolveDef(),

    manualOptions: () => [resolveDef()],

    resolveManualPick: (defId: string) => (defId === NGU_KIEM_THUAT.id ? resolveDef() : null),

    // hidden_sword_pathway owns no battle-scoped cursor/log — nothing to reset.
    resetForBattle: () => {},

    // +1 Kiem Y per resolved cast (hit-or-miss alike) — the domain
    // owner call lives HERE (the provider), never in the generic
    // GameManager cast sink.
    onCastResolved: () => {
      gainKiemY(player, 1)
      return []
    },
  }
}
