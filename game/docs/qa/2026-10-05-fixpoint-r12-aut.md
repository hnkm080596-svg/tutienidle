# Fixpoint r12 — AUT (authority/ownership) audit

Auditor: AUT (blind — no prior auditor reports read)
Target: branch `codex/hoa-cau-fireball-vfx`, pinned commit `f04b6fe2`
Scope: duplicated sources of truth, state mutated outside owning system, bypassed domain APIs, parallel validators/resolvers that disagree, duplicated business rules, responsibility in the wrong layer, ambiguous contracts, two writers for one field.
Method: real code only. Every claim below was verified against the pinned tree. Prior-round reports were not read.

---

## Verdict on the r11 fix claims

| Claim | Verdict | Evidence |
|---|---|---|
| (1) `lastDailyResetAtMs` clamped at `QuestManager.restore` | CONFIRMED, correct direction | `QuestManager.ts` restore normalizes via `Math.min(state.lastDailyResetAtMs, Date.now())` — clamp is the honest direction (a clamped stamp lands in an earlier-or-equal day bucket → `checkAndResetDaily` can only reset sooner, never later). But see F1/F4: the validator still accepts a future stamp, and this introduces a third defense layer for the same invariant class. |
| (2) `settleAutoFarmOffline` window now = caller elapsed ∩ farm anchor | CONFIRMED, sound | `GameManagerAutoFarmOps.ts` settle computes `effectiveSeconds = min(cappedElapsedSeconds, anchorGapSeconds)` where `anchorGapSeconds = max(0, (now - lastCheckedMs)/1000)`. For honest saves `lastCheckedMs ≤ lastSavedAt`, so the anchor gap is always ≥ the caller window → the intersect never binds on honest payloads; on crafted/skewed payloads it fails closed to the smaller bound. The `elapsed` param remains meaningful (it is still the authorized upper bound and drives the `> 60` gate). `tickAutoFarm` already self-heals `lastCheckedMs` the same way, so the two writers of that field now share one contract. |
| (3) `drawFromPool` NaN throw consistent with siblings | PARTIALLY — see F2 | The throw matches the fail-closed convention `poolMissWeight` already uses in the same file (throw on `poolDrawChance` outside `[0,1]`). But the weighted-draw rule is implemented three times in the codebase; the two sibling implementations keep the fail-open-to-last-entry behavior the commit fixed here. |
| (4) cold-boot elapsed migrated to `calculateOfflineTime` | CONFIRMED | `GameManagerSaveRestore.ts` cold-boot and legacy paths both go through `calculateOfflineTime`; a grep for inline `(now - ...)` / `Date.now() - ...` elapsed arithmetic over save markers finds no remaining production instance. Residual: the two callers resolve the same authorized window with different cap arguments and different end-clamps — see F3. |

Third-writer check on `lastDailyResetAtMs`: writers are `createDefaultState` (0), `resetDaily(ids, now)`, `restore` (clamp). No third writer exists in production code. However `QuestManager.getState()` returns the live state object (F5) — a bypass surface, not a writer today.

---

## Findings

### F1 — Medium — `buildings[].lastCollectedAt`: same unbounded-future class r11 just closed on quests, on a sibling field that was not migrated

`saveShapeValidation.ts` validates `buildings[].lastCollectedAt` with `isNonNegativeFiniteNumber` only. `BuildingManager.restore` is a raw `structuredClone` map — no normalization. `BuildingSystem.getStoredAmount` computes `elapsedSeconds = min(currentTime - lastCollectedAt, PRODUCTION_OFFLINE_CAP_SECONDS)` and returns 0 when `elapsedSeconds <= 0`.

