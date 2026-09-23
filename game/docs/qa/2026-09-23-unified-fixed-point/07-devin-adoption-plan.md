# Internal QA adoption implementation plan

> For agentic workers: use the current project implementation workflow with bounded internal workers where available. This plan is an adoption contract; actual implementation must revalidate the cloud checkout, current files and runtime capabilities before editing. No external review is required by this plan.

**Goal:** transfer the useful detection/reasoning capability of internal plus external QA into a single primary-agent-owned internal workflow with automatic qualified learning.

**Architecture:** one canonical protocol, one state-bound ledger and coordinator, multiple internal evidence producers. Existing detectors remain; external transport is removed from required acceptance. A small mechanical runner enforces metadata/state transitions; agents perform semantic reasoning.

**Stack:** current Node/TypeScript/Vitest/Playwright project plus JSON records. Prefer existing dependencies and Node built-ins; do not silently add a model provider, SaaS account, database, queue service or API key.

**Spec:** the numbered documents in this bundle, especially protocol, schemas, learning and qualification.

## Constraints

- Do not change gameplay, economy, architecture owners, release policy or backward-save policy as part of adoption.
- Current unmerged PRs are context. Refresh metadata; use actual intended integration branch, not hardcoded historical SHAs or `master`.
- No commit/push/merge/deploy without explicit authorization in the active Devin session.
- Preserve current useful detectors until corresponding internal capability is qualified. No mandatory ChatGPT Web call even during qualification; compare with historical external results offline.
- Keep historical reports and optional transport scripts. Retiring a mandatory step does not require deleting its implementation or history.
- Adoption has explicit ADOPTING/QUALIFIED status. Until qualification, existing internal evidence gates remain mandatory and the new gate cannot certify production completion. Retire external transport dependency without creating an unguarded acceptance interval.
- Use existing worktree/isolation rules and cloud-equivalence authorization. Preserve unrelated changes; audit current entrypoint instructions before modifying them.
- All new instruction/schema/runner code is QA infrastructure with its own verification. Do not claim the game passes because installation succeeds.

## P. Existing-mechanism disposition and preservation mapping

MERGE below means merge scheduling/result/decision ownership only. REPLACE concerns a workflow/control mechanism, not disappearance of its useful detector. No detector receives REMOVE in this design.

