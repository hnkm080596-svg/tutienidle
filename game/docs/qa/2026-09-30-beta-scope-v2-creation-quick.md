# QA Review: beta-scope-v2-creation (BETA SCOPE LOCK v2 Phase-2)

- Date: 2026-09-30
- Mode: quick (deep-escalation reviewed and bounded — see below)
- Verdict: PASS WITH GAPS
- Task-owned paths: production — `game/src/core/game/GameManagerRealmAdvanceOps.ts`,
  `game/src/core/game/GameManagerProgressionOps.ts`, `game/src/core/player/PlayerSnapshot.ts` (new),
  `game/src/core/betaScope.ts`, `game/src/core/skill/MortalPrecursors.ts`,
  `game/src/core/game/EarlyGameBootstrap.ts`, `game/src/services/save/saveShapeValidation.ts`,
  `game/src/services/character/{CharacterCreationService,MockCharacterCreationService,SupabaseCharacterCreationService,initializeCharacter}.ts`,
  `game/src/core/simulation/{BattleSimulation.ts,earlygame/EarlyGameLoop.ts,earlygame/EarlyGameSession.ts,earlygame/EssenceSubstitutionEconomy.ts,earlygame/PerfectionEconomy.ts,benchmark/BalanceBaselines.ts}`,
  `game/src/composables/useProgressionActions.ts`,
  `game/src/components/{App.vue,onboarding/CharacterCreationScreen.vue,panels/QuanKhiPanel.vue,panels/skill-path/NodeInspector.vue,panels/skill-path/SkillRoleStrip.vue}`,
  `game/src/locales/{en,vi}.json`, `game/vite.config.ts`,
  `game/supabase/migrations/202609300005_beta_scope_v2_creation.sql` (new);
  test/fixture — `tests/setup.betaScope.ts`, `__fixtures__/betaWaysUnlock.ts`,
  `GameManager.fiveElementInitiation.test.ts` (new), `baseStatsWriteAuthority.test.ts`,
  `betaScopeLockV2.test.ts`, plus ~40 mechanical suite migrations (mortal pick fixtures `tram` → `linh_bao`,
  precursor-pick draft fields dropped, sword ritual reroutes to `commitSpellInitiationForTest`).

## Scope and Risk Map

`changed-risk-map.mjs` (task-owned paths only): domains = combat-and-tribulation,
save-and-cloud, ui-input-lifecycle; `deepAuditCandidate: true` (critical state
boundary save-and-cloud + 3-domain crossing); 12 `unmappedPaths` (mapper covers
component/service surfaces; core/simulation/fixture files need manual routing).

Manual routing of unmapped items:

- `core/betaScope.ts` — leaf policy predicates (Phase-1 file, extended); no state, no consumers beyond gates.
- `core/player/PlayerSnapshot.ts` — leaf JSON snapshot/restore helpers; only consumer is the transaction itself.
- `core/game/GameManager{RealmAdvanceOps,ProgressionOps}.ts` — domain-op owners under economy/progression + combat boundary (in-combat gates); routed to economy-and-progression reasoning.
- `core/game/EarlyGameBootstrap.ts`, `core/simulation/**`, `vite.config.ts`, `tests/setup.betaScope.ts`, `__fixtures__/betaWaysUnlock.ts`, `supabase migration` — test-harness/sim and server contract files; no live gameplay path outside their seams.
- `useProgressionActions.ts` — composable surface under ui-input-lifecycle.

Deep-escalation review (mandatory triggers evaluated):

- Save/cloud materially changes: `saveShapeValidation` exempts `rewardOnly` nodes from
  the `purchasedNodeIds` mirror (grant-owned nodes have no purchase path — tightening
  wrong, loosening is the real latent-bug fix); `mortalBoundaryContractViolation`
  tightens the pick to `linh_bao` (fail-closed); server RPC mirrors the constant.
  Bounded: validator change is a documented exemption for a state class that has no
  mirror channel; the pick check is a strict subtype of the previous check.
- Economy/progression transaction crossing persistence/combat: the initiation commit
  mutates player + skillManager + techniqueManager. Rollback coverage audited leg by
  leg — all writes are snapshot-covered (player) or set-difference-covered
  (learned-skill unlearn, techniqueManager.restore). Two channels outside the
  snapshot (`markQuestRealmTransition` boolean flag; `applyCompanionGiftRealmTransition`
  writes `player.companionGifts` — actually inside the player snapshot) bound as
  harmless: the quest flag only requests an idempotent lifecycle reconcile against
  the rolled-back (mortal) state.
- Vue/Pinia lifecycle: snapshot/restore mutates the reactive `$state` object
  in place via delete+assign; JSON-clone capture avoids structuredClone-on-proxy.
  Bounded: restore reproduces only prior state; watchers see field-level writes
  identical to ordinary mutations.

Conclusion: risk confidently bounded → quick verdict permitted.

## Invariant Ledger

