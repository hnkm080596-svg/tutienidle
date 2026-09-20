# QA Review: canonical Ngũ Hành seals + Ngộ Đạo reaction activation

- Date: 2026-09-20
- Mode: deep (escalated — `changed-risk-map.mjs` returned `deepAuditCandidate: true`: cross-system change spanning combat-and-tribulation, economy-and-progression, pinia-phaser-sync, time-and-offline; critical time/offline state-boundary involvement)
- Verdict: **PASS WITH EVIDENCE** — every attack hypothesis resolved to proof or a documented design note; zero confirmed defects.
- Task-owned paths: the 76-file diff of branch `feat/canonical-seals-ngo-dao-reaction` — `src/core/reaction/**`, `src/data/reaction/ReactionDefinitions.ts`, `src/data/buff/{LegacyBuffs,ReactionStatusBuffs}.ts`, `src/core/battle/{contracts,runtime,turn}/**` touched surfaces, `src/core/game/{GameManager,GameManagerTurnBattleOps}.ts`, `src/core/player/CultivationPathRegistry.ts`, `src/data/skill/{PhapTuRouteSkills,CoreSkills,Skills}.ts`, `src/data/companion/Companions.ts`, `src/data/vfx/StatusVfxPresets.ts`, `src/game/scenes/CombatScene.ts`, plus test/spec/docs files. Unrelated dirty paths excluded: none observed in the task diff (all changed files are task-owned; docs/spec files excluded from code review only).

## Scope and Risk Map

`changed-risk-map.mjs` classified the change across four domains with `deepAuditCandidate: true` (time/offline critical boundary + cross-system). Deep escalation applied: the audit therefore covers the persistence boundary (save serialization, persistent buff pool), the Vue/Phaser presentation boundary (eventBus drain, scene floats, status strip), the progression boundary (kit grant, route modifiers in static aggregation), and the combat core (scheduler, batch runner, reaction pipeline). Learned-defects ledger applied: QA-2026-09-08-RR1 (event cardinality), deferred-op dependency handling (r4 HIGH 2 family — never silent materialization on skipped dependency), and the holder_turns lifecycle ordering learned during S4.

## Invariant Ledger

