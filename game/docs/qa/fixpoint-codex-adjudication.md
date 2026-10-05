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

# Wave 2 adjudication (commit <pending>)

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
