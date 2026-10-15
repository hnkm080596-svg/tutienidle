# Trúc Cơ Foundation — Ruling Reconciliation & Mission Graph

Reconciles the completed Trúc Cơ inspection (audit basis: root `master` @ `c5f27a69`,
54 commits ahead of origin; evidence cited by file:line) against the final
authoritative ruling set (FOUNDATION INSPECTION — FINAL AUTHORITATIVE RULINGS).

Scope: ruling reconciliation + mission graph ONLY. No production changes, no
migrations, no balance numbers. Canonical-schema changes use version bump +
save invalidation, never dual-write.

In-flight prior work respected: `.agent-worktrees/mqi-05-core-node-level`
(uncommitted, 128 files, +2085/-928) implements M-QI-05 "Core Node Level =
Skill Level" — `SkillCoreNodes`/`skillCoreNodeId`/`grantSkillCore`,
core-node Insight upgrade curve (5+3·(L−1)), `devResetBranch` revokes granted
cores, `SkillPathEntry.level` reads `nodeLevels`, save shape + version updated.
The old Insight→`skill.level` writer (`SkillSystem.upgradeSkill`) no longer
appears in that worktree's SkillSystem/progressionOps. The graph below treats
it as an existing in-flight dependency, not a new mission.

---

## A. FINDING RECONCILIATIONS

### F1 — Mandatory Talent choice at major breakthrough

- RULING: §15–18 — one breakthrough → one mandatory UPGRADE/NEW decision → one
  result; cannot be bypassed, reload-safe, cancel-safe; NEW draws 3 eligible
  cards from the current-Realm pool; UPGRADE offers owned Talents with a legal
  next level; `pham_cot` evolution stays an explicit special case.
- CURRENT: no talent transaction exists. `resolveVictory`
  (`TribulationOutcomeService.ts:170-273`) writes realm/foundation/passives/
  artifact and returns the announcement; the only breakthrough-time talent
  write is the great_dao `pham_cot`→`pham_nhan_chi_cot` conversion
  (`:238-247`). Talent UI exists only in `CharacterCreationScreen.vue`
  (roll-9-pick-1, "cả đời" per `Talents.ts:6`). `TalentDefinition` has no
  level/next-level axis.
- TARGET: entitlement created at breakthrough commit → decision surface locks
  the transition → UPGRADE (legal owned upgrades only) or NEW (3 eligible
  cards, deduped, realm-pooled, no reroll in Beta) → exactly one commit →
  finalize; idempotent across reload/repeat ticks.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: canonical entitlement record on the outcome path; realm-scoped NEW
  talent pools (existing `CHARACTER_CREATION_TALENTS`/`GREAT_DAO_REWARD_TALENTS`/
  `PARKED_TALENTS` are creation/reward-scoped, not realm-pooled); authored
  next-level model for UPGRADE; decision UI + lock; settle idempotency on the
  existing committed-outcome seam.
- MISSION OWNER: **M-F-TALENT**.
- DEPENDENCIES: none hard (seam exists); sequence after M-F-CEILING so the
  entitlement honors release policy for future-realm pools.
- BALANCE DEFERRED: yes — card pools, upgrade magnitudes, per-realm pool
  composition are content/balance authoring.

### F2 — Dual Skill Insight consumers (skill.level vs nodeLevels)

- RULING: §12–13 — Insight → Node Level; Core Node Level = canonical Skill
  Level; no parallel writable skill.level+CoreNode.level; internal/fixed-kit
  actions scale through parent core/variation.
- CURRENT (master): `SkillSystem.upgradeSkill` spends `player.skillInsight`
  → `skill.level++` (`SkillSystem.ts:274-293`, op `GameManagerProgressionOps.ts:351`,
  UI `SkillDetailView.vue:88`); `skill.level` feeds combat via
  `getScaledPassiveModifiers` (`×(level−1)`). Cast-channel leveling
  (`recordCast`) is legal per ruling (fixed-kit axis).
