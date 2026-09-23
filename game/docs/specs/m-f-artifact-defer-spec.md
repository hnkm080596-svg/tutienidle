# M-F-ARTIFACT-DEFER — Artifact deferral to Kim Đan+ — Spec

Status: v1.3 — draft (worker-authored, amended after C2C spec
review round 56: spell_pathway reward override keyed by
ARTIFACT_UNLOCK_REALM_ID (computed key) — pending re-review)
Depends on: M-F-CEILING release-policy authority (merged on
`p7/truc-co` — `core/realm/ReleasePolicy.ts` owns
`progressionCeilingRealmId`, `isRealmAvailable`,
`isBeyondReleaseCeiling`, `isRealmTransitionEnabled`,
`isBreakthroughAcquisitionEnabled`, and the domain-predicate
composition rule `isRealmAvailable(unlock) && isRealmAvailable(realm)
&& reached(unlock)`), REALM18 (all major realms run realmLevel 1..18).

Mission-graph scope: the Trúc Cơ mission-graph ruling (§2, §52) —
**Artifact = Kim Đan+**. `ngu_hanh_chau` progression/UI and
`doan_bao_thach` acquisition at Trúc Cơ is an
implementation/content conflict and must not remain live. The
P7-era doc claim "Scope MVP dừng ở Trúc Cơ tầng 18" is superseded
for the artifact domain by this ruling.

Not in scope: artifact content rebalancing (level curve, grade
multipliers, milestone copy), UI redesign of panel or wheel, the
future Kim Đan feature surface itself, save migration / stripping
persisted state, the parked combat runtime (`ArtifactRuntime` —
unwired, verified no combat import), Kiếm Tu / Thể Tu artifact
definitions.

## 1. Ruling + verified current state

Verified on `origin/p7/truc-co` (tip `271df96e`, this branch's
base). Coordinator line numbers were slightly stale; symbols below
are the live ones.

- **Grant**: `spell_pathway` realmRewards declares
  `artifactId: 'ngu_hanh_chau'` at `foundation_establishment`
  (`core/phap-tu/PhapTuPath.ts` — `composeRealmRewards` way
  override merged onto `CANONICAL_REALM_PASSIVE_LADDER`). Delivery:
  `grantCultivationPathRealmReward`
  (`core/player/CultivationPathSystem.ts` — `grantPathRealmReward`)
  materializes `player.artifact` on realm entry iff
  `isRealmAvailable(realmId)` (fails closed); called post-write
  from `TribulationOutcomeService.resolveVictory` and exposed via
  `GameManagerRealmAdvanceOps.grantCultivationPathRealmReward`.
- **Awaken/normalize**: `normalizeArtifactProgress`
  (`core/artifact/ArtifactProgression.ts`) auto-creates the
  expected artifact whenever
  `meetsAwakenGate = isArtifactDomainUnlocked(player.realmId)`;
  `ARTIFACT_UNLOCK_REALM_ID` is a single constant
  (`'foundation_establishment'` today) whose header comment already
  anticipates this mission. `resolveExpectedArtifactId`
  (`Artifact.ts`) is a CEILING-owned, policy-agnostic seam scanning
  `way.realmRewards` — a persisted artifactId-match survives
  beyond-ceiling normalize untouched (C2C-12: restore never strips
  ownership).
- **EXP**: `BattleLootSystem.grantArtifactExperience` runs per kill
  and already gates on
  `player.artifact && isArtifactDomainUnlocked(player.realmId)` —
  the constant move retargets it with no code change. The artifact
  realm-tier advance `advanceArtifactRealmLevel`
  (`BreakthroughOutcomeService` — `if (player.artifact)` only) and
  the ops-level `setArtifactPath` / `tryUpgradeArtifactGrade`
  (`GameManagerRealmAdvanceOps`) have **no** domain gate today —
  safe only because the unlock realm is TC; a beyond-ceiling save
  can currently path/upgrade through ops while the wheel is locked.
- **Material**: `doan_bao_thach` is a weighted row in the
  `foundation_establishment` stage pool
  (`data/drop/StageDropTables.ts` — 1-3 @ w25) whose material
  record (`data/materials/materials.ts`) carries no release
  tag; the existing post-resolve policy filter
  (`BattleLootSystem` material arm →
  `isBreakthroughAcquisitionEnabled`) therefore never applies to
  it. Its only live consumer is `tryUpgradeArtifactGrade`
  (artifact grade ladder). Note: `breakthroughRealmId` alone
  cannot express this ruling — it is a transition-window tag
  (delivery iff the predecessor→target transition is open) and
  would still deliver the stone to a below-KD player once the KD
  window opens. The ruling requires window **and** player reach
  (C2C spec round 48, High).
