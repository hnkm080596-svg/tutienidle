# M-F-JOURNEY — Mission notes (Trúc Cơ E2E journey + integration sweep)

## G0 — Task card

- **Authorized outcome:** final mission of the Trúc Cơ block —
  headless end-to-end TC journey on real merged seams, full
  integration sweep (dead authority / orphan seams / duplicated
  authorities / naming-doc drift / persisted drift), docs sync, final
  save-version decision. Sweep-only: no new behavior/features.
- **Owner:** evidence only — new harness seams inside
  `EarlyGameSession.ts` (test-surface carve-out, no `stores/*`
  imports) + `TrucCoJourney.test.ts` + docs. No production edits.
- **Stop condition (A15):** a pre-existing production defect blocking
  any mandatory acceptance item → BLOCKED pending coordinator-owned
  repair — never weakened into a passing characterization. Did not
  trigger: the ordered journey, grade ladder, checkpoint restores,
  and the census all pass on the merged base.

## Conditional-marker expansion (A13) — zero bare conditionals remain

| Conditional | Merged-base state | Resolution |
|---|---|---|
| Leg F artifact asserts | `ARTIFACT_UNLOCK_REALM_ID = 'golden_core'`; `player.artifact` undefined at TC | Concrete: unlock-realm constant pin + `artifact === undefined` + `isArtifactDomainUnlocked → false` + `isCompanionPullPoolEnabled → false` (deferral arm holds at TC ceiling) |
| Leg K body-perfection | `BODY_PERFECTION_REALM_MATERIALS` all-empty `[]` per realm | Mandatory NEGATIVE/structural leg (r83 ruling): `canPerfectBodyRealm`/`perfectBodyRealm` false ∀realm, `isBodyPerfectionRevealed` false, `discoveredMaterials`/`perfectedRealmIds` empty, multiplier 1 — plus persisted-slice parity through checkpoint 2. Positive flow = expected-deferral pending ≥1 authored material via ≥1 channel |
| Leg L hidden channels | `HIDDEN_MATERIAL_CHANNELS` = single huyết-mông `hidden_beast` channel (`bandRealmId 'qi_refining'`, `killThreshold 1000`, `spawnChancePerSpawn 0.05`); `VISIBLE_GRANT_SOURCES = []` | Concrete channel-shape pins + no-TC-band-channel assertion + persisted `hiddenBeastKills`/`hiddenChannelCycles` counters untouched by the TC journey |
| Save parity extension | `bodyPerfection.discoveredMaterials`/`perfectedRealmIds`, artifact fields, `hiddenBeastKills`/`hiddenChannelCycles` landed | Checkpoints compare detached `buildGameSave` — the FULL persisted byte surface (bags, equipment, companions, stats, talents, sites, quests, auto-farm), modulo the documented volatile/restore-derived normalization set in `normalizeVolatileSaveFields` |

## Save-version decision — NO bump (v81 stands)

`CURRENT_SAVE_VERSION = 81` at implementation start (re-read
post-rebase, head `cf766c83`). Accumulated wave bumps: v73 (M-QI-05
canonical node level) → v74 (M-QI-07 physiqueGrade) → v75
(M-F-TECHNIQUE frozen-cycle) → v76 (M-F-TALENT
`pendingTalentEntitlement`) → v77 (M-F-COMPANION-GIFT `companionGifts`)
→ v78 (M-F-CHU-THIEN `bodyProgression.zhou_tian`) → v79
(M-F-ARTIFACT-DEFER artifact deferral) → v80 (M-F-BODY-PERFECTION
`bodyPerfection` slice) → v81 (M-F-BODY-HIDDEN `hiddenBeastKills` +
`hiddenChannelCycles`).

This mission adds **zero persisted fields and zero production code** —
harness seams + tests + docs only. Every save ≤ v80 is already
rejected by the v81 boundary; no new persisted-shape requirement
exists to distinguish. Convention preserved: version rejection, no
translators.

## Integration sweep — findings table

