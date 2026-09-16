// Battle lifecycle constitution (spec C1/C2, Mission C).
//
// 'tribulation' from spec C2 maps onto 'fresh': tribulation battles are
// run by TribulationDirector (GameManager.startTribulation), a separate
// lifecycle that never enters the turn-battle ops. Do NOT add a
// 'tribulation' kind until a real consumer exists.
export type BattleCycleKind = 'fresh' | 'stage' | 'repeat' | 'test'

// Canonical battle-scoped state that a fresh battle must NOT inherit.
// One entry per reset-inventory row (see the Mission C plan header
// table); the repeat-cycle tests assert each field by name.
export const BATTLE_CYCLE_RESET_FIELDS = [
  'entityVitals', // currentHp/currentMp/currentWard/alive back to build values
  'entityExternalWard', // externalWard source-tagged pool
  'entityTurnsSinceLastHitLanded',
  'entityCurrentThe',
  'participantBuffs', // BuffPool - buffs, debuffs, cc, marks
  'participantGauge', // actionGauge
  'participantCounters', // specialAttackCounter, consecutiveHardCcTurns, baTheTriggeredAtTurn
  'participantCooldowns', // special/ultimate.remainingCooldownTurns
  'participantCharge', // chargingTurnsRemaining, pendingChargedSkillId
  'participantDynamicBasic', // provider resetForBattle or rebuild
  'participantReactivePayloads',
  'battleQueues', // queuedFollowUps, queuedExecutions, followUpChainDepth
  'battleRoundState', // actedThisRound, totalTurnsElapsed, roundsElapsed
  'turnSystemPending', // pendingReactiveEntry/pendingQueuedExecution/gaugeDelta/manualOptions - new instance
  'rewardOnceGuards', // rewardsGranted, battleEndEmitted
  'presentationPending', // runtime.resetPendingState: ready/declared/impact/manual + playbackToken
  'enginePipeline', // clearPendingSteps + pipeline.reset + turnToken.reset
  'boundaryQueue', // ops-level command queue
  'surviveSession', // guard.beginBattle + extraSources rebuilt + setSurviveLethalSession
  'passiveStacks', // resetPassiveStacks then seedPassiveCarry (banked carry)
] as const
export type BattleCycleResetField = (typeof BATTLE_CYCLE_RESET_FIELDS)[number]

export interface BattleCyclePolicy {
  kind: BattleCycleKind
  /** Subset of BATTLE_CYCLE_RESET_FIELDS this kind resets. */
  reset: ReadonlySet<BattleCycleResetField>
  /** 'repeat' skips intro/countdown and enters 'fighting' directly. */
  entryState: 'intro' | 'fighting'
  /** Stage binding to keep/write (repeat keeps the launching stage). */
  preserveStageBinding: boolean
  /** Loot summary accumulates across repeat cycles within one stage. */
  preserveLootSession: boolean
}

export const FRESH_BATTLE_RESET: ReadonlySet<BattleCycleResetField> = new Set(
  BATTLE_CYCLE_RESET_FIELDS,
)

export const BATTLE_CYCLE_POLICIES: Record<BattleCycleKind, BattleCyclePolicy> = {
  fresh: {
    kind: 'fresh',
    reset: FRESH_BATTLE_RESET,
    entryState: 'intro',
    preserveStageBinding: false,
    preserveLootSession: false,
  },
  stage: {
    kind: 'stage',
    reset: FRESH_BATTLE_RESET,
    entryState: 'intro',
    preserveStageBinding: false,
    preserveLootSession: false,
  },
  repeat: {
    kind: 'repeat',
    reset: FRESH_BATTLE_RESET,
    entryState: 'fighting',
    preserveStageBinding: true,
    preserveLootSession: true,
  },
  // 'test' must NOT preserve the loot session: startBattle ALWAYS calls
  // battleLoot.beginBattle() for raw-entity/devtools starts - inheriting a
  // stale receiver/summary would silently leak a prior battle's session
  // into devtools battles.
  test: {
    kind: 'test',
    reset: FRESH_BATTLE_RESET,
    entryState: 'fighting',
    preserveStageBinding: false,
    preserveLootSession: false,
  },
}
