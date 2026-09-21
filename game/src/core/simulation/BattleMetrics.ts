// P4-M2 - canonical-surface metrics collector for the deterministic
// combat simulation harness. Subscribes to the eventBus during the run
// (the harness owns dispose-on-teardown), samples buff state once per
// CONSUMED step (turn_battle_entity_snapshot - never getElapsedCombatSteps,
// which counts emitted batches that a freeze/stop can drop), and scans
// the scheduler's trace.executions for authored resource ops.
//
// Provenance rules (plan REV5, corrected after lane audit):
// - ward is VITALS-COMPLETE: every ward mutator emits
//   entity_vitals_changed (spendWard/grantWard -> ward_spend/ward_grant,
//   hit-resolution ward drain -> 'damage' before-snapshot, regen ->
//   'regen'). Authored ward ops and engine-lane spends (consume-ward
//   burst) both surface here - the trace lane must NOT recount ward or
//   apply_shield (VitalsShieldAdapter -> grantWard emits too).
// - mana is TRACE-ONLY for authored ops: consumeResourceFor is a raw
//   field write with no vitals emit, so gain_resource/consume_resource
//   settle via trace.executions[].result.result?.applied - SETTLED,
//   not requested. Vitals mp deltas (mana-shield 'damage' drains,
//   regen) supplement without overlap. Routed cast costs DO surface
//   here (plan.cost -> consume_resource op); commitAction->
//   consumeResourceFor is the engine-unit lane only, not the
//   GameManager production path.
// - 'the' is TRACE-SETTLED + RESIDUAL: production Ung The movement is
//   op-routed (hit-outcome income, proc cost/gain, per-round income all
//   emit gain_resource/consume_resource ops -> exact settled totals from
//   the trace lane). The remaining writers are raw currentThe field
//   writes with no event at all (grantTheFromCast skill gains, the
//   empowered-ultimate burn). Those are covered by a battle-level
//   residual: (lastThe - firstThe) - (traceGain - traceSpend) per
//   entity, credited to theGained when positive / theSpent when
//   negative. Raw gain+raw spend inside the same battle still net in
//   the residual (recorded limitation); op-routed traffic never cancels
//   because the trace carries exact applied amounts.
// - absorption = wardAbsorbed + manaShieldAbsorbed (wardAbsorbed already
//   includes externalWardAbsorbed - never add it again); full mitigation
//   (armor/resist/block pre-value) is unobservable - a recorded gap.
// - overheal = max(0, amount - hpDelta) on healing|leech ONLY; regen's
//   `amount` is post-clamp applied so regen overheal is a recorded gap.
// - uptime denominator = steps the entity was ALIVE while
//   phase === 'fighting' (intro/countdown are presentation prelude).
//   Rates use combatDurationSeconds (fighting steps x 0.1s).

import type { GameManager } from '../game/GameManager'
import type { CombatEntityId } from '../battle/contracts/ids'
import type { TurnBattleEntitySnapshotEvent } from '../battle/turn/TurnActionPresentationEvents'
import type { TurnBattleState } from '../battle/turn/TurnBattleSystem'
import type { EntityVitalsChangedEvent, VitalsChangeReason } from '../combat/EntityVitalsSystem'
import type { CombatExecutionRecord } from '../battle/contracts/trace'
import type { CombatOperationOriginKind } from '../battle/contracts/origin'

// P5 - the damage-bearing vitals reasons. HP loss on 'stat_refresh'
// (a max-HP shrink clamps currentHp), regen/healing, ward_* and
// survive_lethal is NOT combat damage - the incoming/outgoing HP
// ledgers admit only these reasons.
export const DAMAGE_VITALS_REASONS: ReadonlySet<VitalsChangeReason> = new Set([
  'damage',
  'dot',
  'ward_break',
  'reaction',
  'reflection',
  'heavenly_tribulation',
])

interface DamageEvent {
  type: 'damage'
  sourceId: string
  targetId: string
  value: number
  hpDamage: number
  wardAbsorbed?: number
  externalWardAbsorbed?: number
  manaShieldAbsorbed?: number
  damageType?: string
  critical?: boolean
}

