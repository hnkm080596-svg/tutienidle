/**
 * Mission C Task 9 (spec C4, audit T5-44) - the SINGLE dispatch site for
 * cultivation-path combat integration. Every isKiemTuX / isPhapTuX /
 * isTheTuX branch that used to live in GameManager/GameManagerTurnBattleOps
 * resolves here into a CultivationPathRuntime; the battle orchestrator
 * consumes the interface only (architecture guard:
 * tests/architecture/battleLifecyclePathBoundary.test.ts).
 *
 * The factory bodies are the moved GameManager resolvers
 * (resolvePlayerBasicAttack / resolvePlayerSpecialUltimate /
 * resolveTheTuKit / resolveTheTuAnKit / authoredBasicSkillId /
 * assertNgoDaoKitLearned / resolveAnElementBasicPool /
 * buildTheTuBatTuSurvival) - relocated verbatim modulo `this.` -> deps,
 * per the plan's move-don't-rewrite rule.
 */
import type { PlayerData } from './Player'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { CultivationPathRuntime, CultivationPathRuntimeDeps } from './CultivationPathRuntime'
import { hasPathCapability, resolveActiveWayStatDomains } from './CultivationPathSystem'
import { getActiveWayDefinition } from './CultivationPathKit'

import { isMortalPrecursorSkillId, MORTAL_DEFAULT_BASIC_ID } from '../skill/MortalPrecursors'
import {
  toTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
} from '../skilldef/LegacySkillAdapter'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { NGU_KIEM_BASE_NAME } from '../../data/skill/NguKiemDaoSkills'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
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
import { isBetaElement } from '../betaScope'
import {
  HOA_THE_NODE_ID,
  THE_GAIN_CHANCE_PER_LEVEL,
  resolveMaxThe,
  SPELL_PATH_MAX_THE,
  isHiddenSpellPathway,
} from '../phap-tu/PhapTuPath'
import { buildPhapTheVariant } from '../phap-tu/PhapTheVariants'
import {
  applyPhapTuSkillDefinitionModifiers,
  collectPhapTuSkillDefinitionModifiers,
} from '../phap-tu/PhapTuNodeModifiers'
import {
  KIM_LIET_PENETRATION_PER_STACK,
  PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
  PHAP_TU_WINDOW_LANDED_CONSEQUENCES,
} from '../../data/skill/PhapTuSkills'
import {
  buildTheTuAnKit,
  buildTheTuKit,
  type TheTuAnKit,
  type TheTuKit,
} from '../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../the-tu/TheTuKitModifiers'
import { collectHiddenBodyMechanicModifiers } from '../the-tu/TheTuAnMechanicModifiers'
import { getSkillCoreLevel } from '../progression/SkillCoreLevel'
import { buildKiemPhoProvider } from '../kiem-tu/KiemPhoProvider'
import {
  collectKiemPhoComboModifiers,
  collectKiemPhoSkillDefinitionModifiers,
} from '../kiem-tu/KiemPhoNodeModifiers'
import {
  buildNguKiemDaoProvider,
  collectOwnedEvolutionIds,
} from '../kiem-tu/NguKiemDaoProvider'

// ---------------------------------------------------------------------------
// Shared resolver internals (moved from GameManager)
// ---------------------------------------------------------------------------