Consequences, both directions:
- Crafted-future stamp → `elapsedSeconds <= 0` → building income frozen until real time catches the forged stamp. Identical "impossible future stamp freezes the owner" semantics as the `lastDailyResetAtMs` hole r11 adjudicated fix-worthy on quests.
- Crafted-past stamp (e.g. 0) → mints `min(cap, elapsed) * rate` up to storage capacity with no `lastSavedAt` floor. The decompose sibling floors its offline window at `offlineSinceMs` (`DecomposeSystem.settleOffline`); the building channel does not, so a save written 5 minutes ago can carry `lastCollectedAt = 2y` and pay a full storage bin.

Sibling bounds exist for the identical invariant in the same validator file (`workerCycles[].startedAtMs ≤ lastSavedAt`, `alchemyJobs[].startedAtMs ≤ lastSavedAt`, `tribulation.cooldownUntil ≤ lastSavedAt + span`). A collection after save-time is equally impossible; the bound is missing here, and no restore-clamp or consumer self-heal compensates — the only field in the class with zero defenses.

### F2 — Medium — Weighted-draw rule implemented 3x; the r11 fail-closed fix migrated 1 of 3; the other two keep the fail-open-to-last-entry defect

Three independent implementations of the same rule:
- `resolveDrops.drawFromPool` — now throws on non-finite total (r11).
- `DropRoll.weightedRandom` — throws only on empty entries. Non-finite `totalWeight` → `roll = NaN` → `roll <= 0` never true → falls through → returns `entries[last].value`. Silent pay-last-entry — the exact defect r11 closed in `drawFromPool`. Live callers: `StageSystem.pickNextEnemyEntry` (every spawned enemy), `EquipmentRolling` quality-band and tier rolls.
- `TalentEntitlement.drawBreakthroughTalentOffers` — a third hand-rolled draw (does not even reuse `weightedRandom`): `roll -= weight` loop bounded at `index < remaining.length - 1` → NaN roll never breaks → `remaining.splice(remaining.length - 1, 1)` → pays the last pool entry. Same fail-open.

All three feed on authored data at the same trust boundary the r11 commit reasoned over; the adjudication's own defect description ("non-finite weights silently pay the last entry") applies verbatim to both siblings. Also none of the three guards negative per-entry weight (`drawFromPool` included) — a mixed-sign total skews the draw without tripping the finite check.

### F3 — Medium — The two offline-window resolvers disagree on the same authorized window: different caps, different end-clamps

Two owners resolve "the window the server authorized" independently:
- `stores/player.ts` `restoreFromSave`: `windowStartMs = lastSavedAt`, `windowEndMs = windowStartMs + offlineSeconds * 1000` — **no `min(Date.now())` clamp**, and its `calculateOfflineTime` call uses the **default 24h** cap.
- `GameManagerSaveRestore.ts`: `settleNowMs = min(lastSavedAt + elapsed * 1000, Date.now())` — clamped (r11-COR), and its `calculateOfflineTime` call passes **`POSITIVE_INFINITY`** (uncapped, channel caps downstream).

The same crafted input produces different window ends on the two sides. Concrete divergence: cold-boot with server cutoff present + payload `lastSavedAt` edited to the future → `elapsed` comes from the authority (`until - cutoff`), but the cultivation window is positioned entirely off the editable marker: `[future, future + authorizedDuration]`. `splitCultivationSpeedWindow` evaluates timed effects at absolute ms positions, so a crafted `tu_linh_tran` effect (`appliedAtMs ≤ crafted lastSavedAt`, span ≤ authored 24h — the only bounds the validator enforces on that slice) is live inside the fictional window → bounded +25% cultivation mint over the authorized duration. The settle side of the same payload was clamped at `Date.now()` by r11-COR — the clamp migrated one resolver, not the contract.

Secondary divergence: if the server ever authorizes `elapsed > 24h`, the store silently resolves a different (24h-truncated) window than saveOps (`Infinity`) — two owners disagreeing about the same authorized duration.

### F4 — Low — One invariant class, five enforcement postures; r11 added a third defense layer instead of reusing the file's own convention