interface AttackEvent {
  type: 'attack'
  sourceId: string
  targetId: string
  skillId?: string
}

interface DeathEvent {
  type: 'death' | 'kill'
  sourceId?: string
  targetId: string
}

interface ReactionResolvedEvent {
  type: 'reaction_resolved'
  reactionId: string
}

export interface BattleMetrics {
  damage: {
    total: number
    bySource: Record<string, number>
    byType: Record<string, number>
    takenByTarget: Record<string, number>
    dps: number
  }
  absorption: {
    wardAbsorbed: number
    externalWardAbsorbed: number // breakdown field only - already inside wardAbsorbed
    manaShieldAbsorbed: number
    total: number // wardAbsorbed + manaShieldAbsorbed
  }
  healing: {
    total: number // hpDelta>0 on healing|leech|regen
    byTarget: Record<string, number>
    overheal: number // healing|leech only
  }
  resources: {
    byEntity: Record<
      string,
      {
        mpSpent: number
        mpGained: number
        wardSpent: number
        wardGained: number
        theSpent: number
        theGained: number
      }
    >
  }
  casts: Record<string, number> // skillId -> count
  reactions: {
    resolved: Record<string, number>
    resolvedTotal: number
    skipped: number
    perMinute: number // over combatDurationSeconds
  }
  uptime: Record<string, number> // `${roleKey}|${definitionId}` -> buffed-alive-steps / alive-fighting-steps
  deaths: string[] // role keys, spawn order
  // P5 - the COMPLETE HP-damage surface: the `damage` event is a
  // hit-lane subset (resolveActionHit/applyDotDamage only -
  // applyDirectDamage/applyReactionDamage emit vitals alone), so
  // balance KPIs read these vitals-derived ledgers. Damage-reason
  // filtered (DAMAGE_VITALS_REASONS - stat_refresh clamps excluded).
  vitalsDamage: {
    // roleKey(sourceId) -> hp lost by damaged entities ('<unknown>'
    // when the event carries no sourceId). Bilateral diagnostic
    // surface - a player->player self hit lands here too.
    bySource: Record<string, number>
    // roleKey(entityId) -> hp the entity lost.
    byTarget: Record<string, number>
    // P5 plan contract - the player output/attribution denominator:
    // hp lost where source=player AND target is enemy-side. Self/ally
    // damage (a future self-cost mechanic) is excluded so DPS and the
    // unattributed residual measure offense only.
    playerOnEnemy: number
  }
  // P5 - player-sourced damage grouped by the producing operation's
  // origin (trace.executions provenance, settled result.damage
  // .hpDamage). `unattributed` = vitals-derived player damage minus
  // traced player damage - damage emitted outside the scheduler
  // (e.g. ward-break inside resolveActionHit) lands there, so the
  // coverage check is honest instead of claiming completeness.
  damageByMechanic: {
    byKind: Partial<Record<CombatOperationOriginKind, number>>
    bySkillId: Record<string, number> // kind==='skill', per originId
    byReactionId: Record<string, number> // kind==='reaction', per reactionId
    unattributed: number
  }
  // Consumed steps attributed to the phase that SPENT them (pre-step
  // state) - terminal snapshots therefore contribute 0 to their own
  // phase label; the lethal step lands under 'fighting'.
  phaseSteps: Record<string, number>
  // P5 - player hp fraction at the last observed state (snapshot or
  // vitals event, whichever arrived later): the survival-margin scalar
  // for burst-pressure benchmarks. null when the player never appeared
  // in a snapshot (shouldn't happen on the production path).
  playerEndHpFraction: number | null
  // P5 - the player's latest observed maxHp (snapshot visuals) - the
  // pool the stalemate gate compares incoming damage against ("incoming
  // damage cannot kill" = total taken never reached one pool).
  playerMaxHp: number | null
}

// Entity-id normalization: spawned enemies carry crypto.randomUUID() ids,
// so metrics aggregate by ROLE key - 'player', 'companion:<definitionId>',
// 'enemy:<templateId>:<spawnOrdinal>' (ordinal = appearance order per
// template; spawn order is deterministic under the seeded stream).
export class BattleMetricsCollector {
  steps = 0
  fightingSteps = 0
  readonly phaseSteps = new Map<TurnBattleState, number>()
  private lastPhase: TurnBattleState | undefined

