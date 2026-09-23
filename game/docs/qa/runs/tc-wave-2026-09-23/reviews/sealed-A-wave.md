# SEALED REPORT — Reviewer A (CORRECTNESS)

- **Run:** tc-wave-2026-09-23 (AGGREGATE_REPOSITORY retro sweep)
- **Target:** `hnkm080596-svg/tutienidle` @ `b76cc97b24124ae35233958fbcd6384d0b652bb3` (`p7/truc-co` wave tip — merged M-QI-09/10, REALM18, RESPEC, CEILING, BODY-CORE, TECHNIQUE, TALENT, ESSENCE, UI-SYSTEM, COMPANION-GIFT, ARTIFACT-DEFER, CHU-THIEN, BODY-PERFECTION, BODY-HIDDEN, JOURNEY)
- **Baseline:** `origin/master` (diff: 321 files, +29088/−1479)
- **App root:** `game/` — `npm ci` clean (638 pkgs); probes run under vitest v4.1.11.
- **priorFindingsVisible: NO**
- **Evidence artifact:** `game/src/core/progression/sealed-wave.probes.test.ts` (uncommitted, test-only per QA write boundary — green; assertions capture executed defect values).

---

## INDEX

| id | severity | tag | file:line | summary |
|----|----------|-----|-----------|---------|
| A1 | **High** | [SEAM] | `game/src/core/progression/NodeSystem.ts:485` + `game/src/core/game/GameManagerProgressionOps.ts:322` | Respec refunds 100% Insight but never claws back one-shot grants — executed: free Kiem-Y forging and free skill unlocks. |
| A2 | Medium | [SEAM] | `game/src/core/game/GameManagerRealmAdvanceOps.ts:~340` × `game/src/core/tribulation/TribulationOutcomeService.ts:242` | Initiation ritual skips `pourCultivationOvercharge` — Hai Nap bank pours one realm late at foundation entry. |
| A3 | Medium | [SEAM] | `game/src/composables/useTribulation.ts:216` × `game/src/core/talent/TalentEntitlement.ts:155` | Settlement-error drain skips the entitlement gate; stale pending record silently swallows the NEXT victory's entitlement. |
| A4 | Medium | [SEAM] | `game/src/composables/useTribulation.ts:162` + `game/src/components/panels/CharacterPanel.vue:37` | Reload during entitlement deferral loses the `quan_khi` panel hook; no re-entry for unchosen mortals — re-run tribulation is the only recovery, unsignposted. |
| A5 | Low | [RESIDUAL] | `game/src/services/save/saveTypes.ts:267` | `hiddenChannelCycles` written, validated, restored — but undeclared on `ProductionSiteStateSave` (v81 declaration gap). |
| A6 | Low | [RESIDUAL] | `GameManagerTickOps.ts:205`, `AlchemySystem.ts:418`, `NodeSystem.ts:287`, `TalentEntitlement.ts:153`, `HiddenBeastSystem.ts:47` | Wave-introduced unseeded `Math.random` reaches persisted PillBag / nodeFreePurchaseRecord / entitlement offers / hiddenBeastKills — save state not replayable. |
| A7 | Low | [RESIDUAL] | `game/src/core/buff2/BuffPersistence.ts` + `game/src/data/buff/buffs.ts:26` | Kiếp Thương defeat debuff lives in the unsaved buff2 pool — a reload inside its 60s window clears the penalty. |
| A8 | Nit | [RESIDUAL] | `game/src/services/save/saveShapeValidation.ts:459` + `game/src/core/game/GameManagerSaveRestore.ts:536` | `autoWorkerCapacity` trusted from payload when no CHQ instance exists — crafted saves get phantom workers. |
| A9 | Nit | [RESIDUAL] | `game/src/services/save/saveShapeValidation.ts:855` | `formationLoadout.assignments` shape-checked but not uniqueness/bounds-checked — malformed loadout reaches `resolvePartyFormation` blindly. |

---

