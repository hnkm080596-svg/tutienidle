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
