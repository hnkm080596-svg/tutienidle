# Wave-1 blind audit - save/restore/cloud/offline-time
# auditor devin-caa5f312, audited SHA f1049b5e42757f14aebee18bab3569dc43c37d09

CORRECTNESS REVIEW - save/restore/cloud/offline-time - commit audited: `f1049b5e42757f14aebee18bab3569dc43c37d09` (detached HEAD, own clone). Method: blind code reading + executable repros - 37 vitest cases in /tmp/qa-savescope (all green; files attached for reruns via `npx vitest run --config /tmp/qa-savescope/vitest.config.mts` from `game/`).

FINDINGS (ordered by severity):

1. **High - Offline cultivation grant is priced off a stale rate snapshot; buff activate/expire inside the [last tick -> save] gap corrupts the whole window, both directions.**
   Location: `game/src/stores/player.ts:277-284` (restore math), `game/src/core/cultivation/CultivationTick.ts:29-47`, `game/src/core/economy/TuLinhTranBalance.ts:39-46,62-91`.
   Evidence: `cultivationPerSecond` is written ONLY by the 1s tick. Restore computes `percentAtSave = getActiveCultivationSpeedPercent(effects, lastSavedAt)` then `unbuffed = save.player.cultivationPerSecond / (1 + percentAtSave)`. When the snapshot was taken on a different buff-state than the one live at `lastSavedAt`, the un-buff divides by the wrong factor.
   Expected: offline window priced at rates actually held (EM-02 intent). Actual: buff expired <=1 tick before save -> `percentAtSave=0`, `unbuffed` = the still-boosted snapshot -> entire window paid x1.25 (repro pays 1,080,000 vs true 864,000 = +216k on 24h). Buff activated <=1 tick before save -> `percentAtSave=0.25` divides an honest unbuffed snapshot -> the buff's entire offline benefit silently dead (pays 432,000 vs 540,000 on 12h).
   Repro: `offline.test.ts` "DEFECT A/B" - composes the production line verbatim against real `getActiveCultivationSpeedPercent`/`splitCultivationSpeedWindow`/`calculateOfflineProgress`; a control case (honest snapshot + mid-window expiry) prices correctly, isolating the staleness as the defect. Reachability: any pagehide/quit save has a [0,1s) gap after the last tick - rare per event but silent and unrecoverable when it lands.

2. **Medium - Same-revision remote fork resolved by raw wall-clock compare; pull destroys the local save with no backup.**
   Location: `game/src/services/cloudSave/SupabaseRemoteSave.ts:102-105` (`remoteAhead`), `:107-135` (pull writes revision+save, never calls `backupCurrentSave`).
   Evidence: two devices reaching rev N independently are forked by `remoteUpdatedMs > localLastSavedAt` - server-clock timestamp vs client-clock field. A device whose clock runs behind always loses the tie; its genuinely-newer local progress is overwritten and `*-backup` is not written (backup only happens on save/import/delete paths). Repro: `cloud.test.ts` - local rev5/cultivation=777 vs remote rev5/+30s-future `updated_at` -> 'pulled', local destroyed, backup key stays null. Separate test shows plain remote-ahead pull also leaves no backup. (Torn pull on quota does self-heal via re-pull - verified.)

3. **Medium - Two tabs on one account ping-pong LWW: stale tab conflict-resyncs then blind whole-payload overwrite; no merge, no user signal.**
   Location: `game/src/services/cloudSave/CloudSaveCoordinator.ts` (conflict -> `load()` -> one retry), `game/src/services/cloudSave/LocalCloudSaveService.ts:29-63`.
   Repro: `gate.test.ts` - tab A saves rev1 ('TabA-progress'); tab B on stale rev0 -> conflict -> resync -> retry writes rev2 with B's older snapshot -> stored name = 'TabB-progress', A's work silently gone. A's next save conflicts and clobbers B in turn - alternating silent rollback until a tab closes. CAS prevents corruption but not the data loss.

4. **Medium - First-push insert race: `Prefer: resolution=merge-duplicates` silently upserts on PK conflict - the code comment claims it throws.**
   Location: `game/src/services/cloudSave/SupabaseRemoteSave.ts:176-187` ("A concurrent first-push loses to the PK conflict (throws -> 'unavailable')").
   Repro: `cloud.test.ts` - device A POSTs first row (rev1, cultivation=111); device B POSTs with a stale empty-row read -> merge-duplicates upserts over A's row -> both return 'pushed', remote now holds cultivation=222. No CAS guards the insert path (CAS only exists on the PATCH branch). The comment's claimed safety net does not exist at the DB layer.

5. **Medium - `importSaveRaw` never bumps the save revision: an imported save inherits the pre-import lineage counter.**
   Location: `game/src/services/save/SaveSystem.ts:706-801` (writes backup + save key + marker; revision key untouched).
   Evidence: seed revision=5, import foreign v87 payload -> revision stays 5 (repro `gate.test.ts`). Consequence on an account: if remote revision > 5, the NEXT login's `remoteAhead` pull overwrites the just-imported save before it is ever played - the recovery flow's payload is silently discarded. Expected: import should adopt a revision >= remote lineage or mark the slot dirty.

6. **Low - Coordinator conflict-resync consumes the one-shot import-handoff marker and swallows `discardedEquipmentCount`.**
   Location: `game/src/services/cloudSave/CloudSaveCoordinator.ts` (conflict path calls `service.load()` -> `loadGame()`), `game/src/services/save/SaveSystem.ts:521-596`.
   Evidence: `gate.test.ts` - pending marker `{discardedEquipmentCount:4}` + conflicting tab save -> marker deleted during the internal resync `loadGame()`, the count goes to the load result that the coordinator discards - the user-facing discard notice is lost.

