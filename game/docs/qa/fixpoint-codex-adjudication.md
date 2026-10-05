# Fixpoint adjudication — codex aggregate (wave 1, commit f86f28bc)

Audit trio on bdbba217; adjudicator = coordinator session. Severity
decisions are recorded so the re-audit wave can verify disposition,
not re-litigate.

## COR (0 Critical / 0 High / 1 Medium / 1 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| COR-1 out-of-beta committed element split-brain (water save stays purchasable + passives live while combat reads element-uncommitted) | Medium | FIXED — `betaSkillTreeFor` filters `isBetaElement` on the resolved commit; `betaNodeWriteAdmitted` now gates `elementTag` (writes + PersistentEffectOps aggregation both close). Pin: `tests/architecture/fixpointCodexCor.qa.test.ts` |
| COR-2 hoa_the description "+25%/cấp" vs THE_GAIN_CHANCE_PER_LEVEL=0.35 | Low | FIXED — description + 2 comments now say lv1 35% / lv3 certain |
| powerNode "+2%" descriptions vs 0.025 stats | Nit | FIXED — all "+2%" -> "+2.5%" in PhapTuBasicNodes |
| stale "no enemy maps to batch-2" comments | Nit | FIXED — three comments updated; enemies/bosses do map presets |

## AUT (1 High / 1 Medium+auth, assorted)

| Finding | Severity | Disposition |
|---|---|---|
| AUT-AUTH-1 server talent set-equality rejects legitimately-grown saves | High | FIXED — migration `202610050001` mirrors client ceiling (containment + 1+realmIndex + no-dup); applied to staging; 4 contract pins live |
| AUT-DRIFT-1 server roll lacks the flat 15% pham_cot injection | Medium | FIXED — same migration adds replacement injection matching PHAM_COT_OFFER_CHANCE |
| AUT-RNG-1 equipment rolls unseeded (Math.random) | Medium | FIXED — sessionRng threaded through all EquipmentOpsSystem seams incl. previews |
| AUT-RNG-2 production cycle rollSeed mint on Math.random | Low | FIXED — rng param threaded buildProductionCycle <- WorkerLaneAdvance <- tickWorkers/settleOffline, bound to sessionRng |
| AUT-GATE-1 selectSpellPathElement / grantSkillCoreBySkillId lack beta gates | Low | FIXED — isBetaElement + betaSkillAdmitted fail-closed |
| AUT-UI-1 .vue beta-scope predicate duplication | Low | EXCEPTED — UI lane (Codex); noted in docs/balance/2026-10-04-deferred-items.md |
| dead createBattleRng dep | Nit | FIXED — dep removed; battleRngFactoryOverride is the live seam |
| dead Math.random fallback TribulationDirector:290 | Nit | FIXED — deterministic mulberry32 fallback |
| pham_cot dup migrations | Nit | EXCEPTED — harmless duplicates; leave |

## INT (0 Medium+, 2 Low, 3 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| CombatPreload resolveAssetUrl bypass | Low | EXCEPTED — unreachable in shipped flows |
| draft-only update feed | Low | EXCEPTED — intended EXT-04 design |
| 3 nits | Nit | EXCEPTED — cosmetic/pre-existing |

## Re-audit scope for wave 2

New surfaces needing fresh eyes: rng threading (equipment ops,
production cycles), element gates (betaSkillTreeFor /
betaNodeWriteAdmitted / selectSpellPathElement / grantSkillCoreBySkillId),
authority migration semantics, description/comment edits.

---

# Wave 2 adjudication (commit 72f313c2)

Audit trio on 638bfda9; adjudicator = coordinator session.

