# CURRENT_QA_MAP and CURRENT_SYSTEM_FINDINGS

Date: 2026-09-23. Status: architecture audit; not a gameplay QA verdict.

## G0: responsibility and evidence boundary

- Request: unify the existing QA/review system into one stronger decision protocol, with repository-ready instructions for Devin Cloud. Audit first; no production or existing QA infrastructure changes.
- User clarification during audit: ChatGPT Web QA is unstable. Transfer its useful reasoning/detection capability into the primary agent's internal workflow. The target has no mandatory external reviewer, C2C transport, ChatGPT Web session, login or browser automation dependency. C2C artifacts below are historical training/benchmark evidence only.
- Workspace: `E:/tutienidle`, branch `master`, HEAD `7808caba2b71fb3455912d64da693285b4e3b149`.
- Deliverables: new Markdown documents only in `game/docs/qa/2026-09-23-unified-fixed-point/`. P2 Markdown exception used on 2026-09-23; no worktree needed for these proposal documents.
- Existing dirty state preserved: `.gitignore`, `game/docs/c2c/`, `game/docs/p7/foundation-rulings-reconciliation.md`, `game/docs/p7/mortal-chapter-audit-v2.prompt.md`, `game/docs/superpowers/plans/2026-09-20-canonical-path-authority.stale-draft.md`.
- Current authority: AGENTS P3/P4/P5/P13/P14/P18 plus architecture-worker G0-G5; C2C adds external mission review. Target: one decision authority retaining those detectors, then strengthening aggregate review, evidence identity and convergence.
- No game test, build, browser session, mutation run or live C2C send was executed in this audit. Test results below are historical reports, not results obtained in this session.
- The game itself and every PR line were not audited. This is a map of QA mechanisms, supported by their rules, executable configuration, representative tests, recorded failures and cloud review artifacts. Unread PR files are not implicitly certified.

Evidence labels: **SOURCE** = inspected current source/configuration; **HISTORICAL** = inspected prior report/output, not rerun; **INFERRED** = architectural consequence with stated limits; **SPEC DRIFT** = contradictory or stale instructions/reporting. **EXECUTED** in this audit means read-only repository/API inspection or later document validation only.

## Evidence index

