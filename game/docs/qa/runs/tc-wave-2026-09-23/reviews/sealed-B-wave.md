# Sealed Reviewer B — AUTHORITY/PERSISTENCE lens
Run: tc-wave-2026-09-23 · Target: `p7/truc-co @ b76cc97b` (merged 16-mission trúc cơ wave) · Baseline: `origin/master` (~19.4k insertions / 211 files, 128 commits)
Reviewer independence: `priorFindingsVisible: NO`

## Persisted-field census (v73–v81) — what reaches the blob

`buildGameSave` (SaveSystem.ts:322) is a hand-mapped snapshot — every field it writes is intentional; it is the *writer-side* contract. The *declared* contract is `GameSave`/`ProductionSiteStateSave`/`PlayerData` in saveTypes.ts; the *validator* is saveShapeValidation.ts; the *restorer* is `player.restoreFromSave` + `saveOps.restoreFromSave`.

Player census: 55/55 `PlayerData` fields exist on `createDefaultPlayer()` — the restore whitelist (`allowedPlayerKeys`) is complete; nothing persisted is dropped at the key level. Slices: `techniques`, `skills`, `materials`, `equipment`, `pills`, `talismans`(empty), `formations`(empty), `buildings`, `equipmentSlots`, `productionSites?`, `alchemyJobs?`, `quests?`, `decompose?`. Version map: v73 nodeLevels/skillLevels rejection → v74 physiqueGrade → v75 gradeHistory → v76 pendingTalentEntitlement → v77 companionGifts → v78 zhou_tian → v79 ARTIFACT_UNLOCK_REALM_ID → v80 bodyPerfection → v81 hiddenBeastKills + hiddenChannelCycles.

Every persisted slice has exactly one restorer; `computeRestoreIdentity` covers all slices (player minus `lastSavedAt`, optional slices hash `null`). No declared-but-never-restored fields found. Modifier channels: `player.modifiers` bucket (realm-passive/pill/permanent-talent/body-chapter prefixes + `sourceType:'equipment'` replace-slice), `persistentTimedEffects` (timed channel, own stack policy), `externalModifiers` (derived channel, see B-06), `baseStats` (whitelisted keys), body-prefixed `bat-mach:`/`luyen-the:`/`zhou-tian:` (distinct, rebuilt from `bodyProgression` slices at restore).

## Findings

### B-01 — `productionSites[].hiddenChannelCycles` is on the wire but undeclared on the save type — Medium — [SEAM]
Location: `game/src/services/save/saveTypes.ts:267-283` (declaration gap) vs `SaveSystem.ts:376` (writer), `saveShapeValidation.ts:1334-1340` (validator), `ProductionTypes.ts:87` (domain type), `ProductionSystem.ts:146-148` (restorer), `GameManagerSaveRestore.ts:550` (cast bridge).
Evidence: code-read + runtime probe (vitest: field survives `restoreStates` → `getState` → JSON serialize).
Reasoning: the v81 serializer writes `hiddenChannelCycles` per site and the v81 comment block in saveTypes.ts:155-158 explicitly announces it, yet `ProductionSiteStateSave` stops at `assignedWorkers?`. The blob, validator, domain type and restorer all agree; the *declared contract* is the only party that disagrees. Restore works only because `restoreStates` is reached through `as ProductionSiteState[]` — an unchecked cast that trusts shape validation, so the type system gives zero protection here. Consequence today: none (roundtrip verified live); consequence tomorrow: any consumer typed against `ProductionSiteStateSave` (save tooling, cloud diff, migration writers) cannot see the field, and a future hand-map edit can silently drop it with the type approving both sides.
Repair owner: M-F-BODY-HIDDEN follow-up (save contract) — add `hiddenChannelCycles?: Record<string, number>` to `ProductionSiteStateSave`.

