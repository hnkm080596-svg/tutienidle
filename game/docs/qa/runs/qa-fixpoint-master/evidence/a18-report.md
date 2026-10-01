# A18 — scope AUTHORITY seam review (authority-side admission/writers)

**Verdict: PASS WITH GAPS** — 0 confirmed Medium+ defects. Boundary holds under every forge probed; 1 Low latent validator gap, 1 Nit latent defense-in-depth gap, and the accepted-residual classes are documented with evidence.

- Commit: `af3666e7a3b987c270d7acdeb4fe3f91166be4db` (branch `devin/qa-fixpoint`, fresh clone, `git checkout` of the pin)
- Probe: `tests/architecture/betaAuthoritySeamA18.qa.test.ts` — 11/11 green (`npx vitest run tests/architecture/betaAuthoritySeamA18.qa.test.ts`)
- All probe flags pinned by `lockBetaFeaturesForTests`/`lockBetaWaysForTests`/`lockBetaTalentsForTests` (canonical all-false beta table).

## Method

1. Read `docs/design/frontend-contract.md` + `docs/qa/protocol/README.md`.
2. Enumerated writer shapes (Player.ts defaults, GameManager*Ops mint paths, realm/skill/technique/body writers) against `saveShapeValidation.ts` bounds.
3. Write-seam census: every GameManager*Ops method that can mint a persisted claim or dormant-scope record (grant/learn/invest/respec/settle/unlock/pull/exchange/feed/choose/commit/transition/reconcile) was checked for a scope verdict.
4. Forge matrix probes (below), then sibling enumeration per confirmed item.

## Forge matrix — results

| Probe | Forge | Boundary result | Consumer result |
|---|---|---|---|
| A18-1 | `golden_core_wood_thuong_co` (tier-4) in mortal `materials[]` | shape OK, restores to bag | vendor `grade_not_below` — refuse, no mint |
| A18-1s | `tinh_hoa_pham_the` (essence, no profession meta) | shape OK, restores | vendor refuse (no meta → fail-closed) |
| A18-2 | `ngu_kiem_thuat` (dormant-way skill) in `skills[]` | F-W-2A prune / provenance | not learned — `skillManager.has` false |
| A18-3 | coherent `sword_pathway` save (sword path+way, swordPath slice, sword_control_art, orb kit, breakthroughGrade=1) | restores, flagged `way_out_of_scope` | `reconcileWayGrants` replays nothing (isBetaWay gate); transition gate intact |
| A18-4 | `phi_van_dan_mortal` (dormant pill family) in `pills[]` | shape OK, restores to bag | `usePillDetailed` → `{ok:false, reason:'scope_hidden'}`, bag untouched |
| A18-5 | parked `phu_van`; golden_core pool `kd_thanh_dan`/`kd_linh_dan` on mortal | shape reject (each leg) | — |
| A18-6 | `persistentTimedEffects[]` seeded from `khai_linh_dan_mortal` | shape reject (dormant-family source) | — |
| A18-6s | `ngu_kiem_khoi:3` in `nodeLevels` | record kept (preserved) | `node_levels` emission channel emits 0 dormant modifiers |
| A18-7 | `totalExperience`/`skillCastCounts` = 1e6 on `linh_bao` | restores verbatim | +100,000 flat precursor bonus — **writer-identical at same counter value** (residual class) |

## Write-seam census (all gated)

Companion pull/exchange/gift/feed (`CompanionOps:107/176/246/318` + `isBetaCompanionGift`), artifact ops, alchemy ops (beta recipe family), `usePillDetailed` (`scope_hidden` ~:71), quest ops, decompose, skill learn/level/purchase/upgrade/respec/spec/preset/starter/`mortalBasicSkillId` pick, `chooseCultivationPath` (:327 isBetaWay), `commitFiveElementInitiation`, `applySwordPathRealmTransition` (:218), `reconcileWayGrants` (:242 isBetaWay), `grantCultivationPathRealmReward` (:392), `getCultivationPathStatModifiers` (:371), technique mint/grade, tribulation, autofarm×3, `buildingOps.manualWorkforce`, hidden-channel rolls (`ProductionSystem:526` frozen on `isScopeHidden('hiddenContent')`), hidden-beast substitution (`StageWaveSystem:283-289` requires stage-declared spawnable — no beta stage declares it), `isRealmTransitionEnabled` (adjacency + availability), `isBreakthroughAcquisitionEnabled` (predecessor→target or availability), `isCompanionPullPoolEnabled` (false).

## Confirmed / deferred findings

**A18-F1 (Low, deferred)** — Persisted `materials[]` entries pass shape with stack+registry checks only; only spirit stones carry the F-SCOPE-1 realm-tier bound. A tier-4 profession material restores into a mortal's bag (visible-scope data leak as *state*, not behavior). Every consumer gate audited fails closed: vendor grade-below (`VendorSystem.isGradeBelowPlayer` — profession meta required + strictly-below-player rule), craft/essence pipelines keyed to authored inventories. Gap = latent validator asymmetry, not a live mint. Siblings verified: essences (refuse), above-realm equipment (`canUseItemGrade` at `EquipmentSystem.ts:279`), dormant pills (`scope_hidden`).

**A18-F2 (Nit, deferred)** — `CultivationPathSystem.applyPathChoice` carries no internal beta gate (offerGate only). All reachable callers are gated (`chooseCultivationPath`, initiation chain); latent defense-in-depth gap only. Same-module siblings `getCultivationPathStatModifiers`/`grantCultivationPathRealmReward` do gate internally.

**A18-R1 (residual)** — Forged `totalExperience`/`skillCastCounts` mint `floor(casts/10)` flat precursor bonus, uncapped by design ("KHONG tran"). Writer-producible same-value → accepted residual per dispatch. Documented for the record.

**A18-R2 (residual)** — Forged `phaGiapCarryStacks` clamp to authored `maxStacks` (pha_giap 5) and banking is talent- + betaSkillAdmitted-gated. Accepted residual.

**A18-R3 (residual)** — Dormant counters (`duyenPhan`, `companionPullsSinceRare`, `hiddenBeastKills`, `hiddenChannelCycles`, `bossKillCount`) persist but feed only scope-frozen consumers. Accepted residual.

## Access limitations

- Blind review: other reviewers' evidence files in `docs/qa/runs/qa-fixpoint-master/evidence/` (a10–a17, b11–b17) were not read.
- Browser/runtime UI not exercised — this seam is authority/persistence-side; all claims verified at validator + ops level via vitest.
- No production code modified; no commits made.
