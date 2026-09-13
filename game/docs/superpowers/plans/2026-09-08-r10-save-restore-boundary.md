# R10 Session Snapshot & Restore Boundary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (opencode inline execution per AGENTS.md P6 convention) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A save snapshot is a detached value; one restore transaction with explicit identity, replacement and once-only settle semantics (AR-12); the local-adapter boundary documented (AR-15 local scope).

**Architecture:** Strengthen `buildGameSave` detachment, add a whole-payload identity gate in `GameManagerSaveRestore`, switch additive restore paths to replacement inside the transaction, preflight all owners before any mutation.

**Tech Stack:** TypeScript, Vitest (TDD).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r10-save-restore-boundary-design.md`

## Global Constraints

- No `any` (P8); comments English plain ASCII (P15).
- Do NOT redesign the last-writer-wins conflict policy; do NOT add remote adapters (AR-15 remote half out of scope).
- No old-save migration (E8).
- Dedicated worktree `r10-save-restore-boundary`.
- Verification: P3 `full` (save system is critical infrastructure). QA deep is MANDATORY at mission close (save-and-cloud boundary).

---

### Task 1 (S1): Snapshot detachment — buildGameSave

**Files:**
- Modify: `game/src/services/save/SaveSystem.ts` (`buildGameSave` player copy)
- Test: `game/src/services/save/SaveSystem.snapshotIsolation.test.ts` (new)

**Interfaces:**
- Produces: no API change; `save.player` must be fully detached.

- [ ] **Step 1: Failing test**

```ts
it('mutating live player state after buildGameSave does not change the snapshot', () => {
  const manager = createBootedGameManager() // follow saveLoadRoundTrip harness
  const player = createDefaultPlayer()
  const save = buildGameSave(player, manager)
  const snapshot = structuredClone(save)

  player.baseStats.strength = 101
  player.name = 'changed'
  if (player.modifiers?.[0]) player.modifiers[0].value = 999

  expect(save).toEqual(snapshot) // nested refs must not alias live state
})
```

- [ ] **Step 2: RED → implement** — replace the `{ ...player, lastSavedAt }`
  shallow copy with `structuredClone` of the player fields (or a documented
  deep-copy preserving only the intended keys; keep save shape IDENTICAL —
  the JSON output must not gain/lose fields; round-trip test guards this).

- [ ] **Step 3: GREEN + full save test files** — commit:
  `fix(r10): buildGameSave detaches player state (snapshot is a value)`

---

### Task 2 (S2): Restore identity — whole-payload gate

**Files:**
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` (identity gate at restore entry)
- Modify: `game/src/stores/player.ts` (:322-339 region — remove the `lastSavedAt|cultivation` identity skip; consume payload unconditionally; it is the STORE's local restore, validation lives upstream)
- Test: `game/src/core/game/GameManager.restoreIdentity.test.ts` (new)

**Interfaces:**
- Produces (internal to restore):
  ```ts
  interface RestoreIdentity { appliedAt: number; payloadHash: string }
  // whole-payload hash: JSON.stringify of the save with player.lastSavedAt EXCLUDED
  // (hash stability: same payload -> same hash; any field change -> different hash)
  ```
  Semantics:
  - same hash as the last APPLIED transaction -> converge: skip offline
    settle + skip per-owner re-apply, return success (idempotent retry).
  - different hash -> full replacement restore.

- [ ] **Step 1: Failing tests**

```ts
it('same payload restored twice converges (no duplicate materials, no re-settle)', ...)
it('two payloads with equal lastSavedAt|cultivation but different name restore the CORRECT fields each', ...)
it('different payload after a first restore fully replaces session state', ...)
```

- [ ] **Step 2: RED → implement** the identity store (field on the
  SaveRestore Ops instance), hash helper (small util next to SaveSystem;
  exclude `player.lastSavedAt` from the hash), gate placement AFTER
  preflight, BEFORE any mutation.

- [ ] **Step 3: GREEN** — commit: `feat(r10): whole-payload restore identity gate (AR-12)`

---

### Task 3 (S3): Replacement semantics for additive owners

**Files:**
- Modify: `game/src/core/game/GameManagerSaveRestore.ts` (materials/pills restore blocks)
- Test: extend `GameManager.restoreIdentity.test.ts` + `GameManagerSaveRestore`-level integration test

- [ ] **Step 1: Failing test**

```ts
it('restoring into a nonempty bag REPLACES contents (5 saved materials, target holds 3 others -> result == 5 saved)', () => {
  // pre-seed the live bag with unrelated stacks, restore, assert exact
  // equality with the save payload's materials (no 5+3, no merge).
})
it('same save restored twice -> bag state identical (repeat-application contract)', ...)
```

- [ ] **Step 2: Implement** — add a `MaterialBag.clear()` / `PillBag.clear()`
  owner method if absent (smallest owner API; do not mutate internals from
  outside) and call it inside the restore transaction before applying
  materials/pills. Alchemy jobs / buildings / production sites / quests /
  decompose already replace (verified in R7/R8.1) — assert each in the
  same test with one field per assertion.

- [ ] **Step 3: GREEN** — commit: `fix(r10): restore replaces bag contents instead of adding (AR-12)`

---

### Task 4 (S4): Transaction boundary — preflight-first + once-only settle

**Files:**
- Modify: `game/src/core/game/GameManagerSaveRestore.ts`
- Test: `game/src/core/game/GameManager.restoreTransaction.test.ts` (new)

- [ ] **Step 1: Failing tests**

```ts
it('preflight rejection leaves EVERY owner untouched (snapshot all managers before/after)', ...)
it('offline settle runs exactly once per payload (second same-hash restore does not re-settle)', ...)
it('restore emits no loot notifications / quest collect hooks (drainNotifications empty, quest progress unchanged)', ...)
```

- [ ] **Step 2: Implement** — extend `preflightSaveRegistryReferences` to
  cover every registry-backed reference the transaction will touch (skills,
  techniques, materials, pills, buildings, equipment, affixes — audit current
  coverage, add the missing ones); offline settle guarded behind the identity
  gate from Task 2 (same-hash skip already covers this — assert it).

- [ ] **Step 3: GREEN** — commit: `feat(r10): restore transaction - preflight-first, once-only settle (AR-12)`

---

### Task 5 (S5, AR-15 local scope): Local-adapter boundary documentation + guard

**Files:**
- Modify: `game/src/services/cloudSave/README.md` (or create a short `BOUNDS.md` note in that folder — follow existing doc conventions)
- Test: `game/src/services/cloudSave/CloudSaveServiceFactory.test.ts` (extend)

- [ ] **Step 1:** failing guard test: the factory, with ANY configuration
  (including Supabase-looking env config), constructs a service whose
  capability descriptor is `local-only` (add a small readonly capability
  field if a suitable one exists; otherwise assert the concrete class).
- [ ] **Step 2:** implement + document the local boundary (single key,
  non-atomic revision, no remote transport) in the note.
- [ ] **Step 3:** commit: `docs+test(r10): local save adapter boundary explicit (AR-15 local scope)`

---

### Task 6: Mission close

- [ ] P3 full: type-check + build + full vitest (save-reload e2e spec if the
  environment supports it — P13 evidence for boot/restore wiring).
- [ ] **Adversarial QA deep** (mandatory: save-and-cloud critical boundary).
- [ ] E3 simplify + P5 code review.
- [ ] Roadmap R10 status cutover with evidence block.

## Self-Review Notes

- Type consistency: `RestoreIdentity.payloadHash` used identically in Tasks 2/4.
- Hash EXCLUDES `player.lastSavedAt` so a re-save of identical content with a
  new timestamp still converges on retry; document this choice in the util.
- Task 3 changes restore behavior for NONEMPTY bags — fresh boot is the only
  production caller today (boot flow) and starts empty; the nonempty case is
  a correctness contract for future in-session restores. Record this in the
  mission report.
- stores/player.ts identity removal must keep `setEquipmentModifiers`
  orchestration intact (read the current block before editing; the store
  consumes the validated payload — validation lives in the restore gate).
