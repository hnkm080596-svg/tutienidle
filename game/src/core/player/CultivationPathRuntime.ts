import type { PlayerData } from './Player'
import type { TurnSkillDefinition, DynamicBasicProvider } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { StatDomain } from '../stats/StatDomain'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { ElementType } from '../element/ElementType'
import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { SkillManager } from '../skill/SkillManager'
import type { RouteProfile } from '../phap-tu/PhapTuRoutes'

/**
 * Mission C Task 9 (spec C4, audit T5-44) — the cultivation-path combat
 * boundary. GameManagerTurnBattleOps consumes THIS interface; it never
 * branches on path/way identity. Dispatch lives exclusively in
 * CultivationPathRegistry (the path-authority dir per the
 * cultivationPathIsolation architecture guard).
 */
export interface CultivationPathRuntime {
  /** The battle basic — authored Skill pipeline, kit slot, or generic melee. */
  resolveBasic(player: PlayerData): TurnSkillDefinition
  /**
   * Kit slots or emblem markers for special/ultimate. Carries the full
   * shape TurnBattleAdapter stamps onto the participant — dropping
   * reactivePayloads/maxThe deletes the the_tu_an reactive channel.
   */
  resolveSpecialUltimate(player: PlayerData):
    | {
        special?: TurnSkillDefinition
        ultimate?: TurnSkillDefinition
        reactivePayloads?: Record<string, TurnSkillDefinition>
        maxThe?: number
      }
    | undefined
  /** The-cap snapshot (query-derived; MAX_THE for non-The paths). */
  resolveMaxThe(player: PlayerData): number
  /** Stat-domain gate for battle stat derivation (active way's domains). */
  resolveStatDomains(player: PlayerData): readonly StatDomain[] | undefined
  /**
   * Kiem Tu hien/ngu dynamic-basic provider — undefined for other paths.
   * `rng` is the session battle RNG (Mission C Task 8): provider-side
   * rolls (Ngu cascade-crit/pierce) must not fall back to Math.random.
   */
  buildDynamicBasic?(
    player: PlayerData,
    nodes: readonly ProgressionNode[],
    rng: () => number,
  ): DynamicBasicProvider | undefined
  /** The Tu Bat Tu Ba The survive-lethal source(s); absent elsewhere.
      buff2 M4 -- hasActiveBuff binds the battle's BuffSystem read port. */
  buildSurviveSources?(
    player: PlayerData,
    participant: TurnBattleParticipant,
    hasActiveBuff: (definitionId: BuffDefinitionId) => boolean,
  ): SurviveLethalSource[]
  /** Emblem/marker slot overrides (Ngu Kiem Dao special/ultimate). */
  emblemSlots?(): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }
}

/**
 * The resolver deps slice the path factories need — supplied by
 * GameManager (it owns the skill/progression registries, A3).
 */
export interface CultivationPathRuntimeDeps {
  skillManager: Pick<SkillManager, 'get' | 'has' | 'getEquippedInSlot'>
  skillSystem: { getEffectiveSkill(skill: Skill, levelOverride?: number): EffectiveSkill }
  skillTemplates: { get(id: string): Skill | undefined }
  nodeRegistry: { getAll(): ProgressionNode[] }
  getNodeLevel(nodeId: string, player: PlayerData): number
  getPhapTuElement(): ElementType | undefined
  routeProfileProvider(skillId: string): RouteProfile
}
