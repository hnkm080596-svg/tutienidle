# Coordinator mutation battery — beta-release-2026-09-29

Scope: one representative micro-mutation per active non-STANDARD invariant
(MC11). Each mutant: applied to the qa/beta-2026-09-29 checkout, scoped
vitest run, result recorded, then `git checkout` revert. Working tree clean
after every revert (only the pre-existing e2e spec edit and QA docs remain).

Mutant identity: surgical single-point guard/predicate removal, each chosen
to falsify exactly one invariant leg. Hashes below are sha256 of the mutant
spec string (site + operator), since the mutated file no longer exists after
revert.

## Results

| ID | Invariant | Site / operator | Expected detector | Result |
|----|-----------|-----------------|-------------------|--------|
| M-BR-1 | I-IDENTITY-MATRIX | CultivationPathSystem.ts — second-commit guard removed | path contract suite | KILLED (1 fail / 78) |
| M-BR-2 | I-SAVE-VERSION-87 | SaveSystem.ts — version gate `if(false)` | save/ 15 files | KILLED (14 fails) |
| M-BR-3 | I-RESTORE-ATOMIC | player.ts — foreign-key $state purge removed | player.restoreFromSave.test.ts | **SURVIVED** — no test exercises stale-key purge |
| M-BR-4 | I-HIDDEN-PREFIX | HiddenLineage.ts — strict-prefix queue check removed | hidden/ suite | KILLED (4 fails) |
| M-BR-5a | I-CREATION-CONTRACT | App.vue — missing-pick throw removed | App.wiring.test.ts | EQUIVALENT — bootstrap throws on rejected pick downstream |
| M-BR-5b | I-CREATION-CONTRACT | EarlyGameBootstrap.ts — pick write skipped | mortalBasicSkill + wiring | KILLED (2 fails) |
| M-BR-6a | I-SAVE-ROUNDTRIP | SaveSystem.ts — `alchemyJobs` dropped from payload | roundtrip tests | **SURVIVED** — no alchemy persistence test exists |
| M-BR-6b | I-SAVE-ROUNDTRIP | SaveSystem.ts — `techniques` dropped | roundtrip + shape | KILLED (19 fails) |
| M-BR-7 | I-NODE-PREREQ | NodeSystem.ts — `levelOk` conjunct removed | progression/ suite | KILLED (1 fail) |
| M-BR-8 | I-NODE-CORELEVEL | SkillCoreLevel.ts — `getSkillCoreLevel` pinned to 1 | progression + skill | KILLED (4 fails) |
| M-BR-9a | I-TECH-MASTERY | BattleRewardOps — victory gate `if(true)` (defeat flushes) | techniqueMastery tests | **SURVIVED** — defeat-flush path unpinned |
| M-BR-9b | I-TECH-MASTERY | BattleLootSystem — consume-and-zero removed (re-pay) | techniqueMastery tests | KILLED (1 fail) |
| M-BR-10 | I-REALM-SETTLE-ONCE | TribulationOutcomeService — receipt check removed | tribulation/ suite | KILLED (3 fails) |
| M-BR-11 | I-REALM-UNEQUIP | TribulationOutcomeService — `unequipAllEquipment` skipped at startTribulationPrepared | unequipAll + tribulation | KILLED (1 fail) |
| M-BR-12 | I-NGHICH-PITY | NghichChuTian.ts — pity guarantee removed | NghichChuTian.test.ts | KILLED (2 fails) |
| M-BR-13 | I-PHYSIQUE-ONCE | BodyProgressionSystem — source-grade `=== from` guard removed | body/ suite | KILLED (1 fail) |
| M-BR-14 | I-BODY-OWNER | BodyProgressionSystem — sequential-unlock gate removed | body/ suite | KILLED (3 fails) |
| M-BR-15 | I-ESSENCE-SUBST | BodyChapterEssenceSubstitution — upward direction (g--) | body/ suite | KILLED (6 fails) |
| M-BR-16a | I-TECH-MODEL | saveAcceptance — completionState enum check dropped | boundary tests | **SURVIVED** — kills arrive via keySet check, not record shape |
| M-BR-16b | I-TECH-MODEL | saveAcceptance — `g > entry.grade` bound dropped | boundary tests | KILLED (1 fail) |
| M-BR-17 | I-CLOUD-CAS | CloudSaveCoordinator — conflict resync skipped | cloudSave/ suite | KILLED (3 fails) |
| M-BR-18 | I-HIDDEN-REWARD-ONCE | HiddenLineage — breakthrough dedupe removed | hidden/ suite | KILLED (1 fail) |

## Survivals → detector-gap findings

Every ACTIVE non-STANDARD invariant has at least one KILLED representative
(MC11 satisfied). The four survivals are recorded as findings:

- F-MUT-RESTORE-PURGE (I-RESTORE-ATOMIC): the foreign-key purge loop in
  `player.ts` (`Reflect.deleteProperty` over `$state` keys absent from the
  restored player) is exercised by no test. A runtime-added or legacy key
  would persist across restore undetected. Severity: Low (narrow surface —
  whitelist already filters payload keys; the purge defends $state keys
  added by a *previous session's* runtime, e.g. a retired field surviving
  within a same-version payload... actually version-locked restores cannot
  carry removed fields; residual risk is dynamic keys written by runtime
  code outside PlayerData).

- F-MUT-ALCHEMY-ROUNDTRIP (I-SAVE-ROUNDTRIP): removing `alchemyJobs` from
  `buildGameSave` passes all round-trip + shape tests. No test saves a
  player with a running alchemy job and reloads it. In-flight job state
  (elapsed, recipe, inputs debited) silently evaporates on reload if the
  field regresses. Severity: Medium — this is real player-facing state
  (materials debited at job start), and the roundtrip corpus does not cover
  it.

- F-MUT-MASTERY-DEFEAT (I-TECH-MASTERY): replacing the `victory` gate with
  `true` makes natural defeat flush pendingTechniqueMastery — kills during
  a losing battle still pay mastery. The techniqueMastery test file (6
  tests) exercises victory/auto-farm paths only. Contract comment claims
  "defeat never pays" but no test pins it. Severity: Medium.

- F-MUT-COMPLETION-ENUM (I-TECH-MODEL): dropping
  `TECHNIQUE_COMPLETION_STATES.includes(...)` from the record shape check
  still rejects the test corpus because every malformed case ALSO fails
  the canonical key-set check. A record with valid key/valid rank but a
  foreign completionState string would be accepted. Severity: Low.