### B-02 — respec refunds `unlocksSkillIds` unlock nodes while the learned skill + free granted core survive — Low — [SEAM]
Location: `NodeSystem.ts:494-527` (`revokeNodeOwnership` revokes only `grantsSkillCoreIds` ties), `NodeSystem.ts:696` (whole-tree targets `levelsSkillId === undefined && !preserved` — includes `linh_ngo_*`), `GameManagerProgressionOps.ts:298-304` (purchase applies `unlocksSkillIds` via `learnSkill` → `grantSkillCore`), `PhapTuNodes.builders.ts:109-128` (authored unlock nodes, cost 2-3).
Evidence: runtime probe (vitest): buy cost-2 unlock node → `respecNodeTree` refunds 2 while `skillManager.has('tram')` stays true, `nodeLevels.core_tram` stays 1, `purchasedNodeIds` keeps `core_tram`.
Reasoning: an unlock node's entire purchased value is its unlock side-effects; respec revokes the node and refunds it, but the learned skill (SkillManager membership — no unlearn path exists anywhere), the free core level 1 (`levelsSkillId` nodes are excluded from targets and the tie list only covers `grantsSkillCoreIds`), and the core's ownership entry in `purchasedNodeIds` all survive. Net effect: the unlock + core are effectively free after one respec. Re-buying the cleared node then charges insight for a no-op (learn idempotent, `grantSkillCore` write-if-absent) — a mild trap. `selectsSpecialization` node side-effects (persisted `selectedSpecializationId` on the skill) follow the same class. The respec QA doc (docs/qa/2026-09-23-m-f-respec-quick.md) explicitly scoped "non-grant cores and skill-axis investment untouched" — deliberate, but the *unlock* nodes are not "investment": they are the grant seam itself, so the scope statement covers a narrower case than the code permits.
Repair owner: M-F-RESPEC follow-up — either exempt `unlocksSkillIds`/`selectsSpecialization` nodes from respec refunds, or unlink the learned skill/core when the granting node is revoked.

### B-03 — `startTribulation`/`TribulationDirector.start` is fail-open to callers; full admission lives only at the UI/sim edges — Low — [SEAM]
Location: `GameManager.ts:1352-1367` + `TribulationDirector.ts:187` (checks only `isRealmTransitionEnabled`); admission rows (level, chapterClear) live in `getBreakthroughRequirements` (`GameManagerRealmAdvanceOps.ts:716-737`) consulted by `useTribulation.ts:39` and `EarlyGameSession.ts:365` only.
Evidence: code-read.
Reasoning: `canTriggerBreakthrough` is the declared admission authority (M-QI-03) but the domain entry point does not consult it — the policy check inside the director covers only the release ceiling, not per-realm requirements. Notably `isRealmTransitionEnabled('mortal','qi_refining')` is TRUE (adjacent, in-window), so a direct `startTribulation` call admits a mortal into a tribulation and bypasses `chooseCultivationPath` entirely (no path commit, no canonical technique, no kit). No current caller does this (the UI routes mortal to the Quan Khi ritual panel; the sim prechecks), so it is a latent structural hole rather than a live bug — the kind the wave's own "single funnel" ruling (C2C-12) was meant to prevent one level down.
Repair owner: M-F-JOURNEY / breakthrough follow-up — have `TribulationDirector.start` (or `GameManager.startTribulation`) consult the same requirement rows the composable trusts, or hard-block mortal.

### B-04 — realm-passive grant markers persist separately from the granted modifiers with no restore reconciliation — Low — [SEAM]
Location: `RealmPassiveSystem.ts:8-24` (marker `grantedRealmPassiveIds` vs payload `player.modifiers`), `stores/player.ts:322-330` (`isCurrentShapeModifier` filter drops stat/domain-mismatched modifiers only).
Evidence: code-read.
Reasoning: `grantRealmPassive` is write-if-absent on `grantedRealmPassiveIds`; the modifiers it emits are separately persisted and separately filtered at restore. If a realm passive's modifier is ever dropped by the stat/domain gate (a stat renamed or re-gated in a later version), the marker survives while the payload is gone — and because the marker says "granted", re-entry can never re-issue it: silent permanent loss of a realm passive. Authored passives are consistent today (universal stats + declared `domain:'spell'`), so this is a resilience hole in the two-slice authority, not a current defect. Same shape recurs in `tribulationBonusStacks`/`talent_loi_kiep_*` (see B-07) — marker/counter persisted beside the payload it describes, reconciliation nowhere.
Repair owner: Realm-passive owner — either re-derive granted passives from `grantedRealmPassiveIds` at restore (drop persisted copies), or reconcile the marker against dropped modifiers.

