# Automatic learning from failures

Status: CANONICAL — installed by the internal fixed-point QA protocol adoption. Sole QA authority: `README.md` in this directory.
This is a mandatory part of the internal QA loop. Learning is a repository capability, not reliance on one conversation's memory, and not an external review.

## Purpose and owner

After every meaningful failure, the primary agent must make a future recurrence more detectable. Writing an incident paragraph without an executable/detectable consequence does not complete learning. The coordinator owns the lesson ledger and versioned detection policy. Internal reviewers challenge proposed lessons; tools enforce references, freshness and promotion gates.

The system learns from defects, spec ambiguity, missed consumers, weak tests, failed or stale evidence, escaped bugs after an earlier clean result, false positives, flakes, tool/access failures and context-contaminated review. It must distinguish these classes instead of treating every red test as a product bug.

## Mandatory incident -> learning loop

```text
incident observed
 -> preserve exact input/state/tool result
 -> reproduce or establish bounded direct proof
 -> identify root defect class AND why the detector missed it
 -> search siblings and related historical lessons
 -> propose regression pin + generalized attack + routing/coverage change
 -> fresh internal reviewer challenges oracle, scope and false positives
 -> qualify against original failure, legal controls, sibling samples and holdout
 -> promote versioned lesson automatically when objective conditions pass
 -> invalidate affected QA evidence, load lesson in subsequent missions
 -> measure recurrence/detection and revise without deleting history
```

No per-lesson human permission is needed for additive detection improvements within the installed QA scope. Product semantics, dependencies, destructive operations, repair outside authorized scope or weakened gate policy still follow project authorization rules. This deliverable only specifies the behavior; it does not modify existing QA rules now.

## Learning state and exact record

Use the unified ledger's `lessons` records. After installation separate two stores:

- `game/docs/qa/learning/history/lessons.jsonl`: append-only incident/candidate/qualification history, treated as evidence and excluded from product identity. Nothing in this journal is automatically governing policy.
- `game/docs/qa/learning/policies/<policyHash>.json` plus `game/docs/qa/learning/active-policy.json`: immutable promoted lesson definitions/detector references and the active index, included in product/contract/attack identity. Only a qualified promotion or explicit rollback publishes a new policy object and atomically updates the active index. The run's learningPolicyId hashes this policy, not the growing journal.

The per-run ledger references exact lesson revisions and policy hash. A new benign observation can append evidence without changing active policy; a real actionable incident still resets convergence semantically. Field meanings:

Policy serialization has no self-hash cycle: immutable policy payloads contain versioned rule/lesson definitions and detector references, but omit their own computed policyHash/policyVersion and journal/effective-run metadata. Compute policyHash from that canonical payload; store the hash in the filename, active index and external lesson/run records. A lesson's policyVersion in the journal is a reference to that object, not a field recursively included in the object's own hash. Source detector/test files are hashed by content, not by a self-referential containing run ID.

| Field | Contract |
|---|---|
| id / version / supersedes | Stable `L-...` identity, monotone version, previous record identity or null; append, never overwrite prior evidence |
| triggerType | DEFECT / ESCAPE / SPEC / TEST / TOOL / FLAKE / FALSE_POSITIVE / EVIDENCE_INTEGRITY |
| findingIds / incidentEvidenceIds / originatingRun | Exact causal records and reproduced state; no lesson grounded only in a model assertion |
| rootClass / missedInvariantIds | Semantic cause; link all relevant owners, not just changed filename |
| escapeReason | Missing attack, wrong fixture, weak oracle, wrong snapshot, incomplete census, contamination, stale evidence, unsupported tool, or documented other mechanism |
| applicability / exclusions | Searchable domains, concepts, semantic signatures, entry paths and counterexamples where the rule must NOT fire |
| proposedProtection | Named regression tests, generator/mutation operators, structural guard or reviewer attack card; every element has an owner/path/oracle |
| promotionEvidenceIds / qualifiedBy | Original-bug kill, known-good controls, sibling coverage and independent review; role is learning adjudicator, not a blind clean-round reviewer |
| capabilityDelta | Which previously missed violation is now detectable; which old detectors remain; any false-positive/performance tradeoff |
| status | CAPTURED / CLASSIFIED / CANDIDATE / CHALLENGED / QUALIFIED / PROMOTED / REJECTED_WITH_REASON / ROLLED_BACK / SUPERSEDED |
| policyVersion / effectiveFromRun | Hash of resulting detection policy and first applicable run; later runs explicitly acknowledge loading it |
| recurrenceFindingIds / preventionEvidenceIds | Link later misses/catches; separate measured prevention from assumed effectiveness |

## Promotion predicate

Promotion is automatic only if all are true:

1. Incident evidence is valid and state-bound; a proven static defect remains SOURCE_PROOF, never rewritten as an executed failure.
2. Root class and escape mechanism are explained; applicable sibling search is complete or explicitly blocks promotion.
3. The new detector catches the original bug or a faithful representative mutant for the intended reason.
4. At least one valid nearest-neighbor case and every relevant maintained behavior remain accepted. Reject rules that ban a legal pattern merely because it occurred near a bug.
5. The rule is a stable invariant/attack mechanism, not a content-ID workaround. Runtime consumer/inverse/restore consequences are covered where relevant.
6. A fresh internal reviewer independent of author validates the oracle, scope, counterexamples and preservation of existing detection capabilities.
7. The relevant deterministic/QA checks of the changed QA artifacts pass under the **previously accepted protocol plus additive candidate checks**. A new policy cannot certify itself by removing the check it fails.
8. No required coverage, evidence strength, independence, gate or product requirement was reduced. A change that relaxes policy requires explicit human authorization and remains an exception, not automatic learning.
9. All introduced files/instructions/guards are synchronized and referenced by the next-run intake; no lesson stored in an unread archive counts as promoted.

A material runtime defect normally gets an executable pin. When the decisive evidence cannot practically be encoded, promote a reproducible attack procedure with retained runtime proof and mark weaker automation visibly. That cannot satisfy a REQUIRED automated pin/mutation cell without an independently justified applicability decision.

## How the next task automatically uses lessons

At INTAKE, after snapshot/census and again after scope expansion:

1. Read promoted lesson index and policy version.
2. Match lessons by domain, invariant, root class, owner/consumer graph and semantic operation (restore, grant, reject, reset, ACK, etc.), not filename alone.
3. Inject required regression pins/attack cards into the run's coverage matrix and generators. Explain matched and rejected applicability, with a reviewer checking exclusions for high-risk lessons.
4. Run all mandatory global sentinel lessons even if the current diff appears unrelated: wrong snapshot, stale evidence, live authority restoration, invocation wiring and test-oracle validity.
5. Require every matched lesson to have current evidence or explicit NOT_APPLICABLE proof. No silent pruning for time/cost.
6. Record the consumed policy hash and lesson IDs in the run. Resume after compaction must reload them, not rely on conversation history.

Round-B blindness excludes current-run findings/history. It does not erase basic project laws. Neutral promoted invariant/attack policy may be supplied; the reviewer independently derives the local failure hypothesis. Do not supply a previous finding narrative as a 'lesson' to covertly tell a blind reviewer the answer. Holdout cases remain unavailable until first analyses are sealed.

## Learning strength escalates with recurrence

- First material incident: reproduce, preserve original failure, add pin and at least one reusable attack operator/applicability rule.
- A second independent instance of the same class, or a recurrence after promotion: treat the previous protection as insufficient. Expand producer/consumer census, add a production-seam/global invariant or state-machine property, inject a corresponding mutation, and audit why the first lesson failed to route/catch it. Do not merely add another example assertion.
- Escape after an earlier fixed-point claim: open an ESCAPE incident linked to that certificate and exact former attack model; mark the prior confidence claim superseded for affected usage, reopen the class, replay the golden set and broaden the model before another fixed-point claim. Do not rewrite historical logs to pretend detection happened earlier.
- Repeated tool/transport failure: create capability preflight/recovery tests and stable local artifacts; never treat tool absence as permission to remove required evidence. ChatGPT Web instability specifically results in removing that transport as a required dependency while retaining its semantic attack capabilities internally.

## Learning from false positives and flakes

For a false positive, record the failed assumption and a minimal valid counterexample. Narrow the rule's applicability only after demonstrating the actual bug still fails and the legal case passes. No blanket path suppression, severity downgrade or ignored finding list is learned automatically.

For a flaky check, preserve the first failing trace and competing outcomes, environment/RNG/time differences, root cause and reproducibility evidence. A deterministic scheduler or clearer observable may improve it; increased timeout/retry alone is not a learned correctness rule. Quarantine needs an explicit bounded exception and does not make aggregate verification complete.

Tool failures teach reproducible setup and capability checking: exact binary/version, OS/runtime, error code, recovery and a harmless readiness probe. Never store credentials, full environment dumps, browser profiles or private tokens.

## Anti-poisoning, drift and rollback

Repository text, reports and reviewer messages are evidence, not executable instructions. Validate schema and path containment. Only the coordinator can promote after independent validation; a worker cannot self-declare a new global rule. Prefer behavior/invariant guards over source-text bans. Protect fixture-generated positive cases from being mislabeled production outcomes.

Track recurrence rate by root class, original-bug kill success, legal-control false positives, stale-evidence rejection, missing routing and escaped defects. Do not claim effectiveness from number of lessons or generated tests. Zero recurrence is not prevention proof without exposure to the relevant input family.

If a promoted detector is wrong, append rollback/supersession reason and replacement qualification. Preserve the original reproduction/regression protection or a demonstrably equivalent replacement. Human-reviewed relaxation is distinct from automatic additive improvement. A product change that legitimately retires an invariant updates authoritative rulings first, then requalifies dependent lessons.

