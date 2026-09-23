# Defect taxonomy and attack-model contract

Intended installed path: `game/docs/qa/protocol/defect-taxonomy.md`.
This document defines attack families. The protocol defines approval; taxonomy presence alone is not coverage.

## Canonical defect classes

Class IDs are stable. A finding may have multiple tags but exactly one primary root class. Do not rename historical IDs after a fix; add a supersession relationship if a class is refined.

| Family | Required classes | Decisive attack/oracle |
|---|---|---|
| CONTRACT | CON-01 ambiguous requirement; CON-02 contradictory rulings; CON-03 incomplete transition semantics; CON-04 undefined ownership; CON-05 undefined failure behavior; CON-06 incorrect scope; CON-07 historical spec treated as current; CON-08 deferred behavior accidentally live; CON-09 unachievable numeric target/unit mismatch | Produce two incompatible allowed outcomes or a real authored state that cannot satisfy the ruling; trace maintained ruling and production constructor. Numeric design needs a feasibility probe using actual counting units |
| AUTHORITY | AUT-01 multiple canonical rules; AUT-02 duplicated mutable state; AUT-03 legacy authority live; AUT-04 projection promoted to writer; AUT-05 cache/projection drift; AUT-06 duplicated diverging predicates; AUT-07 ambiguous owner; AUT-08 writer bypass | Census all writes and decision variants; change canonical value and observe every projection; exercise alternative callers and retired representation; grep alone cannot certify |
| STATE | STA-01 impossible reachable state; STA-02 invalid field combination; STA-03 prerequisite absent; STA-04 stale dependent state; STA-05 wrong derived value; STA-06 partial state; STA-07 orphan state; STA-08 illegal default | Reach state through legitimate actions or supported save/input boundary, then assert complete semantic snapshot; distinguish authored injection from runtime reachability |
| TRANSITION | TRN-01 wrong preflight; TRN-02 validation after mutation; TRN-03 non-atomic reject; TRN-04 partial commit; TRN-05 ordering; TRN-06 repeated action; TRN-07 non-idempotent retry; TRN-08 min boundary; TRN-09 max boundary; TRN-10 exact threshold; TRN-11 double debit; TRN-12 double settlement; TRN-13 partial reward misreported; TRN-14 stale eligibility after realm/state change | Before/after all owners, event/receipt/queue counts, exact cost, max capacity, reentrant and retry traces; inject failure at every meaningful commit step |
| INVERSE | INV-01 grant/revoke; INV-02 learn/unlearn; INV-03 equip/unequip; INV-04 activate/deactivate; INV-05 unlock/reset; INV-06 upgrade/respec; INV-07 create/destroy; INV-08 acquire/lose; INV-09 parent/dependent cleanup | Test both directions, repeat reversal and save/restore between them; oracle follows explicitly retained history versus revoked contribution |
| PERSISTENCE | PER-01 save divergence; PER-02 restore bypass; PER-03 stale payload accepted; PER-04 impossible state accepted; PER-05 missing integrity; PER-06 migration defect; PER-07 obsolete schema authority survives; PER-08 missing reconciliation; PER-09 round-trip divergence; PER-10 partial restore; PER-11 failed restore mutates; PER-12 snapshot aliasing; PER-13 incomplete payload identity | Nonempty real save -> fresh owners -> continue gameplay; same identity/changed content; restore twice; unsupported version fails non-destructively; mutate nested fields after snapshot; storage failure at each boundary |
| CROSS_SYSTEM | CRS-01 disagreement about concept; CRS-02 producer/consumer drift; CRS-03 event ordering; CRS-04 reward/progression mismatch; CRS-05 realm/unlock mismatch; CRS-06 combat/noncombat mismatch; CRS-07 UI/domain mismatch; CRS-08 save/runtime mismatch; CRS-09 simulation/runtime mismatch; CRS-10 multiple-PR composition | Trace producer -> authoritative operation -> downstream outcome across real composition root; compare every consumer of the same rule without duplicating formulas in expected values |
| RUNTIME | RUN-01 init order; RUN-02 missing wiring; RUN-03 scene/session lifecycle; RUN-04 subscription; RUN-05 emission order; RUN-06 cleanup; RUN-07 settlement; RUN-08 postcombat state; RUN-09 re-registration/HMR; RUN-10 stale singleton/cache; RUN-11 first run; RUN-12 duplicate invocation hidden by idempotent effect | Boot -> actual update -> action -> settlement -> save -> teardown -> restart; assert invocation cardinality where idempotent state hides double calls; test actual production call signature |
| PRESENTATION | UI-01 visibility/authority mismatch; UI-02 enabled/commit mismatch; UI-03 stale projection; UI-04 invalid action exposed; UI-05 valid action unreachable; UI-06 layout/clip/overflow; UI-07 label/data/i18n mismatch; UI-08 missed refresh; UI-09 interaction regression; UI-10 keyboard/focus/input; UI-11 canvas/animation/VFX; UI-12 visual ACK becomes gameplay authority | Browser flow with domain oracle, resize and locale/reduced-motion matrix; screenshot plus interaction; actual canvas playback; ack omit/duplicate/stale/failure cannot change gameplay outcome |
| TEST_QUALITY | TST-01 mocked SUT; TST-02 self-confirming expected value; TST-03 unreachable fixture; TST-04 stale fixture; TST-05 internal bypass; TST-06 happy-path-only; TST-07 no rejection path; TST-08 missing boundary; TST-09 weak boolean; TST-10 implementation-detail assertion; TST-11 mocked seam false confidence; TST-12 original bug survives test; TST-13 assertion reads input instead of owner; TST-14 skips/expected-fail camouflage | Reintroduce original failure in isolation, require intended failure; inspect test constructor and live post-action object; compare expected value derivation against SUT imports; report skips explicitly |
| ROBUSTNESS | ROB-01 unknown ID; ROB-02 missing registry entry; ROB-03 malformed save; ROB-04 absent metadata; ROB-05 fail-open; ROB-06 empty collection; ROB-07 duplicate registration; ROB-08 invalid enum/state; ROB-09 unexpected ordering; ROB-10 nonfinite/unsafe-integer values | Boundary fuzz with legal/illegal partitions, malformed-but-shaped cross-field states, empty/future/retired registry cases; require explicit outcomes and no corruption |
| ASYNC | ASY-01 race; ASY-02 duplicate completion; ASY-03 stale result; ASY-04 duplicate event; ASY-05 event after teardown; ASY-06 early commit; ASY-07 nondeterministic ordering; ASY-08 overlapping session identity | Controlled promises/manual clock schedule; old work resolves after reset/new session; permutations and duplicate delivery; rejection plus cleanup/liveness oracle |
| ECONOMY | ECO-01 conservation broken; ECO-02 overflow/lost delivery; ECO-03 preview/commit divergence; ECO-04 forged/replayed paid result; ECO-05 exact exchange/change; ECO-06 online/offline allocation divergence; ECO-07 reward feasibility/distribution; ECO-08 namespace confusion | All source/sink balances and requested/delivered/overflow receipts; bag at cap; material-versus-pill IDs; fixed RNG streams and independent mathematical bounds |
| COMBAT | CBT-01 damage variant incomplete outcome; CBT-02 lost scaling/target/effect order; CBT-03 dead actor advances; CBT-04 buff stack/expiry clock; CBT-05 stale/omitted ACK; CBT-06 stats applied twice; CBT-07 source context lost; CBT-08 action/round/time unit mismatch | Real authored content through compiler/build/executor; HP/MP/Ward/alive/death/events together; repeated stat derivation; actor liveness at dequeue; timeout and ACK matrix |
| CONTENT_PATH | PTH-01 path/way identity branching; PTH-02 capability inference from state; PTH-03 dormant content leak; PTH-04 hidden content prematurely exposed; PTH-05 catalog/effect unsupported; PTH-06 production catalog differs from fixture | CultivationPathKit/capability census, module-owned validators, release policy, actual catalogs; unknown or unsupported content rejects explicitly |
| TOOLING_SECURITY | SEC-01 path containment; SEC-02 secret leakage; SEC-03 unsafe parsed markup/input; SEC-04 capability/auth mismatch; SEC-05 unbounded resource consumption | Relevant file/import/export/UI/service boundaries only; sandboxed malformed input and bounded resources, never real secret/service attacks |
| QA_INTEGRITY | QAI-01 wrong snapshot/index/server; QAI-02 stale evidence; QAI-03 missing files/tools treated reviewed; QAI-04 contaminated reviewers; QAI-05 transport DONE treated approval; QAI-06 invalidated gate retained; QAI-07 waiver hidden; QAI-08 wrong denominator; QAI-09 mutation escape/unrestored candidate; QAI-10 model budget treated success; QAI-11 report status/count/date drift; QAI-12 circular approval from generated report | Adversarial orchestrator fixtures, exact hash and prerequisite checks, sealed reviewer output, coverage/rejection accounting; reject malformed or stale acceptance request |

