# QA Review: BETA-SEAM-REPAIR (tc-wave aggregate repair, 21 findings + v82)

- Date: 2026-09-24
- Mode: deep
- Verdict: FAIL WITH REASON (1 Confirmed Medium; Low/Nit residue only)
- Task-owned paths: `git diff origin/beta/rc...bc80ffef` on `devin/1790189112-beta-seam-repair` — 53 files, +1742/-124. Production surface: `src/core/tribulation/TribulationDirector.ts`, `TribulationOutcomeService.ts`, `src/core/game/GameManager{,SaveRestore,ProgressionOps,RealmAdvanceOps,TickOps}.ts`, `src/core/progression/NodeSystem.ts`, `src/core/kiem-tu/NguKiemDao.ts`, `src/services/save/{SaveSystem,saveShapeValidation,saveTypes,saveVersion}.ts`, `src/core/simulation/earlygame/EarlyGameSession.ts`, `src/core/quest/QuestSystem.ts`, `src/core/combat/StageWaveSystem.ts`, plus 24 test files and plan/spec docs.

## Scope and Risk Map

The diff repairs all 21 findings of the `tc-wave-2026-09-23` aggregate retro sweep (`beta-seam-repair-plan.md` disposition table F-W-0..20) and bumps the save to v82 (`nodeOneShotGrants` required; optional `tribulation` slice; `tribulationBonusStacks` dropped; v<=81 rejected). One-hop consumers exercised: `saveOps.restoreFromSave` -> `tribulationDirector.restoreRuntime`; `tickOps`/`saveRestore` -> `OutcomeService.settleOutcome`; `respecNodeTree`/`devResetBranch`/`switchRoute` -> `applyOneShotClawback`; `purchaseNode` -> one-shot record write; validator -> `grantedRealmPassiveIds`/`autoWorkerCapacity`/`formationLoadout`/`tribulation` slice/`nodeOneShotGrants` content rules; `EarlyGameSession` -> `startTribulationPrepared` + lazy `writer()` adapter; `commitSpellPathElementRoute` (record-exempt); `NguKiemDaoProvider` kill-feed -> `gainKiemY`. Escalation: deep mode per coordinator mandate (save + progression surface). Exclusions: older save migration (out of phase scope per save-and-cloud pack), UI/Phaser presentation internals.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TRIB-1 | `committedOutcome`, TribulationDirector | `restoreRuntime(slice)` without committed | Replacement | Interruption / stale state | `getCommittedOutcome()` null after restore | unit (QA repro) | Save corruption via fabricated settle |
| INV-TRIB-2 | `active`/`mind`/`tank` run state | `restoreRuntime` mid-run | Replacement | Interruption | `getState()` null after mid-run load | unit (QA repro) | Documented-design violation + leaked ticking run |
| INV-TRIB-3 | `committedOutcome.receipt` | settle after reload | Exactly-once / idempotency | Repeat + reload | one consequence application, receipt re-bound | unit (impl persist tests) | Duplicate realm bump |
| INV-TRIB-4 | `committedOutcome` slot | settle x2 / re-entry during pending | Exactly-once | Repeat | early return on bound receipt; `start()` blocked by non-null active | unit (impl tests) | Double settle |
| INV-TRIB-5 | `pendingTalentEntitlement` | defeat drain / supersede by different realm | Conservation | Reorder | record cleared on settlementError drain; superseded on new realm entitlement | unit (impl tests) | Stale entitlement write to wrong realm |
| INV-CLAW-1 | `nodeOneShotGrants` records | respec/devReset/switchRoute revoked set | Conservation | Repeat + reorder | revoked grants unlearned/debited, records deleted, still-owned records kept | unit (impl clawback tests + rescan) | Perma-skill / currency dup |
| INV-CLAW-2 | grant record semantics | record authored vs delivered amounts | Conservation | Value mutation | `record.kiemY/kiemDao` = authored; delivered proven symmetric for authored content (all grants carry `kiemDaoBelowCap`; `kiemDaoGrant` all = +1) | unit (existing + review) | Over/under-clawback |
| INV-CLAW-3 | `kiemY`/`kiemDaoCount` | `loseKiemY` residual absorb | Boundedness | Value mutation | `ceil(residual/forgeCost)` whole-sword debit for any residual>0 | unit (impl tests) | Pre-existing pool burn (~1 forgeCost) |
| INV-SAVE-1 | v82 shape | `nodeOneShotGrants` required; `tribulation` optional; `tribulationBonusStacks` dropped | Recoverability | Corruption | v81 rejected; missing required field rejected; optional slice accepted absent | unit (impl validator tests) | Mis-classified saves |
| INV-SAVE-2 | `grantedRealmPassiveIds` (F-W-9) | validator cross-check live modifier | Recoverability | Corruption | entry must resolve in REALM_PASSIVES AND live modifier `sourceType='realm' && sourceId=definition.sourceId` | unit (impl tests + emission match `nhap_dao`/`kien_co`) | Phantom realm passives |
| INV-SAVE-3 | `autoWorkerCapacity` (F-W-16) | validator requires `chi_hien_quan` instance | Recoverability | Corruption | `entry.buildingId === 'chi_hien_quan'` check | unit (impl tests) | Phantom capacity |
| INV-SAVE-4 | `formationLoadout` (F-W-17) | validator content rules mirror `commitFormationLoadout` | Recoverability | Corruption | formationId in TRAN_PHAP_FORMATIONS; combatantId `player`/companion `definitionId`; dup combatant + cell; cellPattern bounds | unit (impl tests) | Phantom loadouts |
| INV-SAVE-5 | `tribulation` slice | shape rules: grade in FOUNDATION_LABELS, receipt kind, settlementError boolean | Recoverability | Corruption | invalid slice rejected | unit (impl tests) | Poisoned restores |
| INV-GATE-1 | `startTribulation` (F-W-8) | admission gate `canTriggerBreakthrough` + `isRealmTransitionEnabled` | Monotonicity | Reorder | refused when next-realm requirements unmet; no passive-stack side effects on refusal | unit (impl tests) | Unearned tribulations |
| INV-QUEST-1 | material claim loop (F-W-10) | domain gate `domainUnlockRealmId` vs `playerRealmId` | Conservation | Corruption | material-only scope; pills unaffected; missing realmId fails closed | unit (impl tests) | Locked-domain claims |
| INV-EG-1 | EarlyGameSession (F-W-6/20) | `writer()` lazy adapter + `tinhHoaGained` parity invest + `startTribulationPrepared` | Synchronization | Stale state | parallel sim/store semantics; body_refinement invest on tinh hoa gain | unit (impl parity tests) | Sim/store divergence |
| INV-RNG-1 | `sessionRng` (F-W-7) | injection into 4 consumer surfaces | Determinism | Repeat | GameManager wires progressionOps, StageWaveSystem, saveRestore (offline alchemy), tickOps; OutcomeService talent draw via `gameManager.sessionRng` | code-level audit | Hidden-beast/substitution non-determinism |
| INV-KILL-1 | `hiddenBeastKills` (F-W-19) | active-only counting | Conservation | Value mutation | idle kills not counted | unit (impl flip) | Phantom kill progression |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | exit 0, clean |
| `npm run build` | PASS | vue-tsc + vite build, 1848 modules |
| `npx vitest run` (full) | 7212 pass / 4 fail / 4 expected-fail | 2 fails = intentional QA repro (below); 2 fails = `spawnSync magick ENOENT` environment (dongFu asset tests, no ImageMagick on this box — unrelated to diff) |
| `npx playwright test save-reload.spec.ts tribulation-flow.spec.ts` | 2 pass | most relevant e2e seams green; full e2e not run (browser suite, 35 tests) |
| `tribulationDirector.restoreRuntime` source inspection | Confirmed replacement gap | `TribulationDirector.ts:757-775` — sets `cooldownUntil`, restores `committedOutcome` only `if (slice?.committedOutcome)`, never touches `active`/`mind`/`tank`/`ghost`/`chapters`/`playerOwner` |
| sessionRng consumer census | Complete | GameManager.ts: progressionOps (:665), StageWaveSystem (:763), saveRestore (:856), tickOps (:955); OutcomeService entitlement draw via `() => gameManager.sessionRng()` — no consumer left on `Math.random` |
| F-W-0..20 disposition audit | All 21 map to concrete diff changes | incl. F-W-11/18 recorded as documented deferrals (comments only — consistent with plan) |

