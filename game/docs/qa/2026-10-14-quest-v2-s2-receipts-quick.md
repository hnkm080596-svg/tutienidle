# Quest V2 S2 — receipt foundation: QA quick + G5 worker handoff

- Date: 2026-10-14
- Mode: quick (isolated, not wired to runtime)
- P4 operation verdict: **PASS WITH GAPS** for the standalone ledger; **QA_UNVERIFIED** for production integration and the global fixed-point predicate.
- Baseline: local `codex/quest-v2-integration` at `c516dab9cb99403524b5806e84d675443b20b200`.
- Worktree: `E:/tutienidle/.agent-worktrees/quest-v2-receipts`; branch: `codex/quest-v2-receipts`.
- Task-owned source: `game/src/core/quest/receipt/{ProgressReceipt.ts,ProgressReceiptValidation.ts,ProgressReceiptLedger.ts,ProgressReceiptLedger.test.ts}`.
- Ancillary: `game/docs/qa/quest-v2-receipts-temp/.gitignore` (keep Vitest's worktree-local cache out of the task diff); this report.
- No deletion, external branch changes, push, merge, deployment, producer integration or agent dispatch.

## G0 task card and observable contract

Responsibility: standalone, producer-typed `ProgressReceipt` and `ProgressReceiptLedger` that persist one observed committed gameplay fact and allow that fact to be allocated once to each `(consumerId, objectiveId)` pair. A duplicate allocation must not advance the revision; the same fact must remain available to other objectives/consumers. The ledger rejects malformed, stale and conflicting facts without modifying state. A snapshot must survive JSON serialization and restore without admitting rollback or rewrite of existing allocations.

Current gameplay owner: `core/quest/QuestSystem.ts` lifecycle/progression; the existing achievement contract and quest objectives were inspected read-only. This new ledger is the **sole owner of its own receipt/allocation history**, not of quest progress, the authoritative gameplay event, rewards, or save writes. No real caller is migrated in S2: the future path is `domain commit by owning producer -> domain-created receipt -> quest/achievement progress coordinator -> ledger allocation -> co-persisted progress+ledger`. That chain has **not** been implemented or tested. Scope stops at typed foundation and deterministic tests; S1 quest lifecycle/objective wiring belongs to the other worker.

Identity: `(playerId, runId, enabledAtMs)` supplied by a trusted integration; the ledger never creates a clock value or receipt. `eventId` identifies a fact within a run, and `(producer, payload.kind, sourceId)` independently identifies the originating domain operation. A reused ID with different contents is a collision. `committedAtMs` is validated as a safe, nonnegative integer and must be at least the supplied enablement boundary. Per-objective activation eligibility **remains the consumer's responsibility**. A receipt's `units` must equal a positive delivered material amount, or equal 1 for all currently declared non-material fact kinds. `revision` counts allocations, not events.

Persistence: snapshots are detached values; JSON restore validates version, full payload schema, identity, event/source uniqueness, pair uniqueness, positive quantities, entry shape, activation boundary and revision/count consistency before any state replacement. Restoring over an existing live ledger also refuses any loss or rewrite of prior facts. Maps index event/source IDs during a session and are rebuilt on successful restore. There is deliberately **no eviction**: pruning without durable producer checkpoints would admit old receipt replay.

## G1 evidence: Q1–Q12

| Question | Evidence / status |
| --- | --- |
| Q1 observable success and failure | 9 Vitest cases: multicast, duplicate, malformed, collision, stale, serialized restore, mutation and replay; **PASS standalone**. |
| Q2 one rule owner | `ProgressReceiptLedger.record/restore` owns allocation and historical identity checks; `ProgressReceiptValidation.parseProgressReceipt/parseLedgerState` owns schema validation; **PASS**. |
| Q3 state lifecycle | `state.entries` + session indexes written only by `record`/`restore`, read via detached `snapshot`; save adapter not wired; **PASS local / GAP persistence**. |
| Q4 real production chain | No runtime caller in this assignment; actual QuestSystem/producer/save wiring explicitly deferred; **GAP**. |
| Q5 stable mechanism | Read current quest and achievement contracts. Existing achievement-specific receipt does not supply shared consumer/objective allocation; add separate common ledger, **PASS scoped**. |
| Q6 dependency direction | Three core-only modules and one local test; imports are only local types/validation; no Vue/Phaser/GameManager dependency, **PASS**. |
| Q7 time/presentation | Ledger validates a caller-supplied timestamp, performs no timing, rendering, resource mutation or outcome calculation; **PASS local**. |
| Q8 consumer semantics | Exact per-producer discriminants and quantities validated; mapping of real commits and objective activation pending, **GAP**. |
| Q9 pure queries | `snapshot` returns a detached clone; no activation/progression during read, **PASS**. |
| Q10 duplicate/stale/interrupted | Duplicate, collisions, invalid quantities and stale identity/activation tests; record+progress+save crash atomicity needs integration, **PASS local / GAP cross-system**. |
| Q11 alternate paths | Existing QuestSystem / achievements retained unchanged, no consumers migrated and no authority replacement claimed, **PASS scoped**. |
| Q12 scope and stop | Four new source/test files + two QA files; no writes to S1, save, reward, recurring or UI. P3/P18/P4/P5 evidence below; **PASS scoped / QA_UNVERIFIED total**. |

## G2–G3 tests and triggered domain gates

Tests are in `ProgressReceiptLedger.test.ts`. Includes all 20 discriminated receipt kinds, producer/payload/unknown-field guards; positive safe quantities and exact delivered units; id+source collisions; a single receipt multicast across two consumers and multiple objectives; JSON roundtrip; detached object mutation; hostile and inconsistent restored state; no rollback; preserved source index after restore; reordered object keys; and 100 seeded sequences of 100 allocations with actual repeated restore into fresh ledger instances.

| Domain check | Evidence and boundary |
| --- | --- |
| S1 detached snapshot | Mutating snapshot or input receipt does not mutate live ledger: tested. |
| S2 restore/reset/idempotence | JSON roundtrip, repeated valid restore, rollback/rewrite rejection, post-restore duplicate and collision checks: tested. |
| S3 validate-before-write | Malformed candidate returns invalid/rejected without partial state: tested. |
| S4 stale async session | Wrong player/run and activation boundary rejected; real delayed producer and save callbacks: **QA_UNVERIFIED**. |
| S5 timers/listeners | No async work, listeners or timer ownership in S2: N/A. |
| S6 schema compatibility | Standalone `version: 1` only; no current SaveSystem schema change: **PASS scoped / integration deferred**. |
| E1–E7 economy | Receipt neither changes balances nor creates rewards. E2 delivered quantity/schema validated, but actual delivered-vs-requested event source **QA_UNVERIFIED**; other E checks N/A until producers. |
| L1 panel independence | Ledger API headless; actual progression without opening UI **QA_UNVERIFIED**. |
| L2 domain command authority | Ledger cannot grant progress/rewards or fabricate events; future producer/coordinator authority **QA_UNVERIFIED**. |
| L3 real registration/runtime | No application wiring in S2: **QA_UNVERIFIED**, P13/P14 not triggered by these standalone files. |
| L4 retries/rewards | Allocation dedup and replay tested; actual reward transitions/save replay **QA_UNVERIFIED**. |

## P3 and OCR / P4 evidence

| Check | Observed result |
| --- | --- |
| `npm run type-check` in assigned `game/` | PASS on latest changed TS/test state; `vue-tsc --build`, exit 0. |
| `npx vitest run src/core/quest/receipt/ProgressReceiptLedger.test.ts` | PASS: 1 file, 9 tests; `TEMP`/`TMP` set to worktree `game/docs/qa/quest-v2-receipts-temp` because default Windows temp rename failed with EPERM in the earlier local run. |
| Initial fixture regression | One test initially failed because test data incorrectly included `enabledAtMs` as an envelope property; corrected the fixture and reran PASS. No production defect inferred. |
| `ocr delegate preview -f json` + `ocr delegate rule` | PASS selection, uncommitted workspace mode. Final candidate: 6 changed files, 5 OCR-reviewable files, 5 read/reviewed, 0 reviewable skips, 100% reviewable coverage. Core source (3), focused tests (1), cache `.gitignore` (1). The sixth file (this Markdown report) is excluded by OCR as `unsupported_ext` and inspected manually. Resolved project core/test rules. Host-agent defect reasoning found no confirmed Medium+ within isolated scope; this is not an independent OCR LLM verdict. |
| Adversarial P4 quick | Manually evaluated duplicate, replay, stale/malformed, collision, identity and corruption against focused executable tests; **PASS WITH GAPS** due missing real upstream and persistence wiring. Risk mapper invocation was refused by tool safety review; manually routed save/progression domain packs. |
| Full fixed-point protocol | **QA_UNVERIFIED**: no isolated independent reviewer (explicit no-agent instruction), no producer/save/runtime evidence, no aggregate application census or full protocol attestation. |

### P4 invariant ledger

| ID | Owner/state | Attack | Observable oracle | Evidence / outcome |
| --- | --- | --- | --- | --- |
| INV-RECEIPT-01 | ledger allocations | Duplicate same receipt, multicast to other consumer/leaf | distinct allocation count and `applied`/`duplicate` | Test `multicasts`: PASS. |
| INV-RECEIPT-02 | event/source history | Reused event/source with changed facts or kind | `collision`; unaffected allocations | `rejects source and event collisions`: PASS. |
| INV-RECEIPT-03 | typed validation | Negative/non-finite/unsafe units, forged owner and extra keys | `invalid`; state unchanged | `rejects invalid counts`, `accepts all declared`: PASS. |
| INV-RECEIPT-04 | durable state | Restart, replay, reordered keys, mutated snapshot | identical revision/history, duplicate result | JSON/restore and seeded replay tests: PASS. |
| INV-RECEIPT-05 | progression/save coordinator | Interruption between progress credit, ledger write and durable save | exactly-once progress+dedup after crash | **COVERAGE GAP**: real coordinator/save not wired or authorized in S2. |
| INV-RECEIPT-06 | producer domain | False timestamp or forged event made by untrusted caller | authoritative operation receipt and activation baseline | **COVERAGE GAP**: typed shape is not producer attestation; integration pending. |

### P5 sequential review (same final TS state; no code fixes during passes)

**Sequential Review Pass 1 — Local correctness / regression.** Reviewed post-OCR source, schema, test cases and replay results. Findings: zero confirmed Critical/High/Medium/Low in S2; considered input mutation, event/source collisions and index restore consistency. Fixes: none. Verification: P3 pass listed above.

**Sequential Review Pass 2 — Architecture / authority.** Reviewed resulting state after Pass 1 (no fixes) and original quest/achievement ownership boundary. Findings: zero confirmed in S2; cross-owner atomicity and event authenticity are external integration gaps, not implemented or certified. Fixes: none. Verification: source dependency inspection.

**Sequential Review Pass 3 — Adversarial integration.** Reviewed resulting state after Pass 2 (no fixes); compared ledger replay/origin guards with Q8/Q10, save and quest one-hop boundaries. Findings: zero confirmed in isolated S2; real integration evidence unavailable by assignment. Fixes: none. Verification: 9 focused tests incl. 100 deterministic restart sequences. **This sequence is same-context self-review, not independent verification.**

## G5 worker result and coordinator contract

Behavior before: no new shared, producer-discriminated, per-consumer/objective durable ledger on this baseline. After: type-checked standalone receipt union, runtime exact-shape parser and allocation history with detached snapshots, collision/stale checks, identity-scoped restores and indexed lookup. Files added: `ProgressReceipt.ts` (types), `ProgressReceiptValidation.ts` (runtime validation/restore parsing), `ProgressReceiptLedger.ts` (durable dedup owner), `ProgressReceiptLedger.test.ts` (invariant tests), QA cache ignore and this QA/G5 report.

**Required downstream before production readiness:** authoritative gameplay owners must mint stable `eventId`, `sourceId`, `playerId`, `runId` and true commit time; objective eligibility and activation timing stay in quest authority; consumers must co-commit objective progress, allocation and their persisted snapshot atomically (or via a provably equivalent retry protocol). The ledger itself cannot prove producer provenance or guarantee exactly-once objective progression across a crash. Save schema, restore order, concurrent save conflict treatment, battle/inventory producer hooks and real end-to-end progression tests all remain to be implemented and verified by the coordinator/other owners. Never claim integrated gameplay behavior from the unit tests.

Retention is unbounded intentionally. Any future compaction requires durable high-water/checkpoint guarantees from each relevant producer and proof that no deferred objective can request an older event. No guessed retention window or made-up event time.

**Final status for this slice:** local gates provide reviewable implementation evidence; overall **QA_UNVERIFIED** pending producer/save consumers, runtime, independent review and canonical fixed-point completion. No merge/push/deploy performed. No scope-overlapping production files touched.
