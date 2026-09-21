# P7-M9 — Companion Domain & Ring-2 Realm Gating — Plan

Spec: `m9-companion-ring2-gating.spec.md` (v2, external-review approved). Decisions D3/D4 + M9-F1 (formation unlock pinned at `foundation_establishment` as its own product decision). Worktree `.agent-worktrees/m9-companion-ring2-gating`, branch `feat/m9-companion-ring2-gating`.

## Task card (G0)

- **Responsibility:** one unlock rule per domain (companion, formation) enforced at the domain boundary; source/UI surfaces pointed at it.
- **Owner:** `core/companion/CompanionAvailability.ts` (companion unlock); `core/game/FormationPlacement.ts` (formation unlock — owner of formation commit rules).
- **Chain:** wheel slot → `disabledReason(context.hasFoundationRealm)`; panel tabs → `isCompanionDomainUnlocked`; ops → predicate before mutation; drops/quest → data-level realm removal.
- **Non-goals:** roster redesign, migration, balance, artifact/talisman, TranPhapPanel internals.

## Steps (TDD: red → green per step)

1. **CompanionAvailability + ops gates**
   - New `core/companion/CompanionAvailability.ts`: `COMPANION_UNLOCK_REALM_ID`, `isCompanionDomainUnlocked(realmId)`.
   - `GameManagerCompanionOps`: `'realm_locked'` on the 3 result unions + first-check gate.
   - Tests: ops reject at mortal/qi_refining, succeed at foundation (extend existing ops spec file).

2. **Formation gate**
   - `FORMATION_UNLOCK_REALM_ID` + `isFormationUnlocked` in `FormationPlacement.ts`; `commitFormationLoadout` rejects below threshold.
   - Tests: commit rejected + no mutation at mortal/qi_refining; green at foundation.

3. **Source migration**
   - Remove `chieu_hien_lenh` from `mortal_ferocious_giant_crocodile` + `ferocious_flood_serpent` drops.
   - `daily_chieu_hien_lenh` += `requiredRealmId: 'foundation_establishment'`.
   - **Review-driven addition:** `QuestManager.deactivate` + `reconcileActiveQuests` inverse pass — stale ineligible active quests are dropped at the reconcile boundary (closes the restored-save leak the spec review flagged).
   - Tests: data assertion — no mortal/qi_refining enemy drops the token; quest eligibility + stale-progress drop below foundation.

4. **Wheel + panel**
   - `disabledReason` on `companion_roster` + `formation_slot` (`hasFoundationRealm` → `'Cần đạt Trúc Cơ'`).
   - `WorkerLodgePanel`: gacha tabs filtered when locked.
   - Tests: catalog disabledReason unit cases.

5. **Verify** — `npm run type-check` + `npx vitest run` scoped: companion, formation, quest, wheel catalog, battle loot (grandfather regression).

## Ledger

| Rule | Current authority | Target authority | Consumers |
|---|---|---|---|
| Companion domain available | none (implicit always) | `isCompanionDomainUnlocked` | ops ×3, WorkerLodgePanel tabs, wheel slot |
| Formation commit allowed | none | `isFormationUnlocked` | `commitFormationLoadout`, wheel slot |
| Token acquisition | drops + daily quest (ungated) | foundation-only sources | drop tables, quest def |

## Gates

quick mode (P3): `npm run type-check` + scoped vitest → P18 OCR → P13/14 (wheel lock badge + tab filtering are UI-visible → runtime check in worktree) → P4 QA → P5 ≥3 passes → external IMPL review → merge.
