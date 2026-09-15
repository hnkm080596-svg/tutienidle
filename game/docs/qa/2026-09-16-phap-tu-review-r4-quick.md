# QA — Pháp Tu review round 4 fixes (quick)

- Scope: HEAD `0c43badf` + round-4 repair diff (An full-kit battle-build
  invariant, ritual/element-commit transaction-boundary hardening,
  fixture repairs, QuanKhiPanel authority merge).
- Task-owned paths: `GameManager.ts`, `GameManagerRealmAdvanceOps.ts`,
  `GameManagerProgressionOps.ts`, `CultivationPathKit.ts`,
  `QuanKhiPanel.vue` (+ paired test files).
- Risk-map route: economy-and-progression (ritual grant boundary,
  element commit) + combat-and-tribulation (battle-build assert).
  Bounded — no persistence-shape change; new invariant only rejects
  states no legal writer could produce.

## Findings checked

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| R4-1 | An missing special/passive enters combat silently degraded | **Confirmed pre-fix → fixed** | `skillManager.get('da_phap_lien_tuyen')` → `special: undefined` (no button); `has('ngo_dao_hon_don')` → multicast silently off. RED tests: missing each → `startBattleWithPlayer` throws. `assertPhapTuAnKitLearned` iterates the single authority `PHAP_TU_AN_REQUIRED_SKILLS` (CultivationPathKit.ts — the path's own contract file) from BOTH battle-build resolvers, so neither relies on call order. |
| R4-2 | `chooseCultivationPath` commits path before grant verification | **Confirmed → hardened** | `player.cultivationPath = pathId` preceded learnTechnique/equipTechnique/learnSkill; return values discarded. Pre-validation now checks technique template, its innateSkillId template, every learnSkill target (an pair / bat_kiem_thuat / kit.skillIds tuple), and the kiem_tran_luong_nghi node BEFORE the write. RED tests: missing `da_phap_lien_tuyen` or `ngo_dao_hon_don` template → false + `cultivationPath`/`realmId` untouched. |
| R4-3 | `selectPhapTuElement` commits `{element,route}` before learnSkill verified | **Confirmed → hardened** | Root purchase + commit ran regardless of unlock-skill template existence. Now validates every `unlocksSkillIds` template against `skillTemplates` between `canPurchaseNodeSystem` (eligibility) and `purchaseNodeSystem` (mutation). RED test: missing `hoa_cau_thuat` → false + `phapTu` stays {null,null} + root not purchased. |
| R4-4 | Fixture fallout from the new boundaries | **Found + fixed** | 6 test fixtures relied on silent grant failure: phapTuAnPath (KIEM_TU_NODES), reimagined + realmAdvanceUnequip + kiemTuRoute (TECHNIQUES), buildSnapshot (KIEM_TU_NODES), dotPha + OutcomeService + OutcomeSettlement (TECHNIQUES). All now register the catalog the ritual requires — matching App.vue's full registration. Full suite confirms no other casualties. |
| R4-5 | Other battle-build paths bypass the kit assert | **Bounded** | `toTurnBattleParticipant` receives basic/special only via the two injected resolvers; the assert covers both. `resolveAnElementBasicPool` already throws on missing templates (HIGH-1). |
| R4-6 | `kiemTuRoute!` non-null assertion | **Safe** | Inside `pathId === 'kiem_tu'` branch, kiemTuRoute was computed non-null above. |

## Residuals / notes

- kiem_tran's `purchaseNode('kiem_tran_luong_nghi')` still executes
  post-commit (its `qi_refining` prereq requires the realm swap first,
  so it cannot move earlier). Pre-validation covers registry existence;
  a canPurchaseNodeSystem cost failure post-commit would still leave a
  route-committed player without the node — pre-existing kiem_tu
  semantics, not reachable with current authored data (the node is the
  route grant, free at ritual).
- `ngo_dao_chan_quyet.innateSkillId` in Techniques.ts remains the
  technique's own data point naming `ngo_dao_hon_don`; the kit constant
  documents the contract side. Pre-validation checks the technique's
  declared innate id dynamically, so the two can't silently diverge at
  ritual time.
- The kit assert is per-battle-build (3 `skillManager.has` lookups ×2
  resolvers) — trivial cost, no tick path touched.

## Verification evidence

- `npm run type-check` — clean (also inside `npm run build`).
- `npm run build` — clean (chunk-size warnings only).
- `npx vitest run` — **558 files / 4221 tests pass, 4 expected-fail, 0
  failures** at final code state.
- RED-first: 5 new tests failed pre-fix (2 kit-invariant, 2 ritual
  atomicity, 1 element-commit atomicity), all green post-fix.

## Verdict

**PASS WITH EVIDENCE** — the MEDIUM kit-integrity hole is closed by a
single authority asserted at battle build, and the advisory transaction
boundaries are hardened: no writer can now commit a path/element while
leaving a partial kit behind.