## Aggregate domain census

Every full run assigns an owner and coverage row to each live domain, including unchanged files:

1. Bootstrap, app lifecycle, clock and session switching.
2. Combat, vitals/stats, skills/effects, buffs/reactions and settlement.
3. Cultivation paths/ways/nodes, techniques, body/physique, realm and tribulation.
4. Inventory/equipment/materials/pills, rewards, currency and paid/random operations.
5. Production/offline/buildings/crafting and worker allocation.
6. Quests, companions/gifts, formation and stage/release policy.
7. Save shape/identity/restore/storage/cloud capability and explicit version policy.
8. Vue/Pinia projections, UI primitives/i18n/a11y, Phaser presentation/assets/audio.
9. Auth/backend adapters and Electron/distribution where those capabilities are shipped/claimed; inaccessible deployed capabilities are explicit gaps, not inferred support.
10. Tests/fixtures/simulations/lab, build/tooling and the QA mechanism itself.

For each domain map real outgoing/incoming edges. No claim of complete aggregate coverage from a fixed list of changed files. A future domain is added when discovered; an inventory mismatch invalidates the coverage model.

## Application rules

- A family is applicable when a reachable operation, supported input boundary or maintained contract exercises it. Record non-applicability with source and challenge it independently. Missing tools are not non-applicability.
- Current development save policy rejects old versions. PER-06 must test the actual rejection/compatibility boundary unless migration is deliberately supported. Do not add migration merely to make the taxonomy table green.
- For content shipped dormant/empty, separately test no accidental runtime surface and supported mechanism contracts with controlled injection. Never advertise a fixture-only positive flow as production runtime proof.
- Every cross-owner transaction gets exact-cost, rejection atomicity, repeated commit, inverse/reset, restore and event-cardinality attacks where meaningful.
- Every conceptual migration attacks both the new authority's correct operation and the old authority's inability to drive outcomes.
- Static, deterministic, real browser, generated state and independent reasoning are distinct columns. A check in one does not populate another.