## F-A1 — Respec never claws back one-shot node grants (duplicated Kiem Y, free skill unlocks)

- **Severity:** High
- **Tag:** [SEAM] — `M-F-RESPEC` × Kiem Tu (Cuu Cung grants, spec K20) / Phap Tu (`linh_ngo_*` unlocks)
- **Location:** `game/src/core/progression/NodeSystem.ts:485-527` (`revokeNodeOwnership`), `game/src/core/progression/NodeSystem.ts:672` (`respecNodeTree`), `game/src/core/game/GameManagerProgressionOps.ts:322-328` (grant call sites), `game/src/data/progression/KiemTuNodes.ts:324-361` (grant data)
- **Evidence:** executed — `src/core/progression/sealed-wave.probes.test.ts` (green; assertions pin the defect's actual values)

**Reasoning chain.** `purchaseNode` fires one-shot effects on the 0→1 transition: `unlocksSkillIds` → `learnSkill`, `grantsSkillCoreIds` → `grantSkillCore`, `selectsSpecialization`, `kiemYGrant` → `gainKiemY`, `kiemDaoGrant` → `grantKiemDao` (GameManagerProgressionOps.ts:296-328). The respec pipeline (`respecNodeTree` → `respecApply` → `revokeNodeOwnership`) refunds 100% of paid Insight and revokes ownership, cascading only `grantsSkillCoreIds` cores (NodeSystem.ts:518-524) — the one-shot grants `kiemYGrant`/`kiemDaoGrant`/`unlocksSkillIds`/`selectsSpecialization` are not reverted. Buy → respec → rebuy therefore re-fires them at zero net Insight.

**Executed repro.**
- Sword player (`hidden_sword_pathway`, `foundation_establishment`, cap 3 / forgeCost 12999): 4 × (buy `cuu_cung_kham` → `respecNodeTree` → node gone, insight fully refunded) yields `kiemY = 7001`, `kiemDaoCount = 2`, `skillInsight` unchanged at 50. The K20 comment ("at cap nothing here is purchasable, so no Kiem Y can pool past the sword cap") is honored at purchase time but bypassed by respec — the grant is banked before revocation and never recovered; each realm's raised cap then lets the banked pool forge to cap for free. The intended grind (one palace grant per realm + `ngu_kiem_thuat` cast income) is replaced by a free cycle.
- Spell player (`spell_pathway`, `golden_core`): `selectSpellPathElement('fire','dot')` → buy `linh_ngo_<special>` → respec revokes the keystone and refunds its full cost while `specialId` + `ultimateId` stay learned — a free permanent unlock, repeatable per keystone.
- `selectsSpecialization` likewise survives (spec choice outlives the revoked node) — lower impact, same hole.

**Suggested repair owner:** M-F-RESPEC — `revokeNodeOwnership`/`respecApply` is the clawback site (it already owns the `grantsSkillCoreIds` cascade); either extend the lifecycle tie to `kiemYGrant`/`kiemDaoGrant`/`unlocksSkillIds`/`selectsSpecialization` (Kiem Y reversal needs a domain entry like `loseKiemY` on `NguKiemDao`), or record one-shot grants on the ownership record at purchase so respec can reverse them generically. Kiem Tu owns the domain reversal semantics; the guard K20 (`kiemDaoBelowCap`) cannot be the fix since it evaluates at purchase time only.

---

## F-A2 — Initiation ritual skips `pourCultivationOvercharge` (banked Hai Nap pours one realm late)

- **Severity:** Medium
- **Tag:** [SEAM] — `M-F-TALENT` (ritual restructure) × `CultivationSystem`/Hai Nap
- **Location:** `game/src/core/game/GameManagerRealmAdvanceOps.ts` mortal-commit block (~line 340: `realmId='qi_refining'`, `realmLevel=1`, `cultivation=0`); contrast `game/src/core/cultivation/CultivationSystem.ts:42-51,75` and `game/src/core/tribulation/TribulationOutcomeService.ts:242`
- **Evidence:** source-proof (exhaustive call-site audit — `pourCultivationOvercharge` has exactly two call sites: `breakthrough()` minor-tier and `resolveVictory` major-realm; the ritual is the third realm write and has none)

**Reasoning chain.** `pourCultivationOvercharge` drains persisted `player.cultivationOvercharge` into the new level's cultivation (capped at that level's requirement, leftover stays banked). Every realm/level-write seam calls it — except `chooseCultivationPath`, which writes `realmId='qi_refining'`, `realmLevel=1`, `cultivation=0` in its mortal-commit block without pouring. A mortal holding Hai Nap banks overflow at the mortal cap; the ritual is the actual realm transition but the bank survives untouched and lands at the next caller — the foundation_establishment tribulation victory — pouring into *foundation* level 1 instead of *qi_refining* level 1. Player-visible: cultivation arrives one realm late, applied against the wrong realm's requirement curve. Deterministic, always reproducible; magnitude small (the bank is finite). May have been masked by the (correct) earlier ruling that the ritual is "feature unlock, not breakthrough" — but the pour is attached to the realm *write*, not to the breakthrough ceremony.