| Audit class | Surface | Result |
|---|---|---|
| Dead authority | `ung_the_than_quyet`, `skillLevels`/`Skill.level`, `openedMeridianIds`/`luyenTheTiers`, `usesTheResource`, `swordPathRoute`, `learnByDrop`, `equipTechnique`, `passiveSkillIdsByRealm`, `innateSkillId`, `luyenTheTiers` | CLEAN — only removal-proofing comments + fail-closed `RETIRED_*`/rejection-list reads; zero live refs |
| Dead authority | `standalonePanel` retired ids (`technique`, `luyen_the`), `TechniquePanel`/`LuyenThePanel`/`TechniqueCodex`, `scripturePavilionTab` | CLEAN — no writer can emit retired ids (union/catalog-driven) |
| Orphan seams | `collectBaseStatDeltas` on zhou_tian returning `{}` | Expected blank — `collectBaseStatDeltas` is REQUIRED on baseStat chapters (validator-enforced); magnitudes deferred to balance phase, documented |
| Orphan seams | Tick auto-invest covers `body_refinement` only | Documented deferral — sole tick call site (`GameManagerTickOps.ts:119`); meridian/zhou_tian invest via explicit ops/UI seams by design |
| Orphan seams | `physiqueAdvancement` undeclared on meridian/zhou_tian | Intentional — `?:` reserved seam, validator enforces declared-only chain shape; no reader assumes presence |
| Orphan seams | `advanceArtifactRealmLevel`/`setArtifactPath`/`tryUpgradeArtifactGrade` | Owned consumers exist (ops + `BreakthroughOutcomeService`), all gated by `isArtifactDomainUnlocked` vs `ARTIFACT_UNLOCK_REALM_ID` — unreachable-but-coherent deferral, not orphan code |
| Duplicated authorities | `bodyChapterEssenceGrade` vs `PhysiqueEssence` registry | CLEAN — one resolver (`BodyChapter.ts:109`); substitution + ops read it; registry owns material-id↔grade |
| Duplicated authorities | `canTriggerBreakthrough` vs `getBreakthroughRequirements` | CLEAN — trigger delegates to the read model (`GameManagerRealmAdvanceOps.ts:756`) |
| Duplicated authorities | Release-policy composed gates | CLEAN — single `progressionCeilingRealmId` constant (`ReleasePolicy.ts:42`) feeds each predicate |
| Duplicated authorities | `player.techniqueProgress` vs `TechniqueManager` | CLEAN — read-only derived mirror republished by the manager (v73 contract); consumers read the mirror only |
| Naming drift | `zhou_tian` chapter id inside the English `body_refinement`/`meridian` family | REPORTED (pre-existing, landed authored choice) — family-map amendment records it; not fixed in-mission |
| Naming drift | `gift_*` ids (`gift_than_nong_foundation_entry`…) mix English prefix + VN content inside one id | REPORTED (pre-existing) — landed under M-F-COMPANION-GIFT; recorded in the family-map amendment |
| Naming drift | `bat-mach:` modifier prefix (VN) in the mechanic family | REPORTED (pre-existing) — landed under M5/TC meridian wave; recorded |
| Persisted drift | v72–v81 slices: `nodeLevels`, `physiqueGrade`, technique frozen-cycle fields, `pendingTalentEntitlement`, `companionGifts`, `bodyProgression.zhou_tian`, `artifact`, `bodyPerfection`, `hiddenBeastKills`/`hiddenChannelCycles` | CLEAN — every slice in `saveShapeValidation` + `buildGameSave` round-trip; the journey's two checkpoint restores assert full persisted-save byte parity over all of them |
| Boundary honesty | `EarlyGameSession.ts` imports | CLEAN — zero `stores/*` imports (only the comment recording the carve-out); journey rides real seams (`playerOwner`, `settleTribulationOutcome`, `drainTribulationOutcome`, `resolveTalentEntitlement`, `investChapter`, bag/gift/farm seams) — no mock bypasses shipped contracts |
| Restore-derived surfaces | `player.modifiers` equipment slice, `skill.passiveModifiers.stacks`, `productionSites`, `quests.active` | CLEAN/DESIGNED — equipment slice + `bat-mach:` slice rehydrated at restore (`GameManagerSaveRestore.ts:629-638`, store `setEquipmentModifiers`); passive `stacks` re-derived from authored template (`:404-408`, designed, battle accumulators); `productionSites` eager-seeded per definition (`:550-553` `ensureSiteState`); `quests.active` extended by reconcile activation. Subset-compared or normalized in `assertRestoredSaveParity`, documented in the test |
| Harness gap (fixed) | `equipAll` left `player.modifiers` equipment slice stale | FIXED — `equipAll` now resyncs `playerOwner.setEquipmentModifiers` after the equip loop, mirroring the real store-level equip flow (ops never write the modifier list) |
| Save-schema drift (pre-existing) | `hiddenChannelCycles` written onto `ProductionSiteStateSave` (`SaveSystem.ts:376`) but undeclared on the interface | REPORTED (pre-existing, coordinator-owned) — BH-landing schema drift; not fixed in-mission |
| Perfection-material census | Every authored perfection material vs `BODY_PERFECTION_REALM_MATERIALS` → hidden-beast/grotto emitted sets → `VISIBLE_GRANT_SOURCES` exemptions → `STAGE_DROP_TABLES` + `FAMILY_DROP_TABLES` + `signatureDrops` on every non-channel enemy (incl. guaranteed/pool equivalents) | CLEAN — route-less requirements `[]`, duplicate acquisition authorities `[]`, normal-loot bypasses `[]` (suite: `TrucCoJourney.test.ts` census `it`). Vacuous for perfection materials until the content pass authors ≥1; structural pins (channel shape, emitted-set completeness, `VISIBLE_GRANT_SOURCES=[]`) hold |

