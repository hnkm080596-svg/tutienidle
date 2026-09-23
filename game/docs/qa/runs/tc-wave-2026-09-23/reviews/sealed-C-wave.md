# SEALED REVIEW — REVIEWER C (INTEGRATION lens)
Run: tc-wave-2026-09-23 · AGGREGATE_REPOSITORY retro sweep
Repo: hnkm080596-svg/tutienidle (public) · app root `game/`
Target: branch `p7/truc-co` @ `b76cc97b24124ae35233958fbcd6384d0b652bb3` (16-mission trúc cơ wave)
Baseline: `origin/master` (merge-base `7808caba2b`, +29,088/−1,479 over 321 files)
Date: 2026-09-23 · Verdict frame: PASS WITH GAPS

`priorFindingsVisible: NO`

---

## 1. Evidence base (what was actually executed)

| Probe | Result |
|---|---|
| `git diff` surface map (all `A`/`M` files, wave missions enumerated) | done |
| `npm ci` | node_modules already provisioned by blueprint snapshot; used in place |
| `npx vitest run` on the 95 wave-changed test files | **95 files / 1557 tests — all green** (~13 s) |
| `TrucCoJourney.test.ts` alone | 9/9 green |
| `npm run type-check` (vue-tsc --build) | clean, exit 0 |
| Static trace: GameManager init/tick/save/restore wiring for every wave-added module | done |
| Static trace: restore assembly order, funnel suppression, policy composition, settle/drain contracts | done |

---

## 2. Findings index

| id | severity | tag | location | summary |
|---|---|---|---|---|
| C-01 | Medium | SEAM | EarlyGameSession.ts:368 vs TribulationOutcomeService.ts:425 | Harness runs tribulations equipped; production strips gear at admission — parity hole. |
| C-02 | Low | SEAM | TribulationDirector.ts:566/576; saveTypes.ts (absent) | committedOutcome + defeat cooldown never persisted; save between commit and settle drops the finished tribulation. |
| C-03 | Low | SEAM | QuestSystem.ts:211-288 vs BattleLootSystem.ts:554-573 | Quest-claim drop filter lacks `isDomainScopedAcquisitionEnabled`; latent artifact-domain bypass channel. |
| C-04 | Low | RESIDUAL | StageWaveSystem.ts:255 | `stage.requiredRealmId ?? 'qi_refining'` silently bands mis-authored stages into the hidden-beast pool. |
| C-05 | Nit | RESIDUAL | GameManager.ts:1358; BreakthroughScopedResources.ts:12 | truc_co_dan is presence-checked, never consumed — "consumes" comment wrong; dead inventory post-TC. |
| C-06 | Nit | RESIDUAL | BattleLootSystem.ts:447 vs StageWaveSystem.ts:252-261 | Hidden-beast kill counter increments on idle auto-farm kills though substitution is ACTIVE-only. |
| C-07 | Nit | RESIDUAL | EarlyGameSession.ts (onAdvance) vs GameManagerTickOps.ts (invest tick) | Harness battle advance omits per-tick auto-investBodyChapter — mid-battle state parity gap. |

---

## 3. Findings — detail

### C-01 — Harness tribulation path bypasses the production admission prep [SEAM · Medium]

**Location:** `src/core/simulation/earlygame/EarlyGameSession.ts:364-385` calls `gameManager.startTribulation(this.player, targetRealmId)` directly after a `canTriggerBreakthrough` precheck. `src/core/tribulation/TribulationOutcomeService.ts:420-432` defines `startTribulationPrepared` — `unequipAllEquipment()` + `player.setEquipmentModifiers(...)` **then** `gameManager.startTribulation` — which is what `useTribulation.triggerBreakthroughAction` (lines 66-70, 82-86) invokes in production. `src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts:103` uses the same bypassing seam.

**Evidence kind:** runtime-pinned divergence + code path. The wave's own committed suite pins the gap rather than fixing it: `TrucCoJourney.test.ts:418-419` asserts equipment modifiers are still present on the player **after** `runTribulation` returns (i.e. throughout the simulated fight), and lines 454-460 assert gear is stripped only at settle (`resolveVictory` line 249). So in the harness the ghost tank snapshot at `startTribulation` resolves `resolveAmbientPlayerStats` **with** equipment modifiers; in production the same snapshot resolves post-strip (GameManager.ts:1363-1366 runs after the unequip).

