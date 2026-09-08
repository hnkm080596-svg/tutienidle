# R8.1 — Quest Activation Lifecycle Authority — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R8.1 (Architecture Repair Program), Mission 0 finding AR-09.
Status: APPROVED-by-user-scope (chat, 2026-09-08 — R8.1 selected, R8.2 deferred), pending spec review.

## 1. Finding / Evidence

**AR-09 (P1, confidence 100):** querying quests activates gameplay.

```text
QuestSystem.ts:48-68   getActiveQuests() calls manager.ensureActive(quest)
                       for every unlocked quest — a READ mutates state
QuestSystem.ts:216/258 onEnemyDefeated / onMaterialCollected iterate
                       manager.getActive() — only visit ALREADY-active
                       entries
QuestPanel.vue:44      the ONLY production caller of GameManager.getActiveQuests()
OverlayPanel.vue:36    gates that panel with `open` — kills before first
                       panel open are never counted
GameManager.ts:2733    checkAndResetDaily runs every tick (wall-clock) —
                       daily reset REMOVES daily entries; without the
                       panel open again, kills/collects stop counting
```

Executed repro from audit: kill before opening quest UI → ignored;
after querying active quests → counted; after daily reset → ignored
again until the panel is opened. Normal progression depends on opening
a UI panel — a violation of query purity (A3/A7).

Preserved intended behavior (do not regress):
- counting starts from activation, not from quest authoring;
- no retroactive credit for items/kills already banked before activation;
- `once` quests never reappear after completion;
- daily board = every unlocked `daily` quest of today (no random rotation, v1).

## 2. Invariant

1. **Queries are observational.** `getActiveQuests` (and every read API)
   never creates, claims, resets, or mutates quest state. Same call
   twice in a row returns equal results.
2. **Lifecycle commands own activation.** A dedicated reconciliation
   command activates every eligible quest exactly once. Production
   triggers:
   ```text
   boot / restore-from-save
   realm unlock transition (new quests become eligible)
   daily rollover (after resetDaily re-populates today's board)
   ```
   and it is idempotent — repeated invocation is a no-op for already
   active entries.
3. **Events count without UI.** `onEnemyDefeated` /
   `onMaterialCollected` increment progress for any eligible quest that
   the lifecycle has activated, regardless of QuestPanel visibility.
4. **One owner per state change.** Activation lives in
   QuestSystem/QuestManager (existing authorities); the reconciliation
   command composes them; no second activation path appears (UI, boot
   code, or tests must not call `ensureActive` directly).

## 3. Ownership

| Rule | Owner |
|---|---|
| Eligibility (`isUnlocked`, cadence, completedOnce) | QuestSystem (unchanged) |
| Activation/reconciliation command | QuestSystem.`reconcileActiveQuests` (new lifecycle command) |
| Active-state CRUD | QuestManager (unchanged; `ensureActive` becomes internal to the reconciliation flow) |
| Read model for UI | `QuestSystem.getActiveQuests` — pure projection, no `ensureActive` |
| Lifecycle trigger timing | GameManager tick (daily reset already there) + boot/restore + realm transition point |
| Panel rendering | QuestPanel.vue (unchanged contract: consumes `getActiveQuests`) |

## 4. Existing primitives reused

- `QuestSystem.checkAndResetDaily` — daily rollover already ticked from
  GameManager (:2733); reconciliation hooks right after it returns true.
- `QuestManager.ensureActive` idempotence (returns existing progress) —
  the primitive the reconciliation loop reuses; it just stops being
  reachable from reads.
- `getRealmIndex` realm-order comparison — unlock predicate unchanged.
- Save restore path `QuestManager.restore` — reconciliation runs after
  restore so a save's active list converges to the eligibility set.

## 5. Missing primitive (added by this mission)

```ts
// QuestSystem — lifecycle command (NOT a query)
reconcileActiveQuests(
  registry: QuestRegistry,
  manager: QuestManager,
  player: PlayerData,
): void
```

Rules:

```text
for each quest in registry.getAll():
  skip if !isUnlocked(quest, player)
  skip if quest.cadence === 'once' && manager.isCompletedOnce(quest.id)
  manager.ensureActive(quest)          // idempotent
```

Trigger wiring:

```text
GameManager.restoreFromSave  → after questManager.restore + reset check
GameManager.update           → after checkAndResetDaily() === true only
                               (cheap: no scan on normal ticks; the
                               reset already implies a day rollover and
                               clears daily entries)
realm unlock transition      → the next reconcile after realmId changes;
                               tick path performs it when a new day
                               resets OR a lightweight realmChanged
                               flag set by the realm-transition writer
                               (small, explicit state on GameManager —
                               set where realmId is assigned)
```

`getActiveQuests` keeps its exact return shape
(`{ quest, progress }[]`) so QuestPanel and tests are untouched except
for the removed side effect.

## 6. Migration path

Vertical slices (each ends green):

```text
S1  Characterization: lock current intended behavior in tests —
    activation-on-read (documented as the OLD contract), counting from
    activation, daily reset semantics — then flip:
    make getActiveQuests pure; RED test "kill before any panel open
    counts" fails, implement reconcileActiveQuests, wire boot/restore
    + daily-reset tick; GREEN.
S2  Realm-transition trigger: realmId writer marks reconcile-needed;
    tick reconciles; test "newly unlocked quest counts without opening UI".
S3  Guard: query-purity test (two consecutive reads, state snapshot
    equal) + grep-level check that ensureActive has no caller outside
    QuestSystem/reconcile path.
```

## 7. Real consumers to migrate (production, not fixtures)

- `QuestSystem.getActiveQuests` (side effect removed).
- `GameManagerQuestOps.getActiveQuests` — unchanged signature; now
  guaranteed read-only.
- `GameManager.restoreFromSave` / `GameManagerSaveRestore` — add
  reconciliation after restore.
- `GameManager.update` — reconciliation after daily reset (and realm
  transition).
- `QuestPanel.vue:44` — NO change expected (consumes same shape);
  verified read-only.

## 8. Regression tests required

- Unopened UI: boot with panel never opened → kill counts; collect
  counts.
- Boot/restore: save with completed `once` quests → no reactivation;
  save from a previous day → daily board rebuilt on load without UI.
- Daily rollover mid-combat: reset tick fires → board repopulates →
  next kill counts (no panel).
- Newly unlocked quest (realm transition): eligible next tick without UI.
- Idempotence: reconcile twice → no duplicate active entries, no
  progress reset.
- Query purity: two consecutive `getActiveQuests` → deep-equal results,
  QuestManager state snapshot unchanged.
- Claim path unchanged: canClaim/claim still validated by domain
  (existing tests stay green).

## 9. Explicit out of scope

- New quests, reward balance, retroactive credit (audit: explicit).
- R8.2 tribulation/progression outcomes (depends on reward/vitals
  contracts; separate mission).
- Quest registry content changes; daily random rotation (v1 keeps
  "all unlocked").
- Notification/UX additions for "new quest unlocked".

## 10. Completion gate

```text
- getActiveQuests contains no mutation (code + purity test)
- reconcileActiveQuests is the only activation path (grep evidence)
- all Section 8 tests green; existing QuestSystem/QuestManager tests
  green or updated where they documented the old query-activation
  contract (updated intentionally, not deleted)
- GameManager-level integration evidence: kill → progress → claim with
  panel closed for the whole session
- P3 full + adversarial QA quick + code review pass
- browser check of quest flow deferred per P14 worktree exception
```