| ID | Inspected evidence | What it establishes |
|---|---|---|
| S01 | [AGENTS](../../../../AGENTS.md), [AstraDoctrine](../../../../AstraDoctrine.md) | Required gates, scope boundaries, severity, architectural laws, evidence expectations |
| S02 | [Architecture worker workflow](../../architecture/architecture-worker-workflow.md) | G0-G5, Q1-Q12, C/S/E/L/U domain checks, production-consumer census, worker/coordinator handoff |
| S03 | [Adversarial QA skill](../../../../.agents/skills/tutienidle-adversarial-qa/SKILL.md), its quick/deep/reasoning/reporting references | Risk routing, invariant operators, dynamic confirmation rule, restricted writes, escalation and verdicts |
| S04 | [OCR protocol](../../../../.agents/skills/open-code-review/SKILL.md), [OCR rules](../../../../.opencodereview/rule.json) | Diff selection and host reasoning, coverage accounting; no separate OCR model in delegation mode |
| S05 | [package.json](../../../package.json), [Vite config](../../../vite.config.ts), [lab config](../../../vitest.lab.config.mts), [Playwright config](../../../playwright.config.ts) | Executable gate boundaries; normal Vitest excludes lab/E2E; `verify` does not include lint or E2E |
| S06 | [Lab README](../../../tests/lab/README.md), [Battle determinism tests](../../../src/core/simulation/BattleSimulation.determinism.test.ts), [Mortal journey](../../../src/core/simulation/earlygame/MortalChapterJourney.test.ts) | Existing real-manager/manual-clock harnesses and authored sequence/simulation coverage; these are not automatically a general action-sequence generator |
| S07 | [Learned defects](../learned-defects.md), [whole-project audit](../2026-09-14-full-project-engineering-audit.md) | Real historical defect classes and evidence limitations, including consumer parity and runtime wiring |
| S08 | [M-QI-05 spec](../../p7/missions/mqi-05-core-node-level.spec.md), local `.c2c/mailbox/inbox-mqi05impl-r1.md` | External review caught missing scaling, inverse ownership and staged/working-tree mismatch despite 347 green focused tests |
| S09 | [M-QI-07 notes](../../p7/missions/mqi-07-physique-transformation.notes.md) | Three internal passes missed a Low malformed-slice failure; external review prompted a fourth pass and regression pin |
| S10 | [Subagent workflow](../../../../.agents/skills/subagent-driven-development/SKILL.md), [requesting review](../../../../.agents/skills/requesting-code-review/SKILL.md), [code review](../../../../.agents/skills/code-review/SKILL.md) | Fresh task reviewers and broader branch review exist; generic skill stopping/commit rules need project-law precedence |
| S11 | Untracked local `game/docs/c2c/standing-instruction.md` | Local connector/mailbox variant; must not be mistaken for cloud transport capability |
| R01 | [PR #1 at 32daa106](https://github.com/hnkm080596-svg/tutienidle/tree/32daa10664dfe383e4fbbd5216f8d2b39d081a42) | Cloud C2C protocol, standing instruction and actual `chatgpt-web-review.mjs` read in full |
| R02 | [PR #14 at 66d1aca8](https://github.com/hnkm080596-svg/tutienidle/tree/66d1aca8de21cd2ef2e7cfec8116865cec1478da) | Body Perfection QA report, PR metadata and review thread; no rerun |
| R03 | [PR #16 at f9fc4ee4](https://github.com/hnkm080596-svg/tutienidle/tree/f9fc4ee4dc42e10a8d6765459607b00ec6fd00be) | Integration file inventory plus Talent, essence-substitution and body-core review reports |

## Cloud snapshot: open PRs are context, not merged authority

GitHub search returned three open PRs at inspection. Metadata was then fetched separately.

| PR | Base / head | Observed status | Use in this design |
|---|---|---|---|
| [#1](https://github.com/hnkm080596-svg/tutienidle/pull/1) | `master` / `devin/1790125606-chatgpt-web-review`; head `32daa10664dfe383e4fbbd5216f8d2b39d081a42` | Open, 6 changed files | Cloud transport behavior and limitations |
| [#14](https://github.com/hnkm080596-svg/tutienidle/pull/14) | `p7/truc-co` / `devin/1790147578-m-f-body-perfection`; head `66d1aca8de21cd2ef2e7cfec8116865cec1478da` | Open, 33 changed files | Cross-owner transaction, hidden-content and post-review evidence cases |
| [#16](https://github.com/hnkm080596-svg/tutienidle/pull/16) | `master` / `p7/truc-co`; head `f9fc4ee4dc42e10a8d6765459607b00ec6fd00be` | Open draft, 297 changed files in fetched metadata | Aggregate interaction risks, parallel save-version changes, C2C artifacts |

PR #16's prose still described 260 files and pending missions while API metadata reported 297; its changed-file list already included Body Perfection paths. That establishes metadata drift, not proof of any particular PR being merged. Never synthesize an aggregate by concatenating these diffs or infer ancestry from matching filenames. Devin must refresh heads and derive the actual candidate tree at execution time.

## A. CURRENT_QA_MAP

Legend: S = static, D = dynamic, Det = deterministic execution, J = judgment. Independence below describes guarantees actually visible in the protocol, not presumed model diversity. All rows inherit S01 protection rules.

| Mechanism / purpose / trigger | Inputs -> outputs; authority | Tools, scope, checks, evidence | Independence, rerun behavior, historical detection | Blind spots / overlap |
|---|---|---|---|---|
| M01 Contract/spec and plan review; before mission implementation | Rulings, spec, plan, census -> SPEC/PLAN review verdict; mission acceptance only | S/J; repository docs and C2C, referenced owners/consumers; ambiguity, authority, acceptance oracles | External reviewer exists; repeated spec/plan rounds recorded in P7 missions | Often shared long conversation; access may be inline excerpts; spec approval not implementation proof |
| M02 G0-G5 architecture worker protocol; nontrivial changes/plans | Task card, Q1-Q12, triggered domain modules -> evidence handoff; coordinator accepts slice | S+planned D/J; owner/writer/reader/reset/persistence census, actual factories, migration ledger | Coordinator checks aggregate diff; G4 reruns affected gates | Checklist is not CI; aggregate diff is not necessarily aggregate repository attack model; overlaps P5 architecture |
| M03 TDD/characterization/debugging; before feature/fix | Failing behavior/invariant -> reproducer, repair, red/green record | D/Det + causal J; targeted unit/integration seam; old path must fail | Usually implementer; affected verification after fix | Fixture/oracle can encode wrong assumption; not independent review |
| M04 E3 simplification; after implementation | Implementation -> simpler behavior-preserving state | S/J; task change and consumers; uses code-simplifier | Usually implementer; precedes P3 | Maintainability objective is not a correctness oracle; generic pressure to simplify must not weaken detectors |
| M05 P3 quick/full | Change triggers -> exact command output | D/Det: quick type-check + scoped Vitest; full type-check + build + full Vitest (`npm run verify`) | Same agent may run; stop first failure, repair task-caused, rerun | Green counts do not establish assertion quality; excludes E2E/lab/lint; pre-existing failures need separate accounting |
| M06 Architecture guards and content checks | Source/catalogs -> executable assertions | S/Det: import/writer scans, i18n, catalog/preload, vitals authority, path isolation, ACK tokens | Repeat with Vitest; learned authority/wiring classes motivate many guards | Text/AST guards cannot prove complete outcomes or every dynamic call; overlaps semantic review usefully |
| M07 P18 OCR delegation | Task diff + selected rules -> file accounting + findings | S/J with deterministic selection; `ocr delegate preview/rule`; review full new files | Host agent supplies reasoning, so not an independent model; rerun after meaningful production fixes | Diff-scoped; omitted/unchanged consumers need separate census; OCR clean is not test/runtime approval |
| M08 P13 wiring | Boot/tick/registration/lifecycle change -> real progression evidence | D/Det+J; Playwright from implementation worktree, actual driving behavior | Rerun affected runtime after fix; historical missing GameManager update / actual-call-signature gaps | Boot smoke or helper tests can miss unwired execution; overlaps headless integration with different evidence |
| M09 P14 visual/runtime | Layout/input/Phaser/assets change -> screenshots + interaction + console evidence | D/J; real browser, actual flow/port/worktree, manual visual inspection | Rerun after runtime fix; requires source-under-test identity | DOM and console cannot certify canvas; screenshot cannot certify domain outcomes; environment failures block |
| M10 P4 quick adversarial QA | Task paths, risk map, invariants -> report and permitted repro tests | S+D/J+Det; changed owner plus one-hop consumers, learned defects, operators; Confirmed requires failing test/runtime | Freshness not mandatory in quick; production repair must exit QA, then repeat gates | Static proof alone is only Suspected; high-impact escalation varies in reports; scoped not aggregate |
| M11 P4 deep | Cross-system/high-impact/release trigger -> full ledger and deep report | S+D/J+Det; all domain packs, state chains, save/time/async attacks, full command matrix | Fresh session preferred; all packs/learned defects read | Preferences do not guarantee blindness; old-save migration excluded by current dev convention; no generated-sequence engine guaranteed |
| M12 P5 sequential review | Post-OCR/runtime/P4 state -> chronological >=3 passes | S+D/J; correctness, architecture, adversarial integration; callers/out-of-diff as needed | Temporal sequence required; fixes reverified, last-pass Medium+ fix forces another pass | Three passes do not imply fresh reviewers or two clean independent rounds; Low actionable defects may be deferred |
| M13 External C2C implementation review | Staged/diff/source/inline bundle -> mailbox verdict | S/J, sometimes historical independent D; `go/continue`, ROUND, STATE/END; cloud CDP script | Distinct conversation from implementer, but usually same chat over many rounds; retries after findings | Round identity lacks exact tree/content binding; limited excerpts cannot certify entire repo; output marker validity != approval |
| M14 Generic subagent/task/branch review | Spec + patch + review package -> feedback | S/J; fresh task reviewer and broad branch review available | Fresh context requested; generic skill includes capped fix-loop/adjudication | Generic five-round handling and minor deferral cannot define fixed-point completion; harness identity not proof of blind context |
| M15 Simulation, journey, lab | Seeds/catalogs/clocks/session actions -> metrics and trace assertions | D/Det where all relevant randomness controlled; production battle simulation, Mortal journey, separate lab harness | Usually same tests rerun; simulation/runtime parity must be checked | Authored sequences != generated state-machine coverage; lab has cheats and registration mirror; not all RNG streams universally seeded |
| M16 Save/restore/integrity suites | Current/invalid saves, owners, restore paths -> assertions | D/Det; SaveRoundTrip, SaveSystem, saveShapeValidation, GameManager restore boundary | Historical empty-bag fixture, identity, reconciliation, inverse ownership catches | Input payload equality alone does not prove live owner restored/unchanged; current dev version rejection is not backward migration support |
| M17 Learned-defect ledger | Confirmed QA findings -> recurring-class prompts + pin references | S/J; historical report table; consumed quick by domain/deep in full | Captures repeated wiring, token, data/consumer and capacity classes | No unified structured sibling-search/closure ledger or measured golden replay benchmark found in inspected mechanisms |
| M18 CI, lint, bundle/asset checks | Repo/config/build -> outputs | `lint`, `check:bundle-split`, asset checks exist; no tracked `.github/workflows` found locally | No current remote CI run examined; cannot claim cloud CI absent or green | `verify` omits lint/E2E; ImageMagick failures reported in cloud; branch protection/required statuses not established |

Executable details that matter:

1. `vite.config.ts` includes `src/**/*.test.ts` and `tests/architecture/**/*.test.ts`. `vitest.lab.config.mts` separately includes `tests/lab/**/*.test.ts`. Counting `verify` as lab/E2E evidence would be false.
2. Playwright uses checkout-derived port/`DEV_PORT`, two workers, local server reuse, and `VITE_PRESENTATION_DEADLINE_SCALE=3`. These are recorded accommodations; scaled-deadline evidence does not establish normal production timeout behavior.
3. In PR #1, marker validation checks STATE/ROUND/END. `DONE`, `BLOCKED`, `FINDINGS`, `NOTICE`, `STALE` all can be valid protocol messages; script exit 0 means transport validity, not defect-free review. There is no exact repository-state hash in that parser.
4. PR #1 protocol says inline material is required because that particular C2C runtime could not fetch URLs. Its earlier PR description suggests PR browsing. The source protocol takes precedence over that stale description. Our connector access here does not establish access inside Devin's ChatGPT session.
5. The cloud protocol describes both parallel named rounds and a final single-chat serial rule; state schema has one `open` object. This needs an explicit queue/lock contract, not a belief that unique numbers solve concurrent chat access.

## B. CURRENT_SYSTEM_FINDINGS

These are findings about QA design/evidence, not claims that historical game bugs remain live.

| ID / severity | Evidence and failure mode | Required strengthening |
|---|---|---|
| SYS-01 High | SOURCE S01/S03/S10: P5 gates Medium+, P4 uses Confirmed-only dynamic evidence, generic review permits minor deferral; no common all-actionable closure decision | One typed decision engine; severity prioritizes work, does not waive a real Low correctness defect |
| SYS-02 High | SOURCE R01: transport accepts matching ROUND without tree, task/material checksum or reviewer-context binding | Bind request, repository state, contract revision, evidence bundle and reviewer identity; DONE != pass |
| SYS-03 High | HISTORICAL S08: staged ritual omitted a fix present in the working tree; tests ran the latter | Test/review the same materialized tree; include staged, unstaged, untracked, runtime config and aggregate parents in identity |
| SYS-04 High | SOURCE R01: inline selected hunks and one shared chat; no guaranteed blind independent final reviewers | Complete read-only snapshot access or materialized full scope; isolated first analyses; explicit access gaps |
| SYS-05 High | HISTORICAL R03 Talent report: High issues at round 42 and another Medium at 47 after earlier PASS WITH EVIDENCE | Fix invalidates convergence; novel attacks and fresh aggregate re-review, not only finding verification |
| SYS-06 High | HISTORICAL R03 body-core r27: assertions checked the supplied save, not restored/live owner | Test-quality reviewer, original-bug kill proof, semantic before/after owner snapshots |
| SYS-07 Medium | SOURCE S05/S06: verify excludes runtime/lab/lint; seeded simulations exist but no general state-machine/fuzz/mutation framework established by inspected configs/search | Explicit manifest of required tools/tests, seeded valid/invalid action generation, targeted invariant mutation |
| SYS-08 High | HISTORICAL R02/R03: reports label full runs with failed tests as pre-existing/environmental, and still provide scoped QA pass | Preserve task causality classification, but prohibit aggregate fixed-point claim while required gates fail/unverified |
| SYS-09 Medium | SPEC DRIFT R02: body-perfection report says two body columns; newer PR body says three and different test totals; addenda lack a single immutable reviewed-state record | Append-only state-bound evidence; never upgrade earlier PASS by attaching later prose alone |
| SYS-10 High | SPEC DRIFT S03/R03: QA write rule forbids production fixes in QA; Talent report describes a production fix 'in-pass' without explicit phase transition | Distinct READ/REPRO and REPAIR states/leases; reset review evidence after repair. Wording alone does not prove an actual unauthorized write, but cannot demonstrate compliant handoff |
| SYS-11 Medium | SOURCE R01 and R03 inventory: protocol says mailbox/state stay untracked; #16 changed files contain `.c2c` runtime artifacts | Separate audited, redacted evidence from transient transport/session files; history preserved; no automatic deletion or secret reads |
| SYS-12 High | SOURCE S01/S02/S07: one owner and real-consumer rules are strong; historical RR6/RR7/RR8 show grep and helper-only guards missing invocation cardinality/content semantics | Mandatory producer/consumer/authority census plus production seam outcomes and sibling hunts |
| SYS-13 Medium | SOURCE S05: scaled presentation deadlines/local server reuse can obscure production timing/source identity | Separate normal-timing suite, explicit contention experiment, server-to-state fingerprint; never reuse unknown server |
| SYS-14 Medium | SOURCE S03 vs prompt: current no-backward-migration convention; requested taxonomy includes migrations | Apply migration attacks where supported; always attack explicit old-version rejection and non-mutation. Do not invent backward compatibility |
| SYS-15 Medium | SOURCE R01/S10: cloud children branch from `origin/master` in generic fan-out instructions; actual missions target an integration branch | Record dependency DAG and approved base/head tuples per child; validate actual combined candidate, not sum of child passes |

## G1: Q1-Q12 audit answers

| Questions | Evidence answer |
|---|---|
| Q1-Q3 owner, responsibility, state | Current completion authority is spread among P-rules, QA skill verdicts, sequential review and C2C. Proposed coordinator alone decides completion; detectors own evidence, never approval side effects |
| Q4-Q6 production consumers/layering | Consumers include Codex/Devin instructions, `.opencode/agent/{build,general,plan,explore}.md`, skills, C2C standing instructions and cloud script. New protocol must migrate entry points and preserve detector responsibilities |
| Q7-Q10 invariants, timing, pure reads, failure/stale paths | Schema identity, immutable snapshot, exact evidence, separate transport/QA state and stale rejection are necessary; no code exists yet for proposed enforcement |
| Q11 old/alternate paths | Existing detectors stay live during migration. Local connector and cloud inline transport are adapters, not competing approval authorities |
| Q12 finish/scope | This deliverable finishes with reviewed design, exact artifacts and Devin adoption/qualification instructions. It cannot claim new system installed or game convergence |

## Disposition prerequisite

No useful detector is removed by this audit. Proposed consolidation may merge only scheduling, result formats and decision ownership. Capability preservation is mapped in the migration document and must be demonstrated with golden bugs and orchestrator qualification before removing duplicated approval prose. The design phase can provide a preservation argument; it cannot honestly claim executed non-regression proof.