- **Wheel**: `phap_bao` slot (`data/ui/commandWheelCatalog.ts`)
  enables while `artifactDomainUnlocked && hasArtifactDefinition`;
  `disabledReason` resolves `RELEASE_UNAVAILABLE_REASON`
  ('Chưa mở trong bản hiện tại' — the policy-owned string for
  deferred domains) only on beyond-ceiling saves
  (`realmReleaseUnavailable`), otherwise `'Cần đạt Trúc Cơ'` —
  wrong once the unlock realm moves to KD: a TC player would see a
  progression lock for a realm they already hold.

## 2. Model — deferred-domain state machine

The artifact domain is a realm-scoped domain like companion and
formation: it opens at the declared unlock realm
(`ARTIFACT_UNLOCK_REALM_ID`) inside the release window, and the
single predicate `isArtifactDomainUnlocked(realmId)` is the one
every artifact action evaluates. Under the ruling the unlock realm
moves `foundation_establishment → golden_core`. No new persisted
state, no strip pass. **Save-version note (impl-time override):**
the Phase-2 coordinator directive mandates `CURRENT_SAVE_VERSION
76 → 77` on this branch — spec A8's "no save-version bump" is
superseded by that directive (saves written under the Trúc Cơ-era
grant model must not load under the deferred model; no migration,
no compat translator).

- **Window closed (all live builds today)**: the unlock realm is
  beyond `progressionCeilingRealmId` → `isArtifactDomainUnlocked`
  is false for every realm → awaken/normalize never create, the
  `golden_core` reward record is undeliverable (realm unavailable →
  grant fails closed), EXP feed / tier advance / path / upgrade
  no-op, `doan_bao_thach` suppressed at the material-tag policy
  seam, wheel slot disabled with `RELEASE_UNAVAILABLE_REASON`.
- **Window open, player below unlock (future KD release, below-KD
  saves)**: `isArtifactDomainUnlocked` false for the player's realm
  → same negative behavior; slot shows the progression string
  `'Cần đạt Kim Đan'`.
- **Window open, player at/above unlock (KD+, future)**: grant
  delivers on KD entry (merged record also carries the canonical
  `passive_kim_dan_chi_quang` ladder passive), normalize awakens,
  EXP/upgrade/path flow, stone drops resume, slot enabled (Pháp Tu)
  or definition-pending (other paths — unchanged rule).

## 3. Ownership invariants (restated + new)

Bind from M-F-CEILING:

