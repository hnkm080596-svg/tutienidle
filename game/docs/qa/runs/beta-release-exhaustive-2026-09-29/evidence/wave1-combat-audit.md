# Wave-1 blind audit - combat/skills/buffs/stats/talents
# auditor devin-8ff83640, audited SHA f1049b5e42757f14aebee18bab3569dc43c37d09

**QA report — blind correctness review, combat/skills/buffs/procs/stats/talents**
Commit audited: `f1049b5e42757f14aebee18bab3569dc43c37d09` (verified via `git rev-parse HEAD`). Read-only; all findings carry full proof chains.

---

### FINDINGS

**[Medium] Reciprocity cap silently voids PAID committed reactive follow-ups**
- **Location:** `TurnBattleSystem.ts` `dequeueFollowUpActor` ~1112–1118; cost commit at `resolveReactiveProcs`/`commitReaction` and `runLandedHitProcs` (~682).
- **Evidence:** when `followUpChainDepth >= MAX_FOLLOW_UP_CHAIN_DEPTH (4)`, `battle.queuedFollowUps = undefined` drops every remaining queued entry. Those entries are already committed: each paid `theCost` (consume_resource op), `reactionDebt+1`, and `UNG_TRE_GAUGE_PENALTY` (−400 gauge) at window time. Depth resets only on a gauge-ready natural pick; `queuedExecutions` dequeues don't reset it.
- **Expected:** cap rejects uncommitted rolls or defers entries — never voids paid work.
- **Actual:** cost kept (The, debt, −400 gauge); counter silently dropped, no event/log.
- **Repro (proof chain):** ≥5 committed reactive entries queued before the next natural pick — e.g., 4 player-side counters at `resolvePhanWindow`/`resolveAllyActionWindow` plus a Tro/firedFollowUp entry. Each dequeue increments depth 1→4; the next hits the cap and discards the rest.

**[Medium-Low] Effective-stat pipeline has no floor — negative `maxHp`/`speed` produces a zombie + stall paths**
- **Location:** `StatCalculator.runPipeline`/`calculateEffectiveStats` (no output clamp); `StatMetadata.clampStatValue` (no min for `maxHp`/`speed`); `TurnBattleSystem.refreshParticipantStats` ~1041–1044; `EntityVitalsSystem.clampToMaxHp` ~61–68.
- **Evidence:** `refreshParticipantStats` writes `entity.maxHp = stats.maxHp` unconditionally, then `clampToMaxHp` does `Math.min(currentHp, maxHp)` with no `Math.max(0,…)`. `CombatEntity.alive` is a stored flag (not derived from hp) — this path never flips it.
- **Expected:** effective maxHp... [truncated]

[user: Devin Bot (api)] @ 1790691026 (event-01a0ed80a4c97ccfb90efa744b1a30d2)
Report truncated after the Medium-Low stat-floor finding. Send the remainder (any further findings + surfaces-covered + nothing-found notes).

[devin] @ 1790691040 (event-01a0ed80dd7378739f78675645e3cf56)
Continued from stat-floor finding — remainder:

### FINDINGS (cont.)

**[Low] All-slowed terminal divergence: headless = spurious defeat, paced = permanent hang**
- **Location:** `TurnQueue.resolveNextTurn` (null iff nobody living or `MAX_STEPS=100_000` with nobody gauge-ready); `TurnBattleSystem.resolveNextStep` ~4138–4160; `tickPacing` ~1353.
- **Evidence:** every living participant with effective `speed ≤ 0` → `resolveNextTurn` burns 100k steps → null → `resolveNextStep` sets `state='defeat'` even with all players alive and wave incomplete. `tickPacing` (production lane) has no cap: `ready` empty → null forever → combat clock spins, no terminal.
- **Expected:** one terminal semantics (or a declared non-terminal contract).
- **Actual:** same degenerate state → defeat headless vs infinite hang paced. Latent (enemy base speed floors at 80; no −100% slow authored).

**[Low] `preparePresentationResume` does not re-mint the token on the 'manual' phase**
- **Location:** `CombatAnimationRuntime.ts` ~575–620 (`ready`/`cast`/`complete` all call `nextPlaybackToken()`; `manual` returns `{phase:'manual', actorId}` only).
- **Expected:** detach/reattach invalidates stale callbacks on every phase.
- **Actual:** pre-detach callbacks quoting the old token stay valid post-resume — a stale `acknowledgeActionImpact(oldToken)` after `submitTurnChoice`→declare can fire `applyActionImpact` early. Bounded: same battle+actor, single-consume → early apply, never double-apply.

**[Low] BuffSystem `onReapplyDuration:'extend'` corrupts durationless instances**
- **Location:** `BuffSystem.ts` ~267–270: `(instance.remaining ?? 0) + (duration ?? 0)`.
- **Actual:** permanent instance re-applied with `duration === undefined` → `remaining = 0` → expires next Phase B; finite duration converts permanent → finite silently.
- **Repro:** latent — zero live defs use 'extend'.

**[Low] `BuffSystem.apply` create path mints zero/negative-stack instances**
- **Location:** `BuffSystem.ts` ~235: `stacks: Math... [truncated]

Final remainder:

**[Low] `BuffSystem.apply` create path mints ≤0-stack instances** — `BuffSystem.ts` ~235 `stacks: Math.min(req.stacks, maxStacks)`, no ≥1 floor; ZERO-STACK rule only in mutation paths (~408, ~433). `stacks ≤ 0` creates a live instance; `getStatModifiers` × stacks ≤0 → dead/inverted delivery while `buff_applied` reports created:true. Production lanes floor ≥1 — latent.

**[Nit] `consumeStacks` accepts negatives** — `BuffSystem.ts` ~396–423: `stacksAfter = stacksBefore - consumed`, no input guard, no `maxStacks` cap (unlike addStacks/setStacks). No caller passes ≤0.

**[Nit] `applyBossMultiplier` resistance keyed on own element** — `EnemyStatInput.ts` ~361–365: `woodResistance: woodPower > 0 ? +15 : unchanged`. Boss with no `elemental` gets no +15 anywhere; gate reads offense — plausibly intentional, undocumented.

**[Nit] `getTalentCombatPassiveSkillId` returns only first `combat_passive`** — `TalentEffects.ts` ~46–57. Dead accessor; real path `syncTalentCombatPassive` iterates all.

**[Nit, accepted-latent] Ho intercept consumes once-roll + ward before routability** — `resolveInterceptWindow` ~3741–3914: substitution/ward precede plan resolve; declined cast keeps marker+ward on phantom swing. Documented latent.

### SURFACES COVERED
Settlement (GameManagerTurnBattleOps, RewardOps, TurnQueue, ActionGauge, WaveSpawnTrigger, TurnToken, TurnPipeline) · cast→impact (CombatAnimationRuntime, TBS declare/impact/complete, TurnSkillPlanRuntime, SkillExecutor/Resolver, TurnSkillAction) · buff/reaction/proc/reflect/CC (BuffSystem, BuffPersistence, CombatProcSystem, ReactionDispatcher/System/Gate, TBS reactive windows) · stats (resolvePlayerStatAssembly, StatCalculator, StatDomain, StatMetadata, EntityVitalsSystem, EnemyStatInput, PassiveSystem boundaries) · talents (TalentEntitlement, TalentEffects, syncTalentCombatPassive, respecNodeTree).

### NOTHING-FOUND (verified clean)
- Exactly-once: `battleEndEmitted` once-guard across all endings; `rewardsGranted` Se... [truncated]