## COR (0 Critical / 0 High / 3 Medium / 2 Low / 3 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W2-1 type-check red at HEAD (pin imported nonexistent `core/battle/CombatTypes`; vitest masked it via `import type` erasure) | Medium | FIXED — import now `core/element/ElementType` |
| W2-2 read-model still split: `betaSkillTreeFor` reports water-tagged nodes 'purchasable' while ops refuses | Medium | FIXED — `treeNodeFor` returns 'scope-hidden'/'non-beta-scope' when `!betaNodeWriteAdmitted(node) && level < 1`; owned seats keep 'purchased' (ownership is fact) |
| W2-3 coherent water-commit save permanently wedged (can never commit, never buy, linh_bao forever) | Medium | FIXED — `validateSpellPathPersistedState` now rejects spell_pathway + non-mortal + element null-or-out-of-beta at the save boundary (Minh F2 ruling: crash over silent wedge; module-owned hook so the spell path owns its own axis rule) |
| server ceiling lacks F-TAL-1 creation-catalog ≤1 cap | Low | FIXED — mirrored in `202610050001` (`v_creation_catalog` count > 1 rejects); grown-list fixture switched to real pool ids (lk_*) since a second creation id was never legal growth |
| pick binds all 9 rolled ids vs UI's offered 3 (auth path leaks injected pham_cot ~15% vs ~5% guest) | Low | FIXED — `create_character` now requires `p_talent_ids <@ talent_ids[1:3]` |
| pham_cot injection ignores `enabled` flag | Nit | FIXED — injection gated on `exists(talents where id='pham_cot' and enabled)` |
| unseeded Math.random in hidden-content rolls (AncientBeastTrial, NghichChuTian) | Nit | EXCEPTED — dormant content |
| `pickNextEnemyEntry` rng optional → unseeded outside turn battle | Nit | EXCEPTED — acceptable seam per audit |

## AUT (1 High / 2 Medium / 2 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W2-AUT-1 type-check red at HEAD (same import as W2-1) | High | FIXED — same fix |
| W2-AUT-2 witnessed great-dao saves permanently reject (`pham_cot` conversion drops the recorded pick, containment fails) | Medium | FIXED — containment tolerates the pick's absence iff `highestFoundationAchieved='great_dao'`; contract pin covers reject-without-witness + commit-with-witness |
| W2-AUT-3 roll `jsonb_agg` unordered → "first 3" was arbitrary table order, pham_cot ~0.13% vs ~5% | Medium | FIXED — `ORDER BY array_position(rolled_ids, t.id)`; contract pin asserts response order ≡ stored talent_ids |
| W2-AUT-4 SQL mirrors only 4 F-TAL-1 rules (parked/witness/creation-cap/pool-realm unmirrored) | Low | FIXED — all four mirrored in `_check_save_payload`; 5 contract pins cover each rejection + both controls |
| W2-AUT-5 pham_cot `enabled=false` → server pool 18 vs client 19 | Low | REJECTED WITH EVIDENCE — live staging row shows `enabled=true, weight=1` (later migrations `202610020001`/`202610030001` already enabled it; the audit read the stale seed `202609300005`) |
| W2-AUT-6 The-bar reads raw element (display-only edge) | Nit | EXCEPTED — display-only on a state the boundary now rejects |
| W2-AUT-7 companion/pill RNG unseeded | Nit | EXCEPTED — dormant content |

## INT (1 High / 1 Medium / 1 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| INT-1 type-check red at HEAD (same import) | High | FIXED — same fix |
| INT-2 `treeNodeFor` ignores beta admission (same class as W2-2) | Medium | FIXED — same fix |
| INT-3 shared module-level mulberry32 fallback across rng-less TribulationDirectors | Nit | EXCEPTED — prod binds sessionRng; fallback is deterministic |

## Re-audit scope for wave 3

New surfaces: `validateSpellPathPersistedState` rejection (fixture
coherence across falsification suites updated - spell_pathway carriers
now hold `element:'fire'`), `treeNodeFor` non-beta-scope verdict,
`_check_save_payload` full F-TAL-1 mirror + conversion tolerance,
`create_character` offer-slice binding, roll draw-order contract, the
enabled-gated pham_cot injection.

---

# Wave 3 adjudication (reports: fixpoint-codex-w3-{INT,COR,AUT}.md)

Audit trio on the wave-2 aggregate; adjudicator = coordinator session.

## INT (0 Critical / 0 High / 0 Medium / 1 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W3-INT-1 `onResume` live-replacement discards `restoreGameSession` verdict - a 'rejected' is swallowed and the sim resumes on a payload it could not consume (contract-asymmetric vs boot's recovery routing) | Low | FIXED — rejected now routes like boot: `markFailed('recovery')` + `saveIssue.report('corrupted', ...)` + skip `resumeSimulation` (App.vue onResume) |
| W3-INT-2 `betaCombatRolesFor` reports basic 'available' without `deps.hasSkill` | Nit | EXCEPTED — display-only on a boundary-rejected state |
| W3-INT-3 `isNodeElementActive/Effective` read `spellPath.element` raw | Nit | EXCEPTED — defense-in-depth divergence, unreachable |

