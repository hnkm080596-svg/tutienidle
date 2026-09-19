# Megaplan — M7: Final Battle Wiring & Contract Closure

Status: **ACTIVE — approved implementation-detail authority for Combat Systems Reimagined M7**
Baseline: `4f00f642` (master, post Skill-Definition findings closure)
Parent: `2026-09-17-combat-systems-reimagined.md` (owns execution order only; M7 detail lives HERE)
Atomic rule: ONE worktree, checkpoints are NOT independently mergeable — merge only when all checkpoints complete and all gates pass at 0 Blocker / 0 High / 0 Medium.

## Position

Combat Systems Reimagined has progressed through the buff cutover (M4 + reaction M-INT), the reaction engine (M6, fixture/inert), and the Skill Definition pipeline (M5 + post-merge findings closure). The intended production architecture already exists:

```
TurnSkillDefinition
  -> LegacySkillAdapter
  -> SkillDefinition
  -> SkillResolver
  -> ResolvedSkillPlan
  -> SkillExecutor
  -> CombatScheduler
  -> CombatOperationExecutor
  -> Domain Authorities
```

M7 is NOT another rewrite. M7 proves, hardens, and closes this architecture:

- single production ACTIVE skill pipeline
- single Buff authority
- single mutation authority per combat domain
- deterministic combat execution
- no scheduler bypass
- no hidden compatibility execution lane
- complete causal trace/provenance
- full contract coverage
- real runtime/E2E proof

M7.0–M7.5 are checkpoints inside this one mission, not phases.

## Architecture constraints (binding)

Do NOT:

- redesign SkillDefinition
- reintroduce legacy production fallback
- add custom skill-id handlers
- add runtime closure registries
- move hit/crit/armor RNG into SkillExecutor
- activate production Reaction (dispatcher unregistered, `elemental_reaction_enabled` absent, content deferred to the seal batch)
- author seal/Ngo Dao content
- rewrite Buff architecture
- create a second scheduler

M7 closes architecture; it does not create another one.

## Checkpoints

### M7.0 — Baseline + current-state inventory (read-only)

Verify current post-Skill state **from code** (not commit messages). Prove and record:

- **Skill:** M1–M5 merged; ONE production ACTIVE skill pipeline; runtime-present unsupported casts do NOT fall back to legacy execution (loud report + no-op); `runtime === undefined` engine-unit lane is test-only/non-production. Trace an actual production cast path (selection -> adapter -> resolver -> executor -> scheduler -> operation executor -> authority) with exact files/functions.
- **Buff:** buff2 `BuffSystem` is sole battle Buff authority; legacy `core/buff` authority absent; `BuffPool` battle lane absent.
- **Reaction:** reaction core exists; legacy Reaction manager absent; production `ReactionDispatcher` unregistered; `elemental_reaction_enabled` granted to nobody; production Reaction inert. Do NOT activate Reaction in M7.
- **Scheduler:** production use of `CombatScheduler`, `CombatOperationExecutor`, `CombatAuthorityPorts`, `CombatTrace`, `CombatTraceExporter` — no recreation.
- **Authority matrix:** every battle-reachable mutation (HP damage, healing, native ward, external ward, buff apply/remove/stack/duration, resource spend/gain, gauge mutation, cooldown/charge, reaction payoff, death lifecycle) -> canonical owner, production caller, operation/path, legal exceptions. A second gameplay authority is a finding.
- **Composition map:** for `TurnBattleSystem`, `SkillResolver`, `SkillExecutor`, `CombatScheduler`, `CombatOperationExecutor`, `DamageAuthority`, `BuffSystem`, `GaugeAuthority`, `ResourceAuthority`, `CombatTrace`, `CombatTraceExporter`, `ActionValidator`, `ReactionSystem`, `ReactionDispatcher` — where constructed, lifetime, production vs test-only, injected dependencies.

Output: `game/docs/architecture/YYYY-MM-DD-m7-final-battle-wiring-inventory.md`.

### M7.1 — Authority & composition closure

Battle-reachable runtime only — not a whole-project rewrite.

- **Mutation bypass audit:** direct gameplay writes to `currentHp`, `alive`, `currentWard`, `currentMp`, `currentThe`, `actionGauge`, `BuffInstance.stacks`, `BuffInstance.duration`, cooldown state -> classify owner-internal / init-setup / restore-load / invalid bypass. Fix invalid battle-reachable bypasses.
- **Scheduler bypass audit:** cross-system gameplay mutation without `CombatOperation -> CombatScheduler -> CombatOperationExecutor -> owning authority` — skill, reaction, proc, buff periodic bridges, reactive/follow-up execution, resource grants, gauge effects. Same-authority internal lifecycle allowed; cross-authority direct mutation is not.
- **combatSequence ownership:** only `CombatScheduler` allocates canonical `combatSequence`. Any second runtime allocator is a BLOCKER.
- **RNG ownership:** canonical damage requires injected `CombatRng`; no `Math.random` fallback in canonical battle damage path; `SkillExecutor` never rolls hit/crit/armor; verify every composition root.
- **Skill producer coverage:** the hardened coverage mechanism must fail when a new production producer is added until represented — prove the failure mode, not merely a minimum-count guard.
- **externalWard boundary:** do NOT merge into native Ward. Prove one canonical owner/writer contract, source-tagged replace semantics, existence-bound marker semantics, native ShieldAuthority does not accidentally own it. Multiple battle-reachable writers -> close the collision.