## Journey coverage delivered

- Ordered journey `it` — legs A → B (two-phase settle/drain) → E.1 →
  D.1+D.2 → C/E.2 interleave (G midpoint checkpoint inside at TC L9 /
  circulation 180 / floors 1–9; journey continues on the restored
  session) → continuation (L10 → floor_10 boss → L18 → 360/Đại) → F →
  I → K → L — all on real production seams, no mocks.
- Grade ladder `describe` — human / earth / heaven / great_dao /
  capped-heaven (`greatDaoOpportunityLost`) via real settle; great_dao
  arms all five inputs honestly (`pham_cot` talent, 9/9 meridians, 6/6
  refinement, mortalPerfection, L18, every main stat at cap).
- Determinism — same-seed driver runs produce identical persisted
  `buildGameSave` payloads: a deterministic `Math.random` sequence is
  pinned across the whole drive (covers the talent-offer draw -
  F-A-1 - plus equipment loot rolls and combat/hidden-beast draws).
  Normalization is limited to wall-clock stamps and crypto-minted
  instanceIds/embedded uuids; offer binding is never normalized.
- Save integrity — incoherent-progression save (zhou_tian circulation
  without complete meridian) rejected at `restoreCheckpoint` preflight.
- Seam pins — `EarlyGameSession.test.ts` +4 tests (owner identity,
  two-phase settle/drain idempotency + deferred drain, owner-less
  settle throw, bag/invest seams) — 8/8 green.

## Docs synchronization

- `docs/roadmap.md` — M-QI wave ledger + Trúc Cơ (M-F) wave section
  appended (missions, commits, save versions).
- `docs/p7/mission-graph.md` — M-QI-11/M-QI-12 status rows appended to
  the M-QI ledger; new Trúc Cơ (M-F) graph + completion ledger section.
  M-QI-12 disposition: **covered by M-F-JOURNEY** (its initiation →
  chapter-10 → L12 → breakthrough scope is subsumed by legs A–B) per
  spec §9 recommendation.
- `docs/naming-conventions.md` — family-map amendment: BodyChapter id
  family + gift-id pattern + modifier prefixes recorded (landed
  `zhou_tian`/`gift_*`/`bat-mach:` drift noted, not retro-fitted).

## Gates

- P3: `npm run verify` — type-check clean, `vite build` clean,
  full vitest 765 files: **7188 pass / 4 expected-fail / 3 fail**.
  All 3 failures are pre-existing base/env issues with zero overlap
  with this diff (harness + test + docs only):
  `dongFuBackgroundAssets` + `dongFuBuildingPipeline` =
  `spawnSync magick ENOENT` (ImageMagick absent from env — identical
  env failure recorded on the M-QI-09/10 merges);
  `SettingsPanel.test.ts` = `.confirm-modal__confirm` null click,
  fails deterministically in isolation on the pristine base state
  (file untouched since `ed35f246`; no code path reaches this diff).
- P18 OCR: delegated review over the diff — see session report.
- P13/P14: NOT triggered — headless Vitest seams + docs only; no
  wiring/render correctness surface changed (P3's `runTribulation`
  precheck mirrors `useTribulation`'s production entry).
- P4 QA: quick adversarial pass — see session report.
- P5 sequential: ≥3 passes — see session report.