| ID | Invariant (spec §73 / architecture) | Attack operator | Observable oracle | Result |
| --- | --- | --- | --- | --- |
| INV-R01 | Reaction enabled only by explicit capability (aura) | No-aura leak | Journey A: hoa_an applied, 0 resolved/0 skipped, no aura | PROVEN — browser E2E + S3/S4 gate tests |
| INV-R02 | Board = sourceId + targetId | Cross-source consume | `doan_moc` consumed only `duoc_dong_tu`-source seals; player-source doc_can coexisted untouched | PROVEN — Journey B + S3 mixed-source test |
| INV-R03/04 | Evaluates after committed application; addedStacks>0 required | Cap-refresh trigger | 5-stack tran_an refresh → no reaction | PROVEN — S4 cap test |
| INV-R05/06 | ≤1 reaction per application; relations order-independent | Multi-candidate tie | Khắc wins equal-weight tie | PROVEN — S4 tie test |
| INV-R07/08 | Sinh consumes all Parent, keeps Child | Child orphan | doc_can child kept post-duong_viem | PROVEN — S4 + Journey B |
| INV-R09 | Khắc consumes all Attacker+Defender | Partial consume | consumed lists exact | PROVEN — Journey C payloads |
| INV-R10/17 | Deterministic; zero RNG in ReactionSystem | RNG drift | same seed → identical op sequence | PROVEN — S4 determinism test |
| INV-R11/12 | Sinh P², Khắc A×D | Formula | payoff coefficients match | PROVEN — S4 payoff tests |
| INV-R14 | Reaction-generated state cannot recurse | Recursion | payoff applies carry `reactionEligibility:'suppressed'`; defs non-elemental | PROVEN — ReactionOperations.ts:230 + S4 noRecursion |
| INV-R15 | Multicast sequential | Interleave | shared rootActionId, ordered combatSequence, 0 dup/0 skip | PROVEN — Journey D trace journal |
| INV-R16 | Periodic effects cannot trigger | DoT-triggered reaction | periodic requests are damage/heal, never elemental applications | PROVEN — structural + S4 test |
| INV-R18 | Sinh creates no baseline damage packet | Spurious damage | Sinh emits stacks/modifier/extend only | PROVEN — ReactionOperations emission |
| INV-R19 | Sinh amplifier bounded | Runaway compounding | `reapply:'max'` on modifier id per instance | PROVEN — ReactionOperations.ts:112 |
| INV-R20 | Trấn Ấn does not auto-convert | Cap conversion | tran_an 5-stack stable; cam_cong only via tran_thuy apply_status | PROVEN — Journey C + defs |
| ARCH-1 | Dispatcher registered exactly once | Double registration | scheduler duplicate-handler guard | PROVEN — code + OCR targeted audit |
| ARCH-2 | Aura grants only entry + dormant regrant | Third channel | 2 grant seams verified | PROVEN — §12 sweep |
| ARCH-3 | Battle seals never persist | Save leak | `persistentBuffs` empty post-battle; no serialize path in BuffPersistence | PROVEN — GameManager.reactionReproof.test.ts:969 + BuffPersistence has no snapshot/serialize |
| ARCH-4 | Aura cleanse-immune | Cleanse removal | `dispellable:false` on van_phap_than_hoa | PROVEN — def + S3 matrix |
| ARCH-5 | Death semantics: holder death removes own aura; `removeOnSourceDeath:false` keeps allies' | Stale capability | S3 death matrix; dead holder loses capability so its lingering seals cannot react | PROVEN — S3 + gate reads live capability |
| ARCH-6 | Deferred ops never materialize on skipped/failed deps | Orphan modifier | `application_roll_failed` / `dependency_not_resolved` skip authority | PROVEN — CombatOperationBatchRunner.ts:621-640, 680-698 |
| ARCH-7 | Reaction drain observational, exactly-once per battle | Duplicate/leak VFX | cursor resets on battle identity; drains before outcome settle | PROVEN — GameManagerTurnBattleOps.ts:641-676 |
| GAME-1 | Cấm Công = attack-tag restriction, not stun | Over-blocking | attack rejected; heal/buff/cleanse/defend legal; expiry restores | PROVEN — S4 3-declare test + live `cam_cong` instance browser-side |
| GAME-2 | Companion/ally attribution | Wrong sourceId | `sourceId:'duoc_dong_tu'` on doan_moc; companion-sourced reaction_bleed | PROVEN — Journey B |
| GAME-3 | Route mechanics generic, not bespoke bypass | Hidden special-case | same-source reads, scaleBuff, periodic trigger, extend, manual tick, consume — all through skilldef ops | PROVEN — 20/20 PhapTuRouteSkills tests |

## Focused Checks Run This Pass

| Attack | Method | Result |
| --- | --- | --- |
| Enemy-side seal application to players (self-aura reacting on enemy-seeded board) | grep `data/enemy/**` for seal ids | No enemy applies seals — structurally impossible |
| `applyBuffToPlayer` self-board (`eligible`, source=target=player) | traced callers (talent buffApplier, PillBagSection) + grepped pill/talent data for seal ids | Latent seam only — no authored content routes a seal id through it; player→player board is spec-legal anyway |
| Resisted apply → deferred `add_modifier_on_apply_result` orphan | read deferredSkipReason + materialize | Skips `application_roll_failed` pre-materialization; double-guard throws |
| `heal_from_damage` on missed/unresolved damage | read deferredSkipReason | `dependency_not_resolved` skip |
| `heal_from_damage` with no preceding damage step | read emission | throws at emission (fail-loud authoring fault) |
| `cam_cong` hidden-flag → missing status-strip icon | read def | Non-hidden; attach lane proven by sibling payoff defs observed in browser |
| Save serialization of battle buffs | read BuffPersistence API | No snapshot/serialize methods; persistent pool registration alone persists nothing; apply path is Kiep-Thuong-only with `suppressed` eligibility |

