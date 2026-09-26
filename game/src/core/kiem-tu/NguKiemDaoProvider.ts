import type { PlayerData } from '../player/Player'
import type { CombatEntity } from '../combat/CombatEntity'
import type { DynamicBasicProvider, TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { HitResolveOptions } from '../battle/ActionImpactSystem'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { nodeWayApplies } from '../progression/NodeSystem'
import { LIEN_MOMENTUM_RATE, gainKiemY } from './NguKiemDao'
import { NGU_KIEM_BASE_NAME, NGU_KIEM_THUAT } from '../../data/skill/NguKiemDaoSkills'
import { NGU_KIEM_EVOLUTION_NODE_IDS } from '../../data/progression/KiemTuNodes'

// Ngu Kiem Beta -- the hidden_sword_pathway (Ngu Kiem Dao)
// DynamicBasicProvider. resolveBasic live-reads kiemDaoBase /
// kiemDaoCount from PlayerData EVERY cast -- a mid-battle forge is
// immediately reflected (there is no battle-scoped state to reset:
// count/base are persisted domain state, not runtime).
//
// Khoi (design sec.7): every Kiem Dao spawns one phi kiem -- each a REAL
// ordered damage instance through the standard pipeline. NO
// guaranteedHit, no execute, no crit/armor privilege: a Khoi-only def
// carries just `instances.count`.
//
// Lien (Truc Co): Kiem The momentum -- each LANDED sword stacks +1;
// later swords of the same cast multiply their coefficient by
// (1 + LIEN_MOMENTUM_RATE * stacks). The stack is pure cast-local
// runtime state -- `each.momentumPerLandedInstance` expresses it
// declaratively for the plan lane while `perInstanceOptions` receives
// the same cast-local landed count as its third argument for the
// engine-unit lane. Never persisted, never a buff, never a player stat.

/**
 * Owned evolution layers (design sec.52): any node carrying
 * `effect.evolutionId` contributes its id when owned -- the authored
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

    if (evolutionId !== undefined && isOwnedEvolutionNode(player, node)) {
      owned.add(evolutionId)
    }
  }

  return owned
}

// M3 -- the way-membership gate applies everywhere ownership is read
// (this predicate reads nodeLevels directly): a wrong-way level must
// not unlock an evolution layer. ONE owned-evolution predicate feeds
// the combat collector and the display resolvers alike.
function isOwnedEvolutionNode(player: PlayerData, node: ProgressionNode): boolean {
  return (player.nodeLevels?.[node.id] ?? 0) > 0 && nodeWayApplies(player, node)
}

/**
 * Display name of the hidden way's single evolving skill (design
 * sec.41-42): the name of the NEWEST owned evolution node -- nodes are
 * registered in spine order, so the last owned match is the newest
 * layer. 'Ngu Kiem' is the pre-evolution fallback.
 */
/** The owned evolution node (last matching wins -- spine order = tiers). */
export function resolveNguKiemOwnedEvolutionNode(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): ProgressionNode | undefined {
  // Newest = last owned node in the DECLARED spine order
  // (NGU_KIEM_EVOLUTION_NODE_IDS), not in whatever order the caller's
  // registry iterates - an out-of-order catalog can never resolve the
  // wrong layer.
  let owned: ProgressionNode | undefined

  for (const spineId of NGU_KIEM_EVOLUTION_NODE_IDS) {
    const node = nodes.find((entry) => entry.id === spineId)
    if (node !== undefined && node.effect.evolutionId !== undefined && isOwnedEvolutionNode(player, node)) {
      owned = node
    }
  }

  return owned
}

/** The one-char evolution suffix for the `Evolution: X` display tag. */
export function resolveNguKiemEvolutionSuffix(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): string | undefined {
  // ONE naming authority: the suffix comes from the owned node's own
  // name (text after its middle-dot separator, e.g. 'Khoi') so a future
  // tier never needs a parallel literal map re-listed here.
  const node = resolveNguKiemOwnedEvolutionNode(player, nodes)
  const suffix = node?.name.split('·')[1]?.trim()
  return suffix !== undefined && suffix.length > 0 ? suffix : undefined
}

export function resolveNguKiemSkillName(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): string {
  return resolveNguKiemOwnedEvolutionNode(player, nodes)?.name ?? NGU_KIEM_BASE_NAME
}

export function buildNguKiemDaoProvider(
  player: PlayerData,
  evolutions: ReadonlySet<string>,
): DynamicBasicProvider {
  const lienOwned = evolutions.has('lien')

  // Engine-unit lane authority for Kiem The: `priorLandedInstances` is
  // the cast-local count of landed prior swords supplied by the
  // instance loop -- the same stack the declarative
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

    // hidden_sword_pathway owns no battle-scoped cursor/log -- nothing to reset.
    resetForBattle: () => {},

    // +1 Kiem Y per resolved ngu_kiem_thuat cast (hit-or-miss alike) --
    // the domain owner call lives HERE (the provider), never in the
    // generic GameManager cast sink. The tail-match guard mirrors
    // KiemPhoProvider: only a resolved way skill banks Y (a future
    // committable second skill or an unrouted re-entry must not count).
    onCastResolved: (ctx) => {
      if (ctx.resolvedSkillId !== NGU_KIEM_THUAT.id) return []
      gainKiemY(player, 1)
      return []
    },
  }
}
