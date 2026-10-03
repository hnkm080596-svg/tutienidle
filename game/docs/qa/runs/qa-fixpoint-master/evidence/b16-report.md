# Beta Consumer-Seams Blind Audit — Verdict Report

- **Repo/branch:** hnkm080596-svg/tutienidle @ `devin/qa-fixpoint`
- **Pinned commit:** `a7d12edf` (exact state; branch head `50539385` deliberately not pulled)
- **Scope:** CONSUMER/INTEGRATION seams only — every place persisted/restored state is consumed. Admission/write gates were out of audit scope except where a consumer read proved them weak.
- **Probe file:** `tests/architecture/betaConsumerSeamsProbes.qa.test.ts` — 29 tests, all passing on the pinned state, `npm run type-check` clean.
- **Findings JSON:** `docs/qa/2026-10-01-beta-consumer-seams-blind/findings.json`

## Verdict: PASS WITH EVIDENCE

Zero confirmed defects. Every attacked consumer seam fails closed at a7d12edf: a carried dormant record deserializes inert, never mints effects downstream, and flagged saves still LOAD (`unsupportedReleaseReason` flags to a notice; `useAppLifecycle` never blocks restore on it).

One Nit-level latent coverage gap recorded (QA-CS-N1) — inert today, real binding asymmetry worth fixing when post-beta content lands.

## Findings

| id | severity | confidence | surface | verdict |
|----|----------|------------|---------|---------|
| QA-CS-N1 | Nit | confirmed-inert | `CombatBuild.ts:385` `survive.extraSources` binds `runtime.buildSurviveSources` from the **ungated** runtime | latent coverage gap — no runtime defines it at a7d12edf |

**QA-CS-N1 mint path (latent):** `resolveCombatBuild` emits `survive.extraSources` bound from `runtime` while kit/formation/aura/tranPhap/companion channels all evaluate `wayAdmitted`/`isScopeHidden`. If a post-beta dormant-way runtime gains `buildSurviveSources`, a carried `way_out_of_scope` save mints `SurviveLethalSource` entries via `GameManagerTurnBattleOps.ts:1894` — bypassing the way gate every sibling respects. No repro possible on the pinned state (grep-verified: only the type decl at `CultivationPathRuntime.ts:52` and the parked comment at `CultivationPathRegistry.ts:495`).

## Seam attack matrix (all confirmed clean)

| seam | dormant record injected | consumer attacked | result |
|------|------------------------|-------------------|--------|
| combat build | sword_pathway save + carried formationLoadout + forged talents | kit/formation/aura/clone/companion/entryBuffs | generic basic only; all dormant channels empty |
| survive charges | forged non-beta talent ids | `SurviveLethalGuard.beginBattle` | 0 uses (re-gates via `collectTalentEffects`) |
| stat assembly | forged realm-sourced modifier claim | `resolvePlayerStatAssembly` | dropped to clean baseline |
| stat cap | carried `completedHiddenBodyRealmIds` | `getEffectiveMainStatCap` | base cap only |
| talent effects | forged `pham_cot`/`pham_nhan_chi_cot` | `collectTalentEffects` + combat passive | `[]`/`undefined` |
| hidden beasts | carried window-open counter + forced rng=0 | `maybeReplaceSpawn` | no substitution; counters frozen |
| Quan The | carried active mechanic + lineage + 8/8 meridian | `resolveFinalCultivationGain` | full amount lands; bank frozen |
| Nghich Chu Tian | carried discovered+active record + funded bag | `attemptNghichChuTian` | `ineligible`, zero debit |
| alchemy | carried dormant-family job past completesAt | `tick` settle | parks; no pill, no event |
| decompose | carried started cycle + workers claim | `tick` + `settleOffline` | no output; ore untouched |
| vendor | dormant materials incl. both essence currencies | sell/preview/sellable-rows | all reject (grade gate fails closed) |
| quests | carried daily_ progress | reconcile + claim | deactivated; claim false |
| building | chi_hien_quan | canBuild/build | false/null (scope gate precedes dev flag) |
| way selection | dormant way | `chooseCultivationPath` | false, zero mutation |
| technique | carried dormant technique | `gainMastery` | `{gained:0,rankUps:0}` |
| learned skills | dormant-way passive learned | `getScaledPassiveModifiers` | `[]` |
| tribulation | carried hidden committedOutcome | `settleOutcome` | null; parks (sibling suite confirms) |
| read models | carried records | `betaCombatRolesFor`, `betaHiddenRealmRecordFor`, `unsupportedReleaseReason` | exact tri-state; hidden; flags-not-blocks |

## Tri-state verdict honesty

`betaCombatRolesFor` emits exactly one verdict per role — mortal save: basic `available` / special `progression-locked` / ultimate `scope-hidden`; dormant-way save: all `scope-hidden`. No half-rendered slot. The skill tree surfaces scope-hidden entries explicitly (`BetaSkillTreeNode.state`), never silently drops them.

## Method notes

- Blind audit: gates were read to verify, not trusted. Every claim above carries either a passing probe (fail-closed assertion on a hostile carried record) or a grep-verified production gate line.
- `SkillSystem.learn()` is write-raw by design — all its write-callers gate admission (`betaNodeWriteAdmitted`, way commits), and all consumption gates (`betaSkillAdmitted`, `wayAdmitted`). Verified clean, not a defect.
- `applyCreationProfile` writes talentIds unfiltered, but `validateCharacterCreationDraft` rejects non-beta ids (`isBetaCreationTalentId`) and consumption re-gates per-id. Verified clean.
- `survive.talentIds` passes raw ids into the build — the consumer (`SurviveLethalGuard.beginBattle → getSurviveLethalUsesPerBattle`) re-gates through `collectTalentEffects`. Verified clean.
- Dev seams (`enemySpawnDebug`, `isTestModeUnlockAll`) are `import.meta.env.DEV`-gated and mock-backend-gated; ops-layer scope gates precede the dev flag. Verified clean.
- `MaterialBagSection` renders carried dormant materials — display-only read; consistent with the "dormant, not corrupted" contract (records kept, actions gated downstream; `tinh_hoa_pham_the` is live luyen-the input).
- No production code touched; no commit/push performed (audit-only scope).
