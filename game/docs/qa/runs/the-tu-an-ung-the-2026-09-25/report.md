# QA run the-tu-an-ung-the-2026-09-25

- phase: DECIDE
- outcome: QA_FIXED_POINT_REACHED
- state: product=14401a4f5efe contract=4c561655be98 attack=8812807dbac1 env=e3ca14a6b377
- base/head: be1bdf8d5f3fa45cbe82318473980b7b03ec9227 -> 70636f2981906a12b56686d13561977270924115

## Findings

- **F-TTA-COR-A1-1** Medium/REAL_DEFECT — CLOSED — Tro `seen` set hoisted outside the per-ally loop — later reactors suppressed
- **F-TTA-COR-A1-2** Medium/REAL_DEFECT — CLOSED — Tro canonical candidates never restricted to enemy side — teammate/self actions could queue counters; applyThamMark same-side hole
- **F-TTA-COR-A1-3** Low/REAL_DEFECT — CLOSED — Multi-reactor tro coverage gap: no test with 2+ tro_kich holders
- **F-TTA-COR-A1-4** Nit/REAL_DEFECT — CLOSED — Parked tu_the/bach_ung defs deleted instead of parked-authored
- **F-TTA-AUT-1** Medium/REAL_DEFECT — CLOSED — SkillCoreNodes.test.ts self-contradicts the restored parked-registered cores — 3 deterministic failures at the pin
- **F-TTA-AUT-2** Low/REAL_DEFECT — CLOSED — actionSource mislabeled 'normal' for non-action declares (ccBlocked, charge tick) — latent provenance violation
- **F-TTA-INT-1** Nit/REAL_DEFECT — DUPLICATE_LINKED — Enemy charge-tick turns grant observation income
- **F-TTA-INT-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Post-victory action still runs Phan/Tro/income windows
- **F-TTA-INT-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Dead reactive_economy capability vocabulary retained on parked buffs
- **F-TTA-COR-1** Medium/REAL_DEFECT — CLOSED — manual mode parks committed reactive follow-ups at AWAITING_INPUT (fake choice, input silently discarded)
- **F-TTA-COR-2** Low/REAL_DEFECT — CLOSED — Ho intercept substitutes target on a rolled-but-unpaid attempt (latent)
- **F-TTA-COR-3** Low/REAL_DEFECT — CLOSED — resolveReactiveProcs once:true early-returns on an unaffordable (unrolled) attempt (latent)
- **F-TTA-COR-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — reactionDebt resets on ccBlocked/charge-turn declares
- **F-TTA-COR-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — hitOutcomeScratch 'taken' default
- **F-TTA-A2-COR-1** Low/REAL_DEFECT — CLOSED — Ung Tre debt resets on suppressed/charging declares, not only on performed normal actions
- **F-TTA-A2-COR-2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — reactive_economy capability riders (procCostFlatDelta/freeProcs/payloadAilments) validated but never consumed
- **F-TTA-A2-COR-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — pendingQueuedExecution dropped unconditionally vs pendingReactiveEntry actorId-checked
- **F-TTA-A2-AUT-1** Low/REAL_DEFECT — CLOSED — Phan window pays cost+debt+gauge for an unqueueable counter when the attacker dies mid-action
- **F-TTA-A2-AUT-2** Low/REAL_DEFECT — CLOSED — reactionDebt resets on ANY natural turn arrival incl. ccBlocked and charge-tick
- **F-TTA-A2-AUT-3** Nit/REAL_DEFECT — CLOSED — stale census counts in SkillCoreNodes.ts comments (15/14 written, 16 actual)
- **F-TTA-A2-AUT-4** Nit/REAL_DEFECT — CLOSED — QUAN_THE authored theGainOnLandedCast duplicated as QUAN_THE_BASE_THE - bake overwrites rather than reads the def field
- **F-TTA-A2-AUT-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — parked reactive_economy payloads (tu_the/bach_ung) validate but have zero runtime consumers
- **F-TTA-A2-AUT-6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — recordHitOutcome keeps an unused `battle` parameter (void battle)
- **F-TTA-A2-INT-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Mid-action actor death suppresses owed (b)-income
- **F-TTA-A2-INT-2** Low/REAL_DEFECT — DUPLICATE_LINKED — reactionDebt/Qua The reset on turn arrival, not performed action
- **F-TTA-A2-INT-3** Nit/REAL_DEFECT — DUPLICATE_LINKED — Stale census comments in SkillCoreNodes.ts
- **F-TTA-A2-INT-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Dead Tham mark lingers on HUD until next isObserved read
- **F-TTA-CLEAN-A3-COR-1** Medium/REAL_DEFECT — CLOSED — reactionDebt resets on turns performing no action (sealed NULL_ACTION / null pick), clearing Qua The early
- **F-TTA-CLEAN-A3-AUT-1** Low/REAL_DEFECT — DUPLICATE_LINKED — reactionDebt resets on a Cam-Cong-sealed NULL_ACTION turn performing no action — diverges from the adjudicated 'normal action' boundary
- **F-TTA-CLEAN-A3-AUT-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — 'holder normal turn' splits into three boundary predicates across quan_the duration, debt reset, observation income
- **F-TTA-CLEAN-A3-AUT-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — resolveHiddenBodyKit built twice per role resolution (resolveBasic + resolveSpecialUltimate)
- **F-TTA-CLEAN-A3-INT-1** Medium/REAL_DEFECT — DUPLICATE_LINKED — sealed NULL_ACTION resets reactionDebt a turn early (independent INT discovery of COR-1)
- **F-TTA-CLEAN-A3-INT-2** Nit/REAL_DEFECT — CLOSED — thamTargetId lazy-cleared inside isObserved — HUD reads the stale field between consults
- **F-TTA-CLEAN-A4-AUT-1** Low/REAL_DEFECT — CLOSED — Debt reset re-derives the actionSource boundary inline
- **F-TTA-CLEAN-A4-AUT-2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — grantTheFromCast duplicates TheEconomy clamp authority
- **F-TTA-CLEAN-A4-AUT-3** Nit/REAL_DEFECT — CLOSED — Doc drift: thamTargetId death-clear still described as lazy-at-read
- **F-TTA-CLEAN-A4-AUT-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Latent paid-but-unqueueable commit path in reactive proc lane
- **F-TTA-INT-A4-1** Medium/REAL_DEFECT — CLOSED — Ung Tre gauge penalty erased by the reaction's own queued bypass drain
- **F-TTA-INT-A4-2** Low/REAL_DEFECT — CLOSED — Reflect-killed Tham An mark leaves thamTargetId stale past action end
- **F-TTA-COR-A5-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Unrouted charged-def fizzle still opens post-action windows on declare-populated affected
- **F-TTA-AUT-A5-1** High/REAL_DEFECT — CLOSED — Stale the_tu_ung_the balance baseline: BalanceMatrix.test.ts fails deterministically (postRitual purchases deleted node ids)
- **F-TTA-AUT-A5-2** Low/REAL_DEFECT — CLOSED — Hard-CC blocking implemented twice: declare-path ccBlocked computation vs window-layer isHardCcBlocked
- **F-TTA-AUT-A5-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — isObserved is a mutating read predicate (lazy-clear inside a boolean query)
- **F-TTA-AUT-A5-4** Nit/REAL_DEFECT — CLOSED — Qua The predicate re-derived in the view layer instead of read from the engine
- **F-TTA-AUT-A5-5** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Paid success with an empty payload queue still commits Ung Tre debt
- **F-TTA-AUT-A5-6** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — resolveMaxThe ownership sits in the phap-tu module while serving all pathways (pre-existing)
- **F-TTA-INT-A5-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Tro window opens on ALLY SKILL casts, not only NORMAL actions
- **F-TTA-INT-A5-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Latent: non-'normal' enemy actions would pay observation income; non-damaging hostile actions open Phan via default 'taken'
- **F-TTA-CLN6-AUT-1** Low/REAL_DEFECT — CLOSED — Qua The rule encoded twice: private engine predicate vs presentation re-derivation
- **F-TTA-CLN6-AUT-2** Low/REAL_DEFECT — CLOSED — quan_the presence-scan duplicated across engine and bridge
- **F-TTA-CLN6-AUT-3** Low/REAL_DEFECT — CLOSED — TheEconomy 'single mutation authority' claim contradicted by bypass writes; quan_the seed rides one
- **F-TTA-CLN6-AUT-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — isObserved predicate mutates state (lazy-clear)
- **F-TTA-CLN6-AUT-5** Nit/REAL_DEFECT — CLOSED — reactive_economy left as a validating dead lane
- **F-TTA-CLN6-AUT-6** Nit/REAL_DEFECT — CLOSED — Stale symbol names in ownership comments
- **F-TTA-CLN6-INT-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Observed-enemy income lane (b) pays on charge-INIT and again on charge-RESOLVE — one logical action, two income events
- **F-TTA-CLN6-INT-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — peekNextActor mutates queue state (dequeueFollowUpActor) — latent double-peek footgun
- **F-TTA-CLN7-AUT-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Paid+success reactive proc with zero resolved targets still commits cost and +1 debt
- **F-TTA-CLN7-AUT-2** Nit/DOCUMENTATION_DEFECT — CLOSED — Stale 'maxTheBonus / node bonus' doc drift (collector channel does not exist)
- **F-TTA-CLN7-AUT-3** Nit/REAL_DEFECT — CLOSED — resolveHiddenBodyKit rebuilt twice per participant build (double structuredClone)
- **F-TTA-CLN7-AUT-4** Nit/REAL_DEFECT — CLOSED — collectKitCloneBuffs scans all players incl. companions while the design assumes primary-only
- **F-TTA-CLN7-INT-1** Low/SPEC_DEFECT — CLOSED — refundGauge floors at 0 - a push_gauge on a debt-negative participant silently erases Ung Tre debt (and a pushback inverts to haste)
- **F-TTA-CLN7-INT-2** Low/REAL_DEFECT — CLOSED — pendingQueuedExecution cleared unconditionally before the actor-id match - committed repeat execution drops on mismatch
- **F-TTA-CLN7-INT-3** Nit/REAL_DEFECT — CLOSED — resolvePhanWindow omits the {once:true} guard resolveInterceptWindow passes - a second same-trigger grant would double-commit
- **F-TTA-CLN8-COR-1** Low/SPEC_DEFECT — CLOSED — wave-lull pacing reset erases Ứng Trệ negative gauge debt
- **F-TTA-CLN8-COR-2** Medium/SPEC_DEFECT — CLOSED — observed enemy killed by action-tail reflect pays no observation income
- **F-TTA-CLN8-AUT-1** Nit/REAL_DEFECT — CLOSED — Tro (Trợ) proc fires every ally action instead of once
- **F-TTA-CLN8-AUT-2** Nit/REAL_DEFECT — CLOSED — inline literal buff ids duplicate TheTuBuffs constants
- **F-TTA-CLN8-AUT-3** Nit/REAL_DEFECT — CLOSED — commitReaction writes actionGauge outside the ActionGauge owner module
- **F-TTA-CLN8-INT-1** Low/SPEC_DEFECT — DUPLICATE_LINKED — duplicate of F-TTA-CLN8-COR-1 (wave-lull debt erase)
- **F-TTA-CLN8-INT-2** Nit/REAL_DEFECT — DUPLICATE_LINKED — duplicate of F-TTA-CLN8-AUT-1 (Tro missing once flag)
- **F-TTA-CLN9-COR-1** Medium/REAL_DEFECT — CLOSED — observed enemy killed inside own action loses income (ward-break retaliation in hit loop; dan_the read post-sweep drops to x1)
- **F-TTA-CLN9-COR-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — suddenDeathMultiplier ignored on reactive-bypass lane
- **F-TTA-CLN9-COR-3** Nit/REAL_DEFECT — CLOSED — consumeGaugeAfterAction docstring claims floor-on-any-drain (stale)
- **F-TTA-CLN9-COR-4** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — legacy engine-unit charge-resolve lane skips post-action windows
- **F-TTA-CLN9-AUT-1** Low/REAL_DEFECT — CLOSED — buff-id literals in TheTuSkills bypass TheTuBuffs constants
- **F-TTA-CLN9-AUT-2** Low/REAL_DEFECT — CLOSED — wave-lull gauge write bypasses ActionGauge primitive
- **F-TTA-CLN9-AUT-3** Nit/REAL_DEFECT — DUPLICATE_LINKED — consumeGaugeAfterAction docstring (dup of COR-3)
- **F-TTA-CLN9-INT-1** Low/REAL_DEFECT — CLOSED — headless lane (resolveNextStep/runToCompletion) never advances pendingEnemySpawns — wave battles whiff to defeat
- **F-TTA-CLN9-INT-2** Low/REAL_DEFECT — CLOSED — peekUpcomingActors ignores queuedExecutions/queuedFollowUps (preview wrong while a repeat/counter is pending)
- **F-TTA-CLN9-INT-3** Nit/REAL_DEFECT — DUPLICATE_LINKED — dan_the read post-sweep (dup of COR-1 part b)
- **F-TTA-CLN10-INT-1** Medium/REAL_DEFECT — CLOSED — followUpChainDepth cumulative in headless lane — queued counters silently dropped after cap
- **F-TTA-CLN10-AUT-1** Low/REAL_DEFECT — CLOSED — RESOURCE_THE 'the' redeclared twice + 5 raw literals mint ops
- **F-TTA-CLN10-AUT-2** Low/REAL_DEFECT — CLOSED — snapshot-absent fallbacks in grantObservationIncome unreachable dead code
- **F-TTA-CLN10-AUT-3** Low/REAL_DEFECT — CLOSED — headless wave lane skips resetGaugeOnWaveLull — positive gauge carries across boundary
- **F-TTA-CLN10-AUT-4** Nit/REAL_DEFECT — CLOSED — recordHitOutcome vestigial battle param (void battle)
- **F-TTA-CLN11-AUT-1** Low/REAL_DEFECT — CLOSED — resolvePhanWindow defaults unrecorded outcomes to 'taken' — phantom phan payload on never-resolved hits
- **F-TTA-CLN11-AUT-2** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — 'bat_tu_ba_the' literals bypass TheTuBuffs constants in TheTuBatTuSurvival.ts
- **F-TTA-CLN11-AUT-3** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Raw actionGauge write on TurnOrderPreview simulation clone
- **F-TTA-CLN11-AUT-4** Nit/REAL_DEFECT — CLOSED — Stale filename in TheTuCapabilities.ts header comment
- **F-TTA-CLN11-INT-1** Medium/REAL_DEFECT — CLOSED — Manual-mode presentation deactivation orphans queued executions/reactive entries — parked awaiting input, then silently dropped on next dequeue
- **F-TTA-CLN11-COR-1** Low/REAL_DEFECT — CLOSED — declareReactiveBypass silently substitutes basic attack when named payload is unregistered
- **F-TTA-CLN11-COR-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — paid+successful reactive attempt commits debt/cost when nothing queued
- **F-TTA-CLN12-COR-1** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — non-damaging hostile cast on the player resolves the evaded branch — under trong_phan mints the premium payload
- **F-TTA-CLN12-COR-2** Nit/REAL_DEFECT — CLOSED — stale test title claims (outcome taken) — assertion could not distinguish the branch
- **F-TTA-CLN12-AUT-1** Nit/REAL_DEFECT — CLOSED — stale function-name reference in comment (resolveTakenWindow retired)
- **F-TTA-CLN13-AUT-1** Low/REAL_DEFECT — CLOSED — externalWard write in TBS-owned lanes not gated on op settle result
- **F-TTA-CLN13-AUT-2** Nit/REAL_DEFECT — CLOSED — Stale comment: charge-resolve 'never reaches this point' false for routed lane
- **F-TTA-CLN13-AUT-3** Nit/REAL_DEFECT — CLOSED — 'phan_chan' literal in kit builder where PHAN_CHAN_BUFF imported
- **F-TTA-CLN13-AUT-4** Nit/REAL_DEFECT — CLOSED — Raw gauge write on simulation clone bypasses ActionGauge primitive
- **F-TTA-CLN13-AUT-5** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — PRE-EXISTING: 'khiem_khich'/'bat_tu_ba_the' literals (out of diff)
- **F-TTA-CLNB-COR-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Latent: double-dequeue overwrites an unconsumed pending queued entry
- **F-TTA-TERM-1** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Co-located participants silently disable Ho intercept and make 'single'-shape hits multi-target
- **F-TTA-TERM-2** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — dan_the multi-instance stacking consumes marks one at a time with a single x3 multiplier

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYCLE-TTA-A: CLEAN; reviews REV-TTA-CLN13-COR,REV-TTA-CLN13-AUT,REV-TTA-CLN13-INT
- cycle CYCLE-TTA-B: CLEAN; reviews REV-TTA-CLNB-COR,REV-TTA-CLNB-AUT,REV-TTA-CLNB-INT

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- OK C6-clean-pair: Clean A/B complete and independent
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: brief(s) lack finalConformance evidence: 