"Impossible timestamp" fields in the save shape now have five different defenses:
| Field | Defense |
|---|---|
| `persistentTimedEffects[].appliedAtMs`, `workerCycles[].startedAtMs`, `alchemyJobs[].startedAtMs` | validator relative bound (`≤ lastSavedAt`) → whole-save reject |
| `tribulation.cooldownUntil` | validator relative bound (`≤ lastSavedAt + authored span`) |
| `quests.lastDailyResetAtMs` | restore-normalize clamp to `Date.now()` (new) |
| `autoFarmStage.lastCheckedMs`, `decompose.nextCycleAt` | consumer self-heal at tick/settle |
| `buildings[].lastCollectedAt`, `player.lastSavedAt` | none (F1) |

For the quest field specifically, a `≤ lastSavedAt` validator bound is provably valid (honest `resetDaily` stamps `now` at tick, `lastSavedAt` stamps save ≥ tick) and is the convention the same file uses for every sibling timestamp; the restore-clamp instead self-heals in a different layer — payload consumers that read `save.quests` without `QuestManager.restore` still see the crafted value. Also inside `QuestManager` the time-source contract is mixed: `resetDaily` honors an injectable `now` param, `restore` hard-codes `Date.now()` — under cold-boot the clamp bounds against client-epoch while the restore authority is server-epoch.

### F5 — Low — `QuestManager.getState()` returns the live mutable state object; sibling snapshot contracts detach

`QuestManager.ts` `getState(): QuestManagerState { return this.state }` — the same object reference. Siblings honor the documented detached-snapshot convention: `ProductionSystem.getState/getAllStates` hand out detached snapshots ("callers observe, they never mutate the live domain record"), `DecomposeSystem.getSaveState` returns a fresh object, and `QuestManager.restore` itself documents the A3 detach rule.

No production writer goes through `getState()` today (`SaveSystem` compensates with `detachSaveValue(...)`, `GameManagerQuestOps` reads `.completedOnceIds` read-only), but the mutable reference is exported to every future caller: `getState().lastDailyResetAtMs = x` writes outside `resetDaily`/`restore` — i.e., it bypasses the r11 clamp's own invariant through the class's own read API. Ambiguous contract: is `getState` an observation API or a mutation handle?

### F6 — Low — Cold-boot `sinceMs` falls back to editable `lastSavedAt` when `cutoffMs` is absent; `live-replacement` union member is dormant and its `nowMs` is dead payload

`useAppLifecycle.ts`: `sinceMs = serverAuthority.cutoffMs ?? save.player.lastSavedAt ?? serverNowMs`. The middle fallback re-binds the accrual window to an editable payload marker — the invariant the remote-authority design exists to kill ("editable timestamps are never the accrual bound"). This is a documented degrade for pre-checkpoint saves, but it is a live exception, not a removed one.

`RestoreTimeAuthority.kind: 'live-replacement'` has no production producer (only tests construct it), and its `nowMs` field is dead: `stores/player.ts` uses literal `0`, `GameManagerSaveRestore` re-derives `Date.now()` via `settleNowMs`/anchor. The union's contract has drifted — a member that exists only for tests, carrying a field no consumer reads, while consumers violate B1-D's "server stamps, client clock never bounds" by reading `Date.now()` under the authority union anyway.

### F7 — Low — `player.lastSavedAt` itself: `isFiniteNumber` only — negative/future pass shape validation

`saveShapeValidation.ts` validates `lastSavedAt` with `isFiniteNumber` — not even non-negative. A negative or future value passes. Current consumers fail safe in the directions I checked (future → elapsed 0 on the authorized-elapsed paths; `settleNowMs` clamp covers the settle side), but the field is the anchor the entire offline contract hangs off, and it is the only marker field weaker than `isNonNegativeFiniteNumber`. `offlineSinceMs = save.player.lastSavedAt` still reads it raw and reaches `productionSystem.settleOffline`/`decomposeSystem.settleOffline` whenever `elapsed > 60` — safe today only because a future value makes `elapsed` 0; the floor depends on that ordering, not on the field being bounded.