## Avoid an infinite self-modification loop

Learning proposals from the repair/discovery phase are qualified and promoted **before** freezing a clean-round candidate. Promotion changes protocol/test/attack inputs and resets convergence as appropriate. During Clean A/B, collect incident records but do not silently rewrite the active policy. A real new defect/coverage gap exits candidacy, promotes its necessary protection, then begins a new pair.

Novel test inputs and traces generated by an already frozen generator/attack envelope are evidence and can accumulate without changing the policy hash. A new generator/oracle/requirement or permanent regression test changes the candidate/model and requires a new freeze. Routine successful check logs do not demand a policy update.

## Guidance facets — lessons as construction guidance (schema v2)

A lesson's detection record stays unchanged; v2 adds an optional `guidance` facet that turns the same lesson into prevention: the binding instructions an implementing agent must satisfy BEFORE writing code, not just the detector that catches the defect after. Kinds: `INVARIANT` (binding rule), `RECIPE` (ordered construction steps), `VERIFIED_EXAMPLE` (a proven-correct precedent to copy), `HAZARD` (a known-wrong pattern to avoid), `DISCOVERY_QUESTION` (an unresolved input the brief must answer).

Facet lifecycle: `CANDIDATE` (captured hypothesis — informs bounded discovery only, never auto-applied) -> `QUALIFIED` (independently verified) -> published into `policies/<hash>.json` — or `REJECTED`/`STALE`/`SUPERSEDED`/`ROLLED_BACK` with a recorded reason. Qualification requires: non-empty `authorityRefs` (current authoritative sources), `qualificationEvidence` (original-bug kill + legal controls + candidate-overlay trial), `qualifiedBy` naming an independent verifier — self-approval is rejected by the runner. A facet whose `originAnalysis.category` is `UNKNOWN` may not qualify as a RECIPE (no fabricated causality).

`originAnalysis` names why the original defect escaped: `NOT_RETRIEVED` | `STALE_OR_WRONG` | `AMBIGUOUS` | `NOT_APPLIED` | `MISSING_CAPABILITY` | `CONTRACT_UNRESOLVED` | `NOVEL_CLASS` | `UNKNOWN` | `NOT_APPLICABLE`. Prevention claims: `causalPrevention` starts `NOT_ESTABLISHED`; `EARLY_CORRECTION_OBSERVED` needs a consumption record showing the guidance corrected work before detection would have fired; `COMPARATIVE_EVIDENCE` needs a comparative pilot across ordinary tasks — until then effectiveness is reported as `EFFICIENCY_NOT_YET_ESTABLISHED`.

Routing is deterministic (no similarity search): `qa:internal prepare` emits a `lessonRouting` record per facet — `APPLY` (applicability matched, source hashes fresh, status QUALIFIED), `NOT_APPLICABLE` (exclusion or no trigger), `STALE` (source dependency drift — resolve or reject before apply), `NEEDS_DISCOVERY` (candidate hypothesis). Publication is atomic (`policies/<hash>.json` via tmp+rename, then `active-policy.json`) — torn publication is detected on load, not silently trusted; a payload may not contain `policyHash` or generated-run references (no self-hash cycle). Consumption records prove adoption after publication; a promoted facet that never survives a real task does not count as prevention.

## Immediate lessons to seed from this audit

These are candidate lesson specifications, not promoted or executed results:

| Candidate | Escape mechanism | Required upgraded protection |
|---|---|---|
| L-RESTORE-OWNER | Test asserted incoming save, not live restored owner | Restore into different owner; post-state equality plus reject non-mutation; mutant leaves live owner unchanged |
| L-OWNERSHIP-INVERSE | Forward prerequisite checks missed orphaned dependent state | Bidirectional ownership property across learn/revoke/reset/restore; orphan mutation |
| L-ACTUAL-CALL | Fixture injected a dependency omitted by actual production caller | Actual composition-root/call-signature integration and real progression E2E |
| L-IDEMPOTENT-DOUBLE | Two invocations produce the same final value | Invocation/event cardinality plus effect state; duplicate-registration mutation |
| L-ADAPTER-SEMANTICS | Conversion succeeded while optional scaling/effect data vanished | Production content enumeration, actual downstream outcome, field-drop mutations |
| L-OFFER-UNIVERSAL | One legal offer masked illegal members in a persisted list | Every-member integrity plus decision-time legality; mixed legal/foreign/zero-weight cases |
| L-EXACT-TREE | Reviewed staged code differed from tested working tree | Materialized candidate fingerprint, stale result rejection, server identity test |
| L-ZERO-DELIVERY | Subscribers fired even when delivery was zero | Delivered-quantity invariant across every producer with event/receipt cardinality |

Each candidate must pass the promotion predicate during Devin adoption before being described as learned protection.

## Incident records

### 2026-09-30 BETA-FINAL PR12 (updater) - two escapes caught inside the gate

- **Incident:** `recordMain` TDZ crash on invalid-feed boot. UpdateService's constructor records eagerly on a rejected packaged feed; the service was constructed before `const recordMain` in main(), so the `record` arrow hit the TDZ - the exact guarded-failure path crashed main().
  - **Root class:** L-ORDER-EAGER - a dependency captured by a lazy callback is invoked synchronously by the constructor, before the binding is initialized. Declaration order, not call order, was wrong.
  - **Detector escape:** type-check/build green (TDZ is a runtime fault); no unit harness exists for electron/main.ts by convention; OCR delegation read the deps object but not cross-block ordering.
  - **Pin/attack proposal:** construct eager-recording services AFTER their record/callback dependencies are initialized; P5 passes must trace constructor-time side effects, not only method bodies. Qualify as CANDIDATE.
- **Incident:** `quitAndInstall()` called without `isForceRunAfter` - the NSIS wizard would install but not relaunch, silently truncating the update journey; and a synchronous throw left phase 'installing' forever after a successful flush.
  - **Root class:** L-API-DEFAULT-SEMANTICS - a library call taken verbatim adopted defaults that negate the caller's invariant (relaunch-after-install); plus unguarded terminal call post-commit.
  - **Detector escape:** the FakeUpdater in tests accepted any signature; semantics only live in electron-updater docs, not types.
  - **Pin/attack proposal:** for provider-boundary adapters, pin every defaulted argument that carries a journey invariant in the adapter comment AND verify launch-failure recovery (state returns to a retryable phase). Qualify as CANDIDATE.

### 2026-09-30 qa-fixpoint-master (beta-scope-v2 master gate) - 9 incidents across 15 findings

- **Incident:** carried-save hidden-progression records kept applying effects into live play (F-DL-1 stat-cap inflation, F-DL-2 enhanced realm passive) on a save the reader itself flagged unsupported.
  - **Root class:** L-DORMANT-CARRIED-EFFECT - persisted scope-hidden records are dormant-but-legible: they deserialize intact and their readers kept honoring them. Dormancy flags gated ENTRY (panels, commits) but not the READ seams that turn stored state into stats/effects.
  - **Detector escape:** hostile-save fixtures were exercised against deserialize/flag readers only; no probe replayed a carried record through an effect seam (StatCap read, RealmPassive grant). F-DL-5 (formation_loadout false-positive on absent field) is the same class at the flag reader: presence checks that treat `undefined !== null` as a record.
  - **Pin/attack proposal:** for every persisted field owned by a scope-hidden domain, enumerate its live READERS (not just writers) and assert a carried value cannot alter any effect seam; betaDormantSaveLeak.qa.test.ts now pins the cap/passive reads. Record-presence checks must distinguish absent from present-null. Qualify as CANDIDATE.
- **Incident:** `unsupportedReleaseReason` threw TypeError on `hiddenPerfection: null` (F-DL-3) - the §H hostile-save reader itself crashed on a hostile shape.
  - **Root class:** L-DEFENSIVE-SHAPE - a read written to tolerate corrupt data failed closed on the ONE shape it was meant to tolerate (null/absent treated as object).
  - **Detector escape:** robustness was unit-tested per-field but never fuzzed with non-object scalars/arrays crossing the persisted boundary.
  - **Pin/attack proposal:** every §H flag reader gets a hostile-shape matrix (null, scalar, array, corrupted-nested) asserting resolve-not-throw; now pinned in betaDormantSaveLeak.qa.test.ts.
- **Incident:** two contract-mandated surfaces were completely unwired: the §H unsupported-save notice (F-DL-4) and the §H beta-completion ending beat (F-RM-3, `betaCompletionFor` had zero UI consumers).
  - **Root class:** L-UNWIRED-CONTRACT - a read-model + spec line existed with no consumer; the contract described a surface no code path could reach.
  - **Detector escape:** read-models were verified for correctness against fixture states but nobody enumerated CONSUMER count per read-model; a zero-consumer authority is silent.
  - **Pin/attack proposal:** census every exported beta read-model for >=1 production consumer as a suite check (an authoritative read-model with zero consumers is a defect, not a wart); betaCompletionFor gained its modal consumer; betaSupportedFor gained the post-restore notice consumer.
- **Incident:** three surfaces rendered dormant content through their own filtering, bypassing the canonical beta read-models (F-RM-1 SkillPathPanel element tabs, F-RM-2 combat bar ultimate slot, F-RM-4 AlchemyView dormant families).
  - **Root class:** L-PARALLEL-VERDICT - a surface recomputed visibility from raw domain data (ELEMENT_ORDER, fixed ROLE_ORDER, raw recipe realm filters) instead of rendering the read-model verdict verbatim; the read-model said scope-hidden while the surface rendered the content.
  - **Detector escape:** each surface was internally consistent; only a verdict-vs-render comparison exposes the disagreement (betaReadModelHonesty.qa.test.ts pattern now exists).
  - **Pin/attack proposal:** for every tri-state surface, assert rendered-set === rail verdicts (available+progression-locked render, scope-hidden does not); never let a surface re-derive scope.
