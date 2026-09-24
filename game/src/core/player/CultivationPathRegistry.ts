/**
 * Mission C Task 9 (spec C4, audit T5-44) — the SINGLE dispatch site for
 * cultivation-path combat integration. Every isKiemTuX / isPhapTuX /
 * isTheTuX branch that used to live in GameManager/GameManagerTurnBattleOps
 * resolves here into a CultivationPathRuntime; the battle orchestrator
 * consumes the interface only (architecture guard:
 * tests/architecture/battleLifecyclePathBoundary.test.ts).
 *
 * The factory bodies are the moved GameManager resolvers
 * (resolvePlayerBasicAttack / resolvePlayerSpecialUltimate /
 * resolveTheTuKit / resolveTheTuAnKit / authoredBasicSkillId /
 * assertNgoDaoKitLearned / applyPhapTuTheGains / applyPhapTuEmpowerment /
 * resolveAnElementBasicPool / buildTheTuBatTuSurvival) — relocated
 * verbatim modulo `this.` -> deps, per the plan's move-don't-rewrite rule.
 */
import type { PlayerData } from './Player'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { ElementType } from '../element/ElementType'
import type { CultivationPathRuntime, CultivationPathRuntimeDeps } from './CultivationPathRuntime'
import { hasPathCapability, resolveActiveWayStatDomains } from './CultivationPathSystem'
import { getActiveWayDefinition } from './CultivationPathKit'

import { isMortalPrecursorSkillId, MORTAL_DEFAULT_BASIC_ID } from '../skill/MortalPrecursors'
import { aggregateTurnSkillResourceModifiers } from '../progression/NodeSystem'
import {
  toTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
} from '../skilldef/LegacySkillAdapter'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
import { PHAP_TU_ULTIMATE_IDS } from '../../data/skill/PhapTuUltimates'
import { PHAP_TU_EMPOWERED_ULTS } from '../../data/skill/PhapTuEmpoweredUlts'
import {
  applyAnKitToBasic,
  applyAnKitToSpecial,
} from '../../data/skill/TurnAnKitSkills'
import {
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_REQUIRED_SKILLS,
  HIDDEN_SPELL_SPECIAL_ID,
} from '../phap-tu/PhapTuPath'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import {
  SPELL_EMPOWERMENT_ESSENCE_THRESHOLD,
  SPELL_ESSENCE_GAIN_BASIC,
  SPELL_ESSENCE_GAIN_SPECIAL,
  applyRouteToTurnSkill,
  resolveMaxThe,
  resolveRouteProfile,
} from '../phap-tu/PhapTuRoutes'
import { isHiddenSpellPathway, isSpellPathway } from '../phap-tu/PhapTuPath'
import {
  buildTheTuAnKit,
  buildTheTuKit,
  type TheTuAnKit,
  type TheTuKit,
} from '../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../the-tu/TheTuKitModifiers'
import { collectHiddenBodyMechanicModifiers } from '../the-tu/TheTuAnMechanicModifiers'
import { BodyBatTuSurvival } from '../the-tu/TheTuBatTuSurvival'
import { isBodyPathway, isHiddenBodyPathway } from '../the-tu/TheTuPath'
import { isSwordPathway, isHiddenSwordPathway } from '../kiem-tu/KiemTuPath'
import { buildKiemPhoProvider } from '../kiem-tu/KiemPhoProvider'
import { collectKiemPhoComboModifiers } from '../kiem-tu/KiemPhoNodeModifiers'
import {
  buildNguKiemDaoProvider,
  collectKiemDaoCascadeUnlocks,
} from '../kiem-tu/NguKiemDaoProvider'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'

// ---------------------------------------------------------------------------
// Shared resolver internals (moved from GameManager)
// ---------------------------------------------------------------------------

/**
 * Review round-4 (MEDIUM) — the hidden_spell_pathway kit is a fixed three-skill
 * set granted atomically at the ritual (HIDDEN_SPELL_REQUIRED_SKILLS is
 * the single authority). A save/registry missing ANY member is corrupt
 * progression state — fail loudly at battle build instead of silently
 * dropping the special button or the dao multicast. Called from both
 * battle-build resolvers so each enforces the contract independently.
 */
