# REVIEW_RESULT — REV-B-CONTRACT (beta-creation-impl-2026-09-23)

- reviewerSession: devin-c3fc950212e6435eb7feb857aaee4bb3 (fresh child, sealed)
- requestId: req-roundB-contract
- phase: CONTRACT
- priorFindingsVisible: NO (run artifacts inside diff deliberately not consumed)
- verdict: FINDINGS (5)
- reviewedState: impl head 92b4ebaa (productStateId 08c93b6a)
- access: PASS — own worktree detached at 92b4ebaa, diff base 6d9af7a9; type-check + ~1.4k scoped vitest + 31 crafted adversarial GameSave probes executed

## Findings

1. **F1-P15-ASCII-GATE (Medium)** — P15 ASCII-comments hard gate fails on the frozen head: the new `SupabaseCharacterCreationService.contract.test.ts` carries 2 non-ASCII comment tokens (em dash + ↔ arrow). `npx vitest run tests/architecture/asciiComments.test.ts` = 1 failed; every `npm run verify` on this head is red.
2. **F2-RPC-INPLACE-MIGRATION (Medium)** — in-place edit of `202608240001_online_auth_character.sql` leaves already-migrated DBs with no forward path: v81 overload stays callable with its grant, `mortal_basic_skill_id` column never added, new client body resolves to no function → every online create fails. Correct only on fresh DB / db reset.
3. **F3-STALE-ALLOCATION-DOC (Low)** — `docs/online-login-cloud-save-plan.md` still documents 5-point allocation at :44,:207,:213 though plan Step 5 required updating it.
4. **F4-DUP-ASSERT (Nit)** — duplicated adjacent `expect(manager.skillManager.getAll()).toEqual([])` in `GameManagerSaveRestore.boundary.test.ts` (~:1151).
5. **F5-STALE-BASELINE-ENTRY (Nit)** — `asciiComments.json:11121` baseline still lists the deleted `.pointsLeft` comment entry (inert).

## Attacks (summary)

(a) v82 preflight falsification — 31 crafted probes: missing pick rejects with skills[] unmutated; near-miss ids (`tram `, `Tram`, `TRAM`, `tram\0`, `tram-x`) all reject; unlearned pick rejects; post-path pick rejects; ordering verified (preflight at SaveSystem.ts:272 before owner mutation, again at saveOps.restoreFromSave :326). Channel-3 falsification: levelled entry without nodeLevels[core]>=1 rejects; level-0 core rejects; missing purchasedNodeIds mirror rejects; no-grant-source rejects. Entry-path census: every save ingress (loadGame, importSaveRaw, SupabaseRemoteSave pull, EarlyGameSession restore, App restore) passes shape+preflight — no bypass. (b) ruling conformance — zero remaining allocation refs in src/; only setMortalBasicSkill writes the field; absent→tram is read-time defensive default; consume-once pick safe via newCharacterGrantsApplied ordering. (c) RPC — client body matches migration signature exactly incl. types; contract test pins key set; drop-function identity-args form correct; pick CHECK matches precursor set.

## Gaps

Playwright specs read not executed; migration verified statically not against a live Supabase instance; full `npm run verify` not re-run end-to-end; pre-existing remote-pull asymmetry noted (shape-valid/preflight-invalid remote payload written locally then rejected at boot — same class as existing preflight rejections, widened by new pick rules).