## Findings

### QA-2026-09-24-01: `TribulationDirector.restoreRuntime` is not replacement-complete — stale committed outcome AND leaked ongoing run survive same-session loads

- Severity: **Medium**
- Status: **Confirmed** (two failing reproduction tests)
- Invariant: Replacement / Recoverability (ARCH-001: restore = replacement; loadGame applies the save's state, not union-of-timelines)
- Preconditions: live `TribulationDirector` with a committed-but-undrained outcome (or an ongoing run); a same-session `loadGame`/`restoreFromSave` applying a save whose `tribulation` slice lacks a `committedOutcome` (or carries none at all). Reachable via cloud-pull/resync apply mid-session and any boot-path reload that reuses the director — `saveOps.restoreFromSave` calls `restoreRuntime` unconditionally.
- Reproduction: `src/core/tribulation/TribulationDirector.restoreLeak.qa.test.ts` — (a) restore a committed slice, then `restoreRuntime({})` → `getCommittedOutcome()` still non-null (FAIL); (b) start a real foundation tribulation, then `restoreRuntime(undefined)` mid-run → `getState()` still reports the leaked ongoing run (FAIL).
- Expected: restore replaces — missing `committedOutcome` clears the slot; an ongoing run is lost on load (the file's own persist contract: "Mot run ONGOING co tinh KHONG persist - reload giua tran mat run theo design").
- Actual: `restoreRuntime` writes `cooldownUntil` and (only when present) `committedOutcome`. `this.active`, `this.mind`, `this.tank`, `this.ghost`, `this.chapters`, `this.snapshot*`, `this.playerOwner`, `this.attemptId`, `this.presentationSession` all survive.
- Evidence: two deterministic failing tests; `commitOutcome` keeps `this.active` non-null post-commit (`active.state = outcome`), so a leaked committed outcome also soft-locks `start()` (`cooldown>0 || this.active` guard) until the phantom drain — and the drain applies the leaked consequences: `settleOutcome` early-returns only when `committed.receipt` is already bound, so a leaked commit whose receipt slot is `null` re-runs `resolveVictory`/`resolveDefeat` against the restored player (realm bump + `createTalentEntitlement(..., gameManager.sessionRng)` draw + debuffs) — consequences a save that never ran that tribulation never earned. The leaked ongoing run additionally keeps ticking (`update()` drives `this.active`), can re-commit and overwrite a legit restored commit.
- Test file: `src/core/tribulation/TribulationDirector.restoreLeak.qa.test.ts`
- Owner subsystem: `src/core/tribulation/TribulationDirector.ts` (`restoreRuntime`); consumer `src/core/game/GameManagerSaveRestore.ts:652`
- Blast radius: cross-timeline state pollution on any same-session load; fabricated settlement consequences; tribulation soft-lock until phantom drain. Reachability narrower than boot-load (fresh director is clean) — hence Medium, not High.

### QA-2026-09-24-02: `loseKiemY` residual absorb debits a whole sword per partial residual — asymmetric vs "exactly what the grant delivered"

- Severity: **Low**
- Status: Suspected (code-level; no dedicated failing test — documented bound)
- Invariant: Conservation
- Preconditions: kiemY-grant record exists; at clawback, pool `kiemY < record.kiemY` (e.g. player spent/banked differently, or grant pushed pool over `forgeCost` and forged a sword at purchase).
- Reproduction: `grant_kiemy` node (+5000) bought while `swordPath.kiemY >= forgeCost(realm)-5000` forges a sword at purchase; later respec -> `loseKiemY(5000)` debits the residual pool plus `ceil(residual/forgeCost)=1` whole sword — total clawed exceeds what the grant delivered by up to ~1 `forgeCost` of pre-existing value. The mirror case (pool covers the record) claws exactly the authored amount and leaves grant-forged swords alive only via the residual path — with authored grants all below their realm's `forgeCost` and `kiemDaoBelowCap` prereq on all 9 Cuu Cung nodes, the divergence is bounded to the documented residual-absorb design.
- Expected/Actual: spec says "revoke exactly what the grant delivered"; residual absorb rounds up to a whole sword (documented bound in the impl comment) — the player's own pre-existing pool can be burned ~1 sword-equivalent per respec on kiemY-grant nodes.
- Test file: none (documented bound; magnitude <= ~1 forgeCost per clawback event)
- Owner subsystem: `src/core/kiem-tu/NguKiemDao.ts` `loseKiemY`
- Blast radius: bounded value loss on respec for sword-path players; not exploitable for gain.

### QA-2026-09-24-03: clawback coverage edges (provenance + cascade channels)

- Severity: **Low**
- Status: Suspected (content-dependent; no current content pair triggers them)
- Invariant: Conservation / Exhaustiveness
- Details:
  - `stillGrantedElsewhere` rescans only `effect.unlocksSkillIds` of still-owned nodes — a skill granted by node A via `unlocksSkillIds` and node B via `grantsSkillCoreIds` (core auto-levels the skill) can be unlearned on A's revoke while B's core remains; no current node pair grants one skill across both channels.
  - `switchRoute`'s manual revoke set (75% refund, no `revokeNodeOwnership` cascade) bypasses core cascade — route-tagged nodes carrying `grantsSkillCoreIds` would leak cores; no current route-tagged node has `grantsSkillCoreIds`.
  - Node-first/ritual-second provenance: a node-learned skill makes a later ritual grant no-op (already learned), consuming the ritual's one-shot without a record — respec unlearns the skill and the ritual cannot re-grant. Policy-faithful ("record only what actually fired") but a player-visible corner.
- Test file: none
- Owner subsystem: `src/core/game/GameManagerProgressionOps.ts` `applyOneShotClawback`; `NodeSystem.ts` `switchRoute`
- Blast radius: latent — fires only if future content creates the patterns.

### QA-2026-09-24-04: minor encapsulation/boundary nits

- Severity: **Nit**
- Status: Suspected
- Details: `getCommittedOutcome()` returns the live mutable record (external mutation of the once-only slot possible — existing tests already exploit `committed.settlementError = new Error('boom')`); `EarlyGameSession.writer()` installs `setEquipmentModifiers` as an enumerable own function property on `PlayerData` (JSON-safe — `JSON.stringify` drops functions — but it survives `{...player}` spread clones); `nodeOneShotGrants` validator shape-checks records but does not cross-check keys ⊆ `purchasedNodeIds` (harmless — stale records are never read for un-owned nodes).
- Test file: none
- Owner subsystem: TribulationDirector / EarlyGameSession / saveShapeValidation
- Blast radius: none user-facing today.

## New or Changed QA Tests

- `src/core/tribulation/TribulationDirector.restoreLeak.qa.test.ts` — 2 tests proving QA-2026-09-24-01's two leak manifestations (stale committed outcome; surviving ongoing run). Both fail deterministically on bc80ffef for the intended reason and would pass on a replacement-complete `restoreRuntime`.

## Gaps and Residual Risk

- Full e2e suite (35 specs) not run — verified the two most relevant specs only (save-reload, tribulation-flow). Headless-domain diff; browser surface untouched except SettingsPanel test fix.
- F-W-11/F-W-18 remain documented deferrals by design (comments only) — consistent with the plan's disposition table; flagged as intentional scope, not findings.
- Two-tab/cloud-race restore paths (`CloudSaveCoordinator` mid-session apply) are the practical trigger for QA-2026-09-24-01 outside tests — not exercised end-to-end; reachability recorded as same-session load.

## Pre-existing Failures

- `src/assets/dongFuBuildingPipeline.test.ts`, `src/assets/dongFuBackgroundAssets.test.ts` — `spawnSync magick ENOENT`: ImageMagick missing on this QA box; unrelated to the diff (environment failure).
- (Self-inflicted, fixed): the QA evidence file initially carried two em-dash comment tokens tripping `tests/architecture/asciiComments.test.ts` (P15 ratchet); corrected to ASCII — ratchet green.

---

# Post-Fix Recursion Pass (P5) — 2026-09-24, fix commit `c49f326b`

Per P5 recursion, the production fix for QA-2026-09-24-01 invalidated prior evidence on the tribulation-restore surface; one more pass ran over the fix commit.

## Reviewed state
`c49f326b` on `devin/1790189112-beta-seam-repair` — `restoreRuntime` now calls `clear()` (ends `presentationSession`, nulls `active`/`mind`/`tank`/`committedOutcome`) and resets `ghost`/`snapshotHp`/`snapshotMaxHp`/`snapshotDefense`/`mindFailStacks`/`mindCorrectLightningReduction`/`lightningTalentMultiplier` before applying the slice.

## Findings
None. Field census: every observable runtime field is cleared, reset, or replaced before the slice applies. Residuals `chapters` and `attemptId` are dead data — only read while `active` is set and overwritten at the next `start()` — unreachable, no observable consequence. `presentationMode` is consumer config (not save state) and correctly preserved. No new caller of `restoreRuntime`; `serializeRuntime` unchanged — round-trip and receipt dedup semantics intact. `clear()`'s presentation-session end is UI-facing only and cannot loop back into domain state during restore.

## Verification on c49f326b
- `TribulationDirector.restoreLeak.qa.test.ts`: both former repro tests now PASS (folded into the branch by coordinator).
- `TribulationDirector.persist.test.ts` pin test: PASS (same-session restore clears stale outcome + live run + accepts fresh run).
- Scoped suite (tribulation + composables + save + saveRestore + clawback): 667/667 PASS.
- `npm run type-check`: PASS.

## Closing verdict
**PASS WITH EVIDENCE** — the only Confirmed finding (QA-2026-09-24-01, Medium) is fixed and re-verified; remaining findings are recorded Low/Nit with documented deferral reasons (QA-2026-09-24-02/03/04). Branch is clean for merge to `beta/rc`.