function assertNgoDaoKitLearned(deps: CultivationPathRuntimeDeps, player: PlayerData) {
  if (!isHiddenSpellPathway(player)) {
    return
  }

  const missing = HIDDEN_SPELL_REQUIRED_SKILLS.filter(
    (skillId) => !deps.skillManager.has(skillId),
  )

  if (missing.length > 0) {
    throw new Error(
      `[GameManager] hidden_spell_pathway kit incomplete — missing learned skills: ${missing.join(', ')}`,
    )
  }
}

/**
 * Review fix (HIGH-1) — the An composite pool is the CANONICAL
 * conversion of the five authored element basics (SPELL_KIT_IDS[el][0]
 * templates through getEffectiveSkill + toTurnSkillDefinition), not a
 * static duplicate table. A missing/invalid template throws here —
 * authoring errors must surface loudly at battle build, never silently
 * shrink the pick pool.
 */
function resolveAnElementBasicPool(deps: CultivationPathRuntimeDeps): TurnSkillDefinition[] {
  return ELEMENT_ORDER.map((element) => {
    const templateId = SPELL_KIT_IDS[element][0]
    const template = deps.skillTemplates.get(templateId)

    if (!template) {
      throw new Error(`An kit element pool: skill template "${templateId}" is not registered`)
    }

    return toTurnSkillDefinition(template, deps.skillSystem.getEffectiveSkill(template))
  })
}

/**
 * Task 8 — attach the authored The-gain fields to a spell kit
 * TurnSkillDefinition at battle build. Base values come from
 * SPELL_ESSENCE_GAIN_* (basic +5 / special +15 / ultimate +0); the 'no'
 * route profile contributes theGainOnCrit; tu_the_<element> nodes add
 * per-level deltas via aggregateTurnSkillResourceModifiers — all of it
 * scoped to this authored skill id. Non-spell_pathway ways (incl. hidden_spell_pathway —
 * its kit has no The loop) return the def unchanged.
 */
function applySpellPathEssenceGains(
  deps: CultivationPathRuntimeDeps,
  def: TurnSkillDefinition,
  player: PlayerData,
  baseGainOnLandedCast: number,
): TurnSkillDefinition {
  if (!isSpellPathway(player)) {
    return def
  }

  const nodeMods = aggregateTurnSkillResourceModifiers(deps.nodeRegistry, player).get(def.id)
  const theGainOnLandedCast = baseGainOnLandedCast + (nodeMods?.theGainOnLandedCast ?? 0)
  const theGainOnCrit =
    (resolveRouteProfile(player.spellPath).critTheGain ?? 0) + (nodeMods?.theGainOnCrit ?? 0)

  return {
    ...def,
    ...(theGainOnLandedCast > 0 ? { theGainOnLandedCast } : {}),
    ...(theGainOnCrit > 0 ? { theGainOnCrit } : {}),
  }
}

/**
 * Task 10 — attach the god-ult empowerment to the root chain-E
 * ultimate at battle build. Gated on owning `linh_ngo_<godUltId>` (the
 * engine stays dumb — the gate lives in orchestration, A8); the route
 * profile picks the payload variant ('dot' -> detonate, 'no' -> nuke,
 * none -> nuke default).
 */
function applySpellPathEmpowerment(
  deps: CultivationPathRuntimeDeps,
  def: TurnSkillDefinition,
  player: PlayerData,
  element: ElementType,
): TurnSkillDefinition {
  const godUltId = PHAP_TU_ULTIMATE_IDS[element]

  if ((player.nodeLevels?.[`linh_ngo_${godUltId}`] ?? 0) <= 0) {
    return def
  }

  const variant = resolveRouteProfile(player.spellPath).empoweredUlt ?? 'nuke'
  const empowered = PHAP_TU_EMPOWERED_ULTS[element]?.[variant]

  return empowered
    ? {
        ...def,
        empowerment: { theThreshold: SPELL_EMPOWERMENT_ESSENCE_THRESHOLD, empowered },
      }
    : def
}

/**
 * The canonical authored-Skill -> TurnSkillDefinition basic pipeline
 * (moved from GameManager.resolvePlayerBasicAttack). `strict` paths
 * (spell ways) fail loudly on a missing required basic or a converter
 * rejection — authored-data defects must surface, never silently degrade.
 */
