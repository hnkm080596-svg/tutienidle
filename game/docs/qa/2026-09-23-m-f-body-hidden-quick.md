# Adversarial QA — m-f-body-hidden (quick)

**Date:** 2026-09-23 · **Mode:** quick · **Verdict:** PASS WITH EVIDENCE

## Scope

Task-owned diff (`devin/1790160958-m-f-body-hidden` vs `origin/p7/truc-co @ f9fc4ee4`):

- `src/data/drop/HiddenMaterialChannels.ts` (new) + `.test.ts` (new)
- `src/core/game/HiddenBeastSystem.ts` (channel-generalized rewrite) + `.test.ts`
- `src/core/player/Player.ts` (`luyenKhiKillsSinceBeast` scalar -> `hiddenBeastKills` map)
- `src/core/production/ProductionSystem.ts` (+`rollHiddenChannelRewards`, `hiddenChannelCycles` copy in restore/snapshot) + `ProductionTypes.ts` + `.test.ts`
- `src/core/game/GameManager.ts` (two dep wirings) + `GameManager.hiddenChannel.test.ts` (new)
- `src/services/save/{SaveSystem,saveShapeValidation,saveTypes,saveVersion}.ts` (save v81) + `SaveRoundTrip.test.ts`
- `docs/systems/{enemies-stages,drops-loot}.md` (docs, non-code)

Excluded (non-task-owned): none — worktree is clean beyond the task set.

## changed-risk-map output

Domains: combat-and-tribulation, economy-and-progression, pinia-phaser-sync, save-and-cloud, time-and-offline. `deepAuditCandidate: true` (save boundary + time boundary + 5 domains).

**Escalation assessment — deep not required:** every boundary crossing uses an established mechanism rather than a new one: (a) save delta is the standing version-rejection convention (v80 rejected, no migration semantics to audit) plus two `Record<string,int>` maps through the existing whitelist serializer; (b) offline delta is emission inside the shared `grantCycleRewards` seam — no new elapsed-time math, same single-owner clock; (c) no Vue/Pinia/Phaser path is task-owned — the pinia-phaser domain maps only via hotspot proximity; (d) combat delta is same-call-site generalization (the `onEnemyDefeated`/`maybeReplaceSpawn` seams are unchanged for consumers). Each `unmappedPaths` item routed: `HiddenBeastSystem*` -> combat-and-tribulation, `Player.ts` -> save-and-cloud, `HiddenMaterialChannels*` -> data-registry shape validated by its own integrity suite, docs -> non-code.

## Invariant ledger

| ID | State/owner | Transition | Invariant | Attack operator | Oracle | Result |
|---|---|---|---|---|---|---|
| INV-HB-1 | `player.hiddenBeastKills` (PlayerData) | kill in band / beast kill | per-channel monotonic-until-reset; symmetric | repeat, reorder | counters per channel | tested: A resets A / B increments (HiddenBeastSystem.test) |
| INV-HB-2 | active vs idle spawn | `maybeReplaceSpawn` | idle never substitutes; active substitutes when window+roll | stale state | `activeStagePlayer` guard in StageWaveSystem:252 | inspected: idle path (auto-farm) never sets `activeStagePlayer` |
| INV-HB-3 | window/bound | bound reached | bound substitutes WITHOUT consuming a draw | timing boundary | rng spy never called at bound | tested |
| INV-GC-1 | `hiddenChannelCycles` (site state) | settle cycle | counter resets ONLY on emission; suppressed->primed | repeat, stale | counter 0 after emit; stays N when gate closed | tested (bound=2; suppression primed) |
| INV-GC-2 | table-roll stream | channel emission | `rollSeed ^ TAG` stream => zero table drift | determinism | `rollRewards` + settle stacks identical w/ & w/o channels | tested |
| INV-GC-3 | eligibility | `cycle.collectionRealmId` vs `bandRealmId` | below-band consumes no draw/counter; unknown ids fail closed | value mutation | reach check `cycleTier < band` skip | tested (mortal + qi_refining below foundation band) |
| INV-GC-4 | `isBreakthroughAcquisitionEnabled` | suppressed band | counter primes, emits once gate opens | timing boundary | counter=3 while golden_core closed | tested |
| INV-RS-1 | restore vs offline settle | `restoreStates` vs `settleProductionOffline` | restore = zero rolls/emission; settle = emits once | reorder, repeat | restore: counters verbatim + 0 events; offline: emits | tested (split arms) |
| INV-SV-1 | save v81 | build->JSON->validate->restore | maps round-trip; malformed/missing reject; stale scalar tolerated | value mutation, degraded | validate ok/reject outcomes | tested (4 new SaveRoundTrip arms) |
| INV-SEAM-1 | funnel | emitted material -> pendingEvents -> drain -> notifyMaterialGained -> writer | every landing notifies; write-once is writer's contract | repeat | spy on canonical writer, 1 call/landing | tested (GameManager.hiddenChannel.test) |
| INV-RT-1 | real stage loop | primed window -> substituted spawn -> kill -> signature drop | the real path (startStage->pick->battle->loot) delivers the material | cross-system chain | `tinh_hoa_pham_the` in bag + counter reset 0 | tested (P13 runtime arm) |
| INV-DET-1 | 'detail' metadata | emitted reward `detail:'hidden_channel'` | provenance only; never reaches UI | value mutation | pendingEvents carries siteId/materialId/amount/overflow only | inspected: no UI surface, no spoil |
| INV-GATE-1 | untagged material | `breakthroughRealmId === undefined` | never suppressed | value mutation | `undefined -> true` in ReleasePolicy:98 | inspected |

## Checks run

- `npm run verify` (full P3: type-check + build + 764 vitest files): 7167 pass; 4 failures analyzed -> 1 was task-caused (P15 non-ASCII comments in saveTypes.ts, fixed + rerun green); 3 are environment/pre-existing: `spawnSync magick ENOENT` x2 (ImageMagick absent), `SettingsPanel` jsdom confirm-modal querySelector (no task-owned UI file; fails identically in isolation).
- Scoped suites: HiddenMaterialChannels (integrity arms), HiddenBeastSystem (symmetric/idle/bound/dormant), ProductionSystem (emission/eligibility/suppression/stream parity/restore split), SaveRoundTrip (v81 arms), GameManager.hiddenChannel (funnel + P13 real-loop), BattleLootSystem family (no-drift), stageLease/bossRepeatCycle (harness compile).

## Findings

None at Medium+. No `Suspected` items survived inspection — every hypothesis resolved to code evidence or a passing reproduction test.

Deferred notes (pre-existing, out of scope): `SettingsPanel.test.ts` modal querySelector failure and 2 `magick`-dependent asset tests are environment-level and untouched by this diff.