- TARGET: one level authority (Core Node); internal actions without cores
  scale from parent; respec accounting consistent.
- STATUS: **PARTIAL — in-flight** (M-QI-05 worktree implements it; unmerged).
- DELTA: land M-QI-05; sweep master for any remaining Insight→skill.level
  writer; confirm cast-channel skills stay excluded from cores
  (worktree already enforces).
- MISSION OWNER: **M-QI-05 (existing, in-flight)**.
- DEPENDENCIES: none remaining.
- BALANCE DEFERRED: yes — core upgrade cost curve values.

### F3 — Centralized release-policy authority missing

- RULING: §49–51 — one authority (`progressionCeilingRealmId`-style);
  isRealmAvailable / isRealmTransitionEnabled / isBeyondReleaseCeiling /
  isBreakthroughAcquisitionEnabled; covers all acquisition routes.
- CURRENT: availability is implicit — `getBreakthroughRequirements` returns
  `[]` for TC+ (`GameManagerRealmAdvanceOps.ts:473-508`); missing tribulation
  chapters (`TribulationChapters.ts`); per-domain predicates
  (`CompanionAvailability.ts`, `FormationPlacement.ts:19-23`,
  `ArtifactProgression.ts:174`, `commandWheelCatalog.ts:117,141,152`);
  presence-in-table drop/recipe gates.
- TARGET: one release-policy module queried by transitions, UI predicates,
  and every acquisition route; current Beta ceiling = Trúc Cơ playable,
  TC→KD transition disabled, KD breakthrough-specific acquisition suppressed.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: new `ReleasePolicy` (repo naming); migrate scattered gates to read
  it; tag future-breakthrough resources with target-realm context.
- MISSION OWNER: **M-F-CEILING**.
- DEPENDENCIES: none — first authority primitive.
- BALANCE DEFERRED: no.

### F4 — Technique rank-10 / reset-on-grade-up model

- RULING: §3–11 — Rank 0..18; rank ceiling follows current minor-Realm level
  while Grade == current Realm band; freeze completion on Realm exit;
  manual grade-up transaction preserving history; sequential catch-up allowed
  with skipped cycles untrainable; monotonic inheritance (never grants Rank);
  breakthrough confirm surface must warn when current Grade is unperfected.
- CURRENT: `TECHNIQUE_RANK_CAP=10` (`TechniqueProgression.ts:12`); legacy
  bands 0/1-2/3-5/6-10; `advanceTechniqueGrade` → `grade+1; rank=0; mastery=0`
  (`TechniqueSystem.ts:117-128`) with no history/inheritance/perfected record;
  single live `Technique{grade,rank,mastery}` state.
- TARGET: per-grade frozen completion history {finalRank, completionState:
  partial|dai_thanh|vien_man}; rank ceiling = min(18, realmLevel) while
  grade==realmIndex; rank training disabled when grade<realm; grade-up
  preserves history+build+inheritance; confirm surface communicates freeze.
- STATUS: **CODE CONFLICT**.
- DELTA: canonical technique state gains per-grade history; gainMastery
  respects realmLevel-capped rank ceiling and the frozen-band rule;
  `tryAdvanceTechniqueGrade` reworked into the ruling's transaction;
  `BreakthroughRequirementPanel` gains unperfected-warning; save schema
  bump (new canonical fields).
- MISSION OWNER: **M-F-TECHNIQUE**.
- DEPENDENCIES: M-F-CEILING (policy reads), M-QI-05 (shared progression/
  save surfaces — sequence after to avoid colliding unmerged state).
- BALANCE DEFERRED: yes — mastery costs, inheritance coefficients.

### F5 — Technique→Node gate seam unauthored

- RULING: §11 — Technique owns Node unlock + max-level gates (not Node level).
- CURRENT: prerequisite kinds `techniqueRank`/`techniqueGrade` exist and are
  evaluated (P7-M6; mirror via `techniqueProgress`); **no authored node uses
  them** (`data/progression/*` — only tests reference).