- **Incident:** `usePillDetailed` consumed dormant pill families on carried saves and applied their effects to baseStats (F-TRI-1).
  - **Root class:** L-GATE-MISSING-EFFECT-SEAM - the consumption seam was gated on domain reasons (retired/material/realm/battle) but never consulted the scope authority; entry-gating alone is insufficient when a hostile save bypasses acquisition gates entirely.
  - **Detector escape:** hostile-save analysis focused on persisted-field readers; CONSUMPTION seams (bag item -> effect) were assumed covered by acquisition-side gates.
  - **Pin/attack proposal:** every effect-applying seam must check scope, not just acquisition surfaces; unknown/legacy ids must remain consumable (the dormant resolver rejects only authored dormant families).
- **Incident:** `resolveCombatBuild` resolved a dormant way's full combat kit on a `way_out_of_scope` save (F-TRI-2) - the engine executed sword/body/hidden kits while the rail reported scope-hidden.
  - **Root class:** L-ASYM-SIBLING-SEAM - the same function gated two sibling ACCESS seams (companions, formation buff) but not the third (the player's own path runtime); partial gating reads as complete gating.
  - **Detector escape:** dormant-participation checks were written per-feature; the way runtime was categorized as 'the player's own state' rather than a dormant feature with an ACCESS seam.
  - **Pin/attack proposal:** ACCESS seams enumerate the full dormant-feature list - a feature table diff (`isScopeHidden` checks vs. reachable seams) would have caught the missing third seam; CombatBuild now fails closed to the generic basic.
- **Incident:** save-version coupling forced a design retreat mid-fix (F-RM-3 first draft added `betaCompletionAcknowledged` to PlayerData -> would have required the v88 bump that bricks every existing save).
  - **Root class:** L-SAVE-SCHEMA-COUPLING - ANY PlayerData field addition is a breaking save-schema change (dev-phase no-migration convention); a UI acknowledgment belongs to a side channel.
  - **Detector escape:** type-check/tests do not model save-version bricking; the constraint was discovered through schema review, not a test.
  - **Pin/attack proposal:** device-local/derived acknowledgments (localStorage keyed by character name) for UI-consumption flags; keep the PlayerData diff empty unless the intent is a save-version bump. Documented in the fix, not a test - flag for save-schema lint coverage later.
- **Incident:** test fixtures themselves encoded the leak (PERMANENT_PILL = dormant `to_cot_dan_mortal` expected to consume; CombatBuild parity test asserted dormant-way kit resolution).
  - **Root class:** L-FIXTURE-ENCODES-DRIFT - suites authored pre-lock kept asserting pre-lock behavior as correctness; the new invariant required fixtures to change, not code.
  - **Detector escape:** not an escape - the fixtures failed loudly post-gate; the retreat was recognizing they pinned the OLD contract (update fixture to a beta family, keep the mechanic under test).
  - **Pin/attack proposal:** when a scope gate lands, sweep fixtures for dormant-content consumption; an unlocked-test-build convention (setup.betaScope.ts admits all) already handles the dormant-machinery suites.

- **Incident:** e2e helpers + a boot spec still clicked `creation-skill-tram` after the unified-creation refactor (fb16d2b7) removed the starter-skill pick - the whole e2e layer had drifted dead on master while `npm run verify` stayed green.
  - **Root class:** L-SUITE-DRIFT - coverage suite excluded from the verify gate went silently stale as the product moved.
  - **Detector escape:** no detector at all - e2e specs are not part of `npm run verify`; nothing executed them on master.
  - **Pin/attack proposal:** a runtime probe run (boot + save/reload) inside every fixed-point QA gate - coverage excluded from the gate needs an explicit executor, not an assumption of health.

- **Incident:** a way_out_of_scope save could still browse, buy, level and respec its dormant way's node tree - `purchaseNode`/`upgradeNode`/`canPurchaseNode`/`respecNodeTree`/`selectSkillSpecialization` had no beta gate, and `SkillPathPanel` mounted the tree on `wayNodeTreeTag` alone (F-CA-1). `SkillRoleStrip` rendered the resolved dormant kit cards via `getResolvedSkillRoles`, bypassing the `betaCombatRolesFor` rail (F-CA-2).
  - **Root class:** L-WRITE-SEAM-UNGATED - the scope gate covered read-models and combat ACCESS seams but never the progression WRITE seams; insight economy writes on dormant machinery are invisible to rail-focused checks.
  - **Detector escape:** hostile-save analysis enumerated persisted-field READERS and combat/rail consumers; the node-tree write path (purchase/upgrade/respec/spec-claim) was treated as beta machinery because mortal/element nodes use it - the shared-write-path assumption hid the dormant-node admission hole. Found only by a blind clean-round reviewer.
  - **Pin/attack proposal:** every mutating op on tree-like registries must admit nodes through a scope predicate (`betaTreeNodeAdmitted`: requiredWay beta-admitted AND view tag outside dormant trees); respec/refund seams fail closed on dormant holdings (freeze, never monetize); verdict-vs-render parity now covers write ops too (canPurchaseNode must agree with purchaseNode).

- **Incident:** a committed hidden_spell save still pushed its reaction-aura entryBuffs onto every ally in combat (F-A2-1) - `CombatBuild` gated kit/companions/formation on `wayAdmitted` but the `spell.reaction_aura` capability block one section below never consulted it.
  - **Root class:** L-ASYM-SIBLING-SEAM (recurrence of the F-TRI-2 class one layer down) - sibling ACCESS seams inside one function gated asymmetrically; the aura seam read 'capability machinery' instead of 'dormant-kit buff layer'.
  - **Detector escape:** the wave that gated the player runtime treated `capabilities.has(...)` as intrinsic player state; the capability's way ownership was never traced (resolvePathCapabilities resolves via the ACTIVE way's def, so the aura only exists on hidden_way saves - exactly the saves the gate must cover).
  - **Pin/attack proposal:** inside a gated function, EVERY conditional content push must cite the same admission predicate in its own guard; pin asserts the hostile state (hidden way + learned aura passive) emits zero aura entryBuffs.
- **Incident:** dormant-kit skills minted and leveled through write seams the tree-tag predicate cannot see (F-A2-2/F-A2-3): `learnSkill` minted hidden-kit template skills (`van_phap_tuy_tam`) onto a clean beta save, and `levelUpSkill`/`canUpgradeNode` spent insight on untagged core nodes (`core_tham_the`) because core nodes carry no tree view tag - the dormant-ness lives in the SKILL's way ownership, not the node's.
  - **Root class:** L-PREDICATE-LEVEL-MISMATCH - the admission predicate evaluated the wrong entity level (node tag) while dormancy was declared on the entity's referent (skill -> way kit); untagged shared machinery (core nodes, learnSkill) had no admission at all.
  - **Detector escape:** the prior wave's hostile-node fixtures all carried requiredWay or a tree tag; an untagged core node + a template-level learn seam were never probed.
  - **Pin/attack proposal:** skill-level admission enumerates the way-owned lists (skillIds/passiveSkillIds/coreSkillIds/ownedContent.skillIds) per scope-hidden way, subtracting beta-way ownership; mortal starter declarations are NEVER ownership claims (mortal-domain). One write-admission predicate (tree tag AND skill level) gates purchase/upgrade/learn/respec/spec-claim seams uniformly.
- **Incident (detector self-fault):** the first draft of `betaDormantSkillIds` snapshotted way ownership in a module-load IIFE - under vitest, `setup.betaScope.ts` unlocks ALL ways before test-file imports evaluate, so the snapshot captured the unlocked state and silently admitted everything; the same latent fault existed in `BETA_DORMANT_TREE_VIEW_TAGS` (masked because pinned fixtures carried `requiredWay`, which short-circuits before the tag set).
  - **Root class:** L-MUTABLE-SNAPSHOT - a memoized read of mutable policy state froze at import time; the freeze point precedes the lock pin in every test module graph.
  - **Detector escape:** production behavior was correct (the set is static post-import in prod) - only test-side pinning silently un-pinned; the bug surfaced as a green-but-ungated fix until the admission matrix was dumped.
  - **Pin/attack proposal:** predicates over BETA_PLAYABLE_WAYS/BETA_FEATURES evaluate live per call (both helpers converted); a snapshot of mutable lock state is a detector fault, not an optimization.

- **Incident:** the scope lock's physique-essence faucet suppression was over-broad (F-B-1): `grantResolvedDrops` dropped `tinh_hoa_pham_the/bao_the/phap_the` under `isScopeHidden('bodyPath')`, starving the RealmPanel body chapters (body_refinement -> meridian -> zhou_tian) - a chain the LIVE Kien Co breakthrough grade consumes (`resolveKienCoGrade` requires 3/6 refinement tiers + 6 meridians) and whose currency pill `thong_mach_dan` stayed beta-enabled. Every beta player saw a permanently dead 0/7 progression strip.
  - **Root class:** L-SUPPRESSION-OVERBROAD - a domain-keyed suppression swept content whose live-ness is defined by a DIFFERENT ownership boundary than the domain tag implies (chapter machinery read as 'bodyPath' but the bodyPath tag means the The Tu WAY, not realm body progression).
  - **Detector escape:** dormancy leak checks test 'does hidden content reach live play' (one direction); nobody inverted it - 'does a suppressed faucet feed a consumer the live contract still requires'. The lock's own surfaces (unconditional RealmPanel mounts, ungated investBodyChapter tick, enabled meridian pill) contradicted the suppression and were not cross-checked.
  - **Pin/attack proposal:** for every scope-keyed suppression, enumerate the suppressed item's consumers and assert each is itself scope-hidden (a suppressed item whose consumer is live = broken visible scope); the body chapters' Kien Co grade dependency is the canonical consumer chain. Pinned: essence drop lands in the material bag under beta lock.
