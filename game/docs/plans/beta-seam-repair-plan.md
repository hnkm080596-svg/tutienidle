# Beta Seam Repair Plan — 21 aggregate-wave QA findings

Mission: **BETA-SEAM-REPAIR**. Base: `beta/rc` @ `6d9af7a9` (post-P7 merge,
CURRENT_SAVE_VERSION=81). Branch: `devin/1790189112-beta-seam-repair`.

Source of truth (authoritative artifacts, branch
`devin/1790183687-qa-aggregate-tc-wave`):
`game/docs/qa/runs/tc-wave-2026-09-23/report.md`,
`reviews/aggregate-verdict.md`, `reviews/sealed-{A,B,C}-wave.md`,
`ledger.json`. Aggregate verdict: QA_BLOCKED_SCOPE (review-only run).

Workflow position: **G0/G1 executed; G2-G5 recorded as planned** (read-only
plan per architecture-worker-workflow proportionality table). This document
is a task card + disposition table + repair design; no production edits
until coordinator release.

## TASK CARD (G0)

- **Task / request:** repair or disposition all 21 findings F-W-0..F-W-20
  from the tc-wave aggregate QA run; none silently dropped.
- **Worktree:** `/home/ubuntu/repos/tutienidle/.agent-worktrees/beta-seam-repair`.
- **Requested observable behavior:** every finding either fixed with the
  stated approach or deferred with a recorded reason; the F-W-2 respec
  exploit must end (free kiem forging + free skill unlocks closed).
- **Single responsibility:** close the specific seams the findings name —
  nothing else is re-scoped. Production-edit owners are listed per finding.
- **Existing primitives to reuse:** `revokeNodeOwnership` +
  `cascadeRevokeOrphanedNodes` (NodeSystem.ts:485/570) as the single
  ownership-removal funnel; `canTriggerBreakthrough` /
  `getBreakthroughRequirements` rows (GameManagerRealmAdvanceOps.ts:712/756)
  as the admission authority; `TribulationOutcomeService.startTribulationPrepared`
  (420) as production tribulation admission; `isDomainScopedAcquisitionEnabled`
  (ReleasePolicy) for domain-gated drops; `persistentTimedEffects` /
  buff2 `BuffPersistence` as the two existing buff channels.
- **Non-goals:** no respec-economy redesign beyond clawback; no migration
  surface (v82 rejects v81, dev phase); no UI features; no repairs outside
  the 21 findings.
- **Stop condition:** all findings dispositioned + merged to `beta/rc` via
  PR (coordinator merges; worker never merges own PR).

## Disposition table