- TARGET: authored gates exist where content wants them; semantics defined
  against the frozen-cycle model (e.g., gates read current-cycle Rank/Grade).
- STATUS: **PARTIAL** (evaluator live; zero authored usage).
- DELTA: define gate semantics under the new technique model inside
  M-F-TECHNIQUE; author gates in a later content pass.
- MISSION OWNER: **M-F-TECHNIQUE** (semantics) → TC content pass (authored gates).
- DEPENDENCIES: M-F-TECHNIQUE.
- BALANCE DEFERRED: yes — which nodes/caps is content authoring.

### F6 — General player node respec missing

- RULING: §14 — FREE Beta respec, 100% actual Insight refund, outside combat,
  cascade-reset invalid descendants, atomic/deterministic/idempotent/
  save-safe; no Technique/mastery refunds.
- CURRENT: `devResetBranch` (`NodeSystem.ts:388-484`) already implements the
  exact semantics (100% actually-paid via `paidForNodeLevels` +
  `nodeFreePurchaseRecord`, orphan-cascade, single refund write) but is
  dev/balance-scoped, has no combat guard at op level
  (`GameManagerProgressionOps.ts:320-322`), and no player UI.
  `switchRoute` (75% refund, spell route only) is a different operation.
- TARGET: player-facing respec transaction wrapping the domain primitive,
  combat-guarded, UI entry; M-QI-05's granted-core revoke already extends
  the cascade correctly.
- STATUS: **PARTIAL** (primitive correct; transaction+UI missing).
- DELTA: ops-level respec command (whole-tree and/or branch scope — pick in
  spec), combat guard, NodeTree UI, tests for repeat/restore/no-dup-refund.
- MISSION OWNER: **M-F-RESPEC**.
- DEPENDENCIES: M-QI-05 (core-revoke semantics must land first).
- BALANCE DEFERRED: no (ruling fixes free Beta).

### F7 — Trúc Cơ Kinh Mạch page

- RULING: §19 — per-realm custom content; no fixed 9-node topology; global
  invariants (new page unlocks by realm, old pages never re-lock, old pages
  completable, prerequisite integrity). TC CONTENT PENDING USER AUTHORSHIP.
- CURRENT: architecture already supports arbitrary pages —
  `MERIDIANS[].pageRealmId` grouping, `isMeridianPageUnlocked` realm-index
  unlock, per-page pace gates (`MeridianChapter.ts:63-73`), strict-prefix
  `openedIds`, cross-field integrity (`:178-185`), locked-page preview UI
  (`MeridianSection.vue`). All 9 authored nodes are QI_PAGE.
- TARGET: architecture verified for a second realm page; content stays
  pending user authorship — do not invent.
- STATUS: **SUPPORTED (architecture)** / content PENDING.
- DELTA: none for code now; when content is authored, add TC-page entries —
  verify strict-prefix + completion + integrity across pages then.
- MISSION OWNER: none now → **TC content mission (user-authored)**.
- DEPENDENCIES: user content authorship.
- BALANCE DEFERRED: yes — all node values/costs.

### F8 — Physique ladder missing

- RULING: §30/§37 — normal Body progression controls Physique; one full
  authored normal chapter → exactly one grade; perfection is a separate
  axis; never derive from realm or essence band.
- CURRENT: no physique field/system anywhere in `core/` or `Player.ts`.
- TARGET: canonical physique state; chapter-normal-completion advances one
  grade, once; persisted.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: new canonical field + advancement hook on chapter completion inside
  BodyProgressionSystem; display read-model.
- MISSION OWNER: **M-F-BODY-CORE** (bundled with chapter abstraction —
  physique is normal-progression state, same boundary).
- DEPENDENCIES: M-F-BODY-CORE internals.
- BALANCE DEFERRED: yes — grade effect values, if any beyond identity.

### F9 — Essence bands + downward substitution missing