- **Incident:** a carried way_out_of_scope sword save still wrote and rendered sword machinery (F-B-2): `setKiemPhoPreset` returned true on a hostile save (capability gate admitted, no scope seam) and QuanKhiPanel mounted the dormant spec card + interactive preset editor behind `isActivePath(player,'sword')` - the same entry showed on CharacterPanel with no beta check.
  - **Root class:** L-WRITE-SEAM-UNGATED (third instance, after F-CA-1 node trees and F-A2-2/3 skill minting) + L-PARALLEL-VERDICT (the surface re-derived 'sword player' from the path flag instead of the scope verdict).
  - **Detector escape:** sword machinery was assumed covered by 'sword path is dormant' at the way-ownership level; per-op write seams and per-panel mount predicates each need their own gate.
  - **Pin/attack proposal:** way-machinery write ops gate on `isScopeHidden(<pathFeature>)` AFTER the capability gate; panel mounts gate on `isActivePath(...) && !isScopeHidden(<pathFeature>)`. Pinned: preset write rejects + preset untouched on a realm-valid sword save.

- **Incident:** a carried way_out_of_scope save kept its dormant way's STAT channels live (F-TC-1): the way facet (collectActiveWayStatModifiers), the way's authored statModifiers (getCultivationPathStatModifiers), the canonical technique's tier + combat modifiers (getTechniqueTier/CombatModifiers), learned way passives (getScaledPassiveModifiers) and the node_levels channel all emitted into resolvePlayerStatAssembly/getBattleBaseChannels on flagged saves - every ACCESS seam gated while the EFFECT seams downstream of a dormant way record stayed live.
  - **Root class:** L-EFFECT-CHANNEL-UNGATED (fourth instance of L-WRITE-SEAM-UNGATED, one layer below combat access) - dormancy was enforced at 'can the player reach the machinery' but not at 'does the machinery emit into the shared stat registry'; a dormant save's way record is preserved-by-design so every downstream reader needs its own admission read.
  - **Detector escape:** hostile-save enumeration covered persisted-field readers and write ops; stat-channel emitters were treated as beta machinery because the beta way uses the same channels - the shared-channel assumption hid the dormant emitters (exactly the F-CA-1 escape pattern recurring on the effect side).
  - **Pin/attack proposal:** enumerate every channel that aggregates per-player modifiers and gate each dormant-ownership emitter at its source (way facet + statModifiers via isBetaWay on the ACTIVE way; technique channels via way-techniqueId ownership; passives via way-owned skill lists; node channel via admitted-node filter at the call site when the aggregator cannot import the domain). Pinned: flagged saves emit [] on every channel; beta positive controls unchanged.
- **Incident:** `tryAdvanceTechniqueGrade` spent spirit stones grading a dormant way's canonical technique on a carried save (F-TC-3) - the grade-write seam checked technique existence/advance-band but never scope admission.
  - **Root class:** L-WRITE-SEAM-UNGATED (fifth instance) - economy write on dormant machinery.
  - **Detector escape:** technique-grade writes were cataloged as beta machinery; way.techniqueId ownership was never enumerated as a dormancy boundary.
  - **Pin/attack proposal:** way.techniqueId is an ownership claim - betaDormantTechniqueIds enumerates non-beta way techniqueIds minus beta-owned; grade advancement fails closed and debits nothing. Pinned: 500 stones untouched after refused advance.
- **Incident (detector depth note):** a requiredWay-only neuter of betaTreeNodeAdmitted survived every pin - all authored dormant nodes also carry branchTag view tags, so the view-tag path rejects them even with the requiredWay branch removed; defense-in-depth is real but the requiredWay branch alone is unprobed by current data (unit-level coverage nit for the predicate; no reachable defect).

- **Incident:** the ONLY writer of `player.autoWorkerCapacity` (`refreshAutoWorkerCapacity`, fired on build/upgrade of `chi_hien_quan`) is bound to the scope-hidden `manualWorkforce` feature, which no beta save can reach - so every fresh beta save ran `autoWorkerCapacity=0` and all three Thanh Van production sites produced nothing (F-B3-01: dead herb chain -> uncraftable alchemy families -> uncompletable `collect_tu_linh_thao_1` -> KienCo grade locked 'human'). The same binding let a carried save's persisted CHQ pool + `assignedWorkers` act as a manual override starveing live sites and advertising a workforce pool the player cannot reach (F-B3-02), while `ProductionPanel` rendered the dormant allocation block with a nonsense '5 / 0 workers' header (F-B3-03) and a restored hidden-family alchemy job held the live slot budget hostage (F-B3-04).
  - **Root class:** L-DORMANT-SOLE-SOURCE - a LIVE system's sole input/authority is bound to a dormant feature; gating hid the surface but never replaced the source, so the live system's fuel silently read 0. F-B3-02 is the same class inverted (a dormant SOURCE retained override authority over live machinery); F-B3-04 is L-EFFECT-CHANNEL-UNGATED on a shared budget (dormant records consumed the live slot count).
  - **Detector escape:** dormancy-leak checks ask 'does hidden content reach live play' - the binding direction (live consumer <- dormant source) is the opposite arrow and was never enumerated. Capacity 0 was also indistinguishable from 'CHQ not yet built' in every census, so the starvation read as intended early-game scarcity rather than a permanently dead economy.
  - **Pin/attack proposal:** for every field whose writer is scope-hidden, enumerate its LIVE consumers and route them through a scope-aware effective-value seam (`betaEffectiveWorkerCapacity` -> flat auto pool while hidden); dormant override records (assignedWorkers) become inert AND censored from read models (same precedent as DecomposeSystem.getSettings reporting 0); shared budgets count only live-family records. Pinned: fresh save produces on the flat pool end-to-end (bag non-empty after a due lane); carried CHQ save assigns no manual slots; panel block absent under lock; dormant jobs never consume slots.