- `resolveExpectedArtifactId` stays a CEILING-owned,
  policy-agnostic way-declaration seam — this mission changes the
  declaration (the record's realm key), never the resolver.
- Restore never strips ownership (C2C-12): persisted artifactId
  matches survive normalize dormant; no strip pass, no migration —
  persisted shape is unchanged
  (`saveShapeValidation` artifact block untouched; the coordinator-
  mandated 76 → 77 version bump rejects pre-deferral saves outright,
  it does not transform them).
- Acquisition suppression lives at the tag+policy authority
  (`breakthroughRealmId` + `isBreakthroughAcquisitionEnabled`),
  not per-call-site (INV-CEILING-3); owned stock is conserved
  (INV-CEILING-4).
- Realm-reward delivery already fails closed on
  `isRealmAvailable(realmId)` — moving the record's realm key is
  sufficient; no new delivery gate.

New:

- **AD-INV-1 — Domain gate single-sourced.** Every live artifact
  action (awaken, realm-entry grant, EXP feed, realm-tier advance,
  path select, grade upgrade, material delivery, wheel predicate)
  evaluates `isArtifactDomainUnlocked` directly or composes it —
  none re-derives the realm constant.
- **AD-INV-2 — No artifact before the unlock realm.** A fresh save
  at realmIndex < golden_core never materializes `player.artifact`:
  normalize never creates, grant never delivers, awaken never
  fires.
- **AD-INV-3 — `doan_bao_thach` delivers iff the artifact domain
  is unlocked for the player.** One canonical delivery rule
  composes release availability AND player reach —
  `isRealmAvailable(domainUnlockRealmId) &&
  isRealmAvailable(playerRealmId) && reached(domainUnlockRealmId)`,
  the same three-leg composition the domain predicates use — not a
  window-only check. On the retained TC row: a below-KD player
  receives nothing under any window; a KD player receives the
  stone once the window opens. The post-resolve filter drops it
  before bag credit. Census verified the material has no quest
  `itemDrops`, alchemy, or shop route — the loot arm is the only
  authored delivery channel; the predicate lives in ReleasePolicy
  so any future route composes the same rule.
- **AD-INV-4 — `phap_bao` slot state machine.** Enabled iff
  `artifactDomainUnlocked && hasArtifactDefinition`. While the
  unlock realm is outside the release window and the domain is
  closed → `RELEASE_UNAVAILABLE_REASON`; window open, player below
  unlock → progression string; `!hasArtifactDefinition` →
  definition-pending string (unchanged).
- **AD-INV-5 — Persisted artifact state conserved.** Pre-deferral
  TC artifacts in existing saves remain readable and dormant —
  never destroyed, never auto-stripped, never awakened into.

## 4. Seam changes (delta → implementation surface)

### D1 — grant + awaken → KD+

- `core/phap-tu/PhapTuPath.ts`: realmRewards override key moves to
  the shared declaration — `[ARTIFACT_UNLOCK_REALM_ID]` computed
  key carrying `{ artifactId: 'ngu_hanh_chau' }` (C2C-56: the
  realm-entry grant authority must not re-author the realm
  literal; a duplicated key could drift from the domain unlock on
  a future retarget). The merged record shares the realm entry
  with the canonical `passive_kim_dan_chi_quang` ladder passive.
  `ngo_dao` keeps its empty override (no artifact authored).
  Integrity pin in the census: the unique `spell_pathway` reward
  record containing `artifactId` is keyed by
  `ARTIFACT_UNLOCK_REALM_ID`.
- `core/artifact/ArtifactProgression.ts`:
  `ARTIFACT_UNLOCK_REALM_ID = 'golden_core'` — single-constant move
  retargets the awaken gate, EXP feed, and wheel predicate; the
  self-referencing M-F-ARTIFACT-DEFER comment resolves in place;
  `ARTIFACT_MAX_DESIGNED_LEVEL` comment reframed (designed envelope
  stays 18 levels — the domain, not the envelope, is deferred).
- `core/tribulation/BreakthroughOutcomeService.ts`: the
  documented-unreachable major-realm awaken branch re-aligns its
  hardcoded realm to `ARTIFACT_UNLOCK_REALM_ID` and gains
  `isArtifactDomainUnlocked(player.realmId)` — a hypothetical
  future reach cannot bypass the deferral (branch preserved per
  A12; removal is a separate evidence-based decision). The tier
  advance `advanceArtifactRealmLevel` guard gains the domain
  predicate so dormant artifacts stop tracking realmLevel.
- `data/artifact/NguHanhChau.ts`: declared `unlockRealmId` →
  `ARTIFACT_UNLOCK_REALM_ID` (constant reference, not a literal) —
  dormant field (zero consumers, verified), moved for authored
  truth and single-declaration consistency, not behavior.

### D2 — `doan_bao_thach` delivery rule (C2C-48 High — window
AND player reach)

The stone belongs to the artifact domain, not to a breakthrough
transition: `breakthroughRealmId` answers "is the transition into
the tagged realm open" — under an open KD window it would deliver
to a below-KD player, contradicting the ruling. The canonical
rule is therefore a **domain-scoped acquisition tag**, a parallel
tag family beside the breakthrough one:

- `core/realm/ReleasePolicy.ts`: new canonical predicate —
  `isDomainScopedAcquisitionEnabled(domainUnlockRealmId?,
  playerRealmId)` composing
  `isRealmAvailable(domainUnlockRealmId) &&
  isRealmAvailable(playerRealmId) &&
  getRealmIndex(playerRealmId) >=
  getRealmIndex(domainUnlockRealmId)` — the same three-leg rule
  `isArtifactDomainUnlocked` uses, generalized for resources so
  AD-INV-1 holds for material delivery without artifact-specific
  branching in generic code. Untagged → `true` (not
  domain-scoped); unknown realm ids fail closed.
