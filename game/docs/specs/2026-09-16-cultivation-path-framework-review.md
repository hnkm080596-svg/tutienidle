# Review — Cultivation Path Framework Spec & Plan

Date: 2026-09-16
Reviewed: `docs/specs/2026-09-16-cultivation-path-framework-spec.md`, `docs/superpowers/plans/2026-09-16-cultivation-path-framework.md`
Method: adversarial review against live code (spec/plan argue about ownership — verified against actual owners, not doc claims)

## Verdict

**Needs amendment before execution.** The architecture principles are sound and match the project constitution (A2/A3/A4/A6/A8). But the spec describes building from scratch a framework that already exists at ~60% under different names, and several of its core contracts collide with established authorities. Mission 0 (inventory) is currently positioned as the first step; the inventory answers are already partially knowable, and several force spec changes — the plan should not start coding contracts until they are resolved.

## What already exists (verified in code)

| Spec concept | Existing equivalent | Location |
|---|---|---|
| `CultivationPathId` | Closed union of **5** ids: `'phap_tu' \| 'phap_tu_an' \| 'kiem_tu' \| 'the_tu' \| 'the_tu_an'` | `core/player/CultivationPathKit.ts:20` |
| `CultivationPathModule` | `CultivationPathKit` (techniqueId, statModifiers, realmRewards, skillIds, offerGate, usesTheResource) | `core/player/CultivationPathKit.ts:27` |
| `CultivationPathRegistry` | `CULTIVATION_PATH_KITS` record | `core/player/CultivationPathKit.ts:77` |
| `CultivationPathSystem` | **Name already taken** — free functions: `getOfferableCultivationPaths`, `isCultivationPathOffered`, `isPhapTuAnEligible`, `getCultivationPathStatModifiers`, `grantCultivationPathRealmReward`, domain-gated stat emitters | `core/player/CultivationPathSystem.ts` |
| `selectPath` command | `GameManagerRealmAdvanceOps.chooseCultivationPath` — fused with the mortal→qi_refining ritual | `core/game/GameManagerRealmAdvanceOps.ts:172` |
| Active path state | `player.cultivationPath` on `PlayerData` (permanent, persisted) | `core/player/Player.ts:108` |
| `PathNodeDefinition` / node unlock state | `ProgressionNode` + `player.nodeLevels` (single source of truth) + `NodeSystem` purchase/prereq/upgrade authority; per-path gating via `requiredCultivationPath` | `core/progression/ProgressionNode.ts`, `core/progression/NodeSystem.ts` |
| `PathGrantDefinition` | `NodeEffect` — already a typed declarative grant union (statModifiers, unlocksSkillIds, selectsSpecialization, turnSkillResourceModifiers, kiemYGrant, kiemTuComboModifier, theTuKitModifiers, …) | `core/progression/ProgressionNode.ts:51` |
| `PathStatProvider` | kit `statModifiers` + domain-gated emitters (`getPhapTuAttunementStatModifiers`, `getTheTuAnReactiveStatModifiers`, `getTheTuEnduranceStatModifiers`) + `registerDomainDeltaDeriver` mid-battle channel | `core/player/CultivationPathSystem.ts`, `core/stats/StatCalculator.ts` |
| Dedicated mechanic systems | `core/kiem-tu/` (KiemPhoSystem, NguKiemDao), `core/phap-tu/` (PhapTuRoutes), `core/the-tu/` (TheEconomy, TheTuAnMechanicModifiers, …) | `core/` |
| Domain events | `core/events/EventBus.ts` | exists |

## Critical findings

### C1 — Naming collision and greenfield framing

The spec proposes introducing `CultivationPathSystem` as a new authority; that filename already exists and already holds path-domain logic (offer predicates, stat emission, realm rewards). More broadly, the spec reads as "introduce framework where none exists" — reality is "normalize existing pieces into a framework": `CultivationPathKit` → module, `CULTIVATION_PATH_KITS` → registry, `chooseCultivationPath` → authority command. The plan's Mission 1–3 as written would build parallel structures beside existing ones, which is itself a duplicate-authority violation of the spec's own rules.

**Fix:** reframe Missions 1–3 as evolve/rename, not create. Either repurpose `core/player/CultivationPathSystem.ts` into the real authority (its free functions become methods) or pick a non-colliding name.

### C2 — Five paths, not three; hidden-path asymmetry is the central design question

The spec covers sword/dharma/body. The codebase has five path IDs: `phap_tu`, `phap_tu_an`, `kiem_tu`, `the_tu`, `the_tu_an`. Hidden (`Ẩn`) variants are first-class paths with ritual-time offer gates (`linh_bao` Lv3, `huy_quyen` Lv3), permanent and mutually exclusive. Meanwhile Kiếm Tu's hidden variant is NOT a path id — it is `kiemTu.mode: 'hien' | 'ngu'`, flipped one-way by a node effect (`kiemTuModeSwitch`).