**Reasoning chain:** the wave's spec "do kiep cung la do than" (naked ascension) is enforced at *admission*, not at settle. Any harness-driven tribulation therefore fights with stats a production player never has inside the attempt — gear contributes might/defense/HP the ghost shouldn't see. Today the blast radius is small (TrucCoJourney pins FIXTURE_LQ_STATS that dwarf gear; EssenceSubstitutionEconomy measures arcs, not difficulty) — but the seam advertises a production-parity contract ("mirrors that contract so a journey can't drive a tribulation the game would never admit") while systematically producing fights the game would never run. It also skips the admission-side `setEquipmentModifiers` resync, so harness modifier-state transitions differ from production one step earlier. At wave scale this makes the harness vacuous specifically for tribulation-difficulty and pre/post-equipment evidence — the exact class of thing the journey mission exists to pin.

**Suggested repair owner:** `EarlyGameSession` (simulation harness) — route `runTribulation` through `startTribulationPrepared`; the journey test's pre-settle equipment assertion then becomes vacuously true and can be deleted or inverted (assert stripped *during* the run).

---

### C-02 — Committed tribulation outcome and defeat cooldown are director-local; a save between commit and settle silently discards a completed run [SEAM · Low]

**Location:** `TribulationDirector.ts:566` (`committedOutcome`), `:576` (`cooldownUntil`). Neither appears in `saveTypes.ts`/`SaveSystem.ts`/`saveShapeValidation.ts` (grep: no tribulation payload is persisted; only `player.pendingTalentEntitlement`, `companionGifts`, `hiddenBeastKills` are — validated at saveShapeValidation.ts:336-450, 786, 815-818).

**Evidence kind:** code inspection + save-shape negative-space audit (Suspected; no runtime repro built).