## COR (0 Critical / 0 High / 0 Medium / 2 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W3-COR-1 `committedPlayer` fixture still `element: null` - F-TECH-1 pin passed via F-SCOPE-1 emit, not its intended techniques-empty rule | Low | FIXED — fixture now carries the coherent committed-fire bundle (element + fire root + core node + purchased ids + kit basic) |
| W3-COR-2 `_check_save_payload` coerces non-string talent ids (`jsonb_array_elements_text`) - server accepts ids the client's typeof gate rejects | Low | FIXED — non-string entry rejected in `202610050002` |
| W3-COR-3 F-SCOPE-1 message prints 'undefined' for the null element | Nit | FIXED — prints 'none' |
| W3-COR-4 `treeNodeFor` reports fire root 'purchasable' on unproducible element-null state | Nit | EXCEPTED — write seam closed anyway |

## AUT (0 Critical / 0 High / 1 Medium / 1 Low / 3 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W3-AUT-1 server `_check_save_payload` accepts payload classes every client ingress seam rejects: unknown realmId, realm beyond release ceiling, missing initiation receipts (techniques/breakthroughGrade), missing foundation victory record, mortal cultivation pair, F-SCOPE-1 committed element, fire kit coherence, element-root claims, bad pendingTalentEntitlement.realmId - a 'ready' row wedges on next client read | Medium | FIXED — all classes mirrored in `202610050002_beta_save_boundary_mirror.sql`; deeper graph checks (nodeLevels prereqs, axis slices) stay client-owned: a reject lands on SaveIncompatibleScreen with export/delete, recoverable not wedged. Contract fixture also repaired (canonical payload omitted realmId - dishonest vs the client's required field) |
| W3-AUT-2 `create_character` name check is length-only, no charset | Low | FIXED — client regex mirrored (`^[[:alnum:] _-]+$`) in same migration |
| W3-AUT-3 `characters.realm_id` default 'pham_nhan' diverges from payload catalog 'mortal' | Nit | FIXED — column defaulted + backfilled to 'mortal' (492 beta / 496 staging rows); column is informational only |
| W3-AUT-4 mirror hardcodes carry no drift guard | Nit | EXCEPTED — contract suite covers catalog drift end-to-end |
| W3-AUT-5 no unknown-id check either side for mirror lists | Nit | EXCEPTED — same coverage argument |

## Verification evidence

- `npm run type-check` clean; scoped vitest: save dir + architecture probes 25 files / 683 assertions green; w3int.repro pins 15/15 green.
- Contract suite vs live staging: migration applied idempotently on both projects; fresh-install scratch applies all 13 with catalog identical to historical-upgrade.

---

# Fixpoint termination threshold (Minh ruling, 2026-10-05)

Fix until no confirmed Medium-or-higher remains, then stop: Low/Nit
findings are adjudicated and excepted in place — no further fix waves
chase them. Wave-4 onward applies this threshold.

## Wave 4 (aggregate codex @0afd0b2f — COR + AUT + INT)

## COR (0 Critical / 0 High / 3 Medium / Low+Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W4-COR-1 server `_check_save_payload` accepts non-object `player.nodeLevels` (scalar/array) — client rejects; 'ready' row wedges at next read | Medium | FIXED — key-present + type guard added before F-SCOPE-1 block in `202610060001_beta_save_boundary_hardening.sql`; probed live: scalar/array -> SAVE_INVALID, object/absent -> pass |
| W4-COR-2 name charset mirror rejects client-valid names AND misreports them as taken | Medium | FIXED — split code: format -> `CHARACTER_NAME_INVALID` + honest client message; taken -> `CHARACTER_NAME_UNAVAILABLE`. PG `[[:alnum:]]` vs client `\p{N}` overshoot (No/Nl e.g. '1/2', 'IV') cannot be expressed server-side — residual is Low: exotic-unicode names rejected, recoverable by picking another name |
| W4-COR-3 resume rejected-verdict dropped to a dead write (saveIssue.report without bootFlow.fail) | Medium | FIXED — App.vue onResume rejected branch now reports + `bootFlow.fail()` |
| raw-bytes shape guard deeper than mirror (utf8/control chars inside strings) | Low | EXCEPTED — pin kept `it.fails`/`test.fail()`; server byte-scan would mirror a pathological input class with no observed wedge |