### F8 — Nit — Residual minor issues

- `drawFromPool`/`weightedRandom`/`TalentEntitlement`: negative per-entry weight unguarded everywhere (mixed-sign total skews silently).
- `settleAutoFarmOffline` param is named `elapsedOfflineSeconds` but is now an authorized bound to be intersected, not an elapsed — name documents the old contract.
- `BattleLootSystem`: `stageDropTableFor` falls back `stage?.floor` vs `grantResolvedDrops` falls back `stage.floor ?? stage.requiredRealmLevel ?? 1` — the two floor derivations disagree when a stage has `requiredRealmLevel > 1` and no `floor`. Comment says authored-data-only dormant edge; still two writers of one derivation.
- `player.ts` `idleSkillInsightDaily` ledger vs quest daily reset: second independent daily-rollover ledger. Verified semantics-safe (`!==` dayBucket compare is forge-immune; `minted` cap-clamped) — flagged only because it is a second owner of "what is today" alongside `utcDayBucket`, which is at least the shared convention.

---

## Timestamp-field census (`saveShapeValidation.ts`)

| Field | Shape check | Upper bound | Post-load defense | Verdict |
|---|---|---|---|---|
| `player.lastSavedAt` | `isFiniteNumber` | none | `settleNowMs` min-clamp on settle side only | weakest marker (F7) |
| `player.autoFarmStage.lastCheckedMs` | `requireNonNegativeNumber` | none | consumer self-heal (tick + settle re-anchor) | bounded by consumers |
| `player.persistentTimedEffects[].appliedAtMs` | finite | `≤ lastSavedAt` | — | bounded |
| `player.persistentTimedEffects[].expiresAtMs` | finite | span ≤ TLT authored duration; pill-regen explicitly unbounded ("stackable refresh legitimately widens") | magnitude capped at authored percent | partial — crafted never-expiring regen is reachable, bounded to authored magnitude |
| `player.idleSkillInsightDaily.dayBucket`/`minted` | `requireNonNegativeNumber` | n/a (bucket, not ms) | `!==` roll + mint cap | safe |
| `quests.lastDailyResetAtMs` | `isNonNegativeFiniteNumber` | none at validator | restore clamp to `Date.now()` (r11) | bounded, wrong layer (F4) |
| `buildings[].lastCollectedAt` | `isNonNegativeFiniteNumber` | none | none | unbounded (F1) |
| `productionSites[].workerCycles[].startedAtMs` | finite | `≤ lastSavedAt` + exact span | — | bounded |
| `alchemyJobs[].startedAtMs` | finite | `≤ lastSavedAt` + exact span | settle replays reservation witness | bounded |
| `decompose.nextCycleAt` | non-negative finite | none | restore `Math.max` merge + tick rebase | bounded by consumers |
| `tribulation.cooldownUntil` | non-negative finite | `≤ lastSavedAt + 300s` | — | bounded |

## Verified non-issues

- `settleAutoFarmOffline` anchor-intersect: correct under clock skew; never binds on honest payloads; retry idempotent (anchor lands before the payout loop).
- `tickAutoFarm` and `settleAutoFarmOffline` share the same `lastCheckedMs` sanitize + re-anchor contract — consistent.
- `calculateOfflineTime` is the single elapsed-arithmetic source; no inline `now - savedAt` computation remains in production.
- `AlchemySystem.restoreJobs` detaches; forged jobs cannot mint — settle replays the reservation witness (`verifyAlchemyJobReservation`).
- `DecomposeSystem.settleOffline` floors its window at `offlineSinceMs` and the deadline is idempotent — the floor `lastCollectedAt` lacks.
- `SkillInsightBalance` daily ledger is forge-immune by `!==` compare.
- No third writer for `lastDailyResetAtMs` in production code.

## Severity counts

Critical: 0 | High: 0 | Medium: 3 | Low: 4 | Nit: 1 (4 sub-items)