- RULING: §38–40 — Phàm/Bảo/Pháp essence per Mortal/LQ/TC; higher essence
  auto-substitutes downward (adjacent chain, deterministic, atomic, no
  upward, no arbitrage); separate from hidden-perfection materials.
- CURRENT: only `tinh_hoa_pham_the` exists (`materials.ts:27`, mortal stage
  drops only); BodyRefinement consumes it; meridian chapter consumes
  `thong_mach_dan` pills (pillBag); no Bảo/Pháp materials, no substitution
  resolver, no essence drop band at LQ/TC.
- TARGET: essence materials + authored acquisition bands exist; body
  invest resolves lower-grade-first then adjacent downward substitution in
  one atomic transaction.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: material defs + drop/production sources + invest-resolver
  (inside BodyProgressionSystem's currency seam — `bodyChapterBag` +
  `investBodyChapterState` already centralize the spend).
- MISSION OWNER: **M-F-ESSENCE**.
- DEPENDENCIES: M-F-BODY-CORE (chapter currency seam is the substitution seam).
- BALANCE DEFERRED: yes — substitution ratios, drop amounts.

### F10 — KD+ realms still maxLevel 9

- RULING: §1 — every major Realm = 18 minor levels; normalize old caps.
- CURRENT: `golden_core…tribulation` `maxLevel: 9` +
  `realmDurationMultiplier` budgets (`realms/realm.ts:77-120`); ≤TC realms
  correctly 18 with `baseCultivationMinutes`.
- TARGET: all realms 18; time budgets re-split via the existing weight
  formula (XOR data contract stays valid).
- STATUS: **CODE CONFLICT (data)**.
- DELTA: maxLevel 9→18 for KD+; verify `getRequiredCultivation`/
  `getGlobalCultivationLevel`/equipment-scaling totals.
- MISSION OWNER: **M-F-REALM18** (small standalone data mission; may fold
  into M-F-CEILING — keep separate for reviewability).
- DEPENDENCIES: none.
- BALANCE DEFERRED: no (budgets unchanged; per-tier split follows formula).

### F11 — `requiredRealmLevel` stale comment — LOW

- RULING: n/a. `GameManagerCatalogOps.isStageUnlocked` reads it as a real
  same-realm gate; `Stage.ts` comment is stale.
- STATUS: cosmetic. DELTA: fix comment inside any touching mission or the
  final sweep. MISSION OWNER: sweep/journey mission. DEPENDENCIES: none.
- BALANCE DEFERRED: no.

### F12 — Foundation defeat rows authored without KD tribulation — LOW

- RULING §50: canonical TC→KD design may exist/testable — keep.
- STATUS: intentional future data. No delta.

### F13 — Recurring `chieu_hien_lenh` income

- RULING: §45 — no active pull pool ⇒ recurring token farming must not
  remain live to feed an unavailable pull.
- CURRENT: `daily_chieu_hien_lenh` quest (`quests.ts:59-66`) + floor-10 boss
  signatureDrop 3× token (`FoundationEnemies.ts:415-418`) — both live at TC.
- STATUS: **CODE CONFLICT** (with the new Beta acquisition model).
- DELTA: suppress both sources for Beta (release-policy or authored removal —
  decide mechanism inside the companion mission; keep architecture for future).
- MISSION OWNER: **M-F-COMPANION-GIFT**.
- DEPENDENCIES: M-F-CEILING if suppressed via policy vs deleted outright.
- BALANCE DEFERRED: no.

### F14 — `EXTENDED_REALM_LEVEL` dead constant — LOW

- STATUS: cosmetic dead constant (`realmSystem.ts:51`). DELTA: remove in a
  touching mission or sweep. MISSION OWNER: sweep. BALANCE DEFERRED: no.

### F-ART — Artifact live at Trúc Cơ

- RULING: §2, §52 — Artifact = Kim Đan+; `ngu_hanh_chau` progression/UI/
  `doan_bao_thach` acquisition at TC is an implementation/content conflict;
  must not remain live. **This closes inspection question D1 — no further
  ruling needed.**