## AUT (0 Critical / 0 High / 1 Medium / Low residuals)

| Finding | Severity | Disposition |
|---|---|---|
| W4-AUT-1 corrupt-but-server-accepted row wedges the account permanently: client routes to SaveIncompatibleScreen but `deleteSave()` only clears localStorage — remote row still loads incompatible on every device forever | Medium | FIXED — new `reset_character` RPC (202610060002): hard-deletes the character row (cascades saves/checkpoints/receipts); soft-delete was rejected because every other authority function resolves "the" character by user_id without a deleted_at filter — a tombstone + fresh row would wedge them again. Client wiring: CloudSaveService.resetCharacter?/Supabase impl/Coordinator passthrough, lifecycle 'deleted' -> requireCharacter, SaveIncompatibleScreen calls remote reset then local clear + reload. Live pin `resetCharacter.spec.ts`: create -> save -> DELETED -> NO_CHARACTER -> recreated CREATED (staging) |
| W4-AUT-2 ~30 residual payload classes the mirror doesn't cover | Low | EXCEPTED — recovery premise now real (reset_character), so a residual-class reject is recoverable not wedged; matches mirror's stated scope |
| W4-AUT-3 charset check ordering vs name-availability probe | Nit | FIXED with COR-2 (split code) |

## INT (0 Critical / 0 High / 2 Medium / Low+Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W4-INT-1 (= COR-3) resume rejected -> dead write | Medium | FIXED — same App.vue edit |
| W4-INT-3 (= COR-2) wrong "name taken" for invalid-format names | Medium | FIXED — CHARACTER_NAME_INVALID + invalid_name client message |

## Wave-4 disposition

All confirmed Medium-or-higher findings fixed and verified (type-check clean; scoped vitest 182+1 expected-fail; live playwright boundaryMirrorW4 + resetCharacter specs green on staging; migrations applied to staging AND beta). Remaining Low/Nit excepted in place per the termination threshold — QA fixpoint reached under Minh's ruling.

## Wave 5 (aggregate codex @66746ede+delta — COR + AUT + INT)

## COR (0 Critical / 1 High / 2 Medium / 4 Low / 1 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W5-COR-1 remote reset reachable on HEALTHY remote rows: pending-conflict/pending-quarantined (local envelope problems) mounted SaveIncompatibleScreen with the destructive reset gate — a click deletes the good server character | High | FIXED — `saveIssue.scope` ('remote'|'local'): pending-* reports 'local', incompatible/corrupted/rejected report 'remote'; `remoteResettable` in SaveIncompatibleScreen gates the destructive leg to remote-scope reports only |
| W5-COR-2 (= INT-1) reset confirm dialog asserts the OPPOSITE of behavior ("cloud save is not deleted / screen will return") under a hard-delete RPC | Medium (INT: High) | FIXED — copy rewritten both locales: button "Xoá Nhân Vật Server"/"Delete Server Character", confirm states PERMANENT character+save deletion + restart at creation; stale "cloud recheck/soft-delete" comments corrected (NIT-1) |
| W5-COR-3 (= INT-4) tombstone+fresh-row wedge: characters lookups by user_id/norm_name never filtered deleted_at — create_character fires CHARACTER_EXISTS while load surfaces CHARACTER_DELETED | Medium | FIXED — migration `202610070001_deleted_character_predicates.sql`: partial unique index (deleted_at is null), exists/name checks filter tombstones, load/write canonical order `(deleted_at is null) desc` so live row wins over coexisting tombstone; applied to staging AND beta |
| W5-COR-4 (= INT-2) `bootFlow.fail()` resolved 'rejected' during any in-flight transition and the void-swallow dropped it — dead write survives in exactly the race window the wave-4 fix was written for | Medium | FIXED — `coordinator.whenIdle()` + bounded retry (3) in `useBootFlow.fail()`; behavioral pin in useBootFlow.test.ts; w5int repro pins updated |
| W5-COR-5 reset_character used the weaker `_assert_session_locked` while load/write/create use `_assert_session_protocol` | Low | FIXED — now `_assert_session_protocol` (same gate as every other authority function) in 202610070001 |
| W5-COR-6 reset_character status mapping collapsed every non-DELETED status to 'absent' — unknown RPC contract = wipe local state | Low | FIXED — strict mapping: DELETED→deleted, NO_CHARACTER→absent, else→unavailable retryable SERVER_ERROR; charset message corrected to list the actual accepted charset |
| Residual mirror/byte classes | Low | EXCEPTED — recoverable via reset_character; same ruling as W4-AUT-2 |
| Lexical-witness placement pin only, no effect pin | Nit | FIXED — behavioral pins added (useBootFlow retry test, w5int post-fix assertions) |