  private readonly roleKeys = new Map<string, string>()
  private readonly enemyOrdinals = new Map<string, number>()
  private readonly aliveFightingSteps = new Map<string, number>()
  private readonly buffedFightingSteps = new Map<string, number>() // `${roleKey}|${defId}` -> steps
  private readonly damageBySource = new Map<string, number>()
  private readonly damageByType = new Map<string, number>()
  private readonly damageTaken = new Map<string, number>()
  private damageTotal = 0
  private wardAbsorbed = 0
  private externalWardAbsorbed = 0
  private manaShieldAbsorbed = 0
  private healingTotal = 0
  private readonly healingByTarget = new Map<string, number>()
  private overheal = 0
  private readonly resourceByEntity = new Map<
    string,
    {
      mpSpent: number
      mpGained: number
      wardSpent: number
      wardGained: number
      theSpent: number
      theGained: number
    }
  >()
  private readonly vitalsDamageBySource = new Map<string, number>()
  private readonly vitalsDamageByTarget = new Map<string, number>()
  private vitalsDamagePlayerOnEnemy = 0
  private readonly firstThe = new Map<string, number>() // entityId -> first sampled currentThe
  private readonly lastThe = new Map<string, number>() // entityId -> last sampled currentThe
  private playerEndHpFraction: number | null = null
  private playerMaxHp: number | null = null
  private readonly casts = new Map<string, number>()
  private readonly reactionsResolved = new Map<string, number>()
  private reactionsResolvedTotal = 0
  private reactionsSkipped = 0
  private readonly deaths: string[] = []

  private readonly subscriptions: { type: string; handler: (event: never) => void }[] = []

  constructor(private readonly gameManager: GameManager) {
    const bus = gameManager.eventBus
    const sub = <T>(type: string, handler: (event: T) => void) => {
      const bound = handler as (event: never) => void
      bus.on(type, bound)
      this.subscriptions.push({ type, handler: bound })
    }
    sub<TurnBattleEntitySnapshotEvent>('turn_battle_entity_snapshot', (e) => this.onSnapshot(e))
    sub<DamageEvent>('damage', (e) => this.onDamage(e))
    sub<AttackEvent>('attack', (e) => this.onAttack(e))
    sub<DeathEvent>('death', (e) => this.onDeath(e))
    sub<EntityVitalsChangedEvent>('entity_vitals_changed', (e) => this.onVitals(e))
    sub<ReactionResolvedEvent>('reaction_resolved', (e) => this.onReaction(e))
    sub('reaction_skipped', () => {
      this.reactionsSkipped += 1
    })
  }

  dispose() {
    const bus = this.gameManager.eventBus
    for (const { type, handler } of this.subscriptions) bus.off(type, handler)
    this.subscriptions.length = 0
  }

  private roleKey(entityId: string): string {
    const known = this.roleKeys.get(entityId)
    if (known) return known
    const battle = this.gameManager.getTurnBattle()
    const enemyParticipant = battle?.enemies.find((p) => p.id === entityId)
    let key: string
    if (entityId === 'player') {
      key = 'player'
    } else if (enemyParticipant) {
      const templateId = enemyParticipant.entity.templateId ?? 'unknown'
      const ordinal = (this.enemyOrdinals.get(templateId) ?? 0) + 1
      this.enemyOrdinals.set(templateId, ordinal)
      key = `enemy:${templateId}:${ordinal}`
    } else {
      key = `companion:${entityId}`
    }
    this.roleKeys.set(entityId, key)
    return key
  }