/**
 * Review round-4 (MEDIUM) - the hidden_spell_pathway kit is a fixed three-skill
 * set granted atomically at the ritual (HIDDEN_SPELL_REQUIRED_SKILLS is
 * the single authority). A save/registry missing ANY member is corrupt
 * progression state - fail loudly at battle build instead of silently
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
 * Review fix (HIGH-1) - the An composite pool is the CANONICAL
 * conversion of the five authored element basics (SPELL_KIT_IDS[el][0]
 * templates through getEffectiveSkill + toTurnSkillDefinition), not a
 * static duplicate table. A missing/invalid template throws here -
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
 * The canonical authored-Skill -> TurnSkillDefinition basic pipeline
 * (moved from GameManager.resolvePlayerBasicAttack). `strict` paths
 * (spell ways) fail loudly on a missing required basic or a converter
 * rejection - authored-data defects must surface, never silently degrade.
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
  // it atomically). Fail loudly - degrading to generic melee would
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
    const converted = toTurnSkillDefinition(skill, effective)

    // Task 11 - the An basic carries its composite pick (uniform
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
      ...resolved,
      cooldownTurns: 0,
      resourceType: 'none',
      resourceCost: undefined,
    }
  } catch (error) {
    // Review round-2 (LOW): phap paths have no static fallback - the
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
 * The Tu beta: resolve the owned branch root (cuong_chien XOR
 * tran_the, excludesNode mutex) into a participant-local kit clone
 * with collectBodyKitModifiers baked in. No root -> undefined (INV-3
 * fallback is the caller's job). Slot ownership gates at build: the
 * Truc Co special arrives only with its owning major node (the beta
 * window has no Ultimate slot).
 */
function resolveBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuKit | undefined {
  const mods = collectBodyKitModifiers(deps.nodeRegistry, player)

  if (deps.getNodeLevel('cuong_chien', player) > 0) {
    return buildTheTuKit('cuong_chien', mods, {
      special: getSkillCoreLevel(player, 'loan_dau') > 0,
    })
  }

  if (deps.getNodeLevel('tran_the', player) > 0) {
    return buildTheTuKit('tran_the', mods, {
      special: getSkillCoreLevel(player, 'phan_chan') > 0,
    })
  }

  return undefined
}

/**
 * Ung The beta - the An kit is the basic Tham The at path choice (Phan
 * rides it baseline); the major_quan_the node's granted skill core is
 * the ONLY special gate, opening the Ho/Tro markers with it. Node
 * consequence riders ride the one locked channel and bake into
 * participant-local marker/payload clones here.
 */
function resolveHiddenBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuAnKit {
  const mods = collectHiddenBodyMechanicModifiers(deps.nodeRegistry, player)
  const quanTheCoreLevel = getSkillCoreLevel(player, 'quan_the')

  return buildTheTuAnKit(mods, {
    quanThe: quanTheCoreLevel > 0,
    quanTheCoreLevel,
  })
}

// ---------------------------------------------------------------------------
// Per-path runtime factories
// ---------------------------------------------------------------------------

function sharedMembers(deps: CultivationPathRuntimeDeps) {
  return {
    // Phap Tu Reimagined -- the cap authority moved off the deleted
    // node-cap aggregator: PhapTuPath.resolveMaxThe returns 5 for
    // spell_pathway, MAX_THE elsewhere.
    resolveMaxThe: (player: PlayerData) =>
      resolveMaxThe(player, deps.getNodeLevel(HOA_THE_NODE_ID, player)),
    resolveStatDomains: (player: PlayerData) => resolveActiveWayStatDomains(player),
  }
}

/**
 * Mortal / pham_nhan - the persisted mortalBasicSkillId pick is the
 * player's chosen basic-tier skill (spec 2026-09-15 section 2.3:
 * huy_quyen is cast as a basic while mortal, its casts feeding the
 * hidden_body_pathway offer gate). Restricted to the precursor family -
 * an absent/illegal/unlearned pick resolves the tram default.
 */
function createMortalRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // P7-M4 - the persisted pick is the mortal basic; the precursor
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
        // M9 - content-map lookup keyed on the path id, not a literal
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
      // Spec 2026-09-15 K3 - tram is a MORTAL precursor: once a path is
      // chosen it is no longer the basic. Kiem Tu basics resolve through
      // the dynamicBasic orb provider; the static authored def is the
      // inert slot filler.
      return BASIC_ATTACKS_BY_BUILD[player.cultivationPath!] ?? GENERIC_PHYSICAL_BASIC
    },
    resolveSpecialUltimate: () => undefined,
    buildDynamicBasic: hidden
      ? (player, nodes) =>
          buildNguKiemDaoProvider(player, collectOwnedEvolutionIds(player, nodes))
      : (player, nodes) =>
          buildKiemPhoProvider(
            player,
            collectKiemPhoComboModifiers(player, nodes),
            collectKiemPhoSkillDefinitionModifiers(player, nodes),
          ),
    // P7-M4 - display label for the provider-backed basic (Kiem Pho orb
    // machinery / Ngu Kiem - Ngu Kiem Beta: ONE evolving skill), matching
    // kiemBarBridge's wording.
    describeDynamicBasic: () => ({ name: hidden ? NGU_KIEM_BASE_NAME : 'Kiếm Phổ' }),
  }
}

function createSpellPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      const committedElement = deps.getSpellPathElement()
      // Beta scope: a carried save may commit an out-of-scope element - the
      // engine must not cast its kit, so it resolves as uncommitted.
      const element = committedElement !== undefined && isBetaElement(committedElement) ? committedElement : undefined
      const authoredBasicId = element ? SPELL_KIT_IDS[element]?.[0] : undefined

      const resolved =
        resolveAuthoredBasic(deps, player, authoredBasicId, true) ??
        // P7-M4 - way-authored starter fallback: linh_bao fights as the
        // basic until the element kit supersedes (authored-read - the
        // starter comes off the committed way definition, no literal).
        resolveAuthoredBasic(
          deps,
          player,
          getActiveWayDefinition(player)?.starterBasicSkillId,
          false,
        ) ??
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC

      // Phap Tu Reimagined (spec D1/D2) - the basic's LANDED primary
      // grants +1 The (cap 5 battle-scoped); at 5 the empowered element
      // variant resolves (checked before cast, no consume). Hidden way
      // basics never reach this runtime (F11).
      //
      // Spec D11/D8 seam attach - the KIT basic (never the starter
      // fallback) carries its element's WINDOW landed lane (inert unless
      // the caster holds the Trang buff) and, for metal, the Kim Liet
      // per-stack pierce (spec D7/D11). Stamped BEFORE
      // buildPhapTheVariant so the empowered form inherits both.
      const isKitBasic = element !== undefined && resolved.id === authoredBasicId
      const windowLane = isKitBasic
        ? PHAP_TU_WINDOW_LANDED_CONSEQUENCES[element]
        : undefined
      const kitResolved: TurnSkillDefinition =
        windowLane !== undefined || (isKitBasic && element === 'metal')
          ? {
              ...resolved,
              ...(windowLane !== undefined && windowLane.length > 0
                ? {
                    landedConsequences: [
                      ...windowLane,
                      ...(resolved.landedConsequences ?? []),
                    ],
                  }
                : {}),
              ...(element === 'metal'
                ? {
                    penetrationFromStacks: {
                      ailmentId: 'kim_liet',
                      perStack: KIM_LIET_PENETRATION_PER_STACK,
                    },
                  }
                : {}),
            }
          : resolved

      // The +1 The gain applies to the element basic AND the pre-element
      // starter phase (spec D2 mints The on a landed basic cast to fuel the
      // Phap The empowerment): pre-commit whatever basic resolved IS the
      // legitimate starter; post-commit only a legit resolution mints - the
      // corrupt-state GENERIC_PHYSICAL_BASIC fallback never does. Stamped on
      // `stamped` (not the return wrapper) so the empowered variant inherits
      // it through {...base}.
      // Hoa lane + Tam Muoi trades (Minh rulings 2026-10-06) - the
      // shared node -> authored-def channel folds purchased
      // `skillDefinitionModifiers` aimed at this skill id into a DERIVED
      // copy (cast-scoped stat deltas, damage multiplier, armor pierce,
      // ailment interactions; the derived copy carries `castModifiers`
      // through `stamped` into the empowered variant below).
      const nodeFolded = applyPhapTuSkillDefinitionModifiers(
        kitResolved,
        collectPhapTuSkillDefinitionModifiers(player, deps.nodeRegistry.getAll()),
      )

      // Hoa The gate (Minh ruling 2026-10-04) - the +1 The mint and the
      // Phap The empowerment only exist once the player owns the
      // `hoa_the` node; the node's level sets the mint chance
      // (10%/level). Locked => no stamp, no pool, and
      // resolveMaxThe caps the pool at 0 (see below).
      const hoaTheLevel = deps.getNodeLevel(HOA_THE_NODE_ID, player)
      const stamped: TurnSkillDefinition =
        resolved !== GENERIC_PHYSICAL_BASIC && hoaTheLevel > 0
          ? {
              ...nodeFolded,
              theGainOnLandedCast: 1,
              theGainChance: Math.min(1, hoaTheLevel * THE_GAIN_CHANCE_PER_LEVEL),
            }
          : nodeFolded

      return {
        ...stamped,
        ...(isKitBasic && hoaTheLevel > 0
          ? {
              empowerment: {
                theThreshold: SPELL_PATH_MAX_THE,
                empowered: buildPhapTheVariant(element!, stamped),
              },
            }
          : {}),
      }
    },
    resolveSpecialUltimate(player) {
      const committedElement = deps.getSpellPathElement()
      const element = committedElement !== undefined && isBetaElement(committedElement) ? committedElement : undefined

      if (!element) {
        return {}
      }

      // Spec D8 - kits resolve to {special} only; the legacy ultimate
      // (empowerment@100 chain-E god-ult) is retired.
      const [, specialId] = SPELL_KIT_IDS[element]
      const specialSkill = deps.skillManager.get(specialId)

      return {
        special: specialSkill
          ? {
              // Spec D8/F10 - the five Trang casts pay 30% of LIVE max
              // Linh Luc (evaluated at gate/consume time, never frozen);
              // the authored records carry no flat cost.
              ...applyPhapTuSkillDefinitionModifiers(
                toTurnSkillDefinition(
                  specialSkill,
                  deps.skillSystem.getEffectiveSkill(specialSkill),
                ),
                // Tam Muoi trades + Ngu Hoa (Minh rulings 2026-10-06):
                // node-owned cooldown deltas land on this def (floored
                // at 2 turns inside the fold).
                collectPhapTuSkillDefinitionModifiers(player, deps.nodeRegistry.getAll()),
              ),
              resourceCostPercentOfMax: PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
            }
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
      // Phap Tu An (Task 7) - the special is the repeat-cast skill
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
      // The Tu Reimagined (spec section 5, INV-3) - root-owned kit;
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
    // Beta: no buildSurviveSources; BodyBatTuSurvival reads the
    // ultimate slot that post-beta bat_tu_ba_the will occupy; parked
    // until that content returns.
  }
}

function createHiddenBodyPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  // resolveBasic + resolveSpecialUltimate run back-to-back inside one
  // participant build (resolveCombatRoleComposition); the kit build
  // structuredClones every def, so memoize on the fingerprint - every
  // kit input (hidden-body mods, skill-core levels incl. the quan_the
  // gate) derives from nodeLevels, and nodePathApplies/nodeWayApplies
  // read cultivationPath/way too, so all three join the fingerprint.
  let kitMemo: { fingerprint: string; kit: TheTuAnKit } | null = null
  const kitFor = (player: PlayerData): TheTuAnKit => {
    const fingerprint = JSON.stringify({
      levels: player.nodeLevels ?? null,
      path: player.cultivationPath ?? null,
      way: player.cultivationWay ?? null,
    })
    if (kitMemo?.fingerprint === fingerprint) return kitMemo.kit
    const kit = resolveHiddenBodyKit(deps, player)
    kitMemo = { fingerprint, kit }
    return kit
  }
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // Spec section 6.1 - fixed kit granted at path choice; the built
      // clone's grantsBuffsAtBuild plants ung_the + owned-root markers.
      return kitFor(player).basic
    },
    resolveSpecialUltimate(player) {
      const kit = kitFor(player)
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
// The dispatch table - the ONLY place path:way identity selects behavior.
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