function resolveAuthoredBasic(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
  authoredBasicId: string | undefined,
  strict: boolean,
): TurnSkillDefinition | undefined {
  const skill = authoredBasicId ? deps.skillManager.get(authoredBasicId) : undefined

  // Review round-3 (MEDIUM): a REQUIRED phap basic that isn't learned
  // is corrupt progression state (the element commit / An ritual grants
  // it atomically). Fail loudly — degrading to generic melee would
  // silently strip the path's kit.
  if (skill === undefined && authoredBasicId !== undefined && strict) {
    throw new Error(
      `[GameManager] required basic "${authoredBasicId}" is not learned for path "${player.cultivationPath}" — corrupt progression state`,
    )
  }

  if (!skill) {
    return undefined
  }

  const effective = deps.skillSystem.getEffectiveSkill(skill)
  const unsupported = collectUnsupportedSkillSemantics(skill, effective)

  if (unsupported.length > 0) {
    console.warn(
      `[GameManager] basic "${skill.id}" executes partially — ` +
        `unsupported authored semantics: ${unsupported.join(', ')}`,
    )
  }

  try {
    // Route seam 2 (post-conversion): the converter stays generic —
    // ailmentStackBonus lands on the built definition here.
    const converted = applyRouteToTurnSkill(
      toTurnSkillDefinition(skill, effective),
      deps.routeProfileProvider(skill.id),
    )

    // Task 11 — the An basic carries its composite pick (uniform
    // element_basic pool) plus `multicast` when the player owns the
    // ngo_dao_hon_don dao passive (granted at the ritual).
    const resolved = isHiddenSpellPathway(player)
      ? applyAnKitToBasic(
          converted,
          deps.skillManager.has(HIDDEN_SPELL_PASSIVE_ID),
          resolveAnElementBasicPool(deps),
        )
      : converted

    return {
      ...applySpellPathEssenceGains(deps, resolved, player, SPELL_ESSENCE_GAIN_BASIC),
      cooldownTurns: 0,
      resourceType: 'none',
      resourceCost: undefined,
    }
  } catch (error) {
    // Review round-2 (LOW): phap paths have no static fallback — the
    // SPELL_BASICS table was a second authority that drifted from
    // authored skills. A converter rejection is an authored-data
    // defect; fail loudly instead of silently running wrong gameplay.
    if (strict) {
      throw error
    }

    console.warn(
      `[GameManager] basic "${skill.id}" rejected by strict converter — falling back to static build basic:`,
      error instanceof Error ? error.message : error,
    )
    return undefined
  }
}

/**
 * The Tu Reimagined (plan Task 6) — resolve the owned branch root
 * (cuong_chien XOR tran_the, excludesNode mutex) into a participant-
 * local kit clone with collectBodyKitModifiers baked in. No root ->
 * undefined (INV-3 fallback is the caller's job).
 */
function resolveBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuKit | undefined {
  const mods = collectBodyKitModifiers(deps.nodeRegistry, player)

  if (deps.getNodeLevel('cuong_chien', player) > 0) {
    return buildTheTuKit('cuong_chien', mods)
  }

  if (deps.getNodeLevel('tran_the', player) > 0) {
    return buildTheTuKit('tran_the', mods)
  }

  return undefined
}

/**
 * The Tu Reimagined (plan Task 14) — the An kit is fixed at path
 * choice (spec 6.1); owned roots (ho_mon/phan_mon/tro_mon, non-mutex
 * T9) only decide which mechanic markers get planted on the built
 * basic clone's grantsBuffsAtBuild.
 */
function resolveHiddenBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuAnKit {
  const ownedRoots = (['ho_mon', 'phan_mon', 'tro_mon'] as const).filter(
    (root) => deps.getNodeLevel(root, player) > 0,
  )

  // Plan Task 20 — trunk economy + branch riders ride the one locked
  // channel; baked into participant-local marker/payload clones here.
  const mods = collectHiddenBodyMechanicModifiers(deps.nodeRegistry, player)

  return buildTheTuAnKit(ownedRoots, mods)
}

// ---------------------------------------------------------------------------
// Per-path runtime factories
// ---------------------------------------------------------------------------

function sharedMembers(deps: CultivationPathRuntimeDeps) {
  return {
    resolveMaxThe: (player: PlayerData) => resolveMaxThe(deps.nodeRegistry, player),
    resolveStatDomains: (player: PlayerData) => resolveActiveWayStatDomains(player),
  }
}

/**
 * Mortal / pham_nhan — the persisted mortalBasicSkillId pick is the
 * player's chosen basic-tier skill (spec 2026-09-15 section 2.3:
 * huy_quyen is cast as a basic while mortal, its casts feeding the
 * hidden_body_pathway offer gate). Restricted to the precursor family —
 * an absent/illegal/unlearned pick resolves the tram default.
 */
function createMortalRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // P7-M4 — the persisted pick is the mortal basic; the precursor
      // whitelist + learned membership guard it. Save v82 contract: a
      // mortal SAVE must carry the pick (preflight rejects otherwise);
      // this fallback is the defensive runtime default for in-memory /
      // crafted players, never a creation grant. NO slot read exists.
      const pick = player.mortalBasicSkillId
      const authoredBasicId =
        pick !== undefined && isMortalPrecursorSkillId(pick) && deps.skillManager.has(pick)
          ? pick
          : MORTAL_DEFAULT_BASIC_ID

      return (
        resolveAuthoredBasic(deps, player, authoredBasicId, false) ??
        // M9 — content-map lookup keyed on the path id, not a literal
        // branch: builds with a static authored basic resolve here.
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate: () => undefined,
  }
}

function createSwordPathRuntime(deps: CultivationPathRuntimeDeps, hidden: boolean): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // Spec 2026-09-15 K3 — tram is a MORTAL precursor: once a path is
      // chosen it is no longer the basic. Kiem Tu basics resolve through
      // the dynamicBasic orb provider; the static authored def is the
      // inert slot filler.
      return BASIC_ATTACKS_BY_BUILD[player.cultivationPath!] ?? GENERIC_PHYSICAL_BASIC
    },
    resolveSpecialUltimate: () => undefined,
    buildDynamicBasic: hidden
      ? (player, nodes, rng) =>
          buildNguKiemDaoProvider(player, collectKiemDaoCascadeUnlocks(player, nodes), rng)
      : (player, nodes) =>
          buildKiemPhoProvider(player, collectKiemPhoComboModifiers(player, nodes)),
    emblemSlots: hidden
      ? () => ({ special: TU_KIEM_Y_EMBLEM, ultimate: KIEM_DAO_CASCADE_EMBLEM })
      : undefined,
    // P7-M4 — display label for the provider-backed basic (Kiếm Phổ orb
    // machinery / Ngự Kiếm Đạo cascade), matching kiemBarBridge's wording.
    describeDynamicBasic: () => ({ name: hidden ? 'Ngự Kiếm Đạo' : 'Kiếm Phổ' }),
  }
}

function createSpellPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      const element = deps.getSpellPathElement()
      const authoredBasicId = element ? SPELL_KIT_IDS[element]?.[0] : undefined

      return (
        resolveAuthoredBasic(deps, player, authoredBasicId, true) ??
        // P7-M4 - way-authored starter fallback: linh_bao fights as the
        // basic until the element kit supersedes (authored-read — the
        // starter comes off the committed way definition, no literal).
        resolveAuthoredBasic(
          deps,
          player,
          getActiveWayDefinition(player)?.starterBasicSkillId,
          false,
        ) ??
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      const element = deps.getSpellPathElement()

      if (!element) {
        return {}
      }

      const [, specialId, ultimateId] = SPELL_KIT_IDS[element]
      const specialSkill = deps.skillManager.get(specialId)
      const ultimateSkill = deps.skillManager.get(ultimateId)

      return {
        special: specialSkill
          ? applySpellPathEssenceGains(
              deps,
              applyRouteToTurnSkill(
                toTurnSkillDefinition(specialSkill, deps.skillSystem.getEffectiveSkill(specialSkill)),
                deps.routeProfileProvider(specialSkill.id),
              ),
              player,
              SPELL_ESSENCE_GAIN_SPECIAL,
            )
          : undefined,
        ultimate: ultimateSkill
          ? applySpellPathEmpowerment(
              deps,
              applySpellPathEssenceGains(
                deps,
                applyRouteToTurnSkill(
                  toTurnSkillDefinition(
                    ultimateSkill,
                    deps.skillSystem.getEffectiveSkill(ultimateSkill),
                  ),
                  deps.routeProfileProvider(ultimateSkill.id),
                ),
                player,
                0,
              ),
              player,
              element,
            )
          : undefined,
      }
    },
  }
}

function createHiddenSpellPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      assertNgoDaoKitLearned(deps, player)
      return (
        resolveAuthoredBasic(deps, player, HIDDEN_SPELL_BASIC_ID, true) ?? GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      // Phap Tu An (Task 7) — the special is the repeat-cast skill
      // granted at the ritual; the ult slot is a passive
      // (ngo_dao_hon_don), no ultimate TurnSkillDefinition.
      assertNgoDaoKitLearned(deps, player)

      const specialSkill = deps.skillManager.get(HIDDEN_SPELL_SPECIAL_ID)

      return {
        special: specialSkill
          ? applyAnKitToSpecial(
              toTurnSkillDefinition(specialSkill, deps.skillSystem.getEffectiveSkill(specialSkill)),
              resolveAnElementBasicPool(deps),
            )
          : undefined,
      }
    },
    grantsElementalReactionAura(player) {
      // Canonical-seals S3 (plan sec.9.4) -- the aura gate lives HERE,
      // inside the path-authority dispatch site. P1 - the check itself is
      // now the conditional capability 'spell.reaction_aura' declared on
      // the hidden_spell_pathway way (predicate: ngo_dao_hon_don learned; skill
      // membership arrives via deps.hasSkill - SkillManager is the owner).
      // A corrupt save missing the passive gets no aura and the kit assert
      // above still fails loudly.
      return hasPathCapability(player, 'spell.reaction_aura', {
        hasSkill: (skillId) => deps.skillManager.has(skillId),
      })
    },
  }
}

function createBodyPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // The Tu Reimagined (spec section 5, INV-3) — root-owned kit;
      // P7-M4 way-authored starter fallback (huy_quyen) sits between the
      // kit and the generic melee fallback.
      return (
        resolveBodyKit(deps, player)?.basic ??
        resolveAuthoredBasic(
          deps,
          player,
          getActiveWayDefinition(player)?.starterBasicSkillId,
          false,
        ) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      const kit = resolveBodyKit(deps, player)
      return kit ? { special: kit.special, ultimate: kit.ultimate } : {}
    },
    buildSurviveSources(player: PlayerData, participant: TurnBattleParticipant, hasActiveBuff: (definitionId: BuffDefinitionId) => boolean): SurviveLethalSource[] {
      // The Tu Reimagined (plan Task 9, D9) — Cuong Chien only: the
      // survival source reads the participant's live ultimate slot and
      // buff pool; node-resolved duration comes off the baked kit clone.
      if (deps.getNodeLevel('cuong_chien', player) <= 0) {
        return []
      }

      return [
        new BodyBatTuSurvival({
          ultimateSlot: () => participant.ultimate,
          hasActiveBuff,
        }),
      ]
    },
  }
}

function createHiddenBodyPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // Spec section 6.1 — fixed kit granted at path choice; the built
      // clone's grantsBuffsAtBuild plants ung_the + owned-root markers.
      return resolveHiddenBodyKit(deps, player).basic
    },
    resolveSpecialUltimate(player) {
      const kit = resolveHiddenBodyKit(deps, player)
      return {
        special: kit.special,
        ultimate: kit.ultimate,
        reactivePayloads: kit.reactivePayloads,
        maxThe: kit.maxThe,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// The dispatch table — the ONLY place path:way identity selects behavior.
// ---------------------------------------------------------------------------

export type CultivationPathRuntimeFactory = (
  deps: CultivationPathRuntimeDeps,
) => CultivationPathRuntime

export const CULTIVATION_PATH_RUNTIME_FACTORIES: Record<string, CultivationPathRuntimeFactory> = {
  'sword:sword_pathway': (deps) => createSwordPathRuntime(deps, false),
  'sword:hidden_sword_pathway': (deps) => createSwordPathRuntime(deps, true),
  'spell:spell_pathway': createSpellPathwayRuntime,
  'spell:hidden_spell_pathway': createHiddenSpellPathwayRuntime,
  'body:body_pathway': createBodyPathwayRuntime,
  'body:hidden_body_pathway': createHiddenBodyPathwayRuntime,
}

/**
 * Resolve the combat runtime for a player. Dispatch key is the persisted
 * `cultivationPath:cultivationWay` pair; unknown/absent pairs resolve to
 * the mortal runtime (which still honors BASIC_ATTACKS_BY_BUILD for any
 * path id that authors a static basic).
 */
export function resolveCultivationPathRuntime(
  player: PlayerData,
  deps: CultivationPathRuntimeDeps,
  factories: Record<string, CultivationPathRuntimeFactory> = CULTIVATION_PATH_RUNTIME_FACTORIES,
): CultivationPathRuntime {
  const key = player.cultivationPath
    ? `${player.cultivationPath}:${player.cultivationWay ?? ''}`
    : ''
  const factory = factories[key] ?? factories[player.cultivationPath ?? ''] ?? createMortalRuntime
  return factory(deps)
}
