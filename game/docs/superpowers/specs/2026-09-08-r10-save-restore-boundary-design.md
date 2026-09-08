# R10 — Session Snapshot & Restore Boundary — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R10 (Architecture Repair Program), Mission 0 findings AR-12 + local scope of AR-15.
Status: APPROVED-by-user-scope (chat, 2026-09-08 — R9+R10 planning authorized), pending spec review.

## 1. Findings / Evidence

**AR-12 (P1, executed, confidence 100):** save/restore has inconsistent
identity and snapshot semantics.

```text
stores/player.ts:322   restore identity = lastSavedAt|cultivation ONLY
:325                    repeated identity is SKIPPED (no restore convergence)
:339                    shallow-assigns saved player data into the live store
GameManagerSaveRestore :169+ additive material restore (no replacement)
                        applying the same 5-material save twice -> 10
SaveSystem.buildGameSave :524 shallow-copies player; live baseStats.strength
                        mutated after snapshot changes the SAVED value
Executed: two saves equal in lastSavedAt|cultivation but different
name/skillInsight restore the WRONG (first) payload's fields.
```

**AR-15 (P2, source/config-conditional):** auth + local save are separate
unfinished contracts. CloudSaveServiceFactory ALWAYS builds
LocalCloudSaveService; one unscoped SAVE_KEY + separate revision key; the
revision read/check/write is not atomic cross-tab; no remote adapter exists.

## 2. Scope decision (user-audited)

R10 repairs the LOCAL session restore lifecycle (AR-12). Remote/cloud
capability (AR-15's remote half) is **explicitly out of scope** — the local
adapter stays bounded and documented as local-only. The existing intentional
last-writer-wins conflict policy is NOT redesigned (audit instruction).

## 3. Invariants

1. **Snapshot is a value.** After `buildGameSave(...)`, mutating any live
   object (player fields incl. nested baseStats/modifiers, bags, manager
   states) must not change the snapshot. Deep-detach player + nested state;
   keep the already-detached quests/decompose patterns.
2. **Restore identity is explicit and complete.** One supported restore entry
   point validates the payload's save identity (version + a payload hash or
   whole-payload comparison), then applies. Repeated restore of the SAME
   payload into a live session converges (no duplicated materials, no
   resurrected timers); restore of a DIFFERENT payload replaces the session
   (identity check rejects stale-same-timestamp confusion).
3. **Replacement, not addition.** Restore replaces manager-owned state
   (materials, pills, equipment, buildings, production sites, alchemy jobs,
   quests, decompose) instead of adding on top. Fresh-boot restore keeps
   today's semantics; the transaction is defined for nonempty targets too.
4. **Once-per-session offline settle.** Offline settlement runs exactly once
   per restore transaction (guarded by the transaction, not by caller
   discipline). Repeated restore of the same payload must not re-settle
   (already proven for decompose in R7; generalize the transaction).
5. **Failure behavior is explicit.** Preflight (registry references) fails ->
   no owner mutated. Failure partway is either (a) impossible via ordered
   preflight + owner-local replacement, or (b) an explicit documented
   partial-apply state; choose (a) — preflight everything before mutating.
6. **No new-acquisition on restore.** Rebuilding bags/quests emits no loot
   events and no quest-collect hooks (guard exists; keep it under the
   transaction).

## 4. Ownership

| Rule | Owner |
|---|---|
| Save DTO construction + detachment | `SaveSystem.buildGameSave` (deep-detach player) |
| Restore transaction + identity/repeat semantics | `GameManagerSaveRestore.restoreFromSave` (the ONE supported entry) |
| Player store restore | `stores/player.ts` restore path (consume the detached payload; no shallow spread of nested live refs) |
| Per-owner replacement | each manager/system `restore()` keeps replacement semantics (most already replace; materials/pills must switch from add to replace) |
| Local-adapter boundary doc | `services/cloudSave` README note (local-only, no remote claims) |

## 5. Migration path — vertical slices

```text
S1  Snapshot detachment: buildGameSave deep-copies player (+ nested
    baseStats/modifiers). Mutation-isolation test after build.
S2  Restore identity: payload hash (whole-payload, not a fingerprint of two
    fields); same-hash repeat restore = converge/no-op for settled owners;
    different-hash = full replacement. Kill the lastSavedAt|cultivation
    identity skip in stores/player.ts (replace with payload acceptance).
S3  Replacement semantics: materials/pills restore switches add->replace
    inside the restore transaction (fresh boot unchanged; nonempty target
    defined). Double-restore test: same save twice -> identical bag state.
S4  Transaction boundary: preflight-first ordering (registry checks for ALL
    owners before ANY mutation - strengthen existing preflight), once-only
    offline settle flag scoped to the transaction, explicit docs for the
    single supported entry point.
S5  AR-15 local scope: document LocalCloudSaveService boundary (local-only,
    one key, non-atomic revision) in a maintained note; add the smallest
    guard test proving the factory cannot claim remote capability.
```

## 6. Real consumers to migrate

- `stores/player.ts` restore (:322-:339 region) — identity + shallow-assign fix.
- `GameManagerSaveRestore.restoreFromSave` — identity gate, replacement
  ordering, once-only settle.
- `SaveSystem.buildGameSave` — player deep-detach.
- Callers of restore: `restoreGameSession` (SaveSystem) and boot flow — keep
  ONE path; any direct test callers documented as test-only.

## 7. Regression tests required

- Snapshot isolation: mutate live baseStats/technique/nested after build ->
  save unchanged (deep-equal).
- Identity: two payloads with equal lastSavedAt|cultivation but different
  name/insight restore the CORRECT payload each.
- Repeat restore same payload: bag counts identical, decompose timer not
  rewound (R7 regression stays), quests not reactivated/awarded, offline
  settle not re-run.
- Nonempty target: restore into a session holding other state -> target state
  fully replaced (no 5+5=10 materials, no orphan pills).
- Failure partway: registry-preflight rejection leaves every owner untouched
  (exists today for equipment refs; extend to the whole transaction).
- Boot E2E (save-reload spec) stays green.

## 8. Explicit out of scope

- Remote/cloud save adapters, account sessions, AR-16 server contracts.
- Changing the last-writer-wins local conflict policy.
- Old-save migration (E8 development phase).
- UI changes beyond none.

## 9. Completion gate

```text
- snapshot-isolation + identity + replacement + repeat-restore tests green
- one documented restore entry point; preflight covers all owners
- restore emits no acquisition/quest events (guard test)
- P3 full + adversarial QA deep (save-and-cloud critical boundary - mandatory
  escalation per quick workflow) + code review
- local-adapter boundary documented
```