- CURRENT: `spell_pathway` realmRewards grants `ngu_hanh_chau` at TC
  (`CultivationPathSystem.ts:376-377` + `PhapTuPath` composeRealmRewards);
  `normalizeArtifactProgress` auto-creates at `realmIndex ≥ foundation`
  (`ArtifactProgression.ts:171-182`); EXP accrues per kill
  (`BattleLootSystem.ts:651-655`); grade upgrades consume `doan_bao_thach`
  which TC floors drop 1–3/w25 (`StageDropTables.ts:68`); wheel panel enabled
  when `hasArtifactDefinition` (`commandWheelCatalog.ts:117`). The P7-era doc
  claim "Scope MVP dừng ở Trúc Cơ tầng 18" is superseded by this ruling.
- TARGET: artifact grant/normalize/exp/upgrade/UI gated to Kim Đan+;
  `doan_bao_thach` acquisition suppressed via release policy (its only live
  purpose is artifact); no TC-visible artifact surface.
- STATUS: **CODE CONFLICT**.
- DELTA: move `artifactId` reward record to `golden_core`; awaken gate → KD;
  drop-table/policy suppression of `doan_bao_thach`; panel predicate stays
  false until policy allows KD; authored doc note marking TC-scope superseded.
- MISSION OWNER: **M-F-ARTIFACT-DEFER**.
- DEPENDENCIES: M-F-CEILING (acquisition-suppression authority), M-F-REALM18
  (KD realm shape sanity — soft).
- BALANCE DEFERRED: no.

### F-TDCK — Thiên Địa Chi Kiều in normal progression (new ruling consequence)

- RULING: §23–24 — remove it from the normal visible Luyện Khí progression
  surface entirely (no name/requirements/locked entry/silhouette/hint);
  becomes hidden LQ Body-perfection material (1 of 2 required).
- CURRENT: the 9th meridian `ky_kinh_thien_dia_chi_kieu` (normal list,
  `Meridians.ts:36`) hard-requires the material via `requiresThienDiaChiKieu`
  + chapter `auxCurrency` (`MeridianChapter.ts:44-45,75-77`); the node's own
  NAME contains the material name and renders in the normal rows; the UI
  shows an `auxGate` hint on the next row (`MeridianSection.vue:91,151`).
  Drop source: hidden beast `huyet_mong` 5% (`HiddenBeasts.ts:34`).
- TARGET: normal LQ completion (whatever the normal node set becomes) must
  not require/show the material; it becomes a hidden-perfection input whose
  first acquisition reveals the hidden surface.
- STATUS: **CODE CONFLICT**.
- DELTA: see NB-1 — the Kỳ Kinh node's fate + the Đại Đạo route's implicit
  dependence on this material need explicit re-authoring inside the body/
  hidden-content missions; mechanical decoupling alone silently weakens the
  hidden route.
- MISSION OWNER: **M-F-BODY-HIDDEN** (+ follow-up content authoring).
- DEPENDENCIES: M-F-BODY-PERFECTION, NB-1 resolution.
- BALANCE DEFERRED: yes — second LQ hidden material identity/content.

### F-CHUTHIEN — Trúc Cơ Body = Chu Thiên

- RULING: §20–21, §25 — TC normal Body = Chu Thiên circulation; 20 capacity
  per minor level; 180 = Tiểu Chu Thiên (Lv9), 360 = Đại Chu Thiên (Lv18) =
  normal completion; 361–365 CANCELLED; chapters sequential (A normal → B
  may unlock when realm permits).
- CURRENT: `BODY_CHAPTERS` = `body_refinement` + `meridian` only; no TC
  chapter exists; `ModifierBodyChapter` contract (currency/auxCurrency/
  invest/applyModifiers/progress/isComplete) is the seam a new chapter kind
  implements; `investBodyChapter` op already dispatches by id.
- TARGET: new `zhou_tian` chapter — capacity tracked vs realmLevel
  (20×TC level), milestone flags at 180/360, investable per authored
  currency; sequential unlock after earlier chapters where authored.
