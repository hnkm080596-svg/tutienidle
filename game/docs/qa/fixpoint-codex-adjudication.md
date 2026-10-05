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