- **Incident:** a carried hidden_spell / hidden_sword save's preserved way record still DROVE live realm writes (F-A3-01/02/03): `reconcileCultivationPathRealmRewards` + `grantCultivationPathRealmReward` minted the hidden way's authored tinh_thong L2 node grants on every restore, `syncRealmPassive` learned the canonical ladder passive through the dormant way's composed realmRewards record, and `applySwordPathRealmTransition` ran the Kiem Dao breakthrough merge on the preserved swordPath slice (kiemDaoCount 3 -> base x1.45, count collapsed to 1) - the dormant record was preserved-but-live, not preserved-but-inert.
  - **Root class:** L-REPLAY-SEAM-UNGATED - restore/entry replay seams written before the lock enumerate "what the save ALREADY passed" and unconditionally replay it; a dormant record replayed faithfully is a live write. Sibling of L-EFFECT-CHANNEL-UNGATED (F-TC-1) one direction up: channels emitted per-frame were gated, but event-driven replay seams (restore reconcile, realm-entry grant, realm-transition merge) were never enumerated.
  - **Detector escape:** hostile-save probing enumerated persisted-field READERS and always-on channels; replay seams run once per restore/advance so they only fire on the exact event edge - a census that never crosses a realm transition or reload sees nothing.
  - **Pin/attack proposal:** every replay/reconcile/realm-transition seam gates on way admission BEFORE reading the record (`way === undefined || !isBetaWay(way.id)` early-return, mirroring CombatBuild's wayAdmitted); the pinned hostile save crosses the exact edge (reconcile call, realm-entry grant, realm advance with capability present) and asserts zero writes - plus a beta positive control proving the seam still fires for live ways.
- **Incident:** a carried save's `selectedTalentIds=['pham_nhan_chi_cot']` emitted +0.75 cultivation_speed under the beta lock (F-A3-08): `collectTalentEffects` resolved ANY catalog-defined id, and the Great Dao reward's only acquisition path (the excluded `pham_cot` creation talent) is unreachable in beta - ownership admission was enforced at offer/draw seams but never at the per-frame effect lookup.
  - **Root class:** L-EFFECT-LOOKUP-UNROSTERED - a shared effect aggregator trusted the selection list it was handed; the roster boundary (creation allow-list + breakthrough pools = the only beta acquisition paths) existed for OFFER legality but was never consulted at EMIT time. Same class as F-TC-1's effect-channel gating, on the talent axis.
  - **Detector escape:** dormancy enumeration covered persisted dormant FIELDS (companions, swordPath...) but selectedTalentIds reads as always-live beta state; that a member ID inside a live field can itself be a carried dormant record needed the acquisition-path inversion (for each defined id: is any beta path able to write it?).
  - **Pin/attack proposal:** `isBetaTalentId` (BETA_TALENT_IDS = creation allow-list + every breakthrough-pool member, static catalogs) gates `collectTalentEffects` fail-closed; pin asserts pham_nhan_chi_cot emits nothing under lock with creation + pool positive controls.
- **Incident (detector self-fault):** gating `collectTalentEffects` on the static roster broke pre-beta data-wiring suites (pham_cot/pham_nhan_chi_cot resolution) - the roster had no test-unlock seam unlike BETA_PLAYABLE_WAYS/BETA_FEATURES; the first fixture draft fixed that by eagerly importing talent catalogs, which pre-cached `data/talent/Talents` in the setup-file module graph BEFORE `vi.mock(BreakthroughTalentPools)` applied, silently breaking the offer-legality suite's mock.
  - **Root class:** L-UNLOCK-FIXTURE-EAGER-IMPORT - a global unlock fixture must declare lock STATE only (flags/mutable roster objects); importing the data it unlocks creates an early binding that outruns test-file mocks.
  - **Pin/attack proposal:** new lock classes ship their unlock seam as a flag (BETA_TALENT_ROSTER.unlocked) plus lock/unlock helpers in __fixtures__; the global setup file unlocks it; scope-pin suites re-lock. Any fixture that needs catalog data is a detector fault.
- **Incident:** respec preview + execution threw `Node not found` on a save carrying retired/ghost nodeLevels ids (F-T2-1): the validator tolerates non-core ghost ids by design (skip, preserve), but `holdsDormant` probed `nodeRegistry.get(id)` - a THROWING accessor - behind a `!== undefined` guard that can never be false.
  - **Root class:** L-DEAD-GUARD-GET - `.get` on this registry throws for unknown ids; `x = get(id); x !== undefined` is dead code that crashes instead of skipping. ~20 sibling sites correctly has()-guard; the two respec probes copied the guard shape without the call shape.
  - **Detector escape:** the respec seam was exercised only on authored live trees where every held id resolves; the validator's ghost-tolerance contract was never pushed through the respec ops that read the same map.
  - **Pin/attack proposal:** hostile pin carries a retired node id through preview+respec asserting no-throw and record preservation; registry.get must never appear without a sibling has() guard (grepable rule: `\.get\(` without `has(` on the same registry in the enclosing block).

- **Incident:** hiddenPerfection.completedHiddenBodyRealmIds on a loaded save inflates main-stat cap under beta scope (F-DL-1); hiddenPerfection.hiddenBreakthroughRealmIds grants the enhanced realm-passive variant under beta scope (F-DL-2).
  - **Root class:** L-DORMANT-EFFECT-SEAM - AUTHORITY.
  - **Detector escape:** dormant persisted state fed effect seams (stat cap, realm passive) because the seam read the raw field without isBetaFeature gating | detector gap: the green baseline had no assertion that dormant records stay inert - unlock-everything test setup masked the leak.
  - **Pin/attack proposal:** gate every effect seam on the scope authority; census all dormant persisted fields for effect feeds.

- **Incident:** unsupportedReleaseReason throws TypeError on hiddenPerfection:null (F-DL-3); unsupportedReleaseReason flags formation_loadout on a save MISSING the field (absent field treated as record) (F-DL-5); REJECTED: consumePill throw claim - usePillDetailed fails closed on unknown ids (F-DEFER-4); betaCompletionFor throws on non-array completedStageIds (unreachable via validated saves) (F-DEFER-5).
  - **Root class:** L-HOSTILE-SHAPE - ROBUSTNESS.
  - **Detector escape:** flag reader used !== null on a value that can be absent (undefined) or non-object, throwing / false-flagging | detector gap: shape matrix (null/scalar/array/absent) not enumerated at the seam.
  - **Pin/attack proposal:** enumerate the hostile-shape matrix on every save flag reader.

- **Incident:** frontend-contract sec.H unsupported-save notice is unwired: unsupportedReleaseReason/betaSupportedFor have zero production callers (F-DL-4).
  - **Root class:** L-CONTRACT-NOTICE - CONTRACT.
  - **Detector escape:** contract required a notice on flagged saves but the flag had zero UI consumers | detector gap: contract clauses without a consumer probe drift unwired.
  - **Pin/attack proposal:** every contract observable needs a consumer census entry.

- **Incident:** SkillPathPanel renders the 4 non-committed element branches as browsable locked tabs, violating contract sec.D scope-hidden mandate (F-RM-1); Combat skill bar renders an empty 'Ultimate' slot button for every beta player (scope-hidden role teaser) (F-RM-2); AlchemyView renders 4 dormant pill families (phi_van/to_cot/thoi_the/duong_than) via unfiltered getAlchemyRecipes + realm filter (F-RM-4).
  - **Root class:** L-RAIL-BYPASS - AUTHORITY.
  - **Detector escape:** three surfaces rendered dormant content (element tabs, ultimate slot, alchemy families) around the verdict rail | detector gap: rail computed correctly but no rendered-set===verdict pin existed.
  - **Pin/attack proposal:** pin rendered-set === rail verdict on every tri-state surface.

- **Incident:** betaCompletionFor has zero UI consumers - the contract-promised beta ending beat never displays (F-RM-3).
  - **Root class:** L-UNWIRED-BEAT - CONTRACT.
  - **Detector escape:** betaCompletionFor computed the end beat but nothing mounted it | detector gap: same unwired-consumer class as L-CONTRACT-NOTICE.
  - **Pin/attack proposal:** consumer census for every contract read-model.

- **Incident:** CombatBuild resolves the dormant way kit on a way_out_of_scope save - engine executes sword/body/hidden kit while the rail renders scope-hidden (F-TRI-2).
  - **Root class:** L-DORMANT-RUNTIME - AUTHORITY.
  - **Detector escape:** combat kit builder gated companions/formation but admitted the players own dormant-way kit | detector gap: sibling seam audit stopped at external systems, not self-runtime.
  - **Pin/attack proposal:** sibling search must include the subjects own runtime path.

- **Incident:** usePillDetailed has no beta gate - dormant pill families on a carried save consume and apply effects (permanent_stat baseStats write) (F-TRI-1).
  - **Root class:** L-DORMANT-CONSUME - AUTHORITY.
  - **Detector escape:** pill consumption applied permanent_stat for dormant families on carried saves | detector gap: family-resolver census missed the consume path.
  - **Pin/attack proposal:** gate every dormant-content effect seam, not just render seams.

- **Incident:** e2e suite dead at character creation: specs click removed creation-skill-tram testid (F-E2E-1).
  - **Root class:** L-FIXTURE-DRIFT - TEST_QUALITY.
  - **Detector escape:** e2e helpers referenced a testid removed by the unified-creation refactor; whole e2e layer dead while verify stayed green | detector gap: e2e specs excluded from npm run verify - no executor noticed drift.
  - **Pin/attack proposal:** runtime probes inside the QA gate; excluded suites need an explicit executor.

- **Incident:** Bag sections render dormant stacks unfiltered on flagged saves (materials/equipment/dormant pills) (F-DEFER-1); getResolvedSkillRoles renders the dormant way kit names on way_out_of_scope saves (SkillRoleStrip) (F-DEFER-2); In-flight alchemy jobs for dormant families complete and deliver pills on flagged saves (F-DEFER-3); autoFarmStage.lastCheckedMs may carry a future timestamp (unclamped persisted read) (F-A2-4).
  - **Root class:** L-DEFERRED-LOW - CONTRACT.
  - **Detector escape:** dormant bag stacks / skill strip names / in-flight dormant jobs render on flagged saves (display-only, effect seams closed) | detector gap: display polish on out-of-scope saves - user ruling defers Low.
  - **Pin/attack proposal:** deferred per ruling; revisit when display filtering budget exists.

- **Incident:** carried save's persisted chi_hien_quan pool + assignedWorkers keep live override effect on flagged saves (F-B3-02); restored dormant-family alchemy job occupies maxConcurrentJobs -> job_slots_full with no visible cause or cancel path (F-B3-04).
  - **Root class:** L-DORMANT-PERSISTED-OVERRIDE - AUTHORITY.
  - **Detector escape:** persisted dormant records overrode live beta values (worker capacity, job-slot budget) - dormancy read through carried state instead of being ignored | detector gap: hostile-save probes covered dormant FIELDS but not dormant RECORDS inside live aggregates.
  - **Pin/attack proposal:** when a scope-hidden slice is preserved, every aggregate that iterates it must filter by the admission predicate, not by presence.

- **Incident:** ProductionPanel renders the scope-hidden worker-allocation block unconditionally (nonsense '5 / 0 workers' header) (F-B3-03); dormant-family job settlement emits a 'craft' delivery toast carrying the dormant pill identity (F-B3-05); CombatBuild binds survive.extraSources from the ungated runtime while siblings use gatedRuntime (F-B3-06).
  - **Root class:** L-DORMANT-RENDER-SEAM - READ_MODEL.
  - **Detector escape:** render surfaces mounted dormant blocks (allocation UI, toast identity, extra-source binding) on flagged saves without consulting the scope verdict | Low/Nit deferred per ruling.
  - **Pin/attack proposal:** gate dormant-slice render blocks on betaSurfaceVisible; surfaces may not name dormant identities.

- **Incident:** reconcileWayGrants mints ngu_kiem_khoi (sword core node) on every restore of a hidden_sword save - write-only, emitters filter it (F-A3-04); capability-gated HUD bridges (kiemBarBridge/theBarBridge) bypass betaScope - dormant Ngu Kiem / Ung The bars render mid-battle on flagged saves (F-A3-05); devResetBranch refunds insight for dormant nodes that respecNodeTree excludes (console-only dev path today) (F-A3-06); grantSkillCoreBySkillId lacks the betaSkillAdmitted gate its sibling learnSkill carries (latent: no prod caller reaches dormant ids) (F-A3-07).
  - **Root class:** L-DEFERRED-A3-LOW - CONTRACT.
  - **Detector escape:** write-only dormant mint, capability-bridge HUD render, dev-only reset refund and a latent ungated grant seam - all Low/Nit, deferred per the Medium+-only ruling.
  - **Pin/attack proposal:** next scope revision should still pin write-only mints + capability bridges; latent seams get admission predicates when they gain dormant inputs.

- **Incident:** devResetBranch refunds/revokes dormant-tree nodes: branchTag targets exist only on dormant trees yet the op revokes levels + mints live skillInsight with no dormancy gate (F-A4-1).
  - **Root class:** L-PARALLEL-SEAM-GUARD - AUTHORITY.
  - **Detector escape:** parallel write seam implemented without the sibling op refusal guard: devResetBranch revoked+refunded dormant-tree nodes while respecNodeTree refuses the same save outright.
  - **Pin/attack proposal:** new write seams must enumerate sibling-op guards before admission; pin: holdsDormant shared predicate.

- **Incident:** BETA_TALENT_IDS admits authored-dormant golden_core talents: roster seeds from ALL breakthrough pools including the suppressed golden_core pool; collectTalentEffects emits live (F-A4-2).
  - **Root class:** L-ROSTER-OVERADMISSION - AUTHORITY.
  - **Detector escape:** admission roster seeded from ALL catalog pools including the suppressed golden_core pool; isBetaTalentId admitted authored-dormant talents and collectTalentEffects emitted live effects.
  - **Pin/attack proposal:** roster seeds filter pools through realm-acquisition predicates (isBreakthroughAcquisitionEnabled), not raw catalog union.

- **Incident:** chi_hien_quan build/upgrade writes bypass the lock: BETA_BUILDING_FEATURES gates the surface read-model only; write seam lacks the fail-closed {ok:false,scope_hidden} pattern (F-A4-3).
  - **Root class:** L-SURFACE-ONLY-GATING - AUTHORITY.
  - **Detector escape:** BETA_BUILDING_FEATURES gated the surface read-model only; canBuild/buildBuilding/upgradeBuilding lacked the fail-closed scope_hidden pattern used by equipment/alchemy/workforce.
  - **Pin/attack proposal:** every gated surface needs its domain commands fail-closed on the same admission predicate.

- **Incident:** gainMastery trains dormant-way techniques on carried saves: accrual channel missed the lock that sibling emitters/tryAdvanceTechniqueGrade enforce (F-A4-4).
  - **Root class:** L-ACCRUAL-CHANNEL-LOCK - AUTHORITY.
  - **Detector escape:** accrual channel missed the lock that sibling emitters enforce: gainMastery trained dormant-way techniques via settleTechniqueMastery on carried saves.
  - **Pin/attack proposal:** accrual entry points gate on the same admission predicate as emitters (betaTechniqueAdmitted).

- **Incident:** worker_lodge left-panel mount seam: FunctionOverlayPanel reads ui.leftPanelMode with no isBetaLeftPanelMode check (mount-seam defense asymmetry vs standalonePanel watcher) (F-B-CONS-1); chi_hien_quan popover mount seam: GameRoot mounts BuildingDetailPopover on raw ui.activeBuildingPopoverId; component renders build card ungated (F-B-CONS-2).
  - **Root class:** L-MOUNT-SEAM-ASYMMETRY - AUTHORITY.
  - **Detector escape:** mount seams defended asymmetrically: GameRoot guarded standalonePanel via watcher because callers can bypass the action API, but leftPanelMode + activeBuildingPopoverId lacked it AND downstream commands lacked fail-closed guards.
  - **Pin/attack proposal:** mount seams gate on admission predicates at BOTH the container binding and the component self-gate.

- **Incident:** WorkerLodgePanel imports CompanionAvailability (contract F ban) + never consumes getWorkerLodgeSurfaceModel read model; fails closed today (F-B-CONS-3); AutoFarmIndicator renders raw autoFarmStage.stageId when id does not resolve; reachable only via mid-session corrupt lease, self-clears via Stop (F-B-CONS-4); LoreCodex/material surfaces render carried dormant materials descriptions verbatim (chieu_hien_lenh, doan_bao_thach) - dormant-system teasers on flagged saves only (F-B-CONS-5).
  - **Root class:** L-DEFERRED-B4-LOW - CONTRACT.
  - **Detector escape:** banned dependency import + dead authored read model, raw ghost-id render on corrupt lease, dormant material description teasers - all Low/Nit, deferred per the Medium+-only ruling.
  - **Pin/attack proposal:** next scope revision pins banned-import lint + read-model consumption checks.

- **Incident:** persisted enhanced hidden-breakthrough realm passives emit on flagged saves: resolvePlayerStatAssembly reads player.modifiers verbatim; grant-time gates never cover restore (F-BS-1).
  - **Root class:** L-PERSISTED-EFFECT-RECONCILE - CONTRACT.
  - **Detector escape:** grant-time gates never cover restore: resolvePlayerStatAssembly read persisted player.modifiers verbatim, so a pre-beta save carrying enhanced hidden-breakthrough passives emitted them forever on a flagged save.
  - **Pin/attack proposal:** effect seams reconcile persisted payloads against admission at emit time; records stay intact (deserialize+flag), effects stay inert.

- **Incident:** forged realm-passive modifier entries validate and mint stats: marker->payload coherence checked but payload->marker never; any sourceType realm entry mints without a granting (F-BS-3).
  - **Root class:** L-MARKER-BIDIRECTIONAL - CONTRACT.
  - **Detector escape:** marker->payload coherence checked but payload->marker never: forged sourceType realm entries minted stats past acceptance with no granting marker.
  - **Pin/attack proposal:** coherence checks run both directions; payload entries whose catalog passive lacks the marker are flagged at acceptance + inert at emit.

- **Incident:** devResetBranch admission-seam bypass refunds dormant-tree levels into live skillInsight (F-BS-2); devResetBranch refunds/revokes dormant-tree records bypassing respecNodeTree refusal (stale-state report on 5431ae7e) (F-AS-1); chi_hien_quan build/upgrade write seams admitted dormant building on carried save (stale-state report on 5431ae7e) (F-AS-2); gainMastery accrues on dormant-way active technique (stale-state report on 5431ae7e; mastery half of A5 technique-write finding) (F-AS-3); +2 related findings.
  - **Root class:** L-DUP-WAVE-OVERLAP - PROCESS.
  - **Detector escape:** blind rounds dispatched on different tips can report the same root: TC3 F-BS-2 duplicated F-A4-1 already fixed mid-wave; dedup by root class + seam, not by surface symptom.
  - **Pin/attack proposal:** record duplicateOf at triage; fix ownership follows the earliest confirmed repro.

- **Incident:** TribulationOutcomeService deletes talentLevels[pham_cot] on victory - dormant record mutated on live path; inert (roster-excluded, arguably cleanup) (F-BS-4); selectSpecialization free-switch writes spec claims on a carried learned dormant skill; claims never emit (F-BS-5); buildBuilding/upgradeBuilding ungated for chi_hien_quan via console at review time - dead sink while manualWorkforce hidden (superseded by F-A4-3 fix) (F-BS-6); save.formations slice persisted but never read on restore - dead slice, no effect (F-BS-7).
  - **Root class:** L-DEFERRED-TC3-NIT - CONTRACT.
  - **Detector escape:** dormant-record mutation on live path, dormant-skill spec claims, console-exposed dead sink, dead persisted slice - all Nit, deferred per the Medium+-only ruling.
  - **Pin/attack proposal:** next scope revision pins dormant-record mutation even when inert.

- **Incident:** sealFrozenCycle seals a grade-history cycle onto a dormant-way active technique on a live realm advance - realm-exit freeze write seam missed betaTechniqueAdmitted (F-A5-1).
  - **Root class:** L-TRANSITION-SEAL-LOCK - AUTHORITY.
  - **Detector escape:** realm-exit freeze hook sealFrozenCycle escaped the technique write-op census - sibling ops (gainMastery, tryAdvanceTechniqueGrade) gated first, transition hooks audited as a separate class and missed until stale-tip blind review A5.
  - **Pin/attack proposal:** write-op census includes transition/hook ops (advance, seal, tribulation outcomes), not only explicit user actions.

- **Incident:** unsupportedReleaseReason lacks a workforce case - a carried chi_hien_quan/autoWorkerCapacity save loads unflagged, silent dormant record (F-B5-1).
  - **Root class:** L-FLAG-COVERAGE-CENSUS - LOGIC.
  - **Detector escape:** flag-coverage defect hid behind the mount/write seam fixes - the dormancy record was sealed from interaction AND from notice; only a consumer-side audit enumerating the reason enum against the persisted-record census caught the missing case.
  - **Pin/attack proposal:** reason enum derived census: every persisted dormant record kind must have a matching unsupported reason - census as pin.

- **Incident:** investBodyChapter write dispatch ungated - tick auto-invest + UI button drain live beta currencies into suppressed body-path records (silent sink) (F-BODY-W-1); RealmPanel renders the dormant body chain (BodyRefinement/Meridian/ZhouTian sections) with a live invest button inside the beta-admitted realm panel (F-BODY-UI-1).
  - **Root class:** L-DISPATCH-VS-EMISSION - AUTHORITY.
  - **Detector escape:** emission-side gating verified while the WRITE dispatch stayed open - a silent sink: currency spends that can never emit. Detector gap: suppression tests only asserted no-effect, never no-spend.
  - **Pin/attack proposal:** for every dormant feature, enumerate spend-capable entrypoints (ops dispatch, tick hooks, UI buttons) - not only stat/effect emissions.

- **Incident:** settleOutcome trusts a carried committedOutcome verbatim - dormant realm transition + hidden lineage re-authorized without re-deriving the scope verdict (F-CONS-B1); alchemy tick/settleOffline delivers carried dormant-family jobs into the live pillBag - restore trusted persisted intent without re-deriving the family verdict (F-CONS-B2); applyChapterEffect modifier chapters re-emit their owned modifier slice from carried bodyProgression records under the lock - restore rehydration trusted carried state (F-BODY-EMIT); resolveKienCoGrade counts carried bodyProgression investment toward the Truc Co grade - earth/heaven grades reachable on a flagged save (F-BODY-GRADE); +2 related findings.
  - **Root class:** L-SETTLEMENT-REAUTH - AUTHORITY.
  - **Detector escape:** review/test coverage exercised origination gates (start/startJob) but never the persisted-intent path: restore+settle of a forged-or-carried record was uncovered until the B6/TC4 blind rounds.
  - **Pin/attack proposal:** settle seam checklists: tribulation settleOutcome, alchemy tick/settleOffline delivery, body modifier emission, grade resolvers, flag surfaces.

- **Incident:** applyChapterEffect modifier chapters re-emit their owned modifier slice from carried bodyProgression records under the lock - restore rehydration trusted carried state (F-BODY-EMIT); thong_mach_dan is a live-craftable silent sink: beta-admitted recipe whose only consumer (meridian chapter) is dormant - live herbs/wood/stones drain into a pill that can never (F-SINK).
  - **Root class:** L-SIBLING-EMITTER-ASYMMETRY - AUTHORITY.
  - **Detector escape:** per-fix sibling searches looked for the same emission kind (base-stat vs StatModifier); the census step must enumerate ALL consumers/emitters of a gated record class, not siblings of the same mechanism; F-SINK: recipe-family admission was never census-checked against consumer dormancy.
  - **Pin/attack proposal:** sibling-emitter table in fix records (writer | reader | emitter | consumer columns).

- **Incident:** carried timed alchemy jobs may emit completion notifications long after save timestamp (future completesAtMs) - display-only ordering nit (F-TIMED-EMIT).
  - **Root class:** L-DEFERRED-TIMED-EMIT - AUTHORITY.
  - **Detector escape:** deferred per Medium+-only ruling: future-dated carried job records park silently; notification ordering is display-only on flagged saves with no live effect on beta play.
  - **Pin/attack proposal:** if the deferral is reversed, suppress completion notification for parked records or normalize completesAtMs at restore.

- **Incident:** forged claimed-source player.modifiers mint live stats - emit fallthrough + shape-only boundary (F-A7-1); forged persistentTimedEffects mint stats + unbounded cultivation speed (F-A7-2); alchemy settle trusts persisted job.pillId - never re-derived vs recipe authority (F-A7-3); forged accrualRealmId (+sibling collectionRealmId) pins mint dormant-tier materials at forged-realm rate (F-TC5-1).
  - **Root class:** L-CLAIMED-SOURCE-FORGE - AUTHORITY.
  - **Detector escape:** each prior wave gated real-writer slices but left the claimed-source dimension shape-only: a record claiming a source no writer mints passed the boundary and emitted at read seams; the class only becomes enumerable once save versioning is hard-reject (no migration) so current-version writers are exhaustive.
  - **Pin/attack proposal:** resolve each claimed-source field against the closed writer inventory at the acceptance boundary; fail-closed emit where the inventory is closed; clamp or re-derive where a writer authority exists at the consumer seam.

- **Incident:** forged persistentTimedEffects mint stats + unbounded cultivation speed (F-A7-2).
  - **Root class:** L-BOUNDED-FIXTURE-VALUES - DETECTION.
  - **Detector escape:** bound-tightening regressions twice this wave came from test fixtures minting values outside the authored writer bound (percent 1/0.5 > 0.25); the fixtures were never legal records - the fix detector correctly read them as forged.
  - **Pin/attack proposal:** when adding a writer-shape bound, census test fixtures for out-of-bound values and normalize them to authored values before running.

- **Incident:** dormant talents render as selectable UPGRADE cards on the mandatory breakthrough-talent modal (getUpgradeableTalentIds + UPGRADE branch ungated) (F-B7-1); closeHiddenLineage not scope-gated - every live normal breakthrough destructively mutates a carried open lineage (F-B7-2).
  - **Root class:** L-PARTIAL-GATE-COVERAGE - AUTHORITY.
  - **Detector escape:** the isBetaTalentId/isBetaFeature gates existed on the observed read paths (collectTalentEffects, hidden-lineage reads) but the symmetric write/resolve paths (getUpgradeableTalentIds, resolveTalentEntitlement UPGRADE, closeHiddenLineage, recordHiddenBreakthrough) were left ungated - the fix pattern gated the leak that was seen, not the full entry-point set.
  - **Pin/attack proposal:** when gating a record type, enumerate every public mutator/resolver that can reach it and gate the full set, not only the observed leak.

- **Incident:** forged quests.active[].progress mints the authored reward (same-value claim) (F-TC6-7).
  - **Root class:** L-SAME-VALUE-FORGE - AUTHORITY.
  - **Detector escape:** the claimed-source census bounds magnitudes and shapes, but a claim AT an authored value is indistinguishable from earned state; detection requires provenance (event ledger / writer-signed counters) that the save schema does not carry - the defect class is a schema gap, not a missing check.
  - **Pin/attack proposal:** record same-value claim classes as accepted residuals pending a provenance schema; pin the residual so a future schema change must update the pin; never clamp live counters to detect forgery - it destroys legitimate overshoot and does not block the mint.

- **Incident:** persisted realm-passive payload mints arbitrary stats (id/shape forged) (F-TC6-2); persisted meridian payload emitted on unlock with forged id/shape/percent (F-TC6-9).
  - **Root class:** L-REBUILD-DONT-TRUST-EMIT - AUTHORITY.
  - **Detector escape:** the claimed-source census verified ownership markers but trusted the persisted payload's own numbers; a payload carrying a real marker id with invented magnitudes passed every check - ownership and content are separate claims.
  - **Pin/attack proposal:** at emit, a persisted payload is a CLAIM: rebuild the emitted value from the authored builder keyed by the marker, drop ids the builder does not produce; the validator mirrors the same canonical check at the boundary; iterate claim repair in a scanner-transparent shape (explicit loop) when the write-authority detector is chain-sensitive.

- **Incident:** timed-effect census admits claims no pill writer can mint + unbounded magnitude (F-A8-1); dormant-family timed-effect claim passed the regen-shape check (F-TC6-8).
  - **Root class:** L-WRITER-SHAPE-CENSUS - AUTHORITY.
  - **Detector escape:** the claim census resolved a sourceItemId against the authored catalog but never checked whether that writer actually MINTS the record type, and scope-ordering let a dormant claim pass while authored in shape; a claim must resolve against the writer's PRODUCT, not just its identity, and scope checks must run before shape checks.
  - **Pin/attack proposal:** bound each claim class to the writer-shape inventory that produces it; order scope/dormant checks before writer-shape checks.

- **Incident:** buildings[].level / productionSites[].level unbounded at shape (writer maxLevel=9) - forged level mints ~39x accrual (F-A8-2); building level claim above template.maxLevel flows into rate/capacity math (F-TC6-5).
  - **Root class:** L-PERSISTED-LEVEL-BOUND - AUTHORITY.
  - **Detector escape:** persisted level claims were shape-checked >=1 while the writer's ceiling (template.maxLevel) was never consulted at the boundary or the effective-read seam.
  - **Pin/attack proposal:** bound persisted levels to the writer maximum at shape AND clamp at the effective-read seam for non-save paths.

- **Incident:** SkillPathPanel renders dormant kit rows selectable + enabled-but-dead core upgrade on carried saves (F-B8-1); PillBagSection/BagGrid render carried dormant pill stacks as clickable cells (drink arms then fails) (F-B8-2); TechniqueBand renders dormant canonical technique + enabled advance; canAdvanceTechniqueGrade ungated (F-B8-3).
  - **Root class:** L-VERBATIM-READ-SURFACE - AUTHORITY.
  - **Detector escape:** consumer surfaces mapped domain getAll() outputs verbatim while the domain write seams were already gated; a carried dormant record rendered as a selectable row or an enabled-but-dead control - the rail verdict must reach the surface, not just the write path.
  - **Pin/attack proposal:** filter surfaces through the same admission predicate the write seam uses (betaSkillAdmitted / scopeHiddenPillFamilyOfId / betaTechniqueAdmitted); treat a non-admitted record as absent.

- **Incident:** persisted loi_kiep talent claim emits without the ownership witness (F-TC6-1).
  - **Root class:** L-OWNERSHIP-WITNESS-EMIT - AUTHORITY.
  - **Detector escape:** the emit filter verified the claim's sourceId but not the ownership record that produces it - a grant claim survived with no owning talent selected.
  - **Pin/attack proposal:** emit requires the ownership witness (selectedTalentIds/marker); validator mirrors the same canonical shape.

- **Incident:** carried highestFoundationAchieved='great_dao' save skipped the hidden-progression flag and emitted kien_co (F-TC6-3).
  - **Root class:** L-FLAG-WRITER-COVERAGE - AUTHORITY.
  - **Detector escape:** the hidden-progression flag enumerated dormant-record writers but missed highestFoundationAchieved='great_dao', so a save only hidden writers could produce loaded unflagged and emitted under lock.
  - **Pin/attack proposal:** enumerate flag conditions over the closed writer inventory (great_dao is a hidden-writer product); suppress the gated emissions while locked.

- **Incident:** retired-but-dormant alchemy jobs delivered dormant pills at settle (F-TC6-4).
  - **Root class:** L-SETTLE-EXEMPTION-ORDER - AUTHORITY.
  - **Detector escape:** the settle path's retired exemption ran without the dormant-family check, so a retired-but-dormant job delivered its pill - an exemption applied before a scope check silently re-admits the record.
  - **Pin/attack proposal:** scope/dormant checks run before all exemptions; exemptions may soften handling of LIVE records only.

- **Incident:** attributePoints claims exceed max earnable (getGlobalCultivationLevel) (F-TC6-6).
  - **Root class:** L-EARNABLE-BOUND - AUTHORITY.
  - **Detector escape:** attributePoints was shape-checked >=0 but never bounded against the maximum earnable from the authored progression table (realmLevel + prior maxLevels).
  - **Pin/attack proposal:** bound persisted accumulators to the max a writer could produce from the recorded progression state.

- **Incident:** player.externalModifiers passes shape validation with no claimed-source census - forged entries transiently live until first tick (F-A8-3).
  - **Root class:** L-DEFERRED-TRANSIENT-MIRROR - AUTHORITY.
  - **Detector escape:** deferred per Medium+-only ruling: externalModifiers lacks a claimed-source census, but the per-tick mirror overwrite scrubs forged entries after one frame - a transient window on hostile saves only.
  - **Pin/attack proposal:** if the deferral is reversed, census externalModifiers like player.modifiers.

- **Incident:** CharacterPanel renders carried dormant talents and dormant-way element aura (F-B8-4).
  - **Root class:** L-DEFERRED-DISPLAY-ONLY-DORMANT - AUTHORITY.
  - **Detector escape:** deferred per Medium+-only ruling: CharacterPanel renders carried dormant talents + dormant-way aura - display-only on flagged saves, no live effect.
  - **Pin/attack proposal:** if the deferral is reversed, filter selectedTalentIds via isBetaTalentId and gate the aura read via isBetaWay.

- **Incident:** CombatBuild binds un-gated runtime.buildSurviveSources (F-B8-5); BattleLootSystem pill drop branch lacks scopeHiddenPillFamilyOfId (F-B8-6).
  - **Root class:** L-LATENT-UNGATED-HOOK - AUTHORITY.
  - **Detector escape:** latent hooks (runtime.buildSurviveSources, pill drop branch) lack scope gates but are unreachable at this commit - recorded so a future writer enabling the path sees the gate requirement.
  - **Pin/attack proposal:** when a writer lands for a latent seam, the scope gate must ship with it.

- **Incident:** persisted equipped:true with a realm-incompatible grade validated and minted modifiers at restore (F-SCOPE-EQ-1 / F-EQ-GRADE-REALM).
  - **Root class:** L-CLAIM-WITNESS-CHAIN - BOUNDARY.
  - **Detector escape:** the equipped flag was checked as a boolean and the grade against the enum, but the claim was never reconciled against the writer gates (equip() requires grade==realm, tribulation unequips all) - a claim no writer produces minted might flat:20.
  - **Pin/attack proposal:** equipped claims replay against producibleEquippedGrades(realmId); item-state fields verified vs the writers that could have produced them.

- **Incident:** ungated resolvePartyFormation leaked dormant/forged formationLoadout into live player position and companion EXP (F-SEAM-1); forged perfectClearSeconds below the physical clear floor minted accelerated auto-farm cycles (F-SEAM-2).
  - **Root class:** L-ASYM-SIBLING-SEAM / L-REALM-EARNABILITY-CLAIM - BOUNDARY.
  - **Detector escape:** sibling consumers of the same dormant records were scope-gated but the formation resolver stayed ungated under a pre-lock grandfathering comment; perfectClearSeconds had a shape-only floor (>=1) while the physical floor (waves-1)*spawnInterval was never replayed.
  - **Pin/attack proposal:** enumerate ALL consumers of a gated record class, not just same-mechanism siblings; persisted timing claims replay against the minimum the physics of the recorded stage can produce.

- **Incident:** equipment validator envelope cluster - foreign slot claim (F-EQ-FOREIGN-SLOT), affix slot policy skipped when affix.slots undefined (F-EQ-AFFIX-SLOT), duplicate affix stats (F-EQ-AFFIX-DUP), affix stat overlapping mainStat (F-EQ-AFFIX-MAINSTAT-OVERLAP), quality envelope unenforced count/pool/tier/authored-tier (F-EQ-AFFIX-ENVELOPE), negative mainStat.flat (F-EQ-MAINSTAT-NEG, deferred Low).
  - **Root class:** L-PRODUCER-ENVELOPE-REPLAY - BOUNDARY.
  - **Detector escape:** per-field legality and enum membership were checked, but the roll envelope (ITEM_QUALITY_SUBSTATS_RANGE, ITEM_QUALITY_AFFIX_TIER, ITEM_QUALITY_UNLOCKED_POOLS, authored affix tiers, excludeStats uniqueness, template slot) was never crossed - each claim minted modifiers no roller emits.
  - **Pin/attack proposal:** persisted producer outputs replay against the producer's full eligibility envelope at the boundary; enumerate every constraint the factory applies (pool unlock, tier caps, stat uniqueness, slot policy, template slot, sign/magnitude).

- **Incident:** attributePoints and baseStats bounded independently - a forged save claimed saturated stats AND the full unspent pool (F-AP-DOUBLE-COUNT).
  - **Root class:** L-SPLIT-CLAIM-LEDGER - BOUNDARY.
  - **Detector escape:** the unspent claim and each stat's magnitude were separately bounded against the earnable ceiling, but the SUM was never reconciled - the two claims draw on one ledger.
  - **Pin/attack proposal:** bound unspent + spent together against the earnable total, computing the spent side on the post-normalization claim (per-stat contribution clamped at the restore ceiling).

- **Incident:** duplicated selectedTalentIds entry dodged count bounds and double-applied the talent effect (F-TALENT-DUP).
  - **Root class:** L-WRITER-UNIQUENESS-CLAIM - BOUNDARY.
  - **Detector escape:** the writer guards every push with !includes, but the persisted list carried no dedup bound - a duplicated pool talent claimed cultivation_speed 1.2 vs authored 1.1.
  - **Pin/attack proposal:** list claims whose writer dedups must carry the same uniqueness bound at the boundary.

- **Incident:** negative baseStats claim admitted, restore clamp preserves the negative (F-BASESTATS-NEG, deferred Low); skillInsight unbounded magnitude (F-INSIGHT-UNBOUNDED, deferred Low).
  - **Root class:** L-EARNABLE-BOUND / L-CURRENCY-TALLY - BOUNDARY.
  - **Detector escape:** deferred per Medium+-only ruling: sign and open-ended magnitude classes on stat/currency claims - self-harm mint only, no upward fabrication.
  - **Pin/attack proposal:** if the deferral is reversed, bound sign (>=0 or authored minimum) and magnitudes to the earnable ledger for the recorded progression state.

- **Incident:** spirit-stone stack tier unproducible under the claimed realm (F-SCOPE-1); equipmentSlots.enhanceLevel beyond the realm-tier reachable ceiling (F-SCOPE-2); buildings/productionSites level above the realm-tier writer gate (F-SCOPE-3); workerCycles.siteLevelAtStart outside the monotonic level history span (F-SCOPE-4); flagged beyond-beta realm claim disputed then rejected with proof (F-SCOPE-5).
  - **Root class:** L-REALM-TIER-PRODUCIBILITY - BOUNDARY.
  - **Detector escape:** level and currency-tier claims were bounded against catalog ceilings (materials id legality, MAX_SLOT_ENHANCE_LEVEL, siteDefinition.maxLevel, span consistency) but never replayed against the writer's realm-tier key - every producer gates on getRealmTier(player.realmId), so whole claim classes below the catalog ceiling stayed unproducible under the claimed realm.
  - **Pin/attack proposal:** replay the writer key at the boundary: derive the producibility ceiling from getRealmTier(claimed realmId) - stone material tier, enhance ceiling, site/building level, level-history span - and reject claims above it.

- **Incident:** forged equipment[] with 500+5 unprotected entries minted dissolve essence at restore (F-EQ-COUNT-1); forged duplicate crafting_station buildingId / instanceId entries minted independent accrual windows (F-BLD-DUP-1).
  - **Root class:** L-COLLECTION-LEVEL-INVARIANTS - BOUNDARY.
  - **Detector escape:** per-entry validation checked shape and magnitude of each element but never the cross-entry invariants the sole writers maintain - EquipmentBag.add() dissolves overflow so produced bags hold <=500 unprotected entries, and build() rejects a second crafting_station of the same buildingId; forged collections that no writer could emit minted N x payout at restore.
  - **Pin/attack proposal:** derive collection-level invariants from writer semantics (dedup keys, uniqueness rules, post-write count ceilings) and enforce them at the save boundary; bound only unproducible shapes - protected entries (equipped/locked/favorite) and multi-instance building categories stay tolerated.

- **Incident:** skills[].totalExperience carried no validation - a forged 1e6 claim minted +100000 floor(t/10) flat damage on the beta starter and claimed cast-level 3 (F-SKILLS-TXP); sibling field experience unchecked but consumer-free (G-SKILLS-EXP, deferred Low).
  - **Root class:** L-MIRROR-COHERENCE - BOUNDARY.
  - **Detector escape:** the writer increments totalExperience and writes player.skillCastCounts[id] in the same statement, and the mirror is never cleared (unlearn leaves stale counts, relearn restarts the entry) - the producible relation is tExp <= mirror, which the validator never replayed while checking only entry.id.
  - **Pin/attack proposal:** bound mirrored counters against their never-cleared mirror row in the direction the writer cannot produce (tExp > mirror); tolerate stale-mirror shapes (tExp < mirror after relearn) and mirror-only rows for unlearned skills.