- `core/material/Material.ts`: record type gains
  `domainUnlockRealmId?: string` (same optional-tag convention as
  `breakthroughRealmId`).
- `data/materials/materials.ts`: `doan_bao_thach` gains
  `domainUnlockRealmId` authored THROUGH the shared domain
  declaration — `domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID`
  (import from `core/artifact/ArtifactProgression.ts`), not a
  repeated `'golden_core'` literal (C2C-52: one authored realm
  value for the artifact domain — a duplicated literal could drift
  from the domain unlock on a future retarget).
  `breakthroughRealmId` is NOT used (wrong semantics); the two tag
  families stay distinct.
- `core/game/BattleLootSystem.ts`: the material arm composes the
  new predicate beside the breakthrough check at the same
  post-resolve seam —
  `!isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId,
  this.player.realmId) → skip` — delivery-side, policy-authority,
  not per-call-site. `this.player.realmId` is already read by
  `grantArtifactExperience` on the same system.
- `data/breakthrough/BreakthroughScopedResources.ts`: parallel
  census list for the domain-scoped family (e.g.
  `DOMAIN_SCOPED_MATERIAL_IDS = ['doan_bao_thach']`) — same
  two-direction invariant as the breakthrough lists (listed ⇔
  tagged), PLUS a cross-field pin: every domain-scoped material's
  `domainUnlockRealmId === ARTIFACT_UNLOCK_REALM_ID` (the stone is
  the artifact domain's resource — the census proves the tag
  cannot drift from the domain unlock id). The stone is NOT added
  to `BREAKTHROUGH_SCOPED_MATERIAL_IDS` (it is domain-scoped).
- `data/drop/StageDropTables.ts`: the TC-floor row **stays** —
  authored TC-stage drop; the delivery rule, not the table, is the
  gate. Under an open KD window a below-KD player resolving that
  row still receives nothing (reach leg); a KD player resolving
  the same row receives the stone (intended resume). Removing the
  row would be a content decision beyond this ruling.
- `core/reward/RealmRewardScale.ts`: comment citing the
  "doan_bao_thach drop-table gate" stays accurate (row remains
  TC-scoped); refreshed only if it implies removal.

### D3 — EXP + upgrade + wheel → KD+

- `core/game/BattleLootSystem.ts`: `grantArtifactExperience` — no
  code change (already composes the domain predicate); header
  comment refresh naming the deferred domain.
- `core/game/GameManagerRealmAdvanceOps.ts`: `setArtifactPath` and
  `tryUpgradeArtifactGrade` gain
  `isArtifactDomainUnlocked(player.realmId)` guards — closes the
  ops-level hole where beyond-ceiling saves can path/upgrade while
  the wheel slot is locked.
- `data/ui/commandWheelCatalog.ts` +
  `components/game/DongFuCommandWheel.vue`: context gains the
  deferred-window flag (`isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID)`
  feed, named alongside the existing `realmReleaseUnavailable`);
  slot `disabledReason` resolves `RELEASE_UNAVAILABLE_REASON` while
  the unlock realm sits outside the window and the domain is
  closed, else `'Cần đạt Kim Đan'` while the window is open and the
  player is below unlock. Slot stays rendered+disabled — no layout
  change (no UI redesign).
- `ArtifactPanel.vue`: unchanged — entry is wheel-gated, same
  precedent as companion/formation panels; ops-level guards cover
  any hypothetical non-wheel invocation.

### D4 — superseded doc claim

- `core/artifact/Artifact.ts`: the `resolveExpectedArtifactId` doc
  carrying "Scope MVP dừng ở Trúc Cơ tầng 18" and the
  grants-at-foundation comment → replaced by the ruling note
  (artifact domain deferred to `golden_core`; way record lives at
  KD while unreleased).
- `game/docs/systems/artifact.md`: status line + unlock claims →
  deferred-KD (milestone copy already noted as retained design
  data).
- `game/docs/game-guide.md` "Giới hạn scope progression" paragraph:
  notes the artifact domain rides the same deferred window as the
  other Kim Đan content listed there.
- In-code comments carrying the stale claim refresh alongside seam
  edits (PhapTuPath kit comment, BattleLootSystem EXP header,
  catalog slot comments, drop-test header).

### D5 — tests: §5.

## 5. Verification surface

Update suites (existing files):