## AUT (0 Critical / 0 High / 1 Medium / 3 Low / 1 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W5-AUT-1 CHARACTER_UNINITIALIZED + permanent first-write reject = permanent wedge: generic error surface has no recovery affordance | Medium | FIXED — permanent (`!retryable`) first-write reject now arms the remote-scoped recovery surface (`markFailed('recovery')` + `saveIssue.report('corrupted','',undefined,'remote')` + `boot.fail()`); retryable rejects keep the generic path. w5aut pins flipped to post-fix assertions incl. retryable sibling |
| W5-AUT-2 reset_character blind to manual tombstones (`and deleted_at is null` filter) | Low | FIXED — canonical order (live-first, tombstone-last) with no filter; reset removes a tombstone-only row too |
| W5-AUT-3 CloudSaveCoordinator.resetCharacter bare passthrough — stale revision/identity/queue survives; next save CASes expected_revision under the deleted identity | Low | FIXED — `this.reset()` on any non-'unavailable' result: generation++, revision=0, queue drained |
| W5-AUT-4 recovery/'reconnecting' overlay has no backToAuth escape hatch | Low | EXCEPTED — reload is the documented escape; terminal states already gate mutation |
| resetNotice stale carry | Nit | EXCEPTED — cosmetic, one-shot flag |

## INT (0 Critical / 1 High / 4 Medium)

| Finding | Severity | Disposition |
|---|---|---|
| W5-INT-1 (= COR-2) lying destructive copy | High | FIXED — see COR-2 |
| W5-INT-2 (= COR-4) fail() dropped under in-flight transition | Medium | FIXED — see COR-4 |
| W5-INT-3 attemptReconnect: markReady() BEFORE deps.onResume — an onResume THROW left 'ready' + heartbeat armed + retry dead + sim frozen + autosave gate open on half-restored state | Medium | FIXED — onResume runs first under the generation fence: a throwing resume is classified 'unavailable' (stays 'reconnecting', retry stays armed); a rejecting resume's markFailed (generation bump) beats the trailing markReady. Both local + remote branches |
| W5-INT-4 (= COR-3) tombstone wedge | Medium | FIXED — see COR-3 |
| W5-INT-5 w4int.repro.test.ts replica encoded pre-fix wiring as "verbatim" — fix behaviorally unpinned (regression-safe green) | Medium | FIXED — replica updated to post-fix wiring (markFailed + report + bootFlow.fail order), stale "dead write" claim corrected; behavioral pins added |
| W5-INT-6 resume-reject reports re-serialized bytes (not server-verbatim) | Low | EXCEPTED — forensically usable; ReconnectOutcome would need a raw field; recorded as premise-invalidated re-flag |

## Wave-5 disposition

All confirmed Medium-or-higher findings fixed and verified: `npm run type-check` clean; scoped vitest 8 files / 137 assertions green (incl. flipped repro pins); live `resetCharacter.spec.ts` 2/2 on staging; migration 202610070001 applied to staging AND beta. Low/Nit excepted per the termination threshold. Wave-6 confirmation trio audits the delta; a clean wave = fixed point under Minh's ruling.

# Wave 6 — adjudication (codex aggregate @1bd0763f + wave-6 fixes)