  private onSnapshot(event: TurnBattleEntitySnapshotEvent) {
    this.steps += 1
    // The snapshot's `phase` is POST-step state: a transition step
    // (intro->countdown, countdown->fighting, fighting->terminal) was
    // CONSUMED under the prior phase - the tick that flips the state
    // emits the new label for a step the old phase spent. Attribute the
    // step to the pre-step phase so the last countdown tick never lands
    // in fightingSteps and the lethal fighting step is never dropped.
    const consumedPhase =
      this.lastPhase !== undefined && event.phase !== this.lastPhase
        ? this.lastPhase
        : event.phase
    this.phaseSteps.set(consumedPhase, (this.phaseSteps.get(consumedPhase) ?? 0) + 1)
    this.lastPhase = event.phase
    this.sampleTheBounds()
    if (consumedPhase !== 'fighting') return
    this.fightingSteps += 1
    for (const visual of [...event.players, ...event.enemies]) {
      if (visual.id === 'player' && visual.maxHp > 0) {
        this.playerEndHpFraction = visual.currentHp / visual.maxHp
        this.playerMaxHp = visual.maxHp
      }
      if (!visual.alive) continue
      const key = this.roleKey(visual.id)
      this.aliveFightingSteps.set(key, (this.aliveFightingSteps.get(key) ?? 0) + 1)
      for (const buff of this.gameManager.getBattleBuffs(visual.id as CombatEntityId)) {
        const uptimeKey = `${key}|${buff.definitionId}`
        this.buffedFightingSteps.set(
          uptimeKey,
          (this.buffedFightingSteps.get(uptimeKey) ?? 0) + 1,
        )
      }
    }
  }

  // 'the' bounds sampling: op-routed movement is exact in the trace
  // lane; the residual between (last - first) and the traced net is the
  // raw-write movement no event observes. First sample is the baseline,
  // not income (a participant spawning with a pool reports movement
  // relative to its spawn value).
  private sampleTheBounds() {
    const battle = this.gameManager.getTurnBattle()
    if (!battle) return
    for (const participant of [...battle.players, ...battle.enemies]) {
      const id = participant.entity.id
      const current = participant.entity.currentThe ?? 0
      if (!this.firstThe.has(id)) this.firstThe.set(id, current)
      this.lastThe.set(id, current)
    }
  }