- `core/realm/ReleasePolicy.test.ts`: artifact-domain rows —
  `isArtifactDomainUnlocked('foundation_establishment')` flips
  false; normalize-awaken and grant-dormant cases re-asserted at
  TC (no awaken, persisted match survives dormant, persisted
  mismatch cleared and not re-created).
- `core/artifact/ArtifactProgression.test.ts`: normalize at TC
  creates nothing; mismatched persisted id cleared (never
  re-created); tier-advance semantics unchanged below the gate.
- `stores/player` artifact tests (`player.artifact.test.ts`):
  restore at TC no longer auto-creates; persisted artifact survives
  dormant.
- `core/game/GameManager.artifactGradeUpgrade.test.ts`: op-level
  domain gate — TC/mortal upgrade returns false; positive cases
  move to the mocked-policy boundary file.
- `core/game/BattleLootSystem.artifactDrop.test.ts`: stone rows at
  TC now assert suppressed delivery under real policy (fixture
  registers the domain tag); EXP block at TC asserts 0 accrual;
  header comment refresh (gate = domain tag + player reach, not
  table data).
- `core/game/battleLootTestSetup.ts`: `materialIds` gains a
  per-record carrier for `domainUnlockRealmId` (parallel to the
  existing `pillTemplates` option) — the fixture fabricates fresh
  registries, so the tag must be passed explicitly.
- Grant suite covering `grantCultivationPathRealmReward`
  (`CultivationPathSystem` tests / `GameManagerRealmAdvanceOps`
  tests): TC delivers no artifact record; golden_core delivery
  lives in the mocked-policy file.
- `core/tribulation/BreakthroughOutcomeService` tests: tier advance
  no-ops while domain closed; awaken branch domain-gated.
- `tests/e2e/cultivation-path-ritual.spec.ts`: spell_pathway oracle
  flips — TC save restores with no materialized artifact and the
  `phap_bao` slot aria-disabled with the release-unavailable
  reason; hidden_spell_pathway case unchanged.

New suites:

- **KD boundary positive file** (new test file — `vi.mock`s
  `core/realm/ReleasePolicy` so `isRealmAvailable('golden_core')`
  returns true, the same mock pattern the suite already uses for
  `TribulationChapters`; mocking inside `ReleasePolicy.test.ts`
  would break its other suites): `isArtifactDomainUnlocked
  ('golden_core')` true; normalize awakens at KD; grant delivers
  the `golden_core` record on KD entry; EXP accrues at KD;
  `setArtifactPath`/`tryUpgradeArtifactGrade` succeed; slot
  enabled for Pháp Tu.
- **Stone delivery pinned on the REAL retained TC row** (C2C-48
  Medium — no invented/mocked KD-stage row): under the mocked-open
  window, a `golden_core`-realm player resolving the actual
  `foundation_establishment` stage pool entry receives
  `doan_bao_thach`; a `foundation_establishment`-realm player
  resolving THE SAME row receives zero. Both outcomes run through
  the real `StageDropTables.foundation_establishment` pool — the
  fixture stage already resolves the real table (`fe_5` /
  requiredRealm `foundation_establishment`); only the material
  registry record is fabricated, carrying the domain tag.
- **Policy-reason assertions** (inside the catalog/wheel test
  surface): slot disabledReason = `RELEASE_UNAVAILABLE_REASON`
  at/below TC while deferred; mocked-open + below-KD →
  `'Cần đạt Kim Đan'`; mocked-open + `!hasArtifactDefinition` →
  definition-pending string.

Unaffected by design: `saveShapeValidation` artifact block,
`resolveExpectedArtifactId` mechanics, `ArtifactRuntime` (parked,
unwired), quest/alchemy/shop channels (stone has none — census).

## 6. Risks / edge cases

- **Persisted TC artifacts (pre-deferral dev saves)** — survive
  dormant: normalize keeps the id-match, EXP/tier advance no-op,
  ops gated, slot disabled. No strip, consistent with C2C-12.
- **Beyond-ceiling dev saves (golden_core+)** —
  `isArtifactDomainUnlocked('golden_core')` is false under real
  policy (realm unavailable) → dormant too; the mocked-policy
  suite covers the open case.
- **Ops-level hole today** — `setArtifactPath` /
  `tryUpgradeArtifactGrade` are callable via ops without the wheel;
  D3 closes it. Recorded here so C2C sees the fix is also a
  bug-fix within scope (responsibility = domain gate).