7. **Low - Offline auto-farm settle prices `[lastSavedAt, now]` instead of the farm's own deadline chain -> loses up to one completed cycle per boot.**
   Location: `game/src/core/game/GameManagerAutoFarmOps.ts:199-246`.
   Repro: `offline.test.ts` - chain anchored at `lastCheckedMs=900k` (10s cycle), save at 908k, restore at 1,011,000 -> owed `floor(111s/10s)=11` cycles, paid `floor(103s/10s)=10`; `lastCheckedMs` is re-anchored to `S + paid*c`, permanently forfeit. Bounded at <=1 cycle per boot.

8. **Low - Crafted-save economy magnitudes are unbounded: `player.cultivationPerSecond` (non-neg finite only) and `persistentTimedEffects[].cultivationSpeedPercent`/`expiresAtMs` (finite-only, field not required) pass the gate; restore feeds them straight into offline pricing.**
   Location: `game/src/services/save/saveShapeValidation.ts:258-259,533-563`; `assertSaveAcceptable` covers registries/boundaries, not magnitudes. Arguably outside the gate's anti-corruption threat model - noted since the gate is the only integrity barrier.

9. **Low - `settleAutoFarmOffline` is not idempotent at the primitive level: a repeated call with the same window pays twice** (repro: same 103s window called twice -> 20 cycles paid). Currently unreachable at boot because `player.restoreFromSave`'s payload-identity guard dedupes same-payload restores - the safety lives one level above the primitive.

10. **Low - Frozen dailies from a future `quests.lastDailyResetAtMs`:** `QuestSystem.checkAndResetDaily` skips while `dayBucket(now) <= dayBucket(last)`; restore clamps `>=0` with no upper bound. A clock-forward jump that fires a daily reset persists a future marker -> dailies stay frozen until real time crosses it (durable across sessions - the marker is saved).

11. **Info - Namespace seams:** `accountIdForSession` maps MockAuthService sessions to `loginId` vs Supabase `userId` - the same account stores under different namespaces across providers (saves don't migrate mock\u2194supabase). Guest->login keeps prior guest progress under the `guest` key (not migrated into the account slot) - appears deliberate, noted for completeness.

EXPLICIT NOTHING-FOUND (verified, most by executable repro):
- Version gate: v86, v99, non-numeric `'87'`, truncated JSON, missing-key shape violations all correctly classified incompatible/corrupted; retired `player.skillLevels` rejected; extra top-level keys tolerated; no migration path exists for old versions (dev-phase policy per saveVersion.ts).
- localStorage: disabled -> `storage_unavailable` boot fail-safe (no silent play); quota on revision write -> `unavailable`+retryable, no save written; quota on save write -> revision rolled back, CAS state intact; malformed import -> atomic reject, slot and prior marker preserved byte-for-byte; `deleteSave` backs up then clears all keys.
- Torn writes / autosave ordering: save pair (revision-first -> payload) is fully synchronous inside `pagehide`/`visibilitychange`/`before-quit` handlers - cannot tear across unload; a mid-write process kill heals via coordinator conflict->resync->retry; Electron quit flush is awaited.
- Offline accrual edges: `calculateOfflineTime` clamps [0, 86400s], future `lastSavedAt` -> 0 (no negative grant); mid-window buff expiry priced per-segment correctly when the snapshot is honest (control case); repeat-collection prevented by per-owner payload-identity hash; decompose/production/alchemy offline settles are window-bounded, capped (24h budget / <=5000 cycles / 500-cycle forfeit), and idempotent on re-settle; decompose restore merges timer+started safely.
- Cloud seam good behavior: guest sessions skip remote with zero HTTP calls; expired-session refresh failure clears the session and skips (local untouched); corrupt/incompatible remote payload counts as no-remote -> local pushes and adopts `max(local, remote+1)` revision; PATCH CAS carries `save_revision=eq.<read>` and empty result -> `unavailable`; pull writes the import-handoff marker bound byte-exact to the pulled payload.
- Restore atomicity: per-owner identity hashes commit only after that owner fully applies; a mid-restore throw yields 'rejected' + save-issue surface, and a same-payload retry re-applies exactly the uncommitted owners (design is coherent); rejected restores never persist (autosave gated on `entryStage==='game'`).
- Offline queueing: none needed - architecture is local-first with login-time newest-wins reconciliation only; verified consistent.

Bottom line: the version gate, corrupt-save handling, write atomicity, and offline settle bounds are solid. The real risk concentration is (a) the one-tick-stale rate snapshot feeding offline pricing, and (b) several silent whole-payload clobber paths (same-rev clock fork, two-tab LWW, insert race, post-import pull) - all four are lineage/tie-break weaknesses rather than storage bugs.

ATTACHMENT:{"url":"https://app.devin.ai/attachments/6330cd0a-7957-44b2-b449-cbb1490e34fe/gate.test.ts","fileSize":9279}
ATTACHMENT:{"url":"https://app.devin.ai/attachments/9782a527-bf1d-4970-bc32-4207980eb024/offline.test.ts","fileSize":7772}
ATTACHMENT:{"url":"https://app.devin.ai/attachments/970fd836-68ff-4d98-8ca5-c5403b6f4472/cloud.test.ts","fileSize":11140}
ATTACHMENT:{"url":"https://app.devin.ai/attachments/c6bc2672-0abc-4a32-a0bb-82aa6fb31797/helpers.ts","fileSize":1385}
ATTACHMENT:{"url":"https://app.devin.ai/attachments/2db9a7af-3553-4a37-a53a-3281ad10ee7b/fixtures.ts","fileSize":1209}