| Old mechanism/capability | Disposition -> new owner | New evidence / preservation argument | Required proof before cutover |
|---|---|---|---|
| M01 spec/plan adversarial review | STRENGTHEN -> internal contract operator | Same ambiguity/authority/oracle attack plus invariant schema and current-state census | Historical spec counterexamples still found by blind internal reviewers |
| M02 G0-G5/Q1-Q12/domain modules | KEEP + MERGE reporting -> coordinator | Same task card/authority/consumer questions represented in ledger; no duplicated approval | Map every Q/domain trigger to invariant/evidence, qualify missing-consumer case |
| M03 TDD/debug/characterization | KEEP -> repair operator | Original-bug proof, production-seam pin, causal trace | Valid defect/control pairs; no SUT-mocking loophole |
| M04 simplify | KEEP with constraint -> implementer | Behavior-preserving only; cannot reduce detection independence/coverage | Review resulting diff and rerun impacted evidence |
| M05 quick/full P3 | KEEP + STRENGTHEN -> deterministic operator | Same commands, quick during repair, mandatory final full candidate | Wrong-state/failing-suite qualification rejected |
| M06 architecture/data guards | KEEP -> deterministic structural operator | Existing assertions retained, supplemented by real outcomes | Golden authority/content bugs + current guards green |
| M07 OCR delegation | KEEP -> internal primary/tool selector | Same deterministic rules/file accounting; host agent continues reasoning | Every previewed file accounted; missing tool blocks required surface |
| M08 P13 | KEEP + STRENGTHEN -> runtime operator | Same real driving paths, exact candidate fingerprint, headless/app parity | Missing update and duplicate invocation mutants caught |
| M09 P14 | KEEP + STRENGTHEN -> runtime/UI operator | Same visual/input evidence plus normal-timing/profile distinction | Foreign server and scaled-timing misuse rejected |
| M10/M11 P4 quick/deep | MERGE control/reporting; KEEP attacks -> attack campaign | Same domain packs/learned patterns; broaden aggregate applicability, static proof admitted with honest label | All material old hypotheses retain decisive oracles; no skip from 'quick' |
| M12 P5 sequential | MERGE completion authority; STRENGTHEN -> review cycles | Ordered resulting-state responsibilities retained; clean A/B, novel attacks and Low correctness closure added | Last-pass fix requires fresh state review; three perspectives on one snapshot rejected |
| M13 external C2C reasoning | REPLACE execution owner -> primary + fresh internal reviewers | Preserve bidirectional census, counterexamples, real production consumers, test-quality challenge and repeated review | GB-13..20 replay internally; complete context and blind first analyses proven |
| M13 ChatGPT Web/CDP/mailbox transport | REPLACE mandatory transport -> native internal messages/files | Correlation improves from ROUND to request/state/bundle hash; no semantic capability depends on browser chat | QF-03..06,13..14,18,26..27,32 pass; no external login/API required |
| M14 generic task/branch reviewers | MERGE -> internal reviewer roles | Fresh context and broad branch reasoning retained; generic round caps cannot terminate QA | Context provenance and temporal evidence; budget timeout rejects completion |
| M15 simulations/journey/lab | KEEP + STRENGTHEN -> deterministic/property operators | Existing real-data models retained; generated valid/invalid actions and seed replay added | Determinism/parity, reachability, shrinking and original-counterexample replay |
| M16 save/restore checks | KEEP + STRENGTHEN -> persistence operator | Current schema/rejection retained; live-owner/inverse/atomicity strengthened | GB-01,02,14,16..20 and legal current-save controls |
| M17 learned-defect ledger | STRENGTHEN -> qualified learning pipeline | Preserve old rows/evidence, import candidates, promote pins/rules, route next runs | Original kill + legal controls + independent qualification + recurrence/escalation tests |
| M18 CI/lint/asset/build | KEEP/establish actual capability -> manifest runner | Explicit gates/artifacts and environment provisioning; CI remains execution, not a second approval policy | Current config/tools verified; unavailable required command cannot PASS |

These are preservation obligations and reasoned mappings, not executed proof today. Cutover fails if any valid historical detection is lost or an old required surface lacks new evidence.

## Q. Intended repository layout

```text
AGENTS.md                                      short binding QA authority/rules
AstraDoctrine.md                               reasoning guidance; link to protocol
.opencode/agent/{build,general,plan,explore}.md   synchronized entrypoint references
PROJECT_CONTEXT.md                             cloud entrypoint if present; no competing gate list
.agents/skills/tutienidle-adversarial-qa/        detector adapter + retained domain packs
.agents/skills/open-code-review/                unchanged detector execution responsibility
game/docs/qa/protocol/
  README.md                                    sole normative orchestration/decision law
  defect-taxonomy.md                            attack classes/domain model
  ledger-schema.md                              schema semantics and human views
  learning.md                                   qualification/promotion/routing law
  agent-instructions.md                         primary/internal role/message instructions
  qualification.md                              golden/runner adversarial acceptance
game/docs/qa/learning/
  active-policy.json                            authoritative active promoted policy reference
  policies/<policyHash>.json                    immutable qualified detector/lesson definitions
  history/lessons.jsonl                         append-only evidence, not governing policy
game/docs/qa/corpus/
  index.json                                   historical case metadata and coverage
  cases/                                       replay recipes / controlled mutants
game/docs/qa/runs/<runId>/
  ledger.json                                  materialized view of journal
  journal.jsonl                                sole coordinator event log
  manifest.json                                exact tree, contract, environment inputs
  evidence/                                    immutable redacted results/artifacts
  reviews/                                     sealed review reports
  report.md                                    generated read-only human view
game/scripts/qa/
  cli.mjs                                      command adapter; no LLM/provider dependency
  ledger.schema.json                           extracted exact schema
  state.mjs                                    manifest/hash/identity and stale propagation
  validate.mjs                                 structural/reference/semantic mechanical checks
  decision.mjs                                 explicit terminal predicate
  tests/                                       node:test adversarial runner fixtures/tests
```