- **Unreachable awaken branch** — re-aligned to the constant +
  gated, not removed; keeps the deferred architecture correct if a
  future chain ever reaches it.
- **`unlockRealmId` dormant** — moved for authored truth; zero
  behavior impact; flagged so QA does not credit it as a seam.
- **Stone retention in bag** — owned `doan_bao_thach` in existing
  saves is conserved (acquisition suppression only); the
  post-KD-release player can spend it.

## 7. Consistency invariants (persisted/read state)

- `player.artifact` on a post-normalize save exists only at
  realmIndex ≥ `golden_core`, or as dormant pre-deferral state.
- `doan_bao_thach` owned counts conserved — suppression is
  acquisition-side; owned stock is never removed.
- No `artifact` key materializes on fresh `mortal` /
  `qi_refining` / `foundation_establishment` saves.
- Wheel context fields stay display-only predicate feeds — no
  production mutation flows through them.
- `ARTIFACT_UNLOCK_REALM_ID` is the single domain declaration —
  no second realm literal is authored for the artifact domain:
  `material('doan_bao_thach').domainUnlockRealmId` references the
  constant (import, not literal) and the census test pins
  `=== ARTIFACT_UNLOCK_REALM_ID`; `NguHanhChau.unlockRealmId`
  likewise references the constant; the `spell_pathway`
  realmRewards override carries the artifact record under a
  computed `[ARTIFACT_UNLOCK_REALM_ID]` key with an integrity pin
  asserting the unique artifact-bearing record sits at that key.

## 8. Out of scope (restated)

Artifact content rebalancing (level curve `20 × level^1.35`,
`ARTIFACT_GRADE_MULTIPLIER`, milestone copy), UI redesign of panel
or wheel, the future Kim Đan surface design, quest/alchemy
material routing, save migration or version bump, removing the
unreachable awaken branch, Kiếm Tu/Thể Tu definitions, the parked
combat runtime, removal of the TC drop-table row.

## 9. Acceptance

| # | Acceptance |
|---|---|
| A1 | `spell_pathway` realmRewards declares `artifactId: 'ngu_hanh_chau'` only under the `ARTIFACT_UNLOCK_REALM_ID` key (computed key + integrity pin asserting the RELATION, not the literal); entering TC delivers no artifact (grant fails closed on realm availability); under an open window, KD entry delivers it. |
| A2 | `isArtifactDomainUnlocked` returns false for `foundation_establishment` and below under real policy; normalize never creates an artifact at TC and never strips a persisted one. |
| A3 | `doan_bao_thach` carries `domainUnlockRealmId` referenced to `ARTIFACT_UNLOCK_REALM_ID` (integrity test pins `===`) and is listed in the domain-scoped census; `isDomainScopedAcquisitionEnabled` composes window+reach — closed window OR below-KD player → no delivery on the real TC row; open-window KD player on that same row → delivered; the TC-floor table row is retained. |
| A4 | EXP feed, `advanceArtifactRealmLevel`, `setArtifactPath`, `tryUpgradeArtifactGrade` each evaluate `isArtifactDomainUnlocked(player.realmId)` — all no-op at TC under real policy, all functional at KD under an open window. |
| A5 | `phap_bao` slot disabled with `RELEASE_UNAVAILABLE_REASON` at/below TC while the unlock realm is outside the window; mocked-open + below-KD shows `'Cần đạt Kim Đan'`; enabled at KD+ for Pháp Tu; `hasArtifactDefinition` rule unchanged. |
| A6 | `docs/systems/artifact.md`, `docs/game-guide.md`, and `Artifact.ts` docs record the artifact domain as deferred to `golden_core`; the superseded "Trúc Cơ tầng 18" scope claim appears nowhere as live scope. |
| A7 | KD boundary positive suite (mocked open window) proves the live path end to end: grant on KD entry, normalize awaken at KD, EXP accrual, path set, grade upgrade via stone, stone delivered through the REAL `foundation_establishment` row to a KD player while a TC player on that row gets none, slot enabled. |
| A8 | No persisted-shape change, no strip or migration code — `saveShapeValidation` untouched. ~~No save-version bump~~ — superseded by the Phase-2 coordinator mandate (76 → 77; recorded in the v77 comment block and the final report). |