- STATUS: **NOT IMPLEMENTED** (abstraction exists; chapter kind missing).
- DELTA: chapter state slice + definition + invest/apply + UI row + tests;
  currency choice is content/balance (candidate: Pháp essence per §38).
- MISSION OWNER: **M-F-CHU-THIEN**.
- DEPENDENCIES: M-F-BODY-CORE (chapter-kind abstraction), M-F-ESSENCE
  (if Pháp essence is the authored currency).
- BALANCE DEFERRED: yes — invest costs, per-invest amount, stat values.

### F-HIDDEN — Hidden Body perfection architecture

- RULING: §22, §26–36 — optional per-realm perfection (distinct materials:
  Mortal 1 / LQ 2 / TC 3 / KD 4…); surface completely absent until first
  material discovery; discovery is persistent state, not inventory-derived;
  partial discovery reveals only found materials; Body-domain transaction
  (validate→consume→mark→stack→rebuild), atomic/idempotent; +10pp additive
  per perfected realm applied GLOBALLY to all Body-derived base-stat
  contribution; late perfection allowed; no extra Physique grade; no leak
  to other stat sources.
- CURRENT: nothing exists — no discovery state, no hidden surface, no
  perfection transaction, no body-scoped multiplier. Body chapters emit
  `bat-mach:`/tier modifiers into `player.modifiers` (rebuilt via
  `applyModifiers`) rather than a separable `baseStats` contribution — the
  "Body-derived base-stat" pipeline the multiplier must wrap does not yet
  exist as a distinct channel.
- TARGET: canonical {discoveredMaterials, perfectedRealmIds} state; hidden
  surface renders only after first discovery; perfection transaction inside
  Body domain; `effectiveBodyBase = rawBodyBase × (1 + 0.10×perfectedCount)`
  applied in the stat pipeline before assembly.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: new canonical state + discovery marker on first material
  acquisition (loot hook) + transaction + stat-pipeline channel for
  Body-owned base stats + UI surface (hidden until discovered).
- MISSION OWNER: **M-F-BODY-PERFECTION**.
- DEPENDENCIES: M-F-BODY-CORE (chapter abstraction + a Body-owned base-stat
  channel the multiplier can target — today modifiers are percent-based and
  not separable as "body base stats"), M-F-ESSENCE (separate economies).
- BALANCE DEFERRED: yes — the 10% target is architectural; material
  identities/themes per realm are content authoring (ruling forbids generic
  numbered materials).

### F-COMP — Beta companion acquisition via pull pool

- RULING: §42–45 — no active pull pool in Beta; Thần Nông/Khai Minh arrive
  by authored MAIL/GIFT progression rewards; claim transaction idempotent;
  pull architecture may remain but empty-pool must be an explicit valid
  state; recurring token sources suppressed (F13).
- CURRENT: pull live (`GameManagerCompanionOps.pullCompanion:76-126`,
  `BETA_COMPANIONS` pool + grade roll + pity); exchange live
  (`DuyenPhanTab`); token sources live (F13); no mail/gift/claim system
  exists anywhere in core (grep: none).
- TARGET: Beta pulls unavailable (empty pool explicit state, not a hidden
  dead button); authored mail/gift claims grant the two companions;
  idempotent claim → ownership → consumed marker; token sources off.
- STATUS: **CODE CONFLICT**.
- DELTA: pull-pool activation flag / empty-pool contract; mail/gift
  primitive (new — smallest coherent: a claimable-rewards slice on
  PlayerData + claim op + UI surface); authored grant moments (content);
  token-source suppression.
- MISSION OWNER: **M-F-COMPANION-GIFT**.
- DEPENDENCIES: M-F-CEILING if token suppression goes through policy.
- BALANCE DEFERRED: yes — mail trigger moments (authored), companion
  coefficients unchanged.

### F-FORM — Formation model