Only the protocol owns completion. Taxonomy/schema/learning are delegated contracts with no separate verdict. Reports are generated views. `runs/` and `learning/history/` are evidence exclusions from product identity; protocol, corpus, promoted policies, fixtures and scripts are included. Sealed first-pass review results require per-reviewer access isolation before reconciliation; a globally readable directory plus a 'do not look' sentence alone is not an enforced blind channel.

Runtime transport state belongs outside tracked product files. Persist intentionally redacted QA evidence with explicit retention; do not blindly add entire `.c2c` directories. No deletion/mass-move is required by this adoption plan.

## Proposed runner interface

These commands are **to be implemented**, not currently available. Add one script entry only after implementation:

```json
{"qa:internal": "node scripts/qa/cli.mjs"}
```

| Command from `game/` | Inputs/output and failure behavior |
|---|---|
| `npm run qa:internal -- init --request request.json` | Validate request scope/paths; create run ID/journal/manifest; refuse active conflicting writer lease |
| `npm run qa:internal -- snapshot --run RUN_ID` | Recompute product/contract/model/environment identity; append snapshot/invalidation events; never overwrite old evidence |
| `npm run qa:internal -- record --run RUN_ID --input result.json` | Validate exact correlated immutable evidence/message/finding; CAS append then regenerate ledger; reject stale/unknown/unsafe inputs |
| `npm run qa:internal -- validate --run RUN_ID` | Structural and mechanical semantic checks only; reports pending evidence, never emits fixed point |
| `npm run qa:internal -- decide --run RUN_ID` | Evaluate every terminal clause and independent attestation; emits typed outcome and clause evidence, no network/git mutation |
| `npm run qa:internal -- render --run RUN_ID` | Regenerate report from ledger without changing product identity or approval |
| `npm run qa:internal -- qualify` | Execute deterministic runner fixtures; output individual QF results; never fake model/runtime/golden execution |

`RUN_ID` is a runtime parameter, not a literal folder name. Parameters must be parsed as data, paths normalized/contained, JSON validated; no shell interpolation from report contents. Prefer a tested Draft 2020-12 validator already available in approved dependencies; if absent, propose a deliberate dependency change and verify it. Do not quietly rely on an unpinned transitive module or write a partial validator and call it full JSON Schema support.

Semantic reasoning cannot be automated by a schema. The runner checks concrete prerequisites/attestations and evidence integrity. The primary agent and independent internal reviewers must establish the truth of the corresponding claims.

## S. Migration in dependency order

### Task 1 — Refresh and pin the adoption target

- [ ] Inspect status, user authorization, base/head, current project rules and open PR dependency graph. Revalidate all historical paths/claims in this bundle against the actual cloud tree.
- [ ] Inventory mandatory external-review call sites in active prompts, scripts and mission instructions; distinguish executable calls from historical reports.
- [ ] Verify native isolated reviewer/context capability using a harmless task with a deliberately withheld sentinel finding. Record exposed material and whether results remain inaccessible to other first-pass reviewers.
- [ ] Create assigned isolated adoption checkout under current rules. Lock QA-infrastructure responsibility; gameplay repairs remain separate.
- [ ] Record capability gaps explicitly. Never call ChatGPT Web to fill missing internal reviewer capability.

**Acceptance:** exact adoption tree/scope and internal review capability documented; no user work overwritten; no false independence claim.

### Task 2 — Install canonical documents and conservative adapters

- [ ] Copy protocol/taxonomy/schema-semantics/learning/instructions/qualification texts to intended destinations. Update paths to installed locations; preserve proposal/audit as historical design evidence.
- [ ] Add the short root reference block and prepare revisions of conflicting P4/P5 completion rules. Preserve P3/P13/P14/P18 technical obligations; retain existing sequential floors and write/scope protections.
- [ ] Update architecture-worker G4/G5, relevant `.opencode` prompts, QA skill/reporting references, cloud PROJECT_CONTEXT and current mission templates to reference one coordinator verdict. Preserve Q1-Q12/domain packs rather than copying them into new competing policy files.
- [ ] Mark legacy external-review instructions non-binding for QA adoption/qualification; keep their historical detection cases. Avoid removing useful attacks while retiring transport requirements.
- [ ] Explain static-proof evidence, all-actionable severity closure and automatic qualified learning as intentional rule changes, not accidental drift.