### B-05 — journey-spec doc misstates respec (25% tax) and the save version (78 vs 81) — Nit — [SEAM]
Location: `game/docs/specs/m-f-journey-spec.md:90` ("25% insight tax" on `respecNodeTree`), `:92` (`CURRENT_SAVE_VERSION = 78`).
Evidence: code-read (`respecNodeTree` refunds 100% actual-paid, NodeSystem.ts:660-711; the 25% tax is `switchRoute`'s `floor(paid*0.75)`, NodeSystem.ts:832; version is 81).
Reasoning: wave-authored doc conflates the route-switch tax with the free Beta respec, and the census row predates v79-v81. Doc-only, but it is the wave's own journey contract table.
Repair owner: M-F-JOURNEY follow-up — fix the two rows.

### B-06 — `externalModifiers` persists a re-derived channel; "STATIC-ONLY" contract comment is stale — Nit — [RESIDUAL]
Location: `stores/player.ts:182-205` (persisted field rewritten each tick), `GameManagerPersistentEffectOps.ts:68-73` (comment claims static-only while including `persistentBuffs` + `getScaledPassiveModifiers`; `getBattleBaseChannels:122-129` is the true 5-channel static partition).
Evidence: code-read.
Reasoning: the saved `externalModifiers` slice is re-computed every tick from live state, so a persisted value can serve `finalStats` for at most the window before the first post-restore tick — one-frame staleness, self-correcting. The real cost is the stale contract comment inviting a future caller to treat the aggregated list as battle-safe (which would double-apply persistent buffs, exactly what `getBattleBaseChannels` was extracted to prevent).
Repair owner: Persistent-effect ops owner — drop the slice from the save contract or fix the comment.

### B-07 — `tribulationBonusStacks` is a write-only counter mirroring the loi_kiep modifier sum — Nit — [RESIDUAL]
Location: `TribulationOutcomeService.ts:327` (write), `Player.ts:273` (declared); no production reader (only tests).
Evidence: code-read.
Reasoning: the count duplicates what `talent_loi_kiep_<stat>` modifier percent already encodes; two persisted authorities for one fact, reconcile-free. Harmless today; pure census clutter.
Repair owner: Tribulation owner — remove the field on the next save version, or read it as the authoritative stack count and rebuild modifiers at restore.

## Areas swept and judged clean (authority holds)
- Release-policy single authority (`ReleasePolicy.ts`): ceiling, adjacent transitions, acquisition/domain gates all funnel through it; artifact domain unlock is the same 3-leg composition at every call site (EXP feed, path select, grade upgrade, breakthrough award).
- Talent entitlement: originate→reconcile→resolve is one module; the persisted record is the lock; modal/drain share the actionability predicate.
- Technique mirror: `techniqueProgress` republishes from the canonical holder on every mutation path incl. restore — forged mirrors self-correct.
- Essence substitution: namespace gate at resolver; probe→validate→debit→apply is fail-closed; no second pricing table exists.
- Body chapters: distinct modifier prefixes (`bat-mach:`/`luyen-the:`/`zhou-tian:`), registry-validated 1:1 slice map, capacity-checked integrity (zhou_tian realm cap).
- Hidden channels: one registry authority; `hiddenBeastKills` (player map) and `hiddenChannelCycles` (per-site map) written only by `HiddenBeastSystem`/`ProductionSystem`.
- Companion gifts: `issueCompanionGifts` write-if-absent + `claimCompanionGift` single consume; all `companions`/`duyenPhan` writes inside `GameManagerCompanionOps`.
- Store/component boundary: no domain writes outside ops/systems (only `hasSeenTutorial` UI flag); Pinia store delegates to domain functions.
- Respec core accounting: `revokeNodeOwnership` skips the granted level-1 cost (`spentStart=1` for cores); `paidForNodeLevels`'s level-0 accounting only reachable via `routeTag` nodes, and a test pins cores to `routeTag === undefined` — no over-refund path.

## accessLimitations
- Public repo; no access to the mission pipeline, prior reviewer outputs, or cloud-save backend (`cloudSaveCoordinator` reviewed only at its seam).
- Runtime evidence limited to vitest probes (two scratch tests, run + removed); no browser/E2E run — UI reachability claims (B-03) rest on panel/composable wiring reads.
- Dormant-authored content (golden_core+ realms, pull pool, artifact domain, BAO/PHAP essence upper rungs) was boundary-checked only, not end-to-end simulated.

Attestation: `priorFindingsVisible: NO` — this review was conducted independently at b76cc97b; the one journaled item supplied by the task (hiddenChannelCycles) was re-verified against the tree before inclusion.