### M7.2 — Full contract closure matrix

Output: `game/docs/qa/YYYY-MM-DD-m7-contract-closure-matrix.md`.

- Cover Combat Contract base sections + all addenda through the current contract version (expected ~v1.6 after Skill closure).
- Classify every requirement: **A** new M7 integration test / **B** existing named lower-level test / **C** not applicable to final production composition with explicit reason. No unmapped requirements; no duplicated lower-level tests.
- Update `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` status -> `FINAL — ACTIVE CONTRACT` style consistent with the repo; sync references to actual current Skill Definition / Buff System / Reaction System versions without altering settled semantics.

### M7.3 — Canonical integration acceptance

Create/extend a whole-stack integration suite (e.g. `game/src/core/battle/turn/TurnBattleSystem.contract.test.ts`) on real canonical runtime components. Reaction scenarios use fixture-only composition; production Reaction stays inert.

Coverage equivalent to contract §§91–102:

1. **Application failure** — failed elemental application -> no state commit, no committed-application event, no Reaction evaluation.
2. **Max-stack refresh** — `addedStacks = 0`; duration may refresh; no Reaction.
3. **Generic AddStacks** — generic stack mutation must not masquerade as a new elemental application.
4. **Post-settlement read** — apply state -> Reaction consumes it -> `read_stacks` observes post-Reaction state.
5. **Stale Reaction snapshot** — whole reaction batch skips atomically; no partial consume/payoff.
6. **Death mid-batch** — earlier committed ops stay committed; later invalid ops skip; no rollback.
7. **Exactly once** — duplicate immediate event id processes once.
8. **Sequential multicast** — each subcast fully settles before the next resolves.
9. **Source isolation** — per-source elemental state cannot be consumed by another caster.
10. **Origin/provenance** — `skill` / `buff_periodic` / `reaction` fixture origins carry correct causal lineage.
11. **Cam Cong** — attack-only restriction must not behave like stun.
12. **Buff lifecycle ownership** — BuffSystem may mutate its own private state inside lifecycle authority without fake cross-system ops.

Additional Skill whole-stack acceptance (real `TurnBattleSystem` composition, not isolated `SkillExecutor`):

- root cooldown commits once; root resource cost commits once
- whiff does not roll back committed cost/cooldown
- repeat does not repay; multicast does not repay; composite extras do not repay
- charge init commits; charge resolve does not recommit
- dead target during charge resolves safely
- unsupported runtime cast = loud no-op, never production legacy fallback

Production Reaction boundary: fixture composition only — fixture `ElementalStateRegistry`, `ReactionRegistry`, capability query, `ReactionSystem`, `ReactionDispatcher`, `CombatScheduler` inside tests. No production wiring changes.

### M7.4 — Determinism & trace closure

- **Same-seed whole battle:** representative battle (skill damage, buff application, periodic damage, resource mutation, proc, repeat/multicast, death, fixture Reaction) run twice with same initial state + commands + seed -> assert equality of final HP, alive, buff state, resources, gauge, cooldowns, operation results, events, trace records, causal metadata.
- **Different-seed test:** controlled seeds/roll fixtures landing on opposite sides of a known threshold -> assert the exact expected divergence (no arbitrary `not.toEqual`).
- **Causal graph:** provenance reconstructable through `rootActionId`, `parentOperationId`, `causationEventId`, `causationOperationId`, `castId`, `subcastIndex`, `reactionId` — never inferred from sequence ordering alone.
- **CombatTraceExporter:** already exists — verify it correctly exposes executions, events, faults, batch skips, skipped results, chronological journal, causal metadata. Harden only where coverage/evidence is missing.

### M7.5 — Runtime, Playwright, deletion & DoD closure