  private onDamage(event: DamageEvent) {
    this.damageTotal += event.value
    const source = this.roleKey(event.sourceId)
    const target = this.roleKey(event.targetId)
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + event.value)
    this.damageTaken.set(target, (this.damageTaken.get(target) ?? 0) + event.hpDamage)
    if (event.damageType) {
      this.damageByType.set(
        event.damageType,
        (this.damageByType.get(event.damageType) ?? 0) + event.value,
      )
    }
    // absorption = ward + manaShield; externalWard is a breakdown OF wardAbsorbed.
    this.wardAbsorbed += event.wardAbsorbed ?? 0
    this.externalWardAbsorbed += event.externalWardAbsorbed ?? 0
    this.manaShieldAbsorbed += event.manaShieldAbsorbed ?? 0
  }

  private onAttack(event: AttackEvent) {
    if (!event.skillId) return
    this.casts.set(event.skillId, (this.casts.get(event.skillId) ?? 0) + 1)
  }

  private onDeath(event: DeathEvent) {
    this.deaths.push(this.roleKey(event.targetId))
  }

  private onReaction(event: ReactionResolvedEvent) {
    this.reactionsResolvedTotal += 1
    this.reactionsResolved.set(
      event.reactionId,
      (this.reactionsResolved.get(event.reactionId) ?? 0) + 1,
    )
  }

  private resourceLedger(entityId: string) {
    const key = this.roleKey(entityId)
    let ledger = this.resourceByEntity.get(key)
    if (!ledger) {
      ledger = { mpSpent: 0, mpGained: 0, wardSpent: 0, wardGained: 0, theSpent: 0, theGained: 0 }
      this.resourceByEntity.set(key, ledger)
    }
    return ledger
  }

  private onVitals(event: EntityVitalsChangedEvent) {
    const hpDelta = event.hpAfter - event.hpBefore
    const mpDelta = event.mpAfter - event.mpBefore
    const wardDelta = event.wardAfter - event.wardBefore

    // Post-battle-end HP deltas still count as the latest observed
    // state - vitals events can arrive after the last snapshot.
    if (event.entityId === 'player' && event.maxHp > 0) {
      this.playerEndHpFraction = event.hpAfter / event.maxHp
    }

    if (
      hpDelta > 0 &&
      (event.reason === 'healing' || event.reason === 'leech' || event.reason === 'regen')
    ) {
      this.healingTotal += hpDelta
      const key = this.roleKey(event.entityId)
      this.healingByTarget.set(key, (this.healingByTarget.get(key) ?? 0) + hpDelta)
    }
    // Overheal: `amount` is the pre-clamp request on healing|leech ONLY -
    // regen's `amount` is post-clamp applied (unobservable -> gap).
    if (
      (event.reason === 'healing' || event.reason === 'leech') &&
      event.amount > hpDelta
    ) {
      this.overheal += event.amount - Math.max(0, hpDelta)
    }

    // P5 - the complete HP-damage surface (see BattleMetrics.vitalsDamage).
    if (hpDelta < 0 && DAMAGE_VITALS_REASONS.has(event.reason)) {
      const lost = -hpDelta
      const source = event.sourceId !== undefined ? this.roleKey(event.sourceId) : '<unknown>'
      const target = this.roleKey(event.entityId)
      this.vitalsDamageBySource.set(source, (this.vitalsDamageBySource.get(source) ?? 0) + lost)
      this.vitalsDamageByTarget.set(target, (this.vitalsDamageByTarget.get(target) ?? 0) + lost)
      if (source === 'player' && target.startsWith('enemy:')) {
        this.vitalsDamagePlayerOnEnemy += lost
      }
    }

    // Ward is vitals-complete: EVERY ward mutation emits here -
    // spendWard/grantWard (ward_spend/ward_grant, covering authored ops
    // AND engine-lane spends like the consume-ward burst), the raw
    // currentWard drain in hit resolution (via the 'damage' event's
    // before-snapshot), and regen. The trace lane therefore counts only
    // raw-write pools (mana via consumeResourceFor, the via
    // currentThe) - authored ward ops must not be re-added on top.
    if (mpDelta === 0 && wardDelta === 0) return
    const ledger = this.resourceLedger(event.entityId)
    if (mpDelta > 0) ledger.mpGained += mpDelta
    if (mpDelta < 0) ledger.mpSpent += -mpDelta
    if (wardDelta > 0) ledger.wardGained += wardDelta
    if (wardDelta < 0) ledger.wardSpent += -wardDelta
  }

  // Authored-op resource lane: settled `applied` from trace.executions,
  // narrowed by status + type. Covers ONLY the raw-write pools - 'mana'
  // (consumeResourceFor field debit) and 'the' (currentThe write) emit
  // no vitals event. Ward ops are excluded on purpose: spendWard/
  // grantWard already emitted the vitals lane, so counting them here
  // would double-count. apply_shield likewise (VitalsShieldAdapter ->
  // grantWard -> ward_grant vitals).
  // P5 - damage-by-mechanic from the canonical provenance seam:
  // record.operation.origin (kind/originId/reactionId) joined to the
  // settled result.damage.hpDamage. Player-sourced ops only - the
  // balance gates compare what the PLAYER's mechanics produced.
  private collectDamageByMechanic() {
    const system = this.gameManager.turnBattleOps.getTurnBattleSystem()
    const executions: readonly CombatExecutionRecord[] =
      system?.combatScheduler?.trace.records ?? []
    const byKind = new Map<CombatOperationOriginKind, number>()
    const bySkillId = new Map<string, number>()
    const byReactionId = new Map<string, number>()
    let traced = 0
    for (const record of executions) {
      const op = record.operation
      const result = record.result
      if (result.status !== 'resolved') continue
      if (op.type !== 'deal_damage' || result.type !== 'deal_damage') continue
      if (this.roleKey(op.origin.sourceId) !== 'player') continue
      // Same contract as the vitals denominator: only enemy-side
      // targets count as player output (self/ally hits excluded).
      if (!this.roleKey(op.payload.targetId).startsWith('enemy:')) continue
      const hpDamage = result.damage?.hpDamage ?? 0
      const kind = op.origin.kind
      byKind.set(kind, (byKind.get(kind) ?? 0) + hpDamage)
      if (kind === 'skill') {
        bySkillId.set(op.origin.originId, (bySkillId.get(op.origin.originId) ?? 0) + hpDamage)
      }
      if (kind === 'reaction' && op.origin.reactionId !== undefined) {
        byReactionId.set(
          op.origin.reactionId,
          (byReactionId.get(op.origin.reactionId) ?? 0) + hpDamage,
        )
      }
      traced += hpDamage
    }
    const vitalsTotal = this.vitalsDamagePlayerOnEnemy
    return {
      byKind,
      bySkillId,
      byReactionId,
      // Damage the vitals lane saw but no trace record claims
      // (non-scheduler lanes, e.g. ward-break inside resolveActionHit).
      unattributed: Math.max(0, vitalsTotal - traced),
    }
  }

  private collectAuthoredResourceOps() {
    const system = this.gameManager.turnBattleOps.getTurnBattleSystem()
    const executions: readonly CombatExecutionRecord[] =
      system?.combatScheduler?.trace.records ?? []
    for (const record of executions) {
      const op = record.operation
      const result = record.result
      if (result.status !== 'resolved') continue
      if (
        (op.type !== 'gain_resource' && op.type !== 'consume_resource') ||
        (result.type !== 'gain_resource' && result.type !== 'consume_resource')
      ) {
        continue
      }
      const applied = result.result?.applied ?? 0
      const ledger = this.resourceLedger(op.payload.targetId)
      const spend = op.type === 'consume_resource'
      // Ward stays out (vitals-complete). 'mana' and 'the' are raw-write
      // pools: mana has no vitals emit at all; 'the' ops are the exact
      // settled totals - raw currentThe writes land via the residual
      // reconciliation in finalize, never double-counted here.
      if (op.payload.resourceId === 'mana') {
        if (spend) ledger.mpSpent += applied
        else ledger.mpGained += applied
      } else if (op.payload.resourceId === 'the') {
        if (spend) ledger.theSpent += applied
        else ledger.theGained += applied
      }
    }
  }

  // 'the' residual reconciliation: net observed movement minus the
  // trace-settled net = the untraced raw-write movement (cast gains,
  // empowerment burn). Runs after collectAuthoredResourceOps inside the
  // memoized finalize, so op totals are already in the ledger.
  private applyTheResidual() {
    for (const [id, first] of this.firstThe) {
      const last = this.lastThe.get(id) ?? first
      const ledger = this.resourceLedger(id)
      const residual = last - first - (ledger.theGained - ledger.theSpent)
      if (residual > 0) ledger.theGained += residual
      else if (residual < 0) ledger.theSpent += -residual
    }
  }

  private sortedRecord<V>(map: Map<string, V>): Record<string, V> {
    return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
  }

  private finalizedMetrics: BattleMetrics | undefined

  // Memoized - the trace scan mutates the resource ledger, so a second
  // finalize (e.g. fingerprint) must reuse the same result, not rescan.
  finalize(gameManager: GameManager): BattleMetrics {
    if (this.finalizedMetrics) return this.finalizedMetrics
    this.collectAuthoredResourceOps()
    this.applyTheResidual()
    const mechanic = this.collectDamageByMechanic()
    const combatSeconds = this.fightingSteps * 0.1
    const uptime: Record<string, number> = {}
    for (const [key, buffed] of this.buffedFightingSteps) {
      const roleKey = key.slice(0, key.indexOf('|'))
      const active = this.aliveFightingSteps.get(roleKey) ?? 0
      uptime[key] = active > 0 ? buffed / active : 0
    }
    const metrics: BattleMetrics = {
      damage: {
        total: this.damageTotal,
        bySource: this.sortedRecord(this.damageBySource),
        byType: this.sortedRecord(this.damageByType),
        takenByTarget: this.sortedRecord(this.damageTaken),
        dps: combatSeconds > 0 ? this.damageTotal / combatSeconds : 0,
      },
      absorption: {
        wardAbsorbed: this.wardAbsorbed,
        externalWardAbsorbed: this.externalWardAbsorbed,
        manaShieldAbsorbed: this.manaShieldAbsorbed,
        total: this.wardAbsorbed + this.manaShieldAbsorbed,
      },
      healing: {
        total: this.healingTotal,
        byTarget: this.sortedRecord(this.healingByTarget),
        overheal: this.overheal,
      },
      resources: { byEntity: this.sortedRecord(this.resourceByEntity) },
      casts: this.sortedRecord(this.casts),
      reactions: {
        resolved: this.sortedRecord(this.reactionsResolved),
        resolvedTotal: this.reactionsResolvedTotal,
        skipped: this.reactionsSkipped,
        perMinute: combatSeconds > 0 ? (this.reactionsResolvedTotal / combatSeconds) * 60 : 0,
      },
      uptime: Object.fromEntries(
        Object.entries(uptime).sort(([a], [b]) => a.localeCompare(b)),
      ),
      deaths: [...this.deaths],
      vitalsDamage: {
        bySource: this.sortedRecord(this.vitalsDamageBySource),
        byTarget: this.sortedRecord(this.vitalsDamageByTarget),
        playerOnEnemy: this.vitalsDamagePlayerOnEnemy,
      },
      damageByMechanic: {
        byKind: this.sortedRecord(mechanic.byKind as Map<string, number>) as Partial<
          Record<CombatOperationOriginKind, number>
        >,
        bySkillId: this.sortedRecord(mechanic.bySkillId),
        byReactionId: this.sortedRecord(mechanic.byReactionId),
        unattributed: mechanic.unattributed,
      },
      phaseSteps: this.sortedRecord(this.phaseSteps as Map<string, number>),
      playerEndHpFraction: this.playerEndHpFraction,
      playerMaxHp: this.playerMaxHp,
    }
    this.finalizedMetrics = metrics
    return metrics
  }

  // Determinism witness: FNV-1a over a stable-stringified normalized
  // digest (raw entity ids never reach it - role keys only). Values are
  // fixed to 4 decimals pre-hash to avoid float-representation drift.
  fingerprint(gameManager: GameManager, outcome: string): string {
    const metrics = this.finalize(gameManager)
    const round = (value: number) => Number(value.toFixed(4))
    const roundRecord = (record: Record<string, number>) =>
      Object.fromEntries(Object.entries(record).map(([k, v]) => [k, round(v)]))
    const digest = {
      outcome,
      steps: this.steps,
      fightingSteps: this.fightingSteps,
      phaseSteps: metrics.phaseSteps,
      damage: roundRecord(metrics.damage.bySource),
      taken: roundRecord(metrics.damage.takenByTarget),
      // P5 - the gate-driving surfaces are fingerprint-covered: a
      // reaction/direct-damage tuning that moves balance output MUST
      // move the fingerprint.
      vitalsDamage: {
        bySource: roundRecord(metrics.vitalsDamage.bySource),
        byTarget: roundRecord(metrics.vitalsDamage.byTarget),
        playerOnEnemy: round(metrics.vitalsDamage.playerOnEnemy),
      },
      damageByMechanic: {
        byKind: roundRecord(metrics.damageByMechanic.byKind),
        bySkillId: roundRecord(metrics.damageByMechanic.bySkillId),
        byReactionId: roundRecord(metrics.damageByMechanic.byReactionId),
        unattributed: round(metrics.damageByMechanic.unattributed),
      },
      absorption: round(metrics.absorption.total),
      healing: roundRecord(metrics.healing.byTarget),
      casts: metrics.casts,
      resources: Object.fromEntries(
        Object.entries(metrics.resources.byEntity).map(([k, v]) => [
          k,
          Object.fromEntries(Object.entries(v).map(([f, n]) => [f, round(n)])),
        ]),
      ),
      reactions: metrics.reactions.resolved,
      uptime: Object.fromEntries(
        Object.entries(metrics.uptime).map(([k, v]) => [k, round(v)]),
      ),
      deaths: metrics.deaths,
      playerEndHpFraction:
        metrics.playerEndHpFraction === null ? null : round(metrics.playerEndHpFraction),
      playerMaxHp: metrics.playerMaxHp === null ? null : round(metrics.playerMaxHp),
    }
    const text = JSON.stringify(digest)
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
  }
}
