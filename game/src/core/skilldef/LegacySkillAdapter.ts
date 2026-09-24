// skilldef/LegacySkillAdapter.ts -- M4: TurnSkillDefinition / Skill /
// EffectiveSkill -> ActiveSkillDefinition.
//
// Coverage map (megaplan v2.1 M4 step 2; every field is either mapped,
// consumed upstream, or reported -- nothing drops silently):
//
//   damage (ActionDamageInfo)          -> deal_damage op:
//     physical/primordial              -> damageType + coefficient
//     elemental components             -> components + coefficient
//     scaling                          -> scaling (verbatim)
//     missingHpBonus*                  -> missingHpBonus* scalar fields
//   appliesAilment(s)                  -> apply_buff ops 'eligible':
//     damaging def                     -> inside deal_damage.onLanded
//                                       (per-landed-HIT parity)
//     non-damaging enemy def           -> for_each_target lane
//     self-scope def                   -> reported (the lane never
//                                       fires on self-scope)
//   detonateDoT                        -> detonate op: inside onLanded
//     (damaging) / per-target after ailments (non-damaging)
//   consumesAilmentId + damagePerStack -> deal_damage.consumeBuff
//     {scope:'any'} (TBS consumes every instance of the id, no source
//     filter)
//   consumesWardForDamage              -> deal_damage.consumeWard
//   healPercentOfDamage                -> deal_damage.healPercentOfDamage
//   appliesBuff(s)                     -> apply_buff ops 'suppressed',
//     appended LAST (post-cast lane); target modes map to target
//     intents; stacksPerAffectedTarget -> max(1, alive_count)
//   externalWardGrant                  -> apply_buff.externalWardGrant
//     (contract v1.6 orchestration metadata; the turn runtime replays
//     the source-tagged ward write at settle -- M5a)
//   chargeTurns / cooldownTurns        -> cadence
//   resourceType + resourceCost        -> cost
//   compositePicks                     -> subcasts.compositePool +
//     compositeCount (pool defs adapt as auxiliaries)
//   repeatCasts / multicast            -> subcasts.count / .multicast
//   empowerment                        -> variants.empowerment;
//     empowered def adapts as an auxiliary
//   consumesAllThe                     -> consumesAllThe (on whichever
//     def carries it -- root burns at its own commit; the empowered
//     form burns when the variant swap resolves)
//   theScaling                         -> theScaling (snapshot.theBurned
//     folds at resolve)
//   theGainOnLandedCast / theGainOnCrit-> grants.theOnLandedCast /
//     .theOnCrit
//   instances.count                    -> instances.count literal
//   instances.each (declarative)       -> instances.each verbatim
//   instances.perInstanceOptions       -> REPORTED when `each` absent
//     (runtime closures cannot be read; providers emit `each` -- see
//     NguKiemDaoProvider)
//   counterable / counterSkillId /
//     emblemOnly / presetId / actionTags -> same-named fields
//   targetScope 'self'/'enemy'         -> targetIntent 'self' /
//     'affected_targets'
//   targeting                          -> CONSUMED UPSTREAM
//     (collectTurnTargets resolves the affected set at declare; the
//     plan reads declaredTargetIds)
//   grantsBuffsAtBuild                 -> CONSUMED UPSTREAM
//     (participant-build channel -- not cast data)
//
// Skill/EffectiveSkill producer path: adaptSkill delegates to
// toTurnSkillDefinition (the Skill -> TurnSkillDefinition bridge moved
// here from the retired SkillToTurnSkillConverter.ts, M5e) and merges
// collectUnsupportedSkillSemantics into the report.

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { SkillId } from '../battle/contracts/ids'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'
import type {
  TurnSkillAilmentApplication,
  TurnSkillBuffApplication,
  TurnSkillDefinition,
} from '../battle/turn/TurnSkillAction'
import type { Skill } from '../skill/Skill'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { SkillEffect } from '../skill/SkillEffect'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'
import type { ActionTargeting } from '../battle/CombatAction'

import type {
  ActiveSkillDefinition,
  SkillSubcasts,
} from './SkillDefinition'
import type {
  AuthoredSkillOperation,
  SkillTargetIntent,
} from './AuthoredOperation'
import type { ScalarExpression } from './ScalarExpression'

// ---------------------------------------------------------------------------
// Output shape -- the adapted root def plus auxiliary defs the root's
// subcasts/variants reference (composite pool members, empowered forms).
// The caller registers ALL of them into SkillDefinitionRegistry.
// ---------------------------------------------------------------------------

export interface AdaptedSkillCatalog {
  root: ActiveSkillDefinition
  /** Referenced defs -- composite pool members, empowered payloads. */
  auxiliaries: readonly ActiveSkillDefinition[]
  /** collectUnsupportedSkillSemantics parity -- loud report of fields
      the adapter could not express as canonical semantics. */
  unsupported: readonly string[]
}

/** Adapt a TurnSkillDefinition (and its composite pool / empowered
    payload transitively) into SkillDefinitions. */
