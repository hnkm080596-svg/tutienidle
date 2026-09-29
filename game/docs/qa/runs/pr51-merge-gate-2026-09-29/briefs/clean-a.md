# Reviewer Brief — Clean Round A (BLIND)

You are an independent QA reviewer for a merge-gate run on the TutienIdle repository.
This is a BLIND review: derive your own invariants and attacks. Do NOT read
`game/docs/qa/**`, `game/docs/ui-audit/**`, or any audit/findings/ledger files —
they contain prior conclusions that would contaminate independence. Do NOT read
commit messages (`git log --format=%s`) for the same reason; the diff itself is
your evidence. Do NOT modify, create, or delete any file, and do not run git
write operations. You MAY run tests (`npx vitest run <file>` from `game/`),
typecheck, grep, and read source.

## Frozen state under review
- productStateId: b1b1c5ff0d9772d9362be9feac89e052e638f32f3eab4ff545636b52ca42b5b1
- Working tree: `E:\tutienidle` (repo root), `game/` is the app root
- Review surface: `git diff f196b8d0..HEAD -- game/` — the aggregate delta that
  landed on master via a merge (includes two feature waves + a cleanup + tests).

## What the delta touches (surface map only — no conclusions)
- `src/core/stats/` + `src/data/buff/TalentBuffs.ts` + `src/data/skill/TalentPassives.ts`:
  stat modifier channels (flat vs percent) and a clamp minimum change.
- `src/core/building/`: a per-instance realm pin for accrual windows.
- `src/stores/player.ts` + `src/core/economy/TuLinhTranBalance.ts`: offline
  cultivation segmentation across timed-effect expiry.
- `src/services/cloudSave/` + `game/supabase/migrations/202609290001_*`:
  remote reconcile ordering and a guarded push (CAS), server-owned timestamp.
- `src/game/scenes/` + `src/presentation/gate/`: player nameplate via an
  optional reporting member; HUD spacing vs a gourd overlay; realm passive-node
  labels and a release-ceiling message in `RealmPanel.vue`; i18n keys.
- `src/game/support/` + combat presentation files: an art-wave refactor merged
  concurrently (sprites, reskin maps, cast clips).
- Repo cleanup: ~199 files deleted from git tracking (dead art, .c2c state,
  screenshots); the same paths remain on local disk untracked.
- `src/data/buff/TalentBuffs.test.ts` + `src/core/building/BuildingSystem.test.ts`:
  new/changed regression tests (uncommitted or committed on the branch tip).

## Architecture laws you should enforce
- One owner per rule / one authority per mutable state.
- Presentation (Phaser scenes, Vue) REPORTS state; domain systems decide.
- `GameManager` orchestrates domain managers; scenes own lifecycle/subscriptions.
- Save/restore must be idempotent and shape-validated; cloud sync must never
  regress to an older revision.
- Read `game/docs/roadmap.md` and `AGENTS.md` for the ownership map — those are
  allowed context (architecture contracts, not findings).

## Output (required, verbatim structure)
Return a single markdown block titled `SEALED_RESULT` containing:
1. `contextId` — a short self-chosen unique id.
2. `stateHash` — the productStateId above (copy verbatim).
3. `verdict` — one of: PASS WITH EVIDENCE / PASS WITH GAPS / FAIL / BLOCKED.
4. `findings` — list, each with: id, severity (Critical/High/Medium/Low/Nit),
   location (file:line), evidence class (Confirmed = you produced a failing
   repro or failing test; SOURCE_PROOF = the defect is provable directly from
   source; Suspected = needs runtime confirmation), expected vs actual.
   Evidence classes Confirmed and SOURCE_PROOF only — no bare assertions.
5. `attacksTried` — what you attempted and why it did/didn't break.
6. `coverageNotes` — per-domain gaps you could not close.
7. `independence` — attestation: you consumed no prior findings/ledger and
   coordinated with nobody during the review.

Be adversarial: assume the diff is wrong until proven otherwise. If you find
nothing, say so explicitly with what you tried — an empty findings list with
weak attack surface is a coverage gap, not a pass.
