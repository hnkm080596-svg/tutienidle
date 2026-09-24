# REV-B-CONTRACT repair evidence (commit e6ec09ba)

Round-B contract findings, all repaired and verified at e6ec09ba:

- **F-IMPL-3 (P15 ASCII gate, Medium)** — `SupabaseCharacterCreationService.contract.test.ts`
  non-ASCII comment tokens replaced with ASCII; `npx vitest run
  tests/architecture/asciiComments.test.ts` → 1 passed. Gate restored green.
- **F-IMPL-4 (forward migration, Medium)** — new migration
  `supabase/migrations/202609240001_beta_creation_character_pick.sql`: ALTER
  TABLE adds `mortal_basic_skill_id` (nullable → backfill 'tram' → SET NOT
  NULL), `drop function if exists` kills the v81 overload on already-migrated
  DBs, `create or replace` installs the v82 signature, revoke/grant on the new
  signature. Converges old DBs to the fresh-apply shape.
- **F-IMPL-5 (stale doc, Low)** — `docs/online-login-cloud-save-plan.md`
  :42-46,:207-208,:213 updated to the v82 contract (pick 1 talent, starting-skill
  choice, fixed 1/1/1/1/1, server-side mirror param).
- **F-IMPL-6 (dup assert, Nit)** — duplicate `expect(skillManager.getAll()).toEqual([])`
  removed from `GameManagerSaveRestore.boundary.test.ts`.
- **F-IMPL-7 (stale baseline entry, Nit)** — `.pointsLeft` entry removed from
  `tests/architecture/baselines/asciiComments.json` (JSON still valid).

Verification executed at e6ec09ba:
- `npm run type-check` (vue-tsc --build) → PASS
- `npx vitest run asciiComments + GameManagerSaveRestore.boundary +
  SupabaseCharacterCreationService.contract` → 3 files / 89 tests passed