**Suggested repair owner:** M-F-TALENT / `chooseCultivationPath` — call `pourCultivationOvercharge(player)` right after `cultivation = 0` in the mortal commit block (same placement as `resolveVictory` line 242).

---

## F-A3 — Settlement-error drain bypasses the entitlement gate; a stale record swallows the next victory's entitlement

- **Severity:** Medium
- **Tag:** [SEAM] — `M-F-TALENT` entitlement lock × M6 committed-outcome drain
- **Location:** `game/src/composables/useTribulation.ts:162-233` (the `committed.settlementError` branch at 216-233 skips the `pendingTalentEntitlement` check that the success path applies at 174-177), `game/src/core/talent/TalentEntitlement.ts:150-157` (`createTalentEntitlement` returns the already-pending record untouched)
- **Evidence:** source-proof (path composition); reachability requires a mid-apply throw — narrow but real, the drain branch exists for exactly that case

**Reasoning chain.** `settleOutcome` marks a record `settlementError` when `resolveVictory` throws mid-apply (TribulationOutcomeService.ts:165-169). `resolveVictory` writes `pendingTalentEntitlement` at step 2 (line 204) — before realm writes — so a throw at any later step leaves a persisted pending record AND a failed run. The failure drain (`drainFailedRun`, useTribulation.ts:217-222) runs `director.clear()` unconditionally — no `reconcileTalentEntitlement`, no pending gate — so the record outlives the drained run and the uncancellable modal still presents it (globally mounted, `TalentEntitlementModal` on `GameRoot`). The NEXT tribulation's `resolveVictory` calls `createTalentEntitlement`, which returns the stale record (TalentEntitlement.ts:155-157 — "the receipt-level dedup makes this unreachable on the live seam" is true only per-receipt, not across runs): victory N+1 draws no offers and binds to victory N's `realmId` pool. Result: two committed victories yield one entitlement, and the deferred drain then holds the *new* run's committed outcome hostage to the *old* record (the modal does resolve it — so gameplay continues, but victory N+1's talent silently never happens). The same partial-apply survivors include the already-landed `applyLoiKiepVictoryBonus` stack (step 1) — a failed settle keeps its +10%.

**Suggested repair owner:** M-F-TALENT — make `createTalentEntitlement` supersede when `existing.realmId !== facts.targetRealmId` (or drain-time reconcile must resolve/clear the record before `director.clear()` in the error branch); simplest correct change is in the error drain ordering.

---

## F-A4 — Reload during entitlement deferral loses the `quan_khi` presentation hook (mortal has no path-choice re-entry)