export function adaptTurnSkillDefinition(
  def: TurnSkillDefinition,
): AdaptedSkillCatalog {
  const auxiliaries: ActiveSkillDefinition[] = []
  const unsupported: string[] = []

  const root = adaptOne(def, auxiliaries, unsupported, def.id)
  return { root, auxiliaries, unsupported }
}

/** Skill/EffectiveSkill producer path -- converts through the surviving
    toTurnSkillDefinition bridge, then adapts. Unsupported authored
    fields surface through BOTH reports (converter-thrown errors keep
    their legacy behavior: genuinely unexecutable kits still throw). */
export function adaptSkill(
  skill: Skill,
  effective: EffectiveSkill,
): AdaptedSkillCatalog {
  const catalog = adaptTurnSkillDefinition(toTurnSkillDefinition(skill, effective))
  const merged = [...catalog.unsupported, ...collectUnsupportedSkillSemantics(skill, effective)]
  return { ...catalog, unsupported: merged }
}

/** Registry merge across adapted catalogs. Auxiliary ids repeat across
    catalogs when defs share a pool (the An kit's basic and special both
    composite-pick the same elementPool); identical adaptation output =
    the same source shape -- dedupe to one entry.
 *
 *  Auxiliaries claim id slots BEFORE roots: every resolver `require()`
 *  targets an auxiliary (preResolved payloads, empowered forms,
 *  composite picks) while a root always resolves by reference
 *  (`input.definition`), so a root NEVER needs id-addressing. That
 *  makes three production shapes legal: the An basic's root id
 *  ('doc_chuong') colliding with its own pool member, the empowered
 *  ult's root id ('tat_phuong_giang_the') colliding with its empowered
 *  payload, and two participants carrying same-id different-shape
 *  defs (companion kit clones) -- the auxiliary owns the slot, the
 *  root yields.
 *
 *  An auxiliary-vs-auxiliary same-id/different-shape conflict is a real
 *  ambiguity (picks target the id) -- it stays in the list so the
 *  registry faults loudly (duplicate_id) instead of silently picking
 *  one. */
export function mergeAdaptedCatalogs(
  catalogs: readonly AdaptedSkillCatalog[],
): ActiveSkillDefinition[] {
  const byId = new Map<SkillId, ActiveSkillDefinition>()
  const conflicts: ActiveSkillDefinition[] = []
  const claim = (adaptedDef: ActiveSkillDefinition): boolean => {
    const existing = byId.get(adaptedDef.id)
    if (existing === undefined) {
      byId.set(adaptedDef.id, adaptedDef)
      return true
    }
    return JSON.stringify(existing) === JSON.stringify(adaptedDef)
  }
  for (const adaptedDef of catalogs.flatMap((c) => c.auxiliaries)) {
    if (!claim(adaptedDef)) conflicts.push(adaptedDef)
  }
  // Roots claim unclaimed ids only (registry validation + inspection
  // coverage); any collision yields silently -- see header.
  for (const adaptedDef of catalogs.map((c) => c.root)) {
    claim(adaptedDef)
  }
  return [...byId.values(), ...conflicts]
}

// ---------------------------------------------------------------------------
// Per-def adaptation.
// ---------------------------------------------------------------------------

