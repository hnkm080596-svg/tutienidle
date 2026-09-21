import type { PlayerData } from './Player'
import type { Skill } from '../skill/Skill'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { CultivationPathRuntime } from './CultivationPathRuntime'

// P7-M4 - the ONE role-composition seam. The nominal
// {basic, special, ultimate} triple is NOT the whole contract: the
// kit additionally carries emblem overrides (hidden_sword),
// reactive payloads + the kit-declared The cap (hidden_body), and
// the dynamic-basic marker (sword ways - resolveBasic's return is a
// nominal filler under the provider). Extracted here so
// resolveCombatBuild and the UI read accessor compose roles through
// the same code path and cannot drift apart.
export interface CombatRoleComposition {
  /** Nominal basic - stamped under the dynamic provider for sword ways. */
  basic: TurnSkillDefinition
  /** True when runtime.buildDynamicBasic owns the real basic (sword ways). */
  basicIsDynamic: boolean
  /** Emblem-precedence resolved special. */
  special?: TurnSkillDefinition
  /** Emblem-precedence resolved ultimate. */
  ultimate?: TurnSkillDefinition
  /** hidden_body reactive channel payloads. */
  reactivePayloads?: Record<string, TurnSkillDefinition>
  /** Kit-declared The cap (consumed into entity.maxThe by the build). */
  maxThe?: number
}

export function resolveCombatSkillRoles(
  player: PlayerData,
  runtime: CultivationPathRuntime,
): CombatRoleComposition {
  // Call order: basic -> specialUltimate -> emblem - preserves the
  // retired CombatBuild evaluation prefix so partial runtime fakes
  // throw at the same point they used to.
  const basic = runtime.resolveBasic(player)
  const specialUltimate = runtime.resolveSpecialUltimate(player)
  const emblem = runtime.emblemSlots?.()

  return {
    basic,
    basicIsDynamic: runtime.buildDynamicBasic !== undefined,
    special: emblem?.special ?? specialUltimate?.special,
    ultimate: emblem?.ultimate ?? specialUltimate?.ultimate,
    reactivePayloads: specialUltimate?.reactivePayloads,
    maxThe: specialUltimate?.maxThe,
  }
}

// P7-M4 - presentation contract for the resolved-role display
// (progressionOps.getResolvedSkillRoles). A def-backed role carries the
// resolved definition plus the player's learned instance (undefined
// while the def is authored but not yet learned); a dynamic role (sword
// ways) has no fixed def - only the provider's display label.
export interface ResolvedDefRole {
  def: TurnSkillDefinition
  /** Display name (learned instance > authored template > def id). */
  name: string
  /** Learned instance - present iff the player has learned the skill. */
  skill?: Skill
}

export type ResolvedRoleEntry =
  | ({ kind: 'def' } & ResolvedDefRole)
  | { kind: 'dynamic'; label: string }

export interface ResolvedSkillRoles {
  basic: ResolvedRoleEntry
  special?: ResolvedDefRole
  ultimate?: ResolvedDefRole
}