So the same architectural concept ("hidden branch of a path") is modeled two different ways today. Any shared specialization/path contract must resolve this asymmetry — it is the single most informative test case for the framework, and the spec does not mention hidden paths at all. Roadmap §B6 (line ~2140) also records known design debt around the Kiếm Phổ orb-branch identity — relevant context.

**Fix:** spec must add an explicit ruling: hidden variants are path IDs (the majority model), or modes (kiem model), or specializations — with migration of the outlier. This decision belongs in the spec, not discovered mid-Mission-6.

### C3 — `unlockedNodes` / `unlockNode` collides with NodeSystem authority

Spec §6 assigns `CultivationPathSystem` ownership of "node unlock state"; plan Missions 3/18/20 build `unlockNode`/`canUnlockNode`/`isNodeUnlocked` commands. But node investment already has a single authority: `player.nodeLevels` + `NodeSystem` (`canPurchaseNode`, `hasPrerequisite`, level/upgrade cost rules), wired through `GameManager.purchaseNode`. Per-path membership is already expressed declaratively via `ProgressionNode.requiredCultivationPath`, `routeTag`, `elementTag`, `kiemTuMode`.

Building a second `unlockedNodes` list inside `CultivationPathState` is a permanent duplicate authority — the exact defect the spec exists to eliminate, created by the spec.

**Fix:** amend spec §6/§16: PathSystem owns path lifecycle (offer/choose/active/path-state slices). Node investment stays with NodeSystem. `requiredCultivationPath` is the existing bridge — possibly renamed/kept. Framework queries compose the two.

### C4 — `Specialization` model fits zero of three real paths

Spec §15: `specializationId: SpecializationId | null` + `nodeIds`. Current reality:

- **phap_tu**: `phapTu.element` (5 elements) + `phapTu.route` ('dot'|'no'), committed atomically by `selectPhapTuElement()` (INV-13) — element is chosen *via a node*, not at a branch-selection step
- **kiem_tu**: `kiemTu.mode` ('hien'|'ngu') — one-way, switched by purchasing a specific node
- **the_tu**: root mutex (cuong_chien XOR tran_the) resolved at battle-build kit resolution

None is "pick specialization → unlock its nodes." Forcing `specializationId` is precisely the "secretly Sword-shaped" trap plan §46 warns about — except it isn't even Sword-shaped. Also note: `selectsSpecialization` already exists on `NodeEffect` meaning *skill* specialization (E-8), a different concept sharing the same word — terminology collision.

**Fix:** replace the shared `specializationId` field with a per-path branch-state slot owned by the path module (opaque to the framework), or rule that node tags (`routeTag`/`elementTag`/`kiemTuMode`) are the specialization mechanism and drop the separate concept. Decision needed in spec before Mission 1 types are written.

### C5 — Persistence/save-shape work is missing from the plan

Spec §38 says "no save migration" — but `player.cultivationPath`, `player.phapTu`, `player.kiemTu`, `player.nodeLevels` are persisted `PlayerData` fields under `saveVersion` + `saveShapeValidation` + `SaveRoundTrip` tests. If the framework moves path state into a new `CultivationPathState` record (or even just relocates `cultivationPath`), the save shape changes: version bump, validation schema update, round-trip tests, repeat-restore semantics (A3 — see learned defect QA-2026-09-08-001 on repeated full-restore transactions). "No migration" is acceptable for pre-release only if the plan still does the save-shape work.

**Fix:** add explicit save-shape work to Missions 5–8 (or a dedicated mission): `saveTypes.ts`, `saveVersion.ts`, `saveShapeValidation`, `SaveRoundTrip`, restore-owner ordering. Per P3 this also makes `full` verification mandatory for those missions.

### C6 — Path choice is fused with realm breakthrough

`chooseCultivationPath` is not just path selection — it is the mortal→qi_refining ritual: validates kit registry entries atomically, grants technique/skills, locks `breakthroughGrade`/`mortalPerfectionAchieved`, advances realm, syncs realm passives, merges kiemTu state (learned defect QA-2026-09-02-001: realm-change must clear equipped items via `unequipAllEquipment` contract). A new `selectPath` command cannot simply replace it — the ritual transaction is owned by realm-advance ops and must remain atomic.

**Fix:** plan must state the boundary explicitly: ritual owner (RealmAdvanceOps) orchestrates; path authority owns only the path-state writes inside the transaction. Also: offer semantics are "evaluated at ritual time, never stored" (`isPhapTuAnEligible` reads live `skillCastCounts`, no eligibility flag persisted) — spec's `unlocked: boolean` / `unlockPath` command does not model this. The real surface is `offerablePaths()` query + `choosePath(id)` command; `unlockPath` should likely not exist.

## Important findings

### I1 — Stat integration is two-channel, not one

Spec §18 `collectModifiers()` covers only the assembly-time read. The live system also has `registerDomainDeltaDeriver(domain, fn)` — mid-battle attribute deltas re-emit domain-gated modifiers (INV-10 double-count protection). A naive provider port would drop the delta channel. Either the provider contract exposes both channels, or path stats stay on the existing domain-deriver mechanism and the "provider" is only a registration point. Decide in Mission 4 — the existing mechanism may already BE the correct single implementation (A9).