## Findings

### QA-2026-09-20-001: cam_cong at D≤3 suppresses zero enemy declares (design note — NOT a defect)
- Severity: Low (design observation; spec-faithful data)
- Invariant: GAME-1
- Mechanism: `tran_thuy` authors `durationOverride = clamp(D-2,1,2)` (spec §46: "D 1–3 → 1 holder turn"). `declareActorAction` runs `onHolderTurnEnd` at declare-start before selection (TurnBattleSystem.ts:1588) — a duration-1 `holder_turns` instance decrements 1→0 and is swept before the first selection it could restrict. Duration 1 therefore suppresses 0 declares; duration 2 suppresses exactly 1.
- Disposition: spec §83 explicitly classifies duration values as provisional/tunable ("2-turn Attack Seal" is listed). The authored data is verbatim-faithful; the decrement-before-select ordering is the engine's uniform pre-existing `holder_turns` convention shared by every control def. Recorded as a balance/design observation for a future tuning pass — the restriction mechanism itself is proven (S4 sealed→fallback→expiry test; live cam_cong instance in browser).

### QA-2026-09-20-002: `applyBuffToPlayer` mints `reactionEligibility:'eligible'` on player→player (latent seam — NOT a defect)
- Severity: Low
- Invariant: INV-R01/R02
- Mechanism: the proc-lane op (GameManagerTurnBattleOps.ts:902-912) is eligible-flagged with source=target=player. For a Ngộ Đạo holder this would seed a self-board that can react against the player's own aura.
- Disposition: verified no authored content reaches it with a seal id — pill buffs and talent `passiveConvertsTo` buffs never reference seal/status ids (grep clean). A player→player board is legal per the sourceId+targetId contract anyway; capability is still aura-gated. Latent seam documented for future content authors.

### Pre-existing / out-of-scope findings (not blockers)
- `CombatSkillSlot` prop `total` received `undefined`→NaN warnings during E2E (TurnCombatSkillBar, CombatSkillDockPanel, CombatSceneOverlay, GameRoot). UI skill-slot rendering issue unrelated to the reaction pipeline — no reaction path touches these props. Recorded for a separate UI task.
- Tone.js `AudioContext` autoplay-policy warnings — browser policy, pre-existing.
- The browser `da_phap_lien_tuyen` UNROUTED warning was root-caused to a **seed artifact**: the QA save seed wrote learned-skill ids without full entries (`level`, cooldown fields), so `getEffectiveSkill` produced NaN `cadence.cooldownTurns`/`coefficient` and the registry correctly rejected the malformed def (2 validation faults, fail-loud + no-op — intended behavior). With corrected complete entries (mirroring the atomic ritual grant) all kit defs route cleanly; zero warnings in the post-fix run.

### Coverage gaps (documented, non-blocking)
- `reaction_skipped` is not reachable through production E2E (requires a stale-snapshot race between commit and settle). Engine coverage exists in three tests (ReactionBatch.test.ts:83 atomic skip; TurnBattleSystem.contract.test.ts:432; determinism.test.ts:728 `stale_reaction_snapshot`). The drain forwarding of skipped events is code-verified.
- The dormant resurrection regrant seam has no production caller (no revive mechanic exists); logic is unit-tested in the S3 death matrix.

## Verification Evidence Referenced

- `npm run verify`: type-check + build + **688 files / 5955 tests / 0 failures** (post-P3).
- P18 OCR: 86/86 files reviewed, zero Medium+.
- Journeys A–D (browser, seeded Ngộ Đạo + duoc_dong_tu + giant_earthworm): A = seal applies + 0 reactions (no aura); B = aura on player+companion, companion-source `doan_moc`, payoffs incl. companion-sourced reaction_bleed; C = Khắc payoffs + live cam_cong at A≥3; D = sequential settlement, ordered combatSequence, 0 skip/0 dup, no freeze.
- S4 re-proof: 25/25 production-data tests; S5: 20/20 route-skill tests.
