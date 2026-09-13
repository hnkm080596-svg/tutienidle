# Beta Readiness Plan — Phàm Nhân → Luyện Khí → Trúc Cơ

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Steps use `- [ ]` tracking.
> This is a milestone plan: each wave is a bounded mission, not a code diff.

**Goal:** Close every remaining gap between merged `master` (post
`c29fb7b4` architecture-repair merge) and the beta gate in
`docs/roadmap.md` §0.12, without reopening parked scope.

**Beta scope (fixed):** real progression Phàm Nhân → Luyện Khí → Trúc Cơ.
Out of scope unless the user reopens: world map (B5 parked 2026-09-13),
Kim Đan+ content, Trận Tâm/Phù Văn rework, Phase-6 pre-production
(online/VIP/prestige).

---

## Current state (evidence, not assumptions)

**Done:**
- R0–R14 architecture missions: all COMPLETE (queue table §0.8).
- B1 auto-farm, B2 formations (5 real + buff registry), B3 companions
  (10 + gacha + Duyên Phận), B4 talent M2/M3: all COMPLETE.
- 2026-09-13 deep audit + repairs merged at `c29fb7b4`: tribulation
  soft-lock fixed, auto-farm malformed-timing guards, honest reward
  contract, validating formation-commit owner, i18n parity guard.
- Verified on merged master: `type-check` ✓, `build` ✓,
  **3718 vitest** ✓, **19/19 e2e** ✓. ~23 architecture guards enforce
  the recurring invariants.

**In flight (worktrees, uncommitted):**
- `fix/ui-combat-polish`: `useDynamicRegion` dispatch-queue race fix,
  death-clip/tween overlap fix, panel scroll fixes, reroll UX.
- `feat/audio-system`: Tone.js audio WIP (DESIGN_BRIEF.md đợt-1 partial:
  `src/core/audio/`, `stores/audio`, GameButton wiring).
- `UITemp`: parked temp worktree.