- RULING: §48 — runtime everywhere; pre-TC player center + neutral Basic
  Formation + editing locked; TC editing unlock; same grid for companions.
- CURRENT: `formationLoadout=null` → `DEFAULT_PARTY_FORMATION` (player at
  hero slot, no buff — mechanically equivalent to "Basic Formation active,
  no bonus"); editing locked pre-TC at the domain layer
  (`FormationPlacement.writeFormation:66`) not just UI; 5 authored
  formations share one buff each; companions placed by id through the same
  grid; `resolvePartyFormation` consumed by `CombatBuild`.
- STATUS: **SUPPORTED**.
- DELTA: none required; optional authored "basic formation" id for display
  naming only (cosmetic, not required by the ruling's semantics).
- MISSION OWNER: none (verify inside journey mission).
- BALANCE DEFERRED: no.

### F-BREAK-CONFIRM — Breakthrough consequence surface

- RULING: §6 — confirmation must communicate that breakthrough freezes the
  current Technique Grade when unperfected.
- CURRENT: `BreakthroughRequirementPanel.vue` shows only the unequip warning.
- STATUS: **NOT IMPLEMENTED**.
- DELTA: requirement/confirm surface renders technique completion state +
  freeze warning (needs perfected-state read from M-F-TECHNIQUE).
- MISSION OWNER: **M-F-TECHNIQUE** (same boundary).
- DEPENDENCIES: M-F-TECHNIQUE core.
- BALANCE DEFERRED: no.

---

## B. UPDATED MISSION GRAPH

Dependency philosophy: authority/primitive → canonical state → transaction
→ runtime consumer → UI → content → balance → journey integration.

| # | Mission | Boundary | Depends on |
|---|---|---|---|
| M-QI-05 | **Core Node = Skill Level** (IN-FLIGHT worktree) | single skill-level authority; core catalog; respec core-revoke | — |
| M-F-CEILING | **Release-policy authority** | `ReleasePolicy` (realm availability, transition enable, ceiling, breakthrough-acquisition); migrate requirement rows, tribulation admission, domain predicates, acquisition routes | — |
| M-F-REALM18 | **Realm-18 normalization** | KD+ `maxLevel` 9→18; verify cultivation/global-level consumers | — |
| M-F-TECHNIQUE | **Technique frozen-cycle model** | Rank 0..18; realmLevel-capped rank ceiling; per-grade frozen completion history; freeze-on-advance; sequential catch-up w/o retroactive training; inheritance scaffold; grade-up transaction preserves build/history; unperfected-warning on confirm surface; technique-gate semantics (F5) | M-F-CEILING, M-QI-05 |
| M-F-RESPEC | **Player node respec** | combat-guarded atomic transaction over `devResetBranch` semantics (100% actual paid, cascade), UI entry | M-QI-05 |
| M-F-TALENT | **Mandatory breakthrough Talent transaction** | entitlement record; UPGRADE/NEW decision surface + lock; realm talent pools; next-level model; one-decision-one-result idempotency | M-F-CEILING |
| M-F-BODY-CORE | **Body chapter abstraction + Physique** | chapter-kind support (refinement/meridian/zhou_tian); Body-owned base-stat channel; physique state + once-per-chapter advancement | M-F-REALM18 |
| M-F-ESSENCE | **Essence bands + substitution** | Bảo/Pháp materials + acquisition bands; atomic downward-substitution resolver at the body invest seam | M-F-BODY-CORE |
| M-F-BODY-PERFECTION | **Hidden perfection architecture** | discovery persistence; hidden-until-discovered surface; perfection transaction; +10pp additive global Body-stat multiplier | M-F-BODY-CORE, M-F-ESSENCE |
| M-F-CHU-THIEN | **Trúc Cơ Chu Thiên chapter** | zhou_tian chapter (20/level; 180/360 milestones); sequential unlock; UI row | M-F-BODY-CORE (+M-F-ESSENCE if essence currency) |
| M-F-BODY-HIDDEN | **Thiên Địa Chi Kiều decoupling + LQ hidden content** | remove material from normal meridian surface; re-author Kỳ Kinh + hidden-route reads (NB-1); author LQ perfection materials (2) | M-F-BODY-PERFECTION, NB-1 resolution |
| M-F-ARTIFACT-DEFER | **Artifact deferral to KD** | grant/normalize/exp/upgrade/UI → KD+; doan_bao_thach suppression | M-F-CEILING |
| M-F-COMPANION-GIFT | **Beta companion mail/gift** | empty-pool valid state; idempotent claim→grant→consumed; suppress daily+boss token sources | M-F-CEILING (if policy-based suppression) |
| M-F-CONTENT-TC | **Trúc Cơ content authoring pass** | technique-gated nodes (F5), essence drop bands, Chu Thiên values, hidden-perfection material identities (non-LQ), companion mail moments | respective domain missions |
| M-F-JOURNEY | **Canonical TC journey integration** | full-chain journey tests + endpoint UI + sweep (F11/F14) | all above |

Not in graph: **TC Kinh Mạch content — PENDING USER AUTHORSHIP**
(architecture verified sufficient; no code mission until content exists).

---

## C. NO-LONGER-OPEN DESIGN QUESTIONS

The inspection report's open questions are resolved by the ruling set —
do not reopen:

- ~~D1 (Artifact realm gate)~~ → Kim Đan+; TC artifact is a defect to remove.
- ~~D2 (Technique as breakthrough input)~~ → hard rule: Technique never gates
  Realm breakthrough.
- ~~D3 (Talent-choice content)~~ → UPGRADE/NEW transaction per §15–18;
  next-level model + realm pools authored inside M-F-TALENT.
- ~~D4 (TC Kinh Mạch page)~~ → custom per-realm content; pending user
  authorship; architecture sufficient.
- ~~D5 (Respec surface/cost)~~ → FREE Beta, 100% actual refund, out-of-combat,
  cascade; transaction+UI is M-F-RESPEC.
- ~~D6 (Recruitment finiteness)~~ → no active pull pool in Beta; recurring
  token sources suppressed; gift delivery.

---

## D. NEW BLOCKERS

### NB-1 — Kỳ Kinh node & Đại Đạo hidden route after Thiên Địa Chi Kiều decoupling

- Evidence: `Meridians.ts:36` — the 9th meridian `ky_kinh_thien_dia_chi_kieu`
  requires `requiresThienDiaChiKieu: true` and sits in the NORMAL sequential
  list; `resolveKienCoGrade` (`BreakthroughGrades.ts:48`) requires all 9
  meridians for `great_dao`. So today the Đại Đạo hidden route implicitly
  requires the hidden material (5% hidden-beast drop). `mortalPerfectionAchieved`
  is likewise read by the same resolver (`:53`).
- Conflict: ruling §23–24 removes the material from normal progression and
  makes it hidden-perfection input. If the Kỳ Kinh node simply loses the aux
  requirement, the Đại Đạo route silently drops its hardest acquisition
  condition. If Kỳ Kinh itself moves into hidden scope, the resolver's
  "9 meridians" condition needs re-authoring — and whether `great_dao` should
  read the new hidden-perfection state (and/or a redefined mortal-perfection
  concept now that perfection is material-based, not stat-snapshot) is
  unaddressed by the rulings.
- Needed ruling: what does the Đại Đạo hidden route require after the body
  restructure — (a) unchanged semantics (all normal chapters incl. Kỳ Kinh
  + hidden perfection as authored conditions), (b) explicit hidden-perfection
  reads replacing the meridian-9/mortal-snapshot proxies, or (c) the current
  condition set literally re-pointed?
- Blocks: M-F-BODY-HIDDEN content authoring (mechanical decoupling can
  proceed without it; the hidden-route rewrite cannot).

No other ruling set gaps found: all other findings map cleanly to rulings
with existing or specified seams.

[C2C] STATE FOUNDATION_RULINGS_RESOLVED