## Example attack cards transferred from external history into internal work

| Attack ID | Primary-agent action | Decisive oracle |
|---|---|---|
| AT-CORE-INVERSE | Create a shaped current save with an owned Core whose learned skill/way/granting-node source is absent; attempt actual restore | Rejection before owner mutation; legal alternate sources still accepted |
| AT-RESTORE-LIVE | Save a legal nondefault Body state, restore through GameManager into a different live player, then read the live owner | Restored owner equals intended saved state; unchanged input payload is insufficient |
| AT-TALENT-MIXED | Restore a record mixing a legal and foreign/zero-weight offer; separately issue NEW resolution with latent unowned level | All offers satisfy canonical pool predicate; grant starts at intended level; no dead UI option or lock |
| AT-INHERITED-SCALING | Execute real reactive/extra payload at owner level 1 and higher through actual conversion/execution | Expected literal growth ratio reaches resolved damage/effects, no fabricated internal Core |
| AT-TICK-CARDINALITY | Drive one actual manager update then compare headless and app path | Intended investment occurs exactly once; state idempotency cannot hide a double invocation |
| AT-PARTIAL-DELIVERY | Receive zero/overflow/partial materials via every live grant path | Downstream discovery/quest/reward consumers see delivered quantity and correct event count |
| AT-PRESENTATION-ISOLATION | Omit, repeat or stale an ACK, fail asset load, switch scene during action | Timing recovery follows maintained contract; domain outcome and resource grants never originate from visual completion |

These cards are initial requirements, not the entire attack model. Novel synthesis must challenge assumptions and combinations beyond this history.