**Housekeeping debt (main checkout):** `tests/lab/` + lab scripts +
`.gitignore` uncommitted; `nul` junk file; `stash@{0}` (redundant
pre-merge copy), `stash@{1}` (other agent's c2-merge-temp).

---

## Gap analysis vs §0.12 gates

### Architecture gate — effectively met, 3 residual triage items
The 8 checklist items now hold on the merged tree (no known P0, no
competing authorities, pure queries, presentation non-authoritative,
capability-gated paid random, explicit save lifecycle, integration
evidence, guardrails). Residuals from the audit (corrupt-save
reachability only): `perfectClearSeconds`/`formationLoadout` have no
save-side shape validation; `lastCheckedMs` tiny-positive value → huge
catch-up loop. → Wave C triage: fix cheap, else formally accept.

### Content gate — 2 of 4 items still owe evidence
- Real content Phàm Nhân→Trúc Cơ: exists (M1 Trúc Cơ stages + B1–B4),
  but no **full-cycle progression run** has been evidenced end-to-end.
- No required-flow placeholder/test-only content: needs a final sweep
  (phap_tu art debt is ratcheted not resolved; Kim Đan+ material tiers
  are declared data placeholders — must confirm unreachable in flow).
- Companion/formation scope: done.
- **Balance pass: NOT DONE — the largest open gate item.** No balance
  artifact exists; stat-cap decisions (3.5/3.6) were deferred to it.

### Verification gate — partially met
type-check/build/vitest/e2e are green now. Owed at the end: real
browser/Phaser inspection, deep adversarial QA on the final tree,
code review. (These must run last — they certify the final state.)

### Unscoped decisions blocking a clean beta definition
- **Audio:** WIP exists; "no audio" was a top-3 product risk. Decide:
  ship đợt-1 synth set or formally defer post-beta.
- **Distribution:** `dist:win` electron-builder path exists but was
  never exercised (electron-winstaller script blocked by allow-scripts
  during install). Decide web vs Electron; verify the artifact boots.
- **Cloud save:** wired (Supabase + local fallback). Decide whether
  beta ships Supabase env config or local-only.
- **Tutorial động:** decision pending, non-blocking — needs a ruling.

---

## Execution waves (dependency order)

### Wave A — Land in-flight work (do first; everything else tests on top)
- [ ] A1. `fix/ui-combat-polish`: commit, verify (quick + affected e2e),
      merge to master. Contains real defect fixes (dropped
      `useDynamicRegion` dispatches, death-clip freeze/overlap).
- [ ] A2. `feat/audio-system`: read the brief + WIP; **decide ship-vs-defer
      first.** If ship đợt-1: finish synth set + settings volume
      controls (brief marks them mandatory), verify, merge. If defer:
      document in roadmap and shelve the worktree.
- [ ] A3. Housekeeping: commit or drop `tests/lab/` + lab scripts +
      `.gitignore`; delete `nul`; drop `stash@{0}`; triage `stash@{1}`.

### Wave B — Close the content gate
- [ ] B1. Placeholder sweep: scripted+manual pass over required normal
      flow (stages, enemies, items, talents, formations, companions,
      art refs). Assert no required content is placeholder/test-only;
      confirm Kim Đan+ material tiers unreachable in beta flow; rule
      on phap_tu art debt (ship placeholder vs replace).
- [ ] B2. **Balance pass** (balance-check skill): produce the balance
      report artifact under `docs/qa/`; fix outlier progressions /
      degenerate economies found; rule on stat caps (3.5/3.6) and the
      documented PillBag provenance deviation; document outcome.
- [ ] B3. Full-cycle progression evidence: scripted or instrumented
      Phàm Nhân→Trúc Cơ run (new save → đỉnh Trúc Cơ), recording stage
      clears, tribulations, companion/formation use — the proof behind
      content-gate item 1.

### Wave C — Close architecture residuals
- [x] C1. Triage the 3 corrupt-save residuals: add cheap save-shape
      checks where the validator pattern supports them; anything not
      cheap gets formally accepted with rationale recorded in the
      roadmap (accepting a residual is a decision, not an omission).
      — done 2026-09-14: shape checks added for `perfectClearSeconds`
      (object + finite>0 entries), `autoFarmStage` (null|{stageId,
      lastCheckedMs≥0 finite}), `formationLoadout` (null|{formationId,
      assignments[]} with integer row/column). `tickAutoFarm` catch-up
      now clamps elapsed to `DEFAULT_MAX_OFFLINE_SECONDS` (24h) and
      anchors `lastCheckedMs` to `now − carry`, so a deep-past corrupt
      timestamp pays at most one capped batch then converges (no
      per-tick faucet). Tests: saveShapeValidation + adversarial tick.
- [ ] C2. Re-run the §0.12 architecture checklist against the final
      tree with evidence links per item.

### Wave D — Release readiness
- [ ] D1. Distribution: pick web vs Electron; run `dist:win` (or web
      build) end-to-end; verify the artifact boots and saves. Resolve
      the electron-winstaller/allow-scripts install block if Electron
      is chosen.
- [ ] D2. Cloud save: decide Supabase-prod vs local-only for beta;
      wire chosen config; verify save/load through the shipped path.
- [ ] D3. Tutorial ruling (static-only vs deferred) — record decision.
- [ ] D4. Final verification gate, in order: `type-check` → `build` →
      full vitest → full e2e → real browser/Phaser inspection →
      adversarial deep QA on the final tree → code review → beta tag.

---

## Explicit non-goals (do not reopen)

- B5 world map (user decision 2026-09-13); Kim Đan+ realm content;
  Trận Tâm/Phù Văn rework; Phase-6 online/VIP/prestige; architecture
  rewrites; broad UI redesign.

## Risks

- Audio ship decision expands scope — keep to đợt-1 brief minimum.
- `dist:win` has never run; packaging may surface install/build issues
  (schedule D1 early enough to absorb them — do not leave it last-day).
- Balance pass may surface tuning work; keep changes inside existing
  balance files, no new systems.