**Acceptance:** one unambiguous completion authority, no required ChatGPT Web/C2C approval, no useful detector removed, no live instruction still mandates external round trips. Link/mirror/contradiction scan completed.

### Task 3 — Implement state, ledger and decision enforcement

- [ ] Extract schema exactly; implement input normalization/path containment and validated record references.
- [ ] Implement complete manifest identity, environment-profile versus per-execution input separation, artifact hashes and dependency invalidation.
- [ ] Implement coordinator-only CAS journal/lease/recovery; immutable worker results and exact message correlation.
- [ ] Implement closure-group transaction, derived actionability, typed outcomes and the terminal conjunction.
- [ ] Implement report generation without another status authority. Reject missing rows, stale results, undefined references and fabricated success from tool exit 0.
- [ ] For each QF case, first write the failing state transition/acceptance test, then implement the smallest correct behavior, rerun the test and its related state suite. Include valid nearest-neighbor cases so rejection-everything cannot pass.

**Acceptance:** QF mechanical cases pass, malformed/stale records fail for intended reasons, legal state can progress; schema/runner source reviewed independently. No claim that the runner can judge semantic truth.

### Task 4 — Integrate internal reasoning, attacks and learning

- [ ] Wire primary-agent instruction and native reviewer assignments with fresh contexts and sealed results; sequential state reviews still occur in order.
- [ ] Import every historical learned-defect row and meaningful local/cloud review finding into corpus accounting; unknown original commit/severity remains explicit until recovered.
- [ ] Seed candidate lessons from the learning document. Implement original-bug kill, legal-control, sibling-search, independent qualification and promotion routing checks.
- [ ] Keep append-only lesson history separate from immutable promoted policy. Validate that the next task automatically consumes matched lessons and global sentinels.
- [ ] Define initial generated-action/fuzz/mutation campaigns using existing production factories, RNG and clocks. Prefer permanent pins in existing meaningful suites. Demonstrate shrinking/replay; do not count random iterations without transition/edge coverage.
- [ ] Execute old internal versus new internal golden replay where feasible; historical external findings are benchmark labels, not a live service dependency. Use genuine fresh holdout cases for post-tuning evaluation.

**Acceptance:** transferred external capabilities detect GB families internally; learning catches original and sibling faults without rejecting legal controls; native reviewers demonstrate access/context isolation; no external transport called.

### Task 5 — Qualify on the aggregate adoption state and cut over

- [ ] Run `node --test scripts/qa/tests/*.test.mjs` and all required QA infrastructure qualification cases. Verify node test discovery actually includes the files.
- [ ] Run P3 full `npm run verify` because package/scripts/QA infrastructure changed; run current configured lint and relevant browser/runtime checks when source identity or browser tooling is affected. Keep raw failures and classify baseline/tooling limitations honestly.
- [ ] Run P18 delegation on the actual task diff with full file accounting; run applicable adversarial QA and chronological sequential review against the latest state. Use existing accepted rules plus stronger candidate requirements during bootstrap; a new policy cannot approve itself by skipping a failing old gate.
- [ ] Demonstrate a synthetic full successful internal run with no external-review network/session (native agent harness and local app runtime remain available), plus final-suite failure, stale candidate, pending Low, missing reviewer and unqualified lesson rejection cases.
- [ ] Reconcile preservation table: each old useful capability has internal evidence; each retired requirement is only duplicate decision/transport machinery. Block cutover on a lost detection capability.
- [ ] Reload affected agent instructions; demonstrate a new task consumes the active policy/lessons. Report installation qualification separately from game-wide QA.

**Acceptance:** `PROTOCOL_ADOPTION_QUALIFIED` for the installed mechanism with evidence and limits, or exact incomplete qualification list. Do not emit `QA_FIXED_POINT_REACHED` for the game unless a real aggregate game run has satisfied its full predicate. Do not silently repair unrelated game defects discovered during adoption.

## Safe optimization after qualification

Cache owner/census data only with its complete input/dependency hash; run targeted repair checks then mandatory final full verification; parallelize genuinely independent read-only work against immutable snapshots; deduplicate duplicate findings by evidence without dropping distinct siblings; retain one report generated from the ledger. Preserve contextual independence and full attack obligations. No quota/time-driven coverage reduction or fixed round cutoff.