| ID | Sev | Disposition | Owner file(s) | One-line approach |
|----|-----|-------------|---------------|-------------------|
| F-W-0 | Medium | **Closed upstream** — landed on beta/rc tip by `92352f31` (declares `hiddenChannelCycles` on `ProductionSiteStateSave`; validator block already exists at saveShapeValidation.ts:1330) | none | Verify only: `hiddenChannelCycles` now written (SaveSystem.ts:375) + shape-validated; confirm with the suite, no edit |
| F-W-1 | Medium | **Fix — test-only** | `components/panels/SettingsPanel.test.ts:38` | `ConfirmModal` now renders inside `SysModalBase`'s `<Teleport to="body">`; the confirm button lives at `document.body`, outside `container`. Query `document.body.querySelector('.confirm-modal__confirm')` |
| F-W-2 | **High** | **Fix** — clawback policy (spec below, §F-W-2) | `core/progression/NodeSystem.ts` (report revoked set), `core/game/GameManagerProgressionOps.ts` (record grants at purchase :296-328; apply clawback post-commit), `core/skill/SkillSystem.ts` (new `unlearn`), `core/kiem-tu/NguKiemDao.ts` (new `loseKiemY`/`revokeKiemDao`), `PlayerData.nodeOneShotGrants` + saveTypes/validator (v82) | Record one-shot grants per node at purchase; on respec revoke them through domain entries |
| F-W-3 | Medium | **Fix** | `core/game/GameManagerRealmAdvanceOps.ts:368-370` | Insert `pourCultivationOvercharge(player)` immediately after the mortal-commit realm write — same placement as `resolveVictory` (OutcomeService:242) |
| F-W-4 | Medium | **Fix** | `composables/useTribulation.ts:216-233`; optional defense `core/talent/TalentEntitlement.ts:155` | In the settlementError drain branch, clear the stale `player.pendingTalentEntitlement` created by the failed run before `director.clear()`; optionally make `createTalentEntitlement` supersede a pending record whose `realmId !== targetRealmId`. Reload side closes via F-W-5 (see below) |
| F-W-5 | Medium | **Fix** — forces save v82 | `core/tribulation/TribulationDirector.ts` (+ `restoreRuntime`/`serializeRuntime` methods), `services/save/saveTypes.ts` + `SaveSystem.ts` + `saveShapeValidation.ts` (new `tribulation` slice) | Persist `committedOutcome` (attemptId, outcome, targetRealmId, grade, receipt — `TribulationOutcomeResult` is JSON-safe — settlementError) + `cooldownUntil`; restore into director at load; settled-but-undrained receipt re-presents on reload (receipt-slot dedup in `settleOutcome` prevents double-apply) |
| F-W-6 | Medium | **Fix — harness fidelity** | `core/simulation/earlygame/EarlyGameSession.ts:364-385`; invert pin `TrucCoJourney.test.ts:418-419` | Route `runTribulation` through `new TribulationOutcomeService().startTribulationPrepared(this.writer(), this.gameManager, targetRealmId)` — the writer seam already handles store-vs-PlayerData `setEquipmentModifiers`; `EssenceSubstitutionEconomy.ts:~103` inherits |
| F-W-7 | Medium | **Fix** | `core/game/GameManagerTickOps.ts:205`, `core/alchemy/AlchemySystem.ts:418`, `core/progression/NodeSystem.ts:287`, `core/talent/TalentEntitlement.ts:153`, `core/game/HiddenBeastSystem.ts:47` | All five sites already take an `rng` param (two pass `Math.random` literally, three default it). Add one injectable rng on the GameManager deps seam; route the two literal call sites through it; sim/tests pin it. No signature churn on the defaulted params |
| F-W-8 | Low | **Fix** | `core/game/GameManager.ts` `startTribulation` (:1349) | Consult `realmAdvanceOps.canTriggerBreakthrough(player)` before prep — one admission authority (release-policy + level/chapter rows) that UI and sim already precheck |
| F-W-9 | Low | **Fix** | `core/realm/RealmPassiveSystem.ts:8-29`, `services/save/saveShapeValidation.ts` | Marker/payload two-slice authority: validator cross-checks every `grantedRealmPassiveIds` entry resolves and has ≥1 live `player.modifiers` entry from that definition (fail loud instead of silent orphan via `isCurrentShapeModifier`); keep grant write-if-absent |
| F-W-10 | Low | **Fix** | `core/quest/QuestSystem.ts` claim loop (:220 material, :268 pill) | Add the missing third release-policy branch `isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId, player.realmId)` to both claim-grant loops — mirrors the `grantResolvedDrops` triplet (BattleLootSystem.ts:554-573) |
| F-W-11 | Low | **Defer — design ruling required** (§Design questions) | — | `KIEP_THUONG_DEBUFF` lives in the buff2 persistent pool (no save seam by design). Persisting needs a buff2 save slice; rerouting to `persistentTimedEffects` changes stacking/dispel semantics. Product intent unclear — flagged |
| F-W-12 | Low | **Fix** | `core/game/StageWaveSystem.ts:253-256`, `core/game/HiddenBeastSystem.ts:44` | `maybeReplaceSpawn(player, stageRealmId: string \| undefined, rng)`; pass `stage.requiredRealmId` raw — remove the `?? 'qi_refining'` band so non-LQ stages with no `requiredRealmId` can't attract hidden beasts (band hides absence) |
| F-W-13 | Nit | **Fix — doc** | `docs/specs/m-f-journey-spec.md` Respec row + Save row | Correct "25% insight tax" → respec refunds 100% of actually-paid Insight (the 75% figure belongs to `switchRoute`, GameManagerProgressionOps.ts:505); `CURRENT_SAVE_VERSION = 78` → 81 (then 82 once F-W-5/F-W-2/F-W-15 land) |
| F-W-14 | Low | **Fix — comment/contract** | `core/game/GameManagerPersistentEffectOps.ts:60-80` | Comment claims STATIC-ONLY while including persistent-buff + scaled-passive (runtime) sources; rewrite the comment to name the actual contract (named-channel static partition for battle/menus), verify `externalModifiers` isn't double-fed |
| F-W-15 | Low | **Fix — bundled with v82** | `core/player/Player.ts:273` (field), `core/tribulation/TribulationOutcomeService.ts:327` (write) | `tribulationBonusStacks` is write-only in production (tests-only readers). Drop field + write in the same v82 bump; adjust pinning tests |
| F-W-16 | Low | **Fix — validator** | `services/save/saveShapeValidation.ts:459` | `autoWorkerCapacity > 0` requires a `chi_hien_quan` instance in `save.buildings` — the restore path already recomputes capacity from the building (`refreshAutoWorkerCapacity`, GameManagerSaveRestore.ts:537), so a persisted non-zero without the building is always corrupt |
| F-W-17 | Low | **Fix — validator** | `services/save/saveShapeValidation.ts:845-880` | Mirror `commitFormationLoadout`'s contract (FormationPlacement.ts:73-105): combatantId unique + known, cells inside `formation.cellPattern`, no shared cell — currently shape-only, so a malformed save passes validation then `resolvePartyFormation` drops rows silently |
| F-W-18 | Nit | **Defer — design ruling required** (§Design questions) | `data/breakthrough/BreakthroughScopedResources.ts:12` | Comment says the gate "consumes" `truc_co_dan`; `startTribulation` only presence-checks. Consume-on-attempt vs one-time key changes TC economy — flagged |
| F-W-19 | Nit | **Defer — design ruling required** (§Design questions) | `core/game/BattleLootSystem.ts:447`, `core/game/GameManagerAutoFarmOps.ts:351` | Idle auto-farm kills feed `hiddenBeast.onEnemyDefeated` while substitution is ACTIVE-only — whether the window may warm during idle is a spec question — flagged |
| F-W-20 | Low | **Fix — harness fidelity** | `core/simulation/earlygame/EarlyGameSession.ts:315-322` (`onAdvance`) | Production `tickOps.update` runs `investBodyChapter` every tick; the harness's per-step parity callback cultivates + breakthroughs but never invests — add `investBodyChapter(player)` per advance under `combatCultivationParity` |