| ID | State/owner | Action | Invariant | Attack operator | Oracle | Layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-INIT-1 | initiation transaction | mid-commit leg failure | Zero partial mutation (byte-equivalent player + skill/technique sets) | Fault injection on each public ops leg | `snapshotOf()` JSON byte-equality | unit (`fiveElementInitiation.test.ts`, 7 cases) | High |
| INV-INIT-2 | initiation preflight | every dependency missing BEFORE commit | Named failure reason, zero mutation | Value mutation (missing technique/root/skill, low realm, combat, committed path/element) | `{ok:false, reason}` per case | unit | High |
| INV-GATE-1 | element root purchase | ordinary `purchaseNode(rootId)` | Always rejects (all 5 elements); root only rides the transaction | Direct-API bypass | `purchaseNode` returns false; `nodeLevels` empty | unit (reimagined) | High |
| INV-GATE-2 | chooseCultivationPath | `(spell, spell_pathway)` or non-beta way | Fails closed — element ways only via atomic op | Direct-API bypass | `false` | unit | High |
| INV-GATE-3 | selectSpellPathElement | direct call outside transaction | Rejects: gate is `realmId==='mortal'` + path capability + element-null — unreachably conjunctive post-beta-gate | Direct-API bypass | `false` | unit (mortalBasicSkill + reimagined) | High |
| INV-CREATE-1 | creation draft | `mortalBasicSkillId` in payload | Field absent from contract; draft validator ignores injected pick; boot writes constant | Injection | type shape + boot assertion | unit | High |
| INV-CREATE-2 | setMortalBasicSkill | non-linh_bao id at any admission (boot/repick/API) | `isBetaMortalStarterId` fail-closed | Direct-API bypass | `false` + pick unchanged | unit | High |
| INV-CREATE-3 | talent offers | roll + validate + remote metadata | Only `BETA_CREATION_TALENT_IDS` (18) offered/accepted; `pham_cot`+parked rejected at every seam | Value mutation, stale-server drift | filtered roll, `invalid_talents`, adapter throw | unit + contract test | High |
| INV-SAVE-1 | save boundary | mortal save with tram/huy_quyen pick | `mortalBoundaryContractViolation` fails closed | Crafted payload | violation string | unit (boundary) | High |
| INV-SAVE-2 | validator | grant-owned nodeLevels (rewardOnly) | Exempt from purchasedNodeIds mirror — realm grants no longer corrupt saves | State shape | validator accepts legit grant state | unit | Medium |
| INV-UI-1 | QuanKhiPanel ritual | element pick → commit | Single op call; failure reason mapped to locale key; pendingChoice cleared only after success; ceremony name captured pre-clear | Re-entry, failure path | localized error / announcement | component | Medium — found+fixed: `pendingPathName` read after `pendingChoice=null` would render empty name (captured `wayName` before clear) |
| INV-HARNESS-1 | test setup | `unlockAllWaysForTests` global default | Pre-beta suites unchanged; lock suites re-pin via `lockBetaWaysForTests`; vitest module isolation prevents leak | Cross-file bleed | architecture suite green | meta | Medium |

## Findings

1. **Medium — FIXED (OCR stage, pre-QA):** `QuanKhiPanel.commitInitiation` read
   `pendingPathName` after `pendingChoice.value = null`; the computed resolves to `''`,
   so the world announcement would render an empty way name. Fixed by capturing
   `wayName` before clearing. Reverified (type-check + 90 files / 454 tests).
2. **Low — accepted design, documented in code:** commit-region learn failures
   `throw` (rolling back in `catch` first) rather than returning `{ok:false,
   'commit_failed'}`. Preflight makes them unreachable in practice; the throw
   preserves the failure identity for debugging. Atomicity verified either way.
3. **Low — documented limitation:** rollback leaves `questRealmReconcileNeeded` set —
   an idempotent reconcile trigger that re-evaluates against rolled-back state.
   Harmless by construction.
4. **Observation (balance, not defect):** pinned `linh_bao` starter (~1×might flat,
   no cast-XP bonus vs `tram`'s XP-scaled flat) walls the canonical early loop at
   `mortal_dong_1` pre-initiation. Re-characterized `EarlyGameSession.test.ts` +
   `MortalChapterJourney.test.ts` to the honest beta path (grind → initiate →
   floors open). Carried to the coordinator report as a Phase-2 balance consequence.
5. **Nit — fixed:** element-root description referenced retired `selectSpellPathElement`
   seam name; updated to the initiation ritual wording.

## Coverage Gaps (reported, not blocking)

- No test exercises `commitFiveElementInitiation` on a Pinia `$state` proxy
  (tests use `createDefaultPlayer()` plain objects); snapshot semantics on proxies
  are covered only indirectly by the JSON boundary contract. Acceptable: JSON
  clone is proxy-safe by construction.
- Server RPC (`create_character` beta check, roll allow-list) verified by contract
  test against stubbed fetch; no live Supabase e2e exists in-repo for the beta path.

## Verification Evidence

| Command/observation | Result |
| --- | --- |
| `npm run verify` (type-check + build + full vitest) | GREEN — 846 files / 7685 tests (5 expected-fail, 1 skipped) at 18:36 |
| `npm run type-check` + `npx vitest run src/components/panels tests/architecture` (post-fix) | clean + 90 files / 454 tests |
| `ocr delegate preview -f json` | 67 reviewable / 2 excluded (.mts) — coverage 67/67 reviewed |
| Bypass grep: direct `mortalBasicSkillId=`/`spellPath.element=` writes | only gated ops + test fixture — no ungated write path |
| `mortalBoundaryContractViolation` + boot seam + draft validator | all three admissions fail closed on non-linh_bao |
| Fault-injection suite | 7 tests: each leg fails → byte-equivalent zero mutation |

## Verdict

PASS WITH GAPS — the save-boundary and transaction risks are bounded by inspection
and the atomicity contract is proven by fault injection; residual gaps are the
proxy-state and live-RPC coverage notes above (pre-existing harness limits, not
task regressions). Per-protocol: evidence feeds the coordinator's fixed-point ledger.