### I2 — NodeEffect already accumulates per-path fields

`kiemYGrant`, `kiemTuModeSwitch`, `cascadeUnlock`, `theTuKitModifiers`, `theTuAnMechanicModifiers` on the shared `NodeEffect` union are per-path data fields — arguably an A8 leak, arguably acceptable because they are declarative typed data consumed by path-owned aggregators. The framework should rule on this consciously rather than recreate it: spec §17's `PathGrantDefinition` union is essentially a re-skin of `NodeEffect`.

### I3 — Roadmap context gates this work

Roadmap line ~1911: the 2026-09-14 audit verdict is "REPAIR BEFORE MAJOR FEATURES" with the §0.9 content freeze in force; §B6 contains the path-reimagines ruling and known Kiếm Tu design debt. This plan is architecture normalization (arguably inside the repair program's spirit) but should explicitly cite §B6 and confirm it is sanctioned work, not an unauthorized major feature.

### I4 — P17/P13 wiring obligations

Provider/combat integration will touch battle-build and possibly `CombatScene`/turn paths — P17 requires checking roadmap combat-chain phases (R1–R6) and current `docs/qa/` reports before touching those areas; P13 requires driving the real ritual → progression flow end-to-end (Playwright), not just unit tests. The plan's Mission 12 manual matrix covers this late — the wiring check belongs at each path normalization mission (M5/6/7 exit criteria), since the ritual → stat → combat chain is exactly the unwired-runtime risk P13 was written for.

## Minor findings

- **M1** — Spec uses `sword`/`dharma`/`body`; real ids are `kiem_tu`/`phap_tu`/`the_tu` (+ `_an`). Plan §34 says branches "Kỹ/Ngự"; code uses `hien`/`ngu`. Docs should use real identifiers so Mission 0 outputs map cleanly.
- **M2** — Node data lives split across `core/cultivation/KiemTuNodes.ts` and `data/progression/{PhapTu,TheTu}*Nodes.ts` — inconsistent homes for the same concept; the framework's module layout should fix this, and the plan should name the target directory (e.g., `core/paths/<path-id>/` or keep data-only files under `data/`).
- **M3** — Mission 8 says "delete duplicate path stores"; there are no Pinia path stores — the actual duplicates are `PlayerData` fields + free functions + GameManager ops. Reword to match reality.
- **M4** — Per-mission report format (§80) should add "save-shape impact" and "hidden-path handling" lines — the two highest-risk axes.
- **M5** — Contract tests (§71) should include hidden-path offer-gate cases (eligible/not-eligible at ritual, post-ritual non-reopening) — that is where the asymmetry bites.
- **M6** — `getOfferableCultivationPaths` currently hardcodes the base path list `['phap_tu','kiem_tu','the_tu']` then appends gated ones — a registry-driven enumeration would replace exactly this kind of hand-list; good concrete example for Mission 2/3 of what registry buys.
- **M7** — Spec §41 adds an AGENTS.md rule — fine, but it must be added in the final mission's commit, and AGENTS.md Part 1/2 truncation means placement needs care (A-section).

## Recommended spec amendments (before Mission 1)

1. Rename or repurpose: existing `core/player/CultivationPathSystem.ts` becomes the real system, or new authority gets a distinct name.
2. Reframe: "normalize existing path infrastructure" not "introduce framework."
3. Add hidden-path ruling (path-id vs mode vs specialization) — covers 5 current ids.
4. Amend §6: PathSystem owns path lifecycle + per-path state slices; NodeSystem keeps node investment; `requiredCultivationPath` (or successor tag) is the membership bridge.
5. Replace `specializationId` with per-path branch-state slot (or rule node-tags are the mechanism).
6. Replace `unlockPath`/`unlocked` with offer-query + choose-command semantics (ritual-time evaluation, never stored).
7. Amend §29/§38: save-shape changes are in scope (version/validation/round-trip/restore semantics), only legacy *migration* is out.
8. Stat section: acknowledge assembly-emit + domain-delta-deriver two-channel reality.
9. Add ritual-boundary section: RealmAdvanceOps owns the atomic mortal→qi_refining transaction; path authority contributes path-state writes inside it.
10. Reference roadmap §B6 + §0.9 freeze status explicitly.

## What the documents get right

- Provider-per-subsystem over hook-bag — matches and formalizes the existing kit pattern.
- "Framework decides availability, mechanic system owns execution" — already how `core/kiem-tu`/`phap-tu`/`the-tu` are structured; the spec legitimates existing good structure.
- Staged missions with exit criteria, stop conditions, per-mission reports — operationally sound.
- Plan §7 "reuse rather than duplicate," §18 "only commands needed," §46 "was it secretly Sword-shaped," §50 "do not force symmetry" — the right hedges; they just need to fire earlier (at spec level, not mid-implementation).
- "No arbitrary callbacks in content definitions" — matches the existing `NodeEffect`/`NodePrerequisite` discriminated-union style; spec and codebase already agree here.