## F-W-2 clawback policy spec

**Exploit (executed repro, sealed-A):** buy `cuu_cung_kham` ×4 → respec →
`kiemY=7001` pooled + `kiemDaoCount=2` retained with 0 Insight spent; the
100% refund never takes back the one-shot grants the nodes issued.

**Policy decision (recommended default; flagged for ruling):** respec
revokes exactly the one-shot grants the respecced progression actually
delivered — no more, no less. Grants from *other* sources (ritual kit
learns, way `skillIds`, element roots, other nodes' overlapping effects)
stay. Derived state that cannot be honestly unwound is left and the bound
is documented (below), rather than redesigning the economy.

### Mechanism

1. **Provenance record at purchase.** New persisted field
   `player.nodeOneShotGrants: Record<string, NodeOneShotGrantRecord>`
   (v82), written inside the existing grant block of
   `GameManagerProgressionOps.purchaseNode` (:296-328), same synchronous
   commit as `purchaseNodeSystem`. Record only what actually fired:

   ```ts
   interface NodeOneShotGrantRecord {
     learnedSkillIds?: string[]   // unlocksSkillIds where learnSkill() returned true
     kiemY?: number               // kiemYGrant amount credited
     kiemDao?: number             // kiemDaoGrant swords credited
     specializationId?: string    // selectsSpecialization applied (latent path)
   }
   ```

   Recording `learnSkill`'s boolean result is the provenance guard: a skill
   already learned elsewhere (element root via `selectSpellPathElement`,
   bootstrap like `tram`, way kit) records nothing, so clawback can never
   strip a ritual/asset grant the node merely re-asserted.
   `grantsSkillCoreIds` is **not** recorded — `revokeNodeOwnership` already
   cascades it deterministically from the node def (:522). Level-derived
   effect fields (`statModifiers`, `theCapPerLevel`, `cascadeUnlock`,
   `swordPathComboModifier`, `bodyKitModifiers`, `hiddenBodyMechanicModifiers`,
   `turnSkillResourceModifiers`) need no record — they die with ownership.

2. **Revoke-set reporting.** `NodeSystem` stays pure (registry-only).
   `respecApply`/`respecNodeTree` (+ the shared `devResetBranch`/`switchRoute`
   revoke paths that funnel through the same `revokeNodeOwnership` +
   `cascadeRevokeOrphanedNodes`) additionally return the full revoked node-id
   set they computed (they already iterate it for refunds). The ops layer
   (`GameManagerProgressionOps.respecNodeTree` and siblings) then applies
   clawback to that set — domain purity preserved, one reversal funnel.

3. **Domain reversal at ops layer** (new `applyOneShotClawback(player,
   revokedNodeIds)` in `GameManagerProgressionOps`, run after the domain
   commit — the dry-run already validated node-set atomicity; the clawback
   itself is pure field mutation and must stay non-throwing):

   - **`unlocksSkillIds`** → for each recorded `learnedSkillIds` entry:
     rescan remaining owned nodes (`player.purchasedNodeIds` post-revoke)
     for any other live `unlocksSkillIds` containing the skill; if none,
     `skillSystem.unlearn(skillId)` — **new SkillSystem entry**: remove
     membership, keep `skillCastCounts` (earned progress is retained —
     learned-then-lost skills keep their practice history). Then revoke
     `core_<skillId>` through `revokeNodeOwnership` (refunds whatever
     Insight was paid into core levels — correct: that spend rode on a
     node-granted skill). Spell-kit skills are linh_ngo-exclusive
     (`spell_pathway.skillIds` grants nothing itself — basics come from
     preserved element roots), so unlearn is clean for authored content.
   - **`kiemYGrant`** → `nguKiemDao.loseKiemY(player, amount)` — **new
     NguKiemDao entry** mirroring `gainKiemY`'s own shape: debit
     `player.kiemY` floor 0; the residual debits `kiemDaoCount` at
     `forgeCost(currentRealm)` per sword (the pool auto-forges, so swords
     forged from granted kiemY are the debt's continuation); residual
     beyond live swords is absorbed (see bounds).
   - **`kiemDaoGrant`** → `player.kiemDaoCount -= recorded`, floor 0.
   - **`selectsSpecialization`** → clear `player.selectedSpecializationId`
     only when it still equals the recorded id (a different spec chosen
     later is not this grant's problem). No authored usage today — covered
     generically so the latent path can't reopen the hole.
   - **`grantsSkillCoreIds`** → existing cascade, no work.
   - Talent-side grants: no `NodeEffect` field grants talents (inventory
     ProgressionNode.ts:66-145) — explicitly out of scope.
   - `delete player.nodeOneShotGrants[nodeId]` after applying, so a rebuy
     re-records cleanly.

4. **Documented bounds (what clawback does NOT unwind):**
   `applyBreakthroughMerge`'s `kiemDaoBase *= 1+0.3*mergedCount` inflation
   (NguKiemDao.ts:100-103) is permanent — swords merged into the base can't
   be un-merged; the residual absorb rule exists because of it. Skill cast
   counts, learned-history elsewhere, and any pre-v82 state are likewise
   untouched.

5. **Same-funnel coverage:** `devResetBranch` (NodeSystem.ts:536) and
   `switchRoute`'s route-tagged cleanup revoke through the same functions;
   the revoked-set return lets the ops wrappers apply identical clawback
   there — no second hole.

6. **Tests (planned):** respec repro of sealed-A (4× cuu_cung_kham →
   respec → kiemY=0, kiemDaoCount back to pre-purchase, Insight refunded);
   clawback leaves ritual/bootstrap-learned skills intact; dual-source
   skill stays learned; spec-equality guard; record deleted on revoke.

## Save version decision — v82

F-W-5 + F-W-2 force a persisted-shape change; F-W-15 rides the same bump.

| New/changed field | Finding | Where |
|---|---|---|
| `player.nodeOneShotGrants?: Record<nodeId, NodeOneShotGrantRecord>` | F-W-2 | PlayerData + saveTypes + validator |
| `tribulation: { committedOutcome?, cooldownUntil? }` | F-W-5 | saveTypes + SaveSystem writer/restore + validator + `TribulationDirector.restoreRuntime` |
| drop `player.tribulationBonusStacks` | F-W-15 | Player.ts:273 + OutcomeService:327 |

No backward compat — v82 rejects v81 like every prior version (dev-phase
rejection chain; no migration surface exists to extend).

## Design questions needing a ruling

1. **F-W-11 — Kiep Thuong debuff persistence.** `KIEP_THUONG_DEBUFF`
   (buffs.ts:14-31, buff2 persistent pool, 60s `seconds`-clock debuff
   applied at OutcomeService:382) is unsaved — the buff2 pool has no
   persistence seam at all. Options: (a) persist the buff2 persistent pool
   — new save slice, correct but the largest change; (b) reroute this one
   debuff through `persistentTimedEffects` (already persisted) — changes
   stacking/dispel semantics; (c) accept session-scoped debuff as designed.
   **Recommended:** (a) only if defeat debuffs are meant to survive
   reload; otherwise (c) + a one-line comment. Ruling needed on intent.
2. **F-W-18 — truc_co_dan consume semantics.** The census comment says the
   gate "consumes" the pill; `startTribulation` only `has()`-checks it.
   Consume-on-admission is genre-consistent but makes defeats cost the
   pill on top of the existing cooldown + cultivation/stone loss — harsh
   given the pill's day-scale alchemy cost. **Recommended:** keep
   presence-key semantics, fix the comment; consume-on-victory (debit in
   `resolveVictory`) is the middle option if the designer wants it spent.
3. **F-W-19 — hidden-beast kill window source.** `onEnemyDefeated` counts
   every kill including idle auto-farm cycles (auto-farm feeds the same
   `processDefeatedEnemies` funnel, GameManagerAutoFarmOps.ts:351), while
   the substitution itself is ACTIVE-only. **Recommended:** restrict the
   counter to ACTIVE kills — thread a kill-source tag through
   `processDefeatedEnemies` → `hiddenBeast.onEnemyDefeated` — symmetric
   with the active-only substitution rule. If idle warming is intended,
   document the asymmetry instead.
4. **F-W-2 policy scope** — the coordinator asked for this spec; the
   policy defaults above (revoke only what the respecced nodes granted;
   absorb rather than redesign beyond live swords; keep cast counts) are
   the recommended reading of "revoking only what the respecced
   progression granted". Flagging in case a different bound is wanted.

## Planned implementation gates (G2-G5, recorded as planned — not passed)

Order: P3 quick after each fix cluster; `npm run verify` (type-check +
build + full vitest) once the save-shape/config lands (v82 touches
persisted shape → full mode per P3); P4 adversarial QA (deep — save +
progression surface); P5 sequential ≥3 passes; P18 OCR
(`ocr delegate preview -f json` + `ocr delegate rule <paths>`) on the diff;
PR to `beta/rc` (never self-merge); park for coordinator QA.

Planned test additions: respec clawback suite (F-W-2), tribulation
persist/restore round-trip (F-W-5), mortal-initiation overcharge pour
(F-W-3), settlementError stale-entitlement clear (F-W-4), admission-gate
fail-closed cases (F-W-8), validator negative cases (F-W-9/16/17), quest
domain-gate (F-W-10), hidden-beast no-band stage (F-W-12), harness
equip-strip pin (F-W-6/F-W-20).

## G1 evidence highlights (Q-IDs)

- **Q1/Q12:** observable contract per finding = the disposition table;
  scope bound = 21 findings + their listed owners; nothing else edited.
- **Q2:** each fix routes through the already-named single owner (revoke
  funnel, admission rows, claim-drop triplet, validator).
- **Q3:** F-W-5 state lifecycle: writer `buildGameSave` /
  readers `checkTribulationOutcomeAction` + `resolveVictory` /
  reset `director.clear()` / persist new `tribulation` slice.
- **Q4:** production chains verified: respec via ops→`respecApply`;
  tribulation UI→`useTribulation`→`startTribulationPrepared`→`start`;
  sim→`runTribulation`; quest claim→QuestSystem grant loop.
- **Q5:** primitives reused: `revokeNodeOwnership` (already refunds
  actual-paid Insight incl. core levels), `pourCultivationOvercharge`
  (CultivationSystem.ts:42), receipt-slot dedup in `settleOutcome`.
- **Q8:** clawback preserves dual-source skills via rescan + provenance
  recording; derived modifiers drop automatically with ownership.
- **Q10:** F-W-5 restore honors the settle dedup — a restored
  committedOutcome re-presents the deferral but can't double-settle.
- **Q11:** `tribulationBonusStacks` write-only counter confirmed (only
  test readers) — removal, not a compat path.