function adaptOne(
  def: TurnSkillDefinition,
  auxiliaries: ActiveSkillDefinition[],
  catalogUnsupported: string[],
  reportPrefix: string,
): ActiveSkillDefinition {
  const own: string[] = []
  const report = (message: string): void => {
    own.push(message)
    catalogUnsupported.push(message)
  }
  const operations: AuthoredSkillOperation[] = []
  const isSelfScope = def.targetScope === 'self'

  // --- Primary lane ---------------------------------------------------
  if (def.damage !== undefined) {
    operations.push(adaptDamageOp(def))
  } else if (!isSelfScope) {
    // Non-damaging enemy-scope lane (TBS :1926-1947 parity): ailments
    // then detonate then same-source seal interactions, per affected
    // target, unconditionally.
    const inner: AuthoredSkillOperation[] = []
    for (const ailment of ailmentList(def)) {
      inner.push(adaptAilment(ailment, 'loop_target'))
    }
    if (def.detonateDoT !== undefined) {
      inner.push({ type: 'detonate', target: 'loop_target', amp: def.detonateDoT.amp })
    }
    inner.push(...adaptAilmentInteractions(def, 'loop_target'))
    if (inner.length > 0) {
      operations.push({ type: 'for_each_target', target: 'affected_targets', ops: inner })
    }
  } else if (
    ailmentList(def).length > 0 ||
    def.detonateDoT !== undefined ||
    (def.ailmentInteractions ?? []).length > 0
  ) {
    // Self-scope ailment/detonate/interaction payloads never fire in
    // the legacy lane (the non-damaging block requires enemy scope) --
    // report rather than emit never-firing ops.
    report(`${reportPrefix}.appliesAilments(self-scope: lane never fires)`)
  }

  // Consume fields with no primary damage compile to a consume-only
  // deal_damage op (consumeBuff/consumeWard are landed-gated lanes;
  // with no hit they never fire -- legacy identical: they live inside
  // the landed branch).
  if (
    def.damage === undefined &&
    ((def.consumesAilmentId !== undefined && def.damagePerStack !== undefined) ||
      (def.consumesWardForDamage === true && def.damagePerWardPoint !== undefined))
  ) {
    report(`${reportPrefix}.consumesAilmentId/consumesWardForDamage(no damage: consume lane never fires)`)
  }

  // --- Post-cast buff lane (after the whole hit block, TBS :1976) -----
  for (const buffSpec of buffList(def)) {
    operations.push(...adaptBuffSpec(buffSpec, report, reportPrefix))
  }

  // --- Def-level fields ------------------------------------------------
  const subcasts = adaptSubcasts(def, auxiliaries, catalogUnsupported, reportPrefix)
  const variants = adaptVariants(def, auxiliaries, catalogUnsupported, reportPrefix)
  const grants =
    def.theGainOnLandedCast !== undefined || def.theGainOnCrit !== undefined
      ? {
          ...(def.theGainOnLandedCast !== undefined
            ? { theOnLandedCast: def.theGainOnLandedCast }
            : {}),
          ...(def.theGainOnCrit !== undefined ? { theOnCrit: def.theGainOnCrit } : {}),
        }
      : undefined
  const instances = adaptInstances(def, report, reportPrefix)

  return {
    kind: 'active',
    id: def.id as SkillId,
    name: def.id,
    targetIntent: isSelfScope ? 'self' : 'affected_targets',
    ...(def.actionTags !== undefined ? { actionTags: def.actionTags } : {}),
    cadence: {
      cooldownTurns: def.cooldownTurns,
      ...(def.chargeTurns !== undefined ? { chargeTurns: def.chargeTurns } : {}),
    },
    ...(def.resourceType !== undefined &&
    def.resourceType !== 'none' &&
    def.resourceCost !== undefined &&
    def.resourceCost > 0
      ? { cost: { resourceType: def.resourceType, amount: def.resourceCost } }
      : {}),
    ...(def.consumesAllThe === true ? { consumesAllThe: true } : {}),
    operations,
    ...(subcasts !== undefined ? { subcasts } : {}),
    ...(variants !== undefined ? { variants } : {}),
    ...(grants !== undefined ? { grants } : {}),
    ...(def.theScaling !== undefined ? { theScaling: { coeff: def.theScaling.coeff } } : {}),
    ...(instances !== undefined ? { instances } : {}),
    ...(def.presetId !== undefined ? { presentation: { presetId: def.presetId } } : {}),
    ...(def.counterable !== undefined ? { counterable: def.counterable } : {}),
    ...(def.counterSkillId !== undefined ? { counterSkillId: def.counterSkillId as SkillId | null } : {}),
    ...(def.emblemOnly !== undefined ? { emblemOnly: def.emblemOnly } : {}),
    ...(own.length > 0
      ? { adapterUnsupportedMetadata: [...own] }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// Damage lane.
// ---------------------------------------------------------------------------

function adaptDamageOp(
  def: TurnSkillDefinition,
): Extract<AuthoredSkillOperation, { type: 'deal_damage' }> {
  const info = def.damage!
  // M-QI-05 / QI-D3 — native defs carry a CONSTANT multiplier; when the
  // authored levelScaling metadata is present the adapter wraps it in
  // the canonical-level expression:
  //   multiplier x (1 + (max(1, skill_level) - 1) x levelScaling)
  // skill_level is a first-class ScalarExpression query fed by the
  // battle's CastSnapshot.statScalars.skill_level (the canonical core
  // projection), so no def rewrites per level.
  const coefficient: ScalarExpression =
    info.levelScaling !== undefined
      ? {
          op: 'multiply',
          values: [
            info.multiplier,
            {
              op: 'add',
              values: [
                1,
                {
                  op: 'multiply',
                  values: [
                    {
                      op: 'subtract',
                      left: { op: 'max', values: [1, { query: 'skill_level' }] },
                      right: 1,
                    },
                    info.levelScaling,
                  ],
                },
              ],
            },
          ],
        }
      : (info.multiplier as ScalarExpression)

  const base = {
    type: 'deal_damage' as const,
    target: 'affected_targets' as SkillTargetIntent,
    coefficient,
    ...(info.scaling !== undefined ? { scaling: info.scaling } : {}),
    ...(info.missingHpBonusPerMissingPercent !== undefined
      ? { missingHpBonusPerMissingPercent: info.missingHpBonusPerMissingPercent }
      : {}),
    ...(info.missingHpBonusCap !== undefined
      ? { missingHpBonusCap: info.missingHpBonusCap }
      : {}),
  }
  const lane =
    info.kind === 'elemental'
      ? { components: info.components }
      : { damageType: info.kind as 'physical' | 'primordial' }

  const consumeBuff =
    def.consumesAilmentId !== undefined && def.damagePerStack !== undefined
      ? {
          definitionId: def.consumesAilmentId as BuffDefinitionId,
          damagePerStack: def.damagePerStack as ScalarExpression,
          // TBS :2091-2094 -- legacy consumes every instance of the id
          // with NO source filter; Hoa An seal skills (spec sec.62 Cuu
          // Tieu) opt into same-source 'own'.
          scope: def.consumesAilmentScope ?? ('any' as const),
        }
      : undefined
  const scaleBuff =
    def.scalesWithAilmentStacks !== undefined
      ? {
          definitionId: def.scalesWithAilmentStacks.ailmentId as BuffDefinitionId,
          damagePerStack: def.scalesWithAilmentStacks.damagePerStack as ScalarExpression,
          // Spec sec.7 -- a caster's seal skills read only their own
          // instance.
          scope: 'own' as const,
        }
      : undefined
  const consumeWard =
    def.consumesWardForDamage === true && def.damagePerWardPoint !== undefined
      ? { damagePerWardPoint: def.damagePerWardPoint as ScalarExpression }
      : undefined

  // Per-landed-hit consequence ops (resolveDeclaredHit parity):
  // ailments then detonate then same-source seal interactions, inside
  // the hit's landed gate (Phan Thien order: apply -> tick -> modify ->
  // extend).
  const onLanded: AuthoredSkillOperation[] = []
  for (const ailment of ailmentList(def)) {
    onLanded.push(adaptAilment(ailment, 'loop_target'))
  }
  if (def.detonateDoT !== undefined) {
    onLanded.push({ type: 'detonate', target: 'loop_target', amp: def.detonateDoT.amp })
  }
  onLanded.push(...adaptAilmentInteractions(def, 'loop_target'))

  return {
    ...base,
    ...lane,
    ...(consumeBuff !== undefined ? { consumeBuff } : {}),
    ...(scaleBuff !== undefined ? { scaleBuff } : {}),
    ...(consumeWard !== undefined ? { consumeWard } : {}),
    ...(def.healPercentOfDamage !== undefined
      ? { healPercentOfDamage: def.healPercentOfDamage as ScalarExpression }
      : {}),
    ...(onLanded.length > 0 ? { onLanded } : {}),
  }
}

function adaptAilment(
  ailment: TurnSkillAilmentApplication,
  target: SkillTargetIntent,
): Extract<AuthoredSkillOperation, { type: 'apply_buff' }> {
  return {
    type: 'apply_buff',
    target,
    definitionId: ailment.buffDefinitionId as BuffDefinitionId,
    // r4 parity -- eligibility is path metadata; the legacy
    // canInitiateWuxingReactions flag is never consulted.
    reactionEligibility: 'eligible',
    chance: ailment.chance as ScalarExpression,
    ...(ailment.stacks !== undefined
      ? { stacks: ailment.stacks as ScalarExpression }
      : {}),
  }
}

/** Hoa An spec sec.62 -- same-source seal interactions compile to
    selector-bound buff ops against the caster's OWN instance on the
    bound target (identity selector source:'self'). `routes` was already
    filtered at the route seam (applyRouteToTurnSkill) -- the adapter
    emits every surviving entry verbatim.

    When the same def also APPLIES the interacted seal, the op is
    result-gated (spec sec.11/36): it runs only on a successful apply
    and binds the returned instanceId -- a resisted reapply must not
    tick/modify/extend the stale instance. A def that does not apply
    the seal (e.g. xich_viem's next-tick modifier on a pre-existing
    Hoa An) keeps the plain identity lookup. */
function adaptAilmentInteractions(
  def: TurnSkillDefinition,
  target: SkillTargetIntent,
): AuthoredSkillOperation[] {
  const appliedSealIds = new Set(
    ailmentList(def).map((ailment) => ailment.buffDefinitionId),
  )
  // The buffs lane mints apply_buff ops through the same resolver --
  // an interaction on a buffs-lane-applied id is equally result-gated.
  for (const buff of buffList(def)) {
    appliedSealIds.add(buff.definitionId)
  }
  const ops: AuthoredSkillOperation[] = []
  for (const interaction of def.ailmentInteractions ?? []) {
    const selector = {
      kind: 'identity' as const,
      definitionId: interaction.buffId as BuffDefinitionId,
      source: 'self' as const,
      target,
    }
    const gate = appliedSealIds.has(interaction.buffId)
      ? { gateOnApplyResult: true }
      : {}
    switch (interaction.kind) {
      case 'trigger_periodic':
        ops.push({ type: 'trigger_buff_periodic', selector, ...gate })
        break
      case 'add_modifier':
        ops.push({
          type: 'add_buff_modifier',
          selector,
          modifier: interaction.modifier,
          ...gate,
        })
        break
      case 'extend_duration':
        ops.push({
          type: 'extend_buff_duration',
          selector,
          turns: interaction.turns,
          ...gate,
        })
        break
    }
  }
  return ops
}

// ---------------------------------------------------------------------------
// Post-cast buff lane.
// ---------------------------------------------------------------------------

function adaptBuffSpec(
  spec: TurnSkillBuffApplication,
  report: (message: string) => void,
  reportPrefix: string,
): AuthoredSkillOperation[] {
  const target = buffTargetIntent(spec.target)
  if (target === undefined) {
    report(`${reportPrefix}.appliesBuffs.target('${spec.target}' unmapped)`)
    return []
  }
  // externalWardGrant rides the apply_buff op as orchestration metadata
  // (contract v1.6): the settled op's marker instance existence-binds the
  // ward via reconcileExternalWard, and the turn runtime replays the
  // source-tagged write at settle -- the same write applyDeclaredBuff
  // owned. VitalsShieldAdapter still does not route it: entity.externalWard
  // is the The Tu external-ward mechanism, not the native ward pool.

  // applyDeclaredBuff parity: duration = durationOverride ?? duration;
  // stacks = max(1, stacks ?? 1); stacksPerAffectedTarget -> alive
  // count of the action's target set (the AFFECTED lane, independent
  // of the buff's own target scope).
  const stacks: ScalarExpression =
    spec.stacksPerAffectedTarget === true
      ? {
          op: 'max',
          values: [1, { query: 'alive_count', target: 'affected_targets' }],
        }
      : Math.max(1, spec.stacks ?? 1)
  const durationOverride = spec.durationOverride ?? spec.duration

  return [
    {
      type: 'apply_buff',
      target,
      definitionId: spec.definitionId as BuffDefinitionId,
      reactionEligibility: 'suppressed',
      stacks,
      ...(durationOverride !== undefined
        ? { durationOverride: durationOverride as ScalarExpression }
        : {}),
      ...(spec.externalWardGrant !== undefined
        ? { externalWardGrant: { sourceMaxHpRatio: spec.externalWardGrant.sourceMaxHpRatio } }
        : {}),
    },
  ]
}

function buffTargetIntent(
  scope: TurnSkillBuffApplication['target'],
): SkillTargetIntent | undefined {
  switch (scope) {
    case 'self':
      return 'self'
    case 'target':
    case 'action_targets':
      return 'affected_targets'
    case 'allies_except_self':
      return 'allies_except_self'
    case 'all_enemies':
      return 'all_enemies'
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Subcasts / variants / instances.
// ---------------------------------------------------------------------------

function adaptSubcasts(
  def: TurnSkillDefinition,
  auxiliaries: ActiveSkillDefinition[],
  catalogUnsupported: string[],
  reportPrefix: string,
): SkillSubcasts | undefined {
  let compositePool: readonly SkillId[] | undefined
  let compositeCount: number | undefined
  if (def.compositePicks !== undefined) {
    compositeCount = def.compositePicks.count
    const pool: SkillId[] = []
    for (const member of def.compositePicks.pool) {
      pool.push(member.id as SkillId)
      auxiliaries.push(
        adaptOne(member, auxiliaries, catalogUnsupported, `${reportPrefix}.compositePool`),
      )
    }
    compositePool = pool
    // Composite-extras gate (TBS applyActionImpact parity): picks[1..]
    // run as inline payload lanes that resolve the member VERBATIM, but
    // the legacy extras lane only calls resolveDeclaredHit on members
    // WITH damage -- a non-damaging extra is skipped entirely, a
    // multi-instance member loses its instance multiplicity (one hit
    // per target), an explicit targetScope is ignored (extras always
    // hit declared.affected), and appliesBuffs never run for extras
    // (the shared post-cast lane reads payloadSkill = the PRIMARY pick
    // only). A member that could surface as an extra carrying any of
    // those shapes reports the whole catalog unsupported -- TBS then
    // faults the cast loudly (a no-op, never a silent legacy pass).
    if (def.compositePicks.count > 1) {
      for (const member of def.compositePicks.pool) {
        const reasons: string[] = []
        if (member.damage == null) reasons.push('no damage (legacy extras skip it)')
        if (member.instances !== undefined) reasons.push('instances (legacy extras fire once per target)')
        if (member.targetScope !== undefined) reasons.push('targetScope (legacy extras always hit declared targets)')
        if (member.appliesBuff !== undefined || member.appliesBuffs !== undefined) {
          reasons.push('appliesBuff(s) (legacy extras never run the post-cast buff lane)')
        }
        for (const reason of reasons) {
          catalogUnsupported.push(
            `${reportPrefix}.compositePool member '${member.id}' is not expressible as a composite extra: ${reason}`,
          )
        }
      }
    }
  }

  const subcasts: SkillSubcasts = {
    ...(def.repeatCasts !== undefined && def.repeatCasts > 0
      ? { count: def.repeatCasts }
      : {}),
    ...(def.multicast !== undefined ? { multicast: def.multicast } : {}),
    ...(compositePool !== undefined ? { compositePool, compositeCount } : {}),
  }
  return Object.keys(subcasts).length > 0 ? subcasts : undefined
}

function adaptVariants(
  def: TurnSkillDefinition,
  auxiliaries: ActiveSkillDefinition[],
  catalogUnsupported: string[],
  reportPrefix: string,
): ActiveSkillDefinition['variants'] {
  if (def.empowerment === undefined) return undefined
  const empowered = def.empowerment.empowered
  auxiliaries.push(
    adaptOne(empowered, auxiliaries, catalogUnsupported, `${reportPrefix}.empowerment.empowered`),
  )
  return {
    empowerment: {
      theThreshold: def.empowerment.theThreshold,
      empoweredSkillId: empowered.id as SkillId,
    },
  }
}

function adaptInstances(
  def: TurnSkillDefinition,
  report: (message: string) => void,
  reportPrefix: string,
): ActiveSkillDefinition['instances'] {
  if (def.instances === undefined) return undefined
  if (def.instances.perInstanceOptions !== undefined && def.instances.each === undefined) {
    report(
      `${reportPrefix}.instances.perInstanceOptions(runtime closure -- provider must emit instances.each)`,
    )
  }
  return {
    count: def.instances.count as ScalarExpression,
    ...(def.instances.each !== undefined
      ? {
          each: {
            ...(def.instances.each.guaranteedHit !== undefined
              ? { guaranteedHit: def.instances.each.guaranteedHit }
              : {}),
            ...(def.instances.each.execute !== undefined
              ? {
                  execute: {
                    hpPercentBelow: def.instances.each.execute.hpPercentBelow as ScalarExpression,
                    damageMultiplier: def.instances.each.execute.damageMultiplier,
                  },
                }
              : {}),
            ...(def.instances.each.critChance !== undefined
              ? { critChance: def.instances.each.critChance }
              : {}),
            ...(def.instances.each.armorPierce !== undefined
              ? {
                  armorPierce: {
                    bypassChance: def.instances.each.armorPierce.bypassChance,
                    pierceFraction: def.instances.each.armorPierce.pierceFraction,
                  },
                }
              : {}),
          },
        }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function ailmentList(def: TurnSkillDefinition): readonly TurnSkillAilmentApplication[] {
  return def.appliesAilments ?? (def.appliesAilment !== undefined ? [def.appliesAilment] : [])
}

function buffList(def: TurnSkillDefinition): readonly TurnSkillBuffApplication[] {
  return def.appliesBuffs ?? (def.appliesBuff !== undefined ? [def.appliesBuff] : [])
}

// ---------------------------------------------------------------------------
// Skill/EffectiveSkill -> TurnSkillDefinition bridge (retired
// SkillToTurnSkillConverter.ts, M5e -- all legacy-skill translation now
// lives in this file next to the adapter it feeds).
//
// R3 (AR-03) -- Strict Skill -> TurnSkillDefinition field mapper.
// The caller ALWAYS resolves specialization first via
// SkillSystem.getEffectiveSkill(); this function reads only the already-
// resolved EffectiveSkill output.
//
// Strictness contract (spec §4.2):
// - Explicit targetScope: 'self' vs 'enemy'.
// - Pure buff skills ('self' with buff effects) have NO damage.
// - Multiple debuffs and add_stack folding are mapped into appliesAilments.
// - Leech healing (healPercentOfDamage) is preserved.
// - Fails explicitly with an Error on unsupported effect types or invalid
//   configurations — never silently degrades to physical ×1 might.
//
// M10 (ARCH-008) — two extensions:
// - `appliesBuff.duration` carries the authored effect-level duration
//   override (duong_linh_tuyen: 8 turns instead of the registry's 6).
// - Trigger-migrated skills (tram) express their strike as a single
//   onCast -> dealDamage binding instead of a 'damage' effect; that exact
//   shape converts to `damage`. Anything richer throws — the engine has
//   no trigger runtime.
// - Field-level authored data the engine cannot execute (proc-grant
//   counters, multi-hit, zone spawning, spread, ...) is REPORTED through
//   collectUnsupportedSkillSemantics() — never silently dropped (A8).
// ---------------------------------------------------------------------------

const SUPPORTED_EFFECT_TYPES = new Set(['damage', 'debuff', 'buff', 'add_stack'])

const UNSUPPORTED_EFFECT_FIELDS = [
  'hitCountByRealm',
  'hitCount',
  'realmDamageRatio',
  'skillExperienceRatio',
  'stacksPerAffectedTarget',
  // Mission C Task 10d — real authored fields (SkillEffect.ts:11,28;
  // PhapTuChainSkills.ts) that the turn engine cannot execute; report
  // them instead of silently dropping.
  'scope',
  'refresh',
  'grantsZone',
  'zoneElement',
  'swordZoneCharges',
  'swordZoneTickInterval',
  'swordZoneDamageRatio',
] as const

const UNSUPPORTED_SKILL_FIELDS = [
  'breakDamagePerHit',
] as const

const UNSUPPORTED_DEAL_DAMAGE_FIELDS = [
  'realmDamageRatio',
  'skillExperienceRatio',
  'hitCountByRealm',
  'knockbackDistance',
] as const

/**
 * M10 (ARCH-008) — lists authored fields on the resolved skill that the
 * turn engine cannot execute. Callers report these (warn/log) instead of
 * discovering them silently. Keys are stable dotted paths.
 */
export function collectUnsupportedSkillSemantics(skill: Skill, effective: EffectiveSkill): string[] {
  const unsupported = new Set<string>()

  const skillRecord = skill as unknown as Record<string, unknown>
  for (const field of UNSUPPORTED_SKILL_FIELDS) {
    if (skillRecord[field] !== undefined) {
      unsupported.add(`skill.${field}`)
    }
  }

  for (const effect of effective.effects) {
    const record = effect as unknown as Record<string, unknown>
    for (const field of UNSUPPORTED_EFFECT_FIELDS) {
      if (record[field] !== undefined) {
        unsupported.add(`effect.${field}`)
      }
    }
  }

  for (const binding of effective.triggers ?? []) {
    if (binding.trigger !== 'onCast') {
      unsupported.add(`trigger.${binding.trigger}`)
    }
    for (const action of binding.actions) {
      if (action.type !== 'dealDamage') {
        unsupported.add(`trigger.action.${action.type}`)
        continue
      }
      for (const field of UNSUPPORTED_DEAL_DAMAGE_FIELDS) {
        if (action[field] !== undefined) {
          unsupported.add(`trigger.dealDamage.${field}`)
        }
      }
    }
  }

  return [...unsupported]
}

export function toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill): TurnSkillDefinition {
  // Validate that all effects in the effective skill are supported
  for (const effect of effective.effects) {
    if (!SUPPORTED_EFFECT_TYPES.has(effect.type)) {
      throw new Error(`Unsupported skill effect type "${effect.type}" for skill "${skill.id}"`)
    }
  }

  const isSelf = skill.target === 'self'
  const damageEffect = effective.effects.find(isDamageEffect)

  let damage: ActionDamageInfo | undefined

  if (damageEffect) {
    // R3 re-audit (AR-03 gap) — attributeScaling/manaScalingRatio
    // were being silently dropped here (only
    // `.value` survived conversion), so every Pháp Tu skill's
    // authored scaling had zero effect once cast through the turn
    // engine. `undefined` when the skill authors none, so unaffected
    // skills produce an identical damage shape to before.
    const scaling = damageEffect.attributeScaling || damageEffect.manaScalingRatio
      ? {
          attributeScaling: damageEffect.attributeScaling,
          manaScalingRatio: damageEffect.manaScalingRatio,
        }
      : undefined

    if (damageEffect.components && damageEffect.components.length > 0) {
      damage = { kind: 'elemental', components: damageEffect.components, multiplier: damageEffect.value ?? 1, scaling }
    } else if (damageEffect.damageType === 'primordial') {
      damage = { kind: 'primordial', multiplier: damageEffect.value ?? 1, scaling }
    } else {
      damage = { kind: 'physical', multiplier: damageEffect.value ?? 1, scaling }
    }
  } else {
    // M10 (ARCH-008) — trigger-migrated skills (tram) express their strike
    // as onCast -> dealDamage rather than a 'damage' effect. Only the
    // exact single-binding/single-action shape converts; richer kits throw.
    damage = resolveTriggerDamage(skill, effective)

    if (!damage && !isSelf && !effective.effects.some(isDebuffEffect)) {
      throw new Error(`Unsupported: non-self skill "${skill.id}" has neither damage nor debuff effects`)
    }
  }

  const targeting: ActionTargeting = isSelf
    ? { shape: 'single' }
    : (effective.targeting ?? skill.targeting ?? { shape: 'single' })

  const turnSkill: TurnSkillDefinition = {
    id: skill.id,
    cooldownTurns: skill.cooldown,
    targetScope: isSelf ? 'self' : 'enemy',
    resourceType: skill.resourceType,
    resourceCost: skill.cost,
    damage,
    targeting,
  }

  // Three-path design (2026-09-25, ruling #12) - the authored vfxPresetId
  // rides the Skill -> TurnSkillDefinition seam into action_impact.
  // Undefined stays undefined so the runtime keeps its element/default
  // fallback for skills that author none.
  if (skill.vfxPresetId !== undefined) {
    turnSkill.presetId = skill.vfxPresetId
  }

  // Leech healing on hit (e.g. doc_vien_bao_can)
  if (damageEffect?.healPercentOfDamage) {
    turnSkill.healPercentOfDamage = damageEffect.healPercentOfDamage
  }

  // Detonate / ward-burst consume fields (Phase A3)
  if (damageEffect?.consumesAilmentId && damageEffect.damagePerStack) {
    turnSkill.consumesAilmentId = damageEffect.consumesAilmentId
    turnSkill.damagePerStack = damageEffect.damagePerStack
    if (damageEffect.consumesAilmentScope !== undefined) {
      turnSkill.consumesAilmentScope = damageEffect.consumesAilmentScope
    }
  }

  // Hoa An (spec 2026-09-17 sec.62) -- same-source stack-scaled direct
  // damage (Xich Viem) + post-landing seal interactions (Phan Thien).
  if (damageEffect?.scalesWithAilmentStacks !== undefined) {
    turnSkill.scalesWithAilmentStacks = damageEffect.scalesWithAilmentStacks
  }
  if (damageEffect?.ailmentInteractions !== undefined) {
    turnSkill.ailmentInteractions = damageEffect.ailmentInteractions
  }

  if (damageEffect?.consumesWardForDamage && damageEffect.damagePerWardPoint) {
    turnSkill.consumesWardForDamage = true
    turnSkill.damagePerWardPoint = damageEffect.damagePerWardPoint
  }

  // Buff effect (e.g. thanh_tuyen_duong_linh, dia_tru_thua_thien, or specializations)
  const buffEffect = effective.effects.find(isBuffEffect)
  if (buffEffect?.buffId) {
    turnSkill.appliesBuffs = [{
      definitionId: buffEffect.buffId,
      target: isSelf ? 'self' : 'action_targets',
      // M10 (ARCH-008) — authored duration override (e.g. duong_linh_tuyen
      // spec: 8) must reach BuffSystem.apply; without it the registry
      // default silently wins (5.988 instead of 7.984 under resist 0.998).
      ...(buffEffect.duration !== undefined ? { durationOverride: buffEffect.duration } : {}),
    }]
  }

  // Debuff and add_stack effects
  const debuffEffects = effective.effects.filter(isDebuffEffect)
  const addStackEffects = effective.effects.filter(isAddStackEffect)
  const ailments: TurnSkillAilmentApplication[] = []

  for (const debuff of debuffEffects) {
    if (debuff.buffId) {
      ailments.push({
        buffDefinitionId: debuff.buffId,
        chance: debuff.ailmentChance ?? 1,
      })
    }
  }

  for (const addStack of addStackEffects) {
    if (addStack.buffId) {
      const existing = ailments.find((a) => a.buffDefinitionId === addStack.buffId)
      const extraStacks = addStack.stacks ?? 1
      if (existing) {
        existing.stacks = (existing.stacks ?? 1) + extraStacks
      } else {
        ailments.push({
          buffDefinitionId: addStack.buffId,
          chance: 1,
          stacks: 1 + extraStacks,
        })
      }
    }
  }

  if (ailments.length > 0) {
    turnSkill.appliesAilments = ailments
    turnSkill.appliesAilment = ailments[0]
  }

  return turnSkill
}

/**
 * M10 (ARCH-008) — converts a trigger-migrated strike (tram's onCast ->
 * dealDamage) into ActionDamageInfo. Strict shape: exactly one onCast
 * binding with exactly one dealDamage action. Returns undefined when the
 * skill declares no triggers at all; throws on any richer shape — the
 * engine has no trigger runtime, so degrading would silently corrupt.
 */
function resolveTriggerDamage(skill: Skill, effective: EffectiveSkill): ActionDamageInfo | undefined {
  const triggers = effective.triggers

  if (!triggers || triggers.length === 0) {
    return undefined
  }

  const [binding] = triggers

  if (!binding || triggers.length !== 1 || binding.trigger !== 'onCast' || binding.actions.length !== 1) {
    throw new Error(
      `Unsupported trigger kit for skill "${skill.id}": turn combat executes ` +
        'exactly one onCast binding with a single dealDamage action',
    )
  }

  const action = binding.actions[0]!

  if (action.type !== 'dealDamage') {
    throw new Error(`Unsupported trigger action "${action.type}" for skill "${skill.id}"`)
  }

  const scaling = action.attributeScaling || action.manaScalingRatio
    ? {
        attributeScaling: action.attributeScaling,
        manaScalingRatio: action.manaScalingRatio,
      }
    : undefined

  if (action.components && action.components.length > 0) {
    return { kind: 'elemental', components: action.components, multiplier: action.value ?? 1, scaling }
  }

  if (action.damageType === 'primordial') {
    return { kind: 'primordial', multiplier: action.value ?? 1, scaling }
  }

  return { kind: 'physical', multiplier: action.value ?? 1, scaling }
}

function isDamageEffect(effect: SkillEffect): effect is SkillEffect & {
  components?: SkillDamageComponent[]
  consumesAilmentId?: string
  damagePerStack?: number
  consumesAilmentScope?: 'own' | 'any'
  scalesWithAilmentStacks?: { ailmentId: string; damagePerStack: number }
  ailmentInteractions?: SkillEffect['ailmentInteractions']
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  healPercentOfDamage?: number
  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]
  manaScalingRatio?: number
} {
  return effect.type === 'damage'
}

function isDebuffEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string; ailmentChance?: number } {
  return effect.type === 'debuff' && effect.buffId !== undefined
}

function isBuffEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string } {
  return effect.type === 'buff' && effect.buffId !== undefined
}

function isAddStackEffect(effect: SkillEffect): effect is SkillEffect & { buffId: string; stacks?: number } {
  return effect.type === 'add_stack' && effect.buffId !== undefined
}
