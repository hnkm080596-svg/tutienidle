# R8.2 — Major Progression Outcomes — Design Spec

**Status:** Draft, implementing
**Date:** 2026-09-11
**Branch:** `r8-progression-outcomes` (base: master `f8936331`)
**Roadmap:** game/docs/roadmap.md §R8.2 (AR-10 + selected AR-13)

---

## 1. Scope decision

Roadmap mandates: "Migrate one complete outcome chain" — not all progression
at once. This slice migrates **the tribulation outcome chain** (victory +
defeat consequences), which Mission 0 AR-10 flagged as the highest-value
instance ("consequential progression outcome remains in Vue").

Out of scope (remains for later R8.2 slices or other missions):
- `useBreakthrough.ts` UI-side eligibility reads (currently domain-reads
  only — no outcome determination found there).
- Currency consequence outside tribulation defeat (vendor/production paths
  already domain-owned via R9).
- Realm-passive/projection sync internals (already GameManager authority).

## 2. Current state (characterized 2026-09-11)

`src/composables/useTribulation.ts` — a Vue composable — currently OWNS:

| Outcome rule | Line | Domain consumer that READS the result |
|---|---|---|
| `player.realmId = targetRealmId` | 159 | realm passives, save, UI |
| `player.realmLevel = 1`, `player.cultivation = 0` | 160-161 | cultivation tick |
| `player.highestFoundationAchieved = grade` | 178 | RealmPassives.ts |
| Talent conversion `pham_cot` -> `pham_nhan_chi_cot` | 191-201 | PassiveSystem, save |
| `player.cultivation = floor(cultivation * (1 - lossPercent))` | 226 | cultivation tick |
| Spirit stone penalty `min(owned, stoneLoss)` | 230-235 | vendor, save |
| `player.greatDaoOpportunityLost = true` | 246 | **BreakthroughGrades.ts:36** (domain READ) |

 Violation: **BreakthroughGrades (domain) reads a flag that only Vue writes**
 (AR-10 verbatim: "consequential progression outcome remains in Vue"). The
 cultivation/penalty formulas live in `data/tribulation/TribulationChapters.ts`
 (already data-layer), but the WRITE sequencing (formula -> apply -> sync
 realm passives -> unequip -> quest reconcile -> announcements) is orchestrated
 by Vue with direct Pinia writes.

Also Vue-owned today: post-outcome sequencing
(`markQuestRealmTransition`, `syncRealmPassive`, `syncRealmStatPassive`,
`grantCultivationPathRealmReward`, `unequipAllEquipment`) and presentation
(announcements, `exitTribulationScene`, route request home).

## 3. Target architecture

```text
Encounter Result (TribulationDirector state: 'victory' | 'defeat')
        ↓  (GameManager facade command, called by App.vue tick — same call site)
TribulationOutcomeService.resolveOutcome(player, active)   [DOMAIN, new]
        → applies realm/level/cultivation/talent/foundation/opportunity
        → unequips via GameManager ops
        → quest realm-transition mark, realm passive sync, path reward
        → material penalty via MaterialBag (partial-delivery contract honored)
        → returns TypedOutcomeResult (discriminated union)
        ↓
useTribulation.checkTribulationOutcomeAction (thin adapter)
        → maps TypedOutcomeResult to announcements + panel navigation
        → exits tribulation scene, requests route home (unchanged)
```

### 3.1 Ownership after migration

- **Outcome computation + application**: `TribulationOutcomeService`
  (domain, headless-testable; lives next to TribulationDirector in
  `core/tribulation/`).
- **Typed result**: `TribulationOutcomeResult` union — victory variant
  carries `{ kind: 'victory'; realmEntered: string; foundationGrade?;
  talentConverted: boolean; announceTitle; announceBody }`; defeat variant
  carries `{ kind: 'defeat'; cultivationLost: number; spiritStonesLost:
  number; spiritStoneId: string; greatDaoOpportunityLost: boolean;
  announceTitle; announceBody }`.
- **Vue**: keeps only presentation sequencing it already owns (scene exit,
  route request, announcement display, standalone panel navigation) driven
  by the typed result. **Zero direct player-state writes remain** in
  useTribulation.ts.
- **GameManager**: gains one facade method `resolveTribulationOutcome()`
  delegating to the service (orchestrator pattern, A5 — no formula logic).

### 3.2 Behavior preservation contract (A12)

All current observable behavior must survive, verified by the existing
characterization tests (30 tests across dotPha/artifact/BreakthroughGrades/
Director) + new service-level tests:

1. Victory qi_refining: opens Quan Khi panel, NO realmId change (still
   'mortal' at that point? NO — qi_refining victory means entering Luyen
   Khi from Quan Khi; verify current behavior exactly: code shows early
   return BEFORE realm write — preserve verbatim).
2. Victory other realms: realmId/level/cultivation reset, unequip-all +
   modifier sync, foundation grade recorded for KC realm, path reward,
   talent conversion on great_dao KC.
3. Defeat: cultivation floor 20%, realm-scaled loss, spirit stone
   min(owned, loss) partial removal, Kiep Thuong debuff with real
   finalStats, great_dao KC defeat -> greatDaoOpportunityLost + special
   announcement + NO cultivation-side changes beyond the above.
4. Order: unequip happens AFTER realm write, BEFORE passive sync (Task 17
   rationale).
5. `markQuestRealmTransition` fires on realm change only (R8.1 glue).
6. Session clearing + scene exit + route home stay in the Vue adapter
   (presentation), unchanged.

### 3.3 Deliberate non-changes

- Announcement strings stay in the service result (they are outcome facts,
  not UI chrome) — but displayed by Vue as before. i18n migration of these
  strings is a separate backlog item (P16 scope discipline).
- `resolveNextBreakthroughRealm` + `triggerBreakthroughAction` stay put
  this slice (start-side, not outcome-side; revisit later).

## 4. Migration path (TDD, one slice)

Slice 1: `TribulationOutcomeService` + typed result + GameManager facade
+ full characterization suite migrated to service level (RED first via
service tests asserting CURRENT behavior parity, then wire).
Slice 2: useTribulation.ts rewritten as thin adapter; Vue outcome writes
deleted; existing dotPha/artifact tests re-pointed at the adapter and must
stay green without modification of assertions.

## 5. Verification strategy

- New: `core/tribulation/TribulationOutcomeService.test.ts` (headless,
  full parity matrix incl. order-sensitive assertions).
- Existing: useTribulation.dotPha.test.ts + artifact tests must pass
  UNCHANGED (assertions untouched) after adapter rewrite.
- R14 guards: `statProvenanceAndQueryPurity` + `vitalsWriteAuthority`
  must stay green (no new baseStats/vitals writers).
- P3 full + E3 + P5 + P4 quick before merge; P14 deferred (worktree).

## 6. Explicit out of scope

- No balance/tuning changes (§0.9 content freeze discipline).
- No save-schema change (existing fields persist identically).
- No i18n migration of announcement strings (separate backlog).
- No TribulationDirector internals change (mind/tank phases untouched).