## COR (0 Critical / 1 High / 2 Medium / 2 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W6-COR-1 `characters.user_id` carries `NOT NULL UNIQUE` (202608240001:44, never dropped) — at most ONE row per user, live OR tombstone. A tombstone-only account passed the wave-5 deleted_at-filtered existence checks then crashed on the constraint at INSERT (unique_violation -> opaque 4xx) — unrecoverable wedge for exactly the population the migration was written to recover | High | FIXED — `create_character` absorbs the tombstone (`delete ... where deleted_at is not null`) before INSERT, the same hard-delete rationale reset_character applies. New migration 202610070002, applied to staging AND beta. Live spec: tombstone -> CHARACTER_DELETED -> create_character -> CREATED, exactly one row remains |
| W6-COR-2 (= AUT-1) `unavailable && !retryable` armed remote destruction for failure classes that never proved the remote row bad: NETWORK_UNAVAILABLE lost-ACK (may have COMMITTED on a healthy row), SERVER_ERROR incl. the 23505, SESSION_REVOKED, PROTOCOL_OUTDATED | Medium | FIXED — arm gated on payload-reject codes only: SAVE_INVALID/SAVE_TOO_LARGE are the server's deterministic "this data can never commit" verdicts. 4-code parametric pin added to w5aut.repro.test.ts |
| W6-COR-3 unconditional `markFailed('recovery')` clobbered the terminal state `observeSaveResult` had already chosen (SESSION_REVOKED->'revoked', PROTOCOL_OUTDATED->'update-required') AND mounted remote-delete UX for an auth/protocol problem | Medium | FIXED — subsumed by the W6-COR-2 gate: markFailed('recovery') now only fires inside the payload-reject arm |
| W6-COR-4 (= AUT-5) a throwing `onResume` now churned the full reconnect RPC every 10s forever (post-fix silent loop) | Low | FIXED — resume-failure budget (3 consecutive throws -> markFailed('recovery')); streak resets on a successful resume. Both local and remote branches. Pins added |
| W6-COR-5 `whenIdle()` can stall forever if `curtain.open` in the error path never settles (no withTimeout) — plus bounded fail() could still dead-drop | Low | PARTIAL — fail() bound raised 3->10 + console.error breadcrumb on starvation. The curtain-open deadline is pre-existing (predates wave-5) and changes presentation semantics — EXCEPTED, recorded |
| W6-COR-6 (= AUT-3) `remoteResettable` non-reactive const snapshot | Nit | FIXED — computed over saveIssue.scope |
| W6-COR-7 residual races the delta neither caused nor fixed | Nit | EXCEPTED — pre-existing |

## AUT (0 Critical / 1 High / 1 Medium / 3 Low / 2 Nit)

| Finding | Severity | Disposition |
|---|---|---|
| W6-AUT-1 (= COR-2) non-remote-wedge failure classes armed remote reset on healthy rows | High | FIXED — see COR-2 |
| W6-AUT-2 local-mode `attemptReconnect`: throwing onResume escapes as unhandled rejection + permanent 'reconnecting' (no retry cadence in local mode) | Medium | FIXED — local branch wrapped in the same throw-classify path: catch -> streak++ -> 'reconnecting' until the resume budget escalates to 'recovery'. Pin added |
| W6-AUT-3 (= COR-6) remoteResettable stale-scope gate | Low | FIXED — computed |
| W6-AUT-4 firstSave arm reported `raw: ''` — Export downloaded a 0-byte artifact labelled as the save | Low | FIXED — Export button now `v-if="saveIssue.raw"`; a rejected first write has no bytes to export |
| W6-AUT-5 (= COR-4) remote-branch throwing onResume = unbounded RPC churn | Low | FIXED — see COR-4 |
| W6-AUT-6 `(deleted_at is null) desc` ordering inert under user_id UNIQUE | Nit | EXCEPTED — defensive ordering stays; after the COR-1 absorb a tombstone cannot coexist with a live row anyway |
| W6-AUT-7 (= COR-5) fail() bounded-3 dead-drop | Nit | FIXED — see COR-5 |

## INT

Still in flight (session de0243ebcdea43f1b5196a1b45c859d2); findings fold into this section when the report lands — Medium+ fixes land before the wave-7 dispatch.

## Wave-6 disposition

All confirmed Medium-or-higher findings fixed: type-check clean; scoped vitest green (incl. 3 new resume-budget pins + 4-code parametric arm-gate pin); live spec W6-COR-1 3/3 on staging; migration 202610070002 applied to staging AND beta. Low/Nit excepted per threshold. Wave-7 confirmation trio audits the delta.
