# Reviewer Brief - Clean Round A2 (BLIND)

You are an independent QA reviewer for a merge-gate run on the TutienIdle repository.
This is a BLIND review: derive your own invariants and attacks. Do NOT read
`game/docs/qa/**`, `game/docs/ui-audit/**`, or any audit/findings/ledger files -
they contain prior conclusions that would contaminate independence. Do NOT read
commit messages (`git log --format=%s`) for the same reason; the diff itself is
your evidence. Do NOT modify, create, or delete any file, and do not run git
write operations. You MAY run tests (`npx vitest run <file>` from `game/`),
typecheck, grep, and read source.

## Frozen state under review
- productStateId: 0d0921a5ddd9279694539c3c611b37cb8fd01ca217141843fc2f0fd43e5dd85d
- Working tree: `E:\tutienidle` (repo root), `game/` is the app root
- Review surface: `git diff f196b8d0..HEAD -- game/` - the aggregate delta that
  landed on master via a merge, plus the current tip commits on top of it
  (includes two feature waves + a cleanup + tests + repair commits).

## What the delta touches (surface map only - no conclusions)
- `src/core/stats/` + `src/data/buff/TalentBuffs.ts` + `src/data/skill/TalentPassives.ts`:
  stat modifier channels (flat vs percent), clamp minimum change, passive
  modifier ids and stack caps.
- `src/core/skill/PassiveSystem.ts`: per-second passive ticking, HP-gated
  conditions, stack lifecycle.
- `src/core/building/`: a per-instance realm pin for accrual windows.
- `src/stores/player.ts` + `src/core/economy/TuLinhTranBalance.ts`: offline
  cultivation segmentation across timed-effect expiry.
- `src/services/save/` (shape validation, acceptance): building save fields.
- `src/services/cloudSave/` + `game/supabase/migrations/`: remote reconcile
  ordering, guarded push (CAS), server-owned timestamp, insert semantics.
- `src/game/scenes/` + `src/presentation/gate/`: player nameplate via an
  optional reporting member; HUD spacing vs a gourd overlay; realm passive-node
  labels; a release-ceiling message in RealmPanel.vue; i18n keys.
- `src/game/support/` + combat presentation files: an art-wave refactor merged
  concurrently (sprites, reskin maps, cast clips).
- `tests/` + `src/**/*.test.ts`: many new/changed pins along the same surface.

## Deliverable
Return a SEALED_RESULT report containing:
1. The invariants you derived for this surface (short list).
2. Every finding: id, severity (Critical/High/Medium/Low/Nit), location
   (file + symbol), a deterministic counterexample or repro, expected vs
   actual, and whether it is branch-caused or pre-existing.
3. Attestation: what you could and could not access, and confirmation that
   you did not read prior findings/ledger/audit docs or commit messages.
4. Verdict: PASS or FAIL.
