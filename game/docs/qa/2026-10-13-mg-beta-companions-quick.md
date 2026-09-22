# QA Quick Review — P7-M-G Beta companion roster

Date: 2026-10-13 · Mode: quick · Scope: `than_nong` (healer) + `khai_minh` (buffer) definitions, `BETA_COMPANIONS` acquisition pool, 4 `COMPANION_BUFFS`, acquisition-surface reroute, display meta.

## Inputs

Task-owned paths (reviewed; all unmapped by `changed-risk-map.mjs` — manually routed):

- `src/data/companion/Companions.ts` — economy-and-progression
- `src/data/buff/CompanionBuffs.ts`, `src/data/buff/buffs.ts` — combat-and-tribulation
- `src/data/skill/TurnSkillDisplayMeta.ts` — ui-input-lifecycle
- `src/core/game/GameManagerCompanionOps.ts` — economy-and-progression (transaction into persisted `player.companions`)
- `src/components/panels/worker-lodge/DuyenPhanTab.vue` — ui-input-lifecycle

Deep-escalation check: the exchange transaction does cross persistence, but the mechanism is unchanged — only the acquirable catalog view narrowed. Risk confidently bounded by code inspection + suite evidence; no escalation.

## Invariant ledger

| ID | Hypothesis | Operator | Oracle | Result |
| --- | --- | --- | --- | --- |
| INV-MG-1 | A non-Beta definition can still be minted (alternate pool caller, stale exchange row, direct gacha call) | cross-system chain | `grep` all `COMPANIONS`/`rollCompanionPull` consumers; `exchangeCompanion('ho_ly_tinh')` → `unknown_definition` | **No defect** — `rollCompanionPull` has exactly one caller (`companionOps`); exchange/UI re-gate on `BETA_COMPANIONS`; test asserts catalog-but-non-beta rejection. |
| INV-MG-2 | `BETA_COMPANIONS` derivation drifts from `BETA_COMPANION_IDS` (typo, reorder, duplicated objects) | value mutation | roster test pins `['than_nong','khai_minh']` order + `COMPANIONS`-contains-same-object | **No defect** — derived `filter`, ids are the single source; tested. |
| INV-MG-3 | Two external-ward producers (`son_nhac` + `khai_minh`) cross-wipe each other's pool — M-G is the SECOND producer of `externalWard` ever authored | cross-system chain / timing boundary | `reconcileExternalWard` source inspection | **No defect** — reconcile is keyed to the ward's CURRENT `sourceId`; an expired source-A marker only clears the pool when A still owns it. Multi-source is the documented contract (`TheTuExternalWard.ts:24-54`). |
| INV-MG-4 | `clearsCcOnApply` strips more than control instances (all debuffs → silent over-cleanse vs spec) | value mutation | `BuffSystem.ts:183-189` — removes only instances whose def has `controls` | **No defect** — scope is control defs only; TBS test applies real `choang` and observes cleanse. |
| INV-MG-5 | Support cast with zero allies (solo companion side) | value mutation | `resolveBuffApplicationTargets('allies_except_self')` → empty list → appliesBuffs no-op | **No defect** — harmless no-op; matches SON_NHAC semantics. |
| INV-MG-6 | Beta-owned instance fails save validation (catalog mismatch) | interruption | `saveShapeValidation.ts:644` validates against `COMPANIONS` (full catalog) | **No defect** — beta ids live in the catalog; grandfathered ids too. Learned-defect QA-2026-09-12-013 rule holds. |
| INV-MG-7 | Pity/effective-rate math diverges for the 2-grade pool | determinism | `effectiveCompanionRates` → `{huyen:2/3, dia:1/3}`; 30-pull pity → `khai_minh` | **No defect** — mechanism unchanged, pool-filtered as designed; tested. |
| INV-MG-8 | `than_nong` special at `mortal:12` exceeds mortal maxLevel (unreachable unlock) | value mutation | roster test asserts `realmLevel ≤ realm.maxLevel` for every threshold | **No defect** — suite green, threshold reachable. |

## Focused checks run

- `npx vitest run` over `src/data/companion`, `src/data/buff`, `src/core/companion`, `GameManagerCompanionOps`, `GameManager.companionSkillKit`, `TurnBattleSystem.companionSupport`, `src/components/panels` — **294 tests green** (incl. 6 new TBS-level defs executed through the real registry — learned-defect RR4 rule).
- `npm run type-check` — clean.
- `BUFF_REGISTRY` resolution for all 4 new buff ids — asserted in `CompanionBuffs.test.ts` + `Companions.roster.test.ts`.

## Coverage gaps

None blocking. `DuyenPhanTab` rows are verified through the real-mount `ChiHienQuan.integration.test.ts` (2 rows, disabled/max-enabled semantics); no dedicated Playwright run — judged unnecessary: no Phaser/lifecycle/boot wiring touched, and the row source is a pure computed over `BETA_COMPANIONS`.

## Verdict

**PASS WITH EVIDENCE** — 8 hypotheses resolved, 0 defects (0 Confirmed/Suspected), no blocking gaps.