- **Severity:** Medium
- **Tag:** [SEAM] — `M-F-TALENT` drain deferral × outcome presentation (`standalonePanel`)
- **Location:** `game/src/composables/useTribulation.ts:162-205` (deferral + `presentOutcome` inside `consumeReceipt`), `game/src/core/tribulation/TribulationOutcomeService.ts:207-223` (qi_refining early-return emits `standalonePanel:'quan_khi'` as the entire progression surface), `game/src/components/panels/CharacterPanel.vue:37` (`showQuanKhiEntry = isActivePath(player,'sword')` — sword-path only), `game/src/components/panels/QuanKhiPanel.vue:7-9` (panel self-gates nothing)
- **Evidence:** source-proof (volatility + gating audit); the reload-window is inferred reachability, the mechanism is fully source-proven

**Reasoning chain.** `getCommittedOutcome()` is memory-only (TribulationDirector.ts:566) — the committed record is stamped at commit and lives until `director.clear()`. For a `qi_refining` victory, `resolveVictory` deliberately writes *no* realm state — its entire transaction surface is `pendingTalentEntitlement` (persisted) plus `standalonePanel:'quan_khi'` (ephemeral). While the entitlement is pending, the drain is deferred (committed record retained). A reload in that window: the save carries the pending record (validator accepts it — `isTalentEntitlementActionable` guard), the modal re-presents and resolves fine, but the committed outcome — and with it `presentOutcome` → `openStandalonePanel('quan_khi')` — is gone. The mortal sits at max level with `cultivationPath === null` and no UI entry back to the ritual: CharacterPanel's entry is sword-only, the command-wheel slot was removed. The path choice itself is recoverable — `canTriggerBreakthrough` still passes at mortal cap, so re-running Quan Khi re-issues the whole sequence — but nothing in the UI tells the player this, and the announcement says the ritual is ready.

**Suggested repair owner:** `M-F-TALENT` (outcome/drain) or panel gating — e.g. extend `showQuanKhiEntry` to `cultivationPath == null && mortal-at-cap`, or persist a `ritualPending`-style flag so restore can re-emit the panel.

---

## F-A5 — `hiddenChannelCycles` written/validated/restored but undeclared on `ProductionSiteStateSave`

- **Severity:** Low
- **Tag:** [RESIDUAL] — `M-F-BODY-HIDDEN`
- **Location:** `game/src/services/save/saveTypes.ts:267-283` (declared shape omits it) vs `game/src/services/save/SaveSystem.ts:376` (writer emits it), `game/src/services/save/saveShapeValidation.ts:1334-1340` (validator requires/validates it), `game/src/core/production/ProductionTypes.ts:87` (runtime type declares it), `game/src/core/production/ProductionSystem.ts:146-161` (restoreStates consumes it)
- **Evidence:** source-proof