**Reasoning chain:** `commitOutcome` stamps the once-only settlement record; `checkTribulationOutcomeAction` (useTribulation.ts:148-160) settles it on the *next* tick. An auto-save or unload in that window captures pre-settle state (player still in old realm, no entitlement) — on reload `getCommittedOutcome()` is null, the completed tribulation is gone, and the player simply re-runs it. Cost is bounded: `truc_co_dan` is presence-checked, never consumed (C-05), so nothing is lost but the replay itself; post-settle state (realmId, `pendingTalentEntitlement`, gifts) is persisted and survives. The same non-persistence makes `cooldownUntil` (defeat lockout) reload-skippable — a defeated player restarts the client and retries immediately. Within the wave this is newly load-bearing because the settle/drain split (M-F-TALENT's held drain) widened the post-commit lifetime — though the actual window remains ~1 tick, keeping severity Low.

**Suggested repair owner:** `TribulationDirector` + `saveTypes` — persist `committedOutcome` (attemptId/outcome/target/grade, receipt-free) or a cheaper "pending outcome" marker, and `cooldownUntil`; or explicitly accept-and-document the discard.

---

### C-03 — Quest-claim drop filter omits the domain-scoped acquisition check [SEAM · Low]

**Location:** `QuestSystem.ts:211-288` applies `isBreakthroughAcquisitionEnabled` (lines 220, 268) and `isCompanionPullTokenSourceSuppressed` (226) to reward item drops. `BattleLootSystem.ts:554-573` applies those plus `isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId, player.realmId)` (the M-F-ARTIFACT-DEFER third filter).

**Evidence kind:** code inspection; latent (no current trigger — grep shows the only authored quest `itemDrops` material is `chieu_hien_lenh`, which is covered by the token filter; `doan_bao_thach` is the sole domain-scoped material and appears in no quest reward).

**Reasoning chain:** the wave's `VISIBLE_GRANT_SOURCES` census declares quest-grant a legitimate delivery channel, and the claim path was retrofitted with the other two release-policy filters — the domain filter was missed. Today it cannot fire; the moment a quest rewards `doan_bao_thach` (or any future `domainUnlockRealmId` material), the claim path delivers it to a player below the artifact-domain realm — the only channel that would. Same single-check-at-origination invariant the loot path honors.

**Suggested repair owner:** `QuestSystem.claim` — add the third `continue` beside lines 226; optionally pin with a data test asserting claim-filter parity with `BattleLootSystem`.

---

### C-04 — Hidden-beast band falls back to `qi_refining` when a stage lacks `requiredRealmId` [RESIDUAL · Low]

**Location:** `StageWaveSystem.ts:255` — `maybeReplaceSpawn(this.activeStagePlayer, stage.requiredRealmId ?? 'qi_refining', rng)`.

**Evidence kind:** code inspection (Suspected/coverage; data tests pin `requiredRealmId` on every authored stage today — `ChapterStages.ts:99`, `Zones.ts:24` — so the fallback is dead-until-regressed).

**Reasoning chain:** spec §4.1c restricts substitution to Luyen Khi stages + the 1000-kill window. A stage authored without `requiredRealmId` would silently enter the qi_refining band and substitute Huyet Mong — masking the data bug behind a plausible-looking spawn instead of failing closed. The neighboring combat override (line 212) correctly treats absence as "leave the enemy's own realm"; the band default invents a realm instead.

**Suggested repair owner:** `StageWaveSystem` — pass `stage.requiredRealmId` through undefined (no band → no substitution), and/or a data-shape assert making the field required.

---

### C-05 — `truc_co_dan` is presence-checked, never consumed [RESIDUAL · Nit]

**Location:** `GameManager.ts:1358` (`pillBag.has(TRUC_CO_DAN_PILL_ID, 1)`); no `pillBag.remove`/`removePill` of this id exists anywhere in core (grep). `BreakthroughScopedResources.ts:12` comments "Pill the Truc Co breakthrough gate consumes (hasTrucCoDan check)".

**Evidence kind:** code inspection.

**Reasoning chain:** the pill is a permanent grade input: once held, every attempt reads `hasTrucCoDan === true` forever, including post-TC where it becomes dead inventory. If the design intends consumption-per-attempt, the gate is currently free-ridable; if it intends a one-time key, the census wording ("consumes") misleads. Either way it's documentation/behavior ambiguity, not a break — the journey pins x1 held for one victory and never re-attempts.

**Suggested repair owner:** `GameManager.startTribulation` (consume on start, if intended) or `BreakthroughScopedResources` comment fix.

---

### C-06 — Idle auto-farm kills increment the hidden-beast window [RESIDUAL · Nit]

**Location:** `BattleLootSystem.ts:447` calls `hiddenBeastSystem.onEnemyDefeated` per kill — including kills produced by `rollAutoFarmCycleReward` on the 'idle' channel — while the substitution spawn (`StageWaveSystem.ts:252-261`, `maybeReplaceSpawn`) is gated on `activeStagePlayer` (ACTIVE only, set/cleared at :87/:116/:141).

**Evidence kind:** code inspection (spec ambiguity — the window "counts kills"; whether idle kills were meant to warm it is not stated).

**Reasoning chain:** overnight auto-farming accumulates the 1000-kill window without any ACTIVE play; the next active LQ stage substitutes almost immediately. If the bound/farm design intended the window to reflect deliberate farming, idle kills inflate it; if it's a pure kill counter, this is by design. Flagging because the two halves of the channel treat the same kill differently (counted, never substitutable) and no test pins which behavior is intended.

**Suggested repair owner:** `HiddenBeastSystem` / `BattleLootSystem` — either filter `onEnemyDefeated` to active-channel kills or pin the intended asymmetry in a comment/test.

---

### C-07 — Harness in-battle advance skips the per-tick auto-invest [RESIDUAL · Nit]

**Location:** `EarlyGameSession` battle-advance cultivates and breakthroughs mid-fight but does not run `tickOps.update`'s `investBodyChapter(player)` (which in production invests the refinement chapter every frame); harness investment happens only via `drainRefinement` at stage boundaries (self-documented in the file).

**Evidence kind:** code inspection (acknowledged harness seam; coverage nit).

**Reasoning chain:** production auto-invests each tick so stat deltas land between battles continuously; the harness converges the same progression only at stage boundaries. Mid-battle impact is nil in both (the battle snapshot is taken at battle start), so this is purely a cadence-fidelity nit — but it means a battle-advance harness can leave a refinement tier one stage behind where a real session would already be invested, skewing any future difficulty evidence that runs at the boundary.

**Suggested repair owner:** `EarlyGameSession` — call the same invest seam inside `onAdvance`, or document the divergence as intentional.

---

## 4. Surfaces audited with NO finding (condensed)

- **Boot/wiring completeness:** every wave-added module is reachable at runtime — `ReleasePolicy` composed in 4+ gate families; `ZhouTianChapter` registered in the chapter table, tick-invested, and surfaced via `ZhouTianSection` (RealmPanel.vue:142); `BodyPerfection` (core) reachable via the `notifyMaterialGained` funnel, `perfectBodyRealm` op, save preflight (GameManagerSaveRestore:299), and `BodyPerfectionSection` (RealmPanel.vue:149); `TalentEntitlement` wired settle→modal(GameRoot.vue:163)→`resolveTalentEntitlement`; `CompanionGifts` fired at both authored moments (realmAdvanceOps:170-172 realm_entered; BattleRewardOps:174 stage_completed, inside the once-guard); gift claims via `QuaTangTab` (WorkerLodgePanel.vue:114) → `claimCompanionGift`; `BodyChapterEssenceSubstitution` applied inside `investBodyChapter` (realmAdvanceOps:588-644); `HiddenMaterialChannels`/`HiddenBeastSystem` wired spawn-side and kill-side; breakthrough censuses consistent both directions; `SysPanel`/`SysBar`/`SysStat`/`SysTag`/`useSystemRimAuthority` mounted. No wave subsystem was found unit-tested but undriven — the P13 failure mode is absent at wave tip.
- **Restore assembly:** `preflightSaveRegistryReferences` (which includes the technique-holder contract, body-progression and body-perfection integrity asserts) runs at `SaveSystem.ts:272` BEFORE `player.restoreFromSave` mutates the store — a corrupt slice fails with zero owner mutation; it re-runs defensively inside `restoreFromSave` before the `lastAppliedPayloadHash` commit at method end (mid-restore throw leaves the payload uncommitted → retry re-applies). Order: skills/techniques → bags → invalidatePendingOperationTickets → materials/pills/equipment (auto-dissolve WITHOUT the funnel — deliberate, commented at line 477-479) → slots → modifiers → buildings → questManager → production → decompose → offline settle (production/decompose/auto-farm outputs DO route through the funnel — intended, offline production counts) → auto-farm lease re-acquire → alchemy restore+settle → `applyAllBodyModifiers` → `reconcileQuestLifecycle` LAST → hash commit. No cross-mission restore read-order violation found.
- **Tick ordering:** `update()` sequence is coherent — daily reset precedes production; production/decompose settlement events drain through the funnel; essence landing this tick is investable next tick (1-tick lag only); `markQuestRealmTransition` flag converges realm-entry quest activation.
- **Cross-mission chains:** loot path applies all three release-policy filters; alchemy recipe `alchemy_truc_co_dan` gated by `isBreakthroughAcquisitionEnabled` (AlchemyOps:83); breakthrough admission = level + chapterClear rows, `isRealmTransitionEnabled` adjacency (TC→KD closed at the ceiling); `startTribulation` itself is caller-trust but every reachable caller gates; respec is battle-gated with preserved commit-marker node ids and probe-first JSON-clone preflight; invest is probe→plan→debit→apply atomic; gifts and entitlements are write-if-absent idempotent; settle receipts bind once-only to attemptId.
- **Duplicate init / cleanup:** single `setActivePlayer` in `restoreGameSession`; stateless `TribulationOutcomeService` per call; `director.clear()` drains once behind the curtain; `settleOutcome` re-settles onto the same bound receipt (dup ticks are no-ops); `resolveDefeat` correctly does not re-strip gear (already stripped at admission; post-defeat gear state is consistent).
- **Auto-farm:** lease identity + eligibility re-check on every restore; `isValidCycleSeconds` guard; 24 h cap; try/finally channel restore around `processDefeatedEnemies`.
- **Deliberate dormancy (not defects):** `BODY_PERFECTION_REALM_MATERIALS` all empty + `HIDDEN_MATERIAL_CHANNELS` shipping only `huyet_mong` are the M-F-CONTENT-TC deferral — wired seams, authored content later; `isCompanionPullPoolEnabled() = false` suppresses the pull faucet but keeps gift-channel claims.

## 5. Access limitations

- Public repo; cloned and audited locally — full source available, nothing withheld.
- No access to Reviewer A/B outputs or the dispatch corpus beyond this brief (by design — sealed).
- Runtime evidence limited to headless Vitest (wave scope + journey) and `vue-tsc`; no Playwright/browser session was launched, so Vue/Phaser surface behavior was verified statically (mount points, composable contracts) rather than visually.
- Production database/live saves unavailable — save-path conclusions rest on shape validation + restore code, not on a real persisted blob.
- `npm ci` was satisfied by the pre-provisioned blueprint `node_modules`; dependency-graph edge cases of a cold install were not exercised.

## Attestation

I did not view any prior findings for this run before or during this audit. `priorFindingsVisible: NO`
