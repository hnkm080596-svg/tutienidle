# Mission E — Correctness & UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Land the independent confirmed defects — gameplay id mismatches, silent resource loss, stale UI, raw-id leaks — as one batch of small tasks.

**Architecture:** Each task is self-contained: domain fix + failing regression test first, UI consumes domain truth (A7). No cross-task dependencies; tasks may be batched per area for review sanity.

**Tech Stack:** TypeScript, Vue 3, Vitest.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission E (E1–E12). Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` — T3-16, T1-10, T1-11, T3-21/23/26, T4-31..39, T5-48, T6-53/54, T8-71/75.

## Global Constraints

- Dev-stage rule; P8 no `any`; P15 English comments; P16 new UI strings via `t()`.
- A2/A9: UI never recomputes domain rules — where UI duplicates a rule, route through the owner.
- Worktree: `.agent-worktrees/correctness-ux` (branch `fix/correctness-ux`).
- Tasks are independent — batch same-area tasks into single dispatches per the SDD batching rule.

---

### Task 1: Kill-quest + hidden-beast id mismatch (T3-16)

**Files:** `game/src/core/enemy/EnemySystem.ts:20` (spawned id shape), `game/src/core/game/BattleLootSystem.ts:371,393` (kill event payload), `game/src/core/quest/QuestSystem.ts:272`, `game/src/core/game/HiddenBeastSystem.ts:40`

- [ ] Read first: how `template_uuid` ids are minted and where template/species id is still available at spawn time.
- [ ] Failing test: kill a `wild_wolf` enemy → quest kill-counter increments; hidden-beast window reset fires for `huyet_mong`.
- [ ] Implement: carry `templateId` alongside runtime `id` in the spawned entity / kill event; quest + hidden-beast consumers match on `templateId`.
- [ ] PASS + commit `fix(quest): match kills on template id, not instance id`

### Task 2: Material pills are not consumables (T1-10)

**Files:** `game/src/core/game/GameManagerPillOps.ts:93-115`, `game/src/components/panels/bag-sections/PillBagSection.vue:302`, `game/src/data/pill/pills.ts:69-92`

- [ ] Failing test: `usePill('truc_co_dan')` (material-type) returns a rejected result and does NOT remove the item.
- [ ] Implement: domain rejects material-type pill consumption with a typed reason; UI binds no drink action for that type (render as material row or disabled with i18n reason tooltip).
- [ ] PASS + commit `fix(pill): reject consumption of material-type pills`

### Task 3: Quest claim atomicity (T1-11)

**Files:** `game/src/core/quest/QuestSystem.ts:153-215`

- [ ] Failing test: reward grant throws/returns failure → item cost is NOT debited; quest remains claimable.
- [ ] Implement: grant rewards first, debit cost only on success — or stage the exchange so failure is atomic (check existing exchange patterns in `TuLinhTranBalance`/vendor for the house style).
- [ ] PASS + commit `fix(quest): claim is atomic — no cost without reward`

### Task 4: Tribulation correctness batch (T3-21, T3-23, T6-54)

**Files:** `game/src/core/tribulation/TribulationDirector.ts:280-284,634-642`, `game/src/components/game/tribulation/TribulationSceneOverlay.vue:11-23`, `game/src/game/scenes/TribulationScene.ts:98,129`

- [ ] Failing tests: ghost HP regen applied per tick (documented behavior); overlay computeds update on `stateVersion` change (return primitives, not the same-ref object); scene renders damage on `entity_vitals_changed` (or emit `damage` — pick whichever matches the scene's contract, document choice).
- [ ] Implement all three fixes.
- [ ] PASS + commit `fix(tribulation): apply documented regen, unfreeze overlay, restore damage numbers`

### Task 5: Offline summary accuracy + single owner (T3-26, T5-48)

**Files:** `game/src/stores/player.ts:335,419-452`, `game/src/core/idle/OfflineProgressSystem.ts`, `game/src/composables/useAppLifecycle.ts` + `game/src/App.vue` (modal ownership)

- [ ] Failing test: capped player → modal shows post-cap actual gain, not theoretical.
- [ ] Implement: restore returns/records actual granted cultivation; modal reads that. One layer owns showing the modal — pick `useAppLifecycle` (boot-time side effect) and remove the App-level duplicate trigger.
- [ ] PASS + commit `fix(offline): report actual post-cap gains; single summary owner`

### Task 6: UI staleness batch (T4-31, T4-32, T4-38)

**Files:** `game/src/components/panels/BuildingConstructionGate.vue:55-63`, `game/src/composables/useBuildingNavigation.ts`, `game/src/components/game/HomeBuildingIcons.vue`, `game/src/components/panels/AlchemyView.vue:302`, `game/src/components/panels/StageSelectPanel.vue:197-201`

- [ ] Failing tests/verification per item:
  - `canBuild`/building badges consume `stateVersion` → recompute on material/state change.
  - Alchemy craft failure → visible reason via existing `alchemy.reason.*` keys; button disabled when domain says can't craft.
  - `StageSelectPanel` closes only when `startAutoFarm()` returns true; mode disarms on stage change.
- [ ] Implement; PASS + commit `fix(ui): consume stateVersion, surface craft failure reasons`

### Task 7: Wash/refine paid-preview batch (T4-33, T4-34)

**Files:** `game/src/components/panels/equipment-hall/WashTab.vue:188-202,240`, `game/src/components/panels/equipment-hall/RefineTab.vue`, `game/src/core/equipment/EquipmentWash.ts:110-114,359`, `game/src/core/equipment/EquipmentRefine.ts:258`, `game/src/composables/useEquipmentTooltip.ts:207`

- [ ] Decide + record the paid-ticket policy ONCE (recommended: a failed commit never consumes nor replaces a held ticket — same rule both ops); implement consistently.
- [ ] Preview rows iterate the **rolled** affix list (extra lines + zero-line case visible before commit); enforce configured min-affix range; clear pending ticket on unmount; remove dead "Giữ" state; tooltip cap → `MAX_SLOT_ENHANCE_LEVEL`.
- [ ] Failing tests per sub-item; PASS + commit `fix(equipment): honest paid previews and unified ticket lifecycle`

### Task 8: Announcement overlay + id leaks + mojibake (T4-35, T4-36, T4-37)

**Files:** `game/src/components/common/WorldAnnouncementOverlay.vue:58`, `game/src/core/presentation/OverlayLayers.ts:33`, `game/src/components/panels/CompanionPanel.vue:422`, `game/src/components/game/combat/BattleLogPanel.vue:40-54`, `game/src/core/game/GameManager.ts:260-261`

- [ ] Announcement: drop below modal layer (or make interceptor non-blocking outside its own surface); add Escape dismissal + timer cleanup on unmount + dialog semantics if it intercepts input.
- [ ] Companion/battle-log names resolve through `TURN_SKILL_DISPLAY_META` / display-name helper — never raw ids.
- [ ] Replace mojibake notification strings with i18n keys.
- [ ] PASS + commit `fix(ui): announcement layer order, display names, i18n strings`

### Task 9: Small correctness nits (T8-71, T8-75, T4-39)

**Files:** `game/src/core/reward/DropRoll.ts:43`, `game/src/core/progression/NodeSystem.ts:49`, `game/src/core/player/PlayerVisualForm.ts:22-31`

- [ ] `weightedRandom([])` → explicit `Error('weightedRandom: empty entries')`.
- [ ] Unknown prereq `realmId` → reject/warn (visible), not silent pass.
- [ ] `phap_tu_an` + hidden path ids get correct visual-form fallback.
- [ ] PASS + commit `fix(core): fail loudly on empty roll and unknown realm prereq`

### Task 10: Deferred-content stopgaps + roadmap section (E11)

**Files:** `game/docs/roadmap.md` (new "deferred content" section), plus minimal UI stopgaps only where players lose resources today (covered by Task 2 for pills).

- [ ] Add roadmap section listing deferred items: `alchemy_thong_mach_dan`↔MeridianSystem, `great_dao_seed` boss-gate, `heaven`/`great_dao` grades + `pham_nhan_chi_cot`, `golden_core`-gated `phap_tu`/`kiem_tu` nodes, artifact combat reimagine.
- [ ] Do NOT wire or delete the content (locked decision).
- [ ] Commit `docs(roadmap): track deferred pre-beta content`

---

## Mission E done-criteria

- Kill quests + hidden-beast reset fire; material pills can't be destroyed; quest claims are atomic.
- Tribulation regen/overlay/damage-numbers correct; offline summary honest and single-owned.
- No stale gates: building/production/alchemy UI consumes domain truth.
- Paid previews show exactly what will be committed; ticket lifecycle unified.
- No raw ids or mojibake reach the player; announcements don't block dialogs.
- `npm run type-check` + scoped vitest green; P4 quick QA; P5 review.