**Reasoning.** The v81 per-site `hiddenChannelCycles` map is emitted by the save writer (inside the `.map()` object literal — structural widening means TS's excess-property check never fires on the inferred map result), required by the shape validator, and restored verbatim — so today's round-trip is correct and `computeRestoreIdentity` covers it (it hashes the emitted objects). The declaration gap is a drift hazard: any consumer reading the declared type (docs, migrations, other validators, typed tooling) sees a wrong schema, and the next v82+ edit can silently diverge.

**Suggested repair owner:** `M-F-BODY-HIDDEN` — add `hiddenChannelCycles?: Record<string, number>` to `ProductionSiteStateSave`.

---

## F-A6 — Wave-introduced unseeded `Math.random` reaching persisted state

- **Severity:** Low
- **Tag:** [RESIDUAL] — spans `M-F-ESSENCE` (alchemy), `M-F-RESPEC` (Van Dao waive), `M-F-TALENT` (offer draw), `M-F-BODY-HIDDEN` (beast spawn)
- **Locations / evidence:** source-proof
  - `game/src/core/game/GameManagerTickOps.ts:205` — `alchemySystem.tick(..., Math.random, ...)` extra-pill roll every tick → persisted `pillBag`
  - `game/src/core/alchemy/AlchemySystem.ts:418` — `settleOffline` passes `Math.random` again → same persisted bag; jobs carry no `rollSeed` (contrast production cycles' persisted `rollSeed` + `GROTTO_CHANNEL_SEED_TAG`; `alchemyMulberry32` is exported but unused)
  - `game/src/core/progression/NodeSystem.ts:287` — `rollVanDaoWaive` → `Math.random` → persisted `nodeFreePurchaseRecord` (drives refund accounting on respec — so an unseeded roll changes refund math)
  - `game/src/core/talent/TalentEntitlement.ts:153` — `drawBreakthroughTalentOffers` default `Math.random` → persisted `pendingTalentEntitlement.offeredTalentIds` (asserted by the shape validator)
  - `game/src/core/game/HiddenBeastSystem.ts:47` — `maybeReplaceSpawn` default `Math.random` → feeds persisted `hiddenBeastKills` counters

**Reasoning.** The project's stated convention ("loot/economy `Math.random` stays unseeded BY DESIGN — a seeded battle must not pin drops", EarlyGameSession.ts:9-11) covers drop *rolls*, but these four sites write their outcomes into *persisted or validator-asserted* state: same-seed replay / save-time-hash / sim fingerprints cannot pin them, and the `EarlyGameSession` seeded surfaces (`setLootRng`, `setBattleRngFactory`) don't reach them. Not exploitable — a replay/determinism regression rather than a cheat. The alchemy channel is the most consequential: every tick and every offline settle draws unseeded numbers that become persisted pill counts.

**Suggested repair owners:** per-site missions; alchemy likely wants the production pattern (job carries a `rollSeed` snapshot; deterministic settle) or at minimum an injectable rng dep threaded through `tickOps`/`settleOffline` so the sim can pin it.

---

## F-A7 — Kiếp Thương debuff is unsaved; a reload inside its 60s window erases the defeat penalty

- **Severity:** Low
- **Tag:** [RESIDUAL]
- **Location:** `game/src/data/buff/buffs.ts:17-32` (def: −15% might/def, `duration: 60`, seconds clock), `game/src/core/tribulation/TribulationOutcomeService.ts:382` (`applyPersistentBuff(KIEP_THUONG_DEBUFF)`), `game/src/core/buff2/BuffPersistence.ts` (no serialize/restore seam — `grep` confirms no GameSave slice touches it)
- **Evidence:** source-proof

**Reasoning.** `resolveDefeat` applies the debuff into the buff2 persistent pool — runtime-only. Nothing serializes active instances (`persistentTimedEffects` is a different, timed-effect channel). A reload inside the 60s window clears the penalty entirely. Magnitude is small (60s, −15%), and the def's `lifetime.clock:'seconds'` was always designed as session-scoped — but the defeat penalty specifically benefits from being escapable via reload. Pre-existing gap, still live at the wave tip.

**Suggested repair owner:** tribulation/buff2 (long-standing); if the penalty must survive reload it needs a persisted slice, else document it as intentionally session-scoped.

---

## F-A8 — `autoWorkerCapacity` trusted from payload when no CHQ instance exists

- **Severity:** Nit
- **Tag:** [RESIDUAL] — crafted-save hardening
- **Location:** `game/src/services/save/saveShapeValidation.ts:459` (non-negative only), `game/src/core/game/GameManagerSaveRestore.ts:534-541` (`refreshAutoWorkerCapacity` only runs `if (chiHienQuan)`)
- **Evidence:** source-proof

**Reasoning.** The restore comment acknowledges the saved capacity can be stale and re-derives from the CHQ formula — but only when an instance exists. A crafted save with `autoWorkerCapacity > 0` and no `chi_hien_quan` keeps the phantom capacity into `decomposeSystem.updateCapacity`/`resolveProductionWorkerCapacity`. Legitimate saves can't hit this (capacity only ever comes from CHQ), so it's a validator-depth question, not a reachable bug — worth a one-line consistency check.

**Suggested repair owner:** save-validation boundary.

---

## F-A9 — `formationLoadout.assignments` not uniqueness/bounds-checked

- **Severity:** Nit
- **Tag:** [RESIDUAL] — crafted-save hardening
- **Location:** `game/src/services/save/saveShapeValidation.ts:851-884`
- **Evidence:** source-proof (the comment admits `resolvePartyFormation` "maps .assignments blindly")

**Reasoning.** Shape checks cover `formationId` (non-empty string) and `assignments[]` entries (`combatantId` string, `row`/`column` integers) — but no combatantId-uniqueness or row/column bounds check. A malformed crafted save can double-assign one combatant or place off-grid; grant-time dedup mitigates the real path. Nit per the validator's own scope comment.

**Suggested repair owner:** save-validation boundary.

---

## Cleared / verified-clean seams (investigated, no defect)

- **v73–v81 "migration chain":** every version rejects its predecessor (`dev phase, no migration`) — the chain is a rejection chain, not a transformer chain. No migration-correctness surface exists to audit beyond that; declared-vs-persisted parity was audited instead (only F-A5 found).
- **Restore order:** quest restore (544) precedes production restoreStates + offline settle (550-598) → `deliverDecomposeOutput → notifyMaterialGained` replays offline deliveries into collect-quests and perfection discovery *after* quest restore — deliberate and consistent (decompose pending output is a genuine new landing). Production offline settle's `pendingEvents` drain into the same funnel on the first post-restore tick; autoFarm offline rewards route through `processDefeatedEnemies → notifyMaterialGained` too. Funnel coverage is symmetric.
- **Technique mastery flush vs realm seal:** `settleTechniqueMastery` runs inside `tickOps.updateBattleFixedStep` at terminal, *before* `checkTribulationOutcomeAction`/`settleOutcome` runs `sealFrozenCycle` — mastery trains at the departing realm, then seals. Correct ordering.
- **Technique holder preflight vs domain:** `getTechniqueRankCeiling = min(18, realmLevel)` iff `grade === realmIndex` else 0; `gainMastery` cascade + zero-at-ceiling + consume-only-needed is consistent with the save validator's `gradeHistory`/`rank`/`mastery` contract. No falsification found.
- **Ritual unequip:** `chooseCultivationPath` is authored as feature-unlock, not auto-unequip (locked by `GameManager.realmAdvanceUnequip.test.ts`, QA-2026-09-02-001 resolved by redesign) — not a defect.
- **`zhou_tian` auto-invest:** deliberate manual-invest only (authored comment; tick invests `body_refinement` only). Not a gap.
- **`switchRoute` orphan cascade:** route-tagged nodes are leaves prereq'd on element roots — no untagged descendants exist to orphan. Verified against `PhapTuNodes.builders.ts`.
- **`startTribulation` while committed:** `director.start` rejects when `this.active` is set (state survives until drain) — a second run cannot overlap the pending-entitlement window via the real entry path.
- **`companionGifts` idempotency:** `issueCompanionGifts` is write-if-absent; `realm_entered` fires after the realm write; claim path is separate. Clean.
- **Body-perfection integrity gate:** `assertBodyPerfectionIntegrity` (perfected ⊆ discovered, realm-order bound) and `validateBodyPerfectionPersistedState` are consistent; `canPerfectBodyRealm` requires both discovered AND owned. Clean.
- **`skillCastCounts` vs respec:** cast-leveled skill levels derive from persisted cast counts; respec doesn't touch them — no desync.

## Access limitations

- Full `npm run verify` (type-check + build + full suite) not run — out of scope for a review sweep; probes were targeted vitest only.
- No live-browser execution — UI claims (uncancellable modal, sword-only CharacterPanel entry, missing re-entry) are source-proven, not rendered.
- F-A3's settlement-error arm requires a mid-apply throw — the composition is proven from the code path; not exercised end-to-end.
- F-A4's reload window is a reachability argument (autosave cadence makes it narrow but real).
- Cloud-save / cross-device restore paths not audited.
- The probe file `game/src/core/progression/sealed-wave.probes.test.ts` is left uncommitted per report-only scope (test-only artifact, QA-write boundary).