- **Journey 1 (real production battle):** battle starts -> active skill executes through the SkillDefinition pipeline -> damage settles -> buff applies -> buff lifecycle/periodic resolves -> target death -> presentation/result correct. Adapter-lifted production content is acceptable.
- **Journey 2 (real content with repeat/multicast/charge/dynamic extra):** assert no duplicate cast, duplicate cooldown, duplicate cost, phantom action, battle freeze.
- **Deletion / legacy sweep:** every `TurnReactionManager`, `canInitiateWuxingReactions`, legacy buff authority, `SkillToTurnSkillConverter`, legacy production active-skill execution, silent runtime fallback, direct cross-authority mutation helper hit must be test-only, historical documentation, or explicitly justified.
- **CON-01 -> CON-23 evidence:** `game/docs/qa/YYYY-MM-DD-m7-contract-closure-deep.md` — every invariant: PASS/FAIL, implementation evidence, named automated test, relevant file, notes. No PASS by suite-green alone.
- **Definition-of-Done mapping:** every contract DoD item including current addenda -> implementation evidence + named test. Explicitly include: Skill damage-policy RNG authority, cleanse limit, Skill cast commit, scheduler settlement barriers, periodic correlation, causal provenance, stale Reaction semantics, sequence ownership.

## Gates

- `npm run type-check`, `npm run build`, `npx vitest run` — prefer final `npm run verify`.
- Focused: skilldef, TurnBattleSystem contract/integration, buff acceptance, reaction fixtures, scheduler, determinism, architecture tests.
- P13/P14: Playwright real battle from this worktree (`npm run dev`, actual port).
- **P18** OpenCodeReview over the complete M7 diff — 100% coverage; untracked files read fully.
- **P4** DEEP QA (not quick): authority ownership, cross-system mutation, duplicate execution, resource conservation, ordering, dead source/target, stale state, determinism, composition drift, runtime/presentation boundary.
- **P5** sequential multi-pass review over evolving states (Pass 1 local correctness -> Pass 2 architecture/authority -> Pass 3 adversarial integration; a Medium+ fix on the last pass forces another pass).

## Completion

- All checkpoints complete; all gates pass; 0 Blocker / 0 High / 0 Medium.
- Update this plan + parent roadmap: Combat Systems Reimagined runtime architecture CLOSED; production Reaction/content activation remains a separate later batch (seal batch owns canonical reaction content, dispatcher registration, Ngo Dao grant, payoff defs, Cam Cong production buff).

## Execution log

| Checkpoint | State | Evidence |
|---|---|---|
| M7.0 | DONE | `docs/architecture/2026-09-21-m7-final-battle-wiring-inventory.md` — composition roots, authority write audit, sequence allocators, retired-architecture sweep |
| M7.1 | DONE (`9bf0dbd4`) | externalWard write through adapter seam; dead legacy helper removal; production `TurnBattleSystem` construction guard (`damageAuthorityRng.test.ts`) |
| M7.2 | DONE | `docs/qa/2026-09-21-m7-contract-closure-matrix.md` §1–105 + addenda + CON/DoD classification; contract spec status `FINAL — ACTIVE CONTRACT` |
| M7.3 | DONE (`2a89ddb9`) | `TurnBattleSystem.contract.test.ts` — 22 whole-stack acceptance tests (§§91–102 + skill stack incl. charge + composite no-repay); §49 per-op validity gate moved into shared `CombatOperationBatchRunner`; fixture `setRandomSource` bind |
| M7.4 | DONE (`ca9835c9`) | `TurnBattleSystem.determinism.test.ts` — 7 tests: same-seed parity, controlled divergence, causal-graph reconstruction, stale-batch export; `FixtureReaction.ts` shared composition + dormancy allowlist |
| M7.5a | DONE | `GameManager.skillPipelineJourney.test.ts` journey 1 — real wood path `doc_chuong` → `trung_doc` DoT → enemy death → victory |
| M7.5b | DONE | Journeys 2–3 — real An kit (`da_phap_lien_tuyen` repeat + `van_phap_tuy_tam` multicast, exactly-once commit/cooldown) + companion `van_du_kiem_khach_ultimate` charge (`chargeTurns: 2`, deferred resolve, no mid-charge action) |
| M7.5c | DONE (`267ec23d`) | Deletion sweep: TurnReactionManager/wuxing/BuffPool/converter/per-id lanes all absent or comments-only; engine lane test-only; construction guard extended to runtime arg |
| M7.5d | DONE (`6714f86a`) | `docs/qa/2026-09-21-m7-contract-closure-deep.md` — CON-01..23 PASS with mechanism + named test + notes; production boundary proofs; DoD emphasis mapping |
| M7.5e | DONE | Playwright real-battle in worktree: `create-to-combat.spec.ts` (2.2m) + `turn-combat-hud.spec.ts` (3.5m) PASS serially; parallel 2-worker run starved RAF (contention, not regression — serial rerun green) |
| Gates | DONE | `npm run verify` 683f/5821t green; P18 OCR 100% coverage (1 Low fixed `877f9022`); P4 deep QA `docs/qa/2026-09-19-m7-battle-wiring-deep.md` PASS WITH EVIDENCE; P5 3 sequential passes clean (Pass 1 fixed deferred-after-invalid-skip cascade coverage); roadmap row added |
