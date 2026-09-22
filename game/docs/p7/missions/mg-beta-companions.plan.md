# M-G — Beta Companion Roster — Plan

Spec: `mg-beta-companions.spec.md` (v2 — post-review catalog/beta-pool split)
Worktree: `.agent-worktrees/mg-beta-companions` branch `p7-mg-beta-companions` from master `fb87ce52`

---

## Scope

+2 `CompanionDefinition`s, `BETA_COMPANION_IDS`/`BETA_COMPANIONS` acquirable-pool exports, 3 acquisition-surface reroutes (pull, exchange, DuyenPhanTab), +1 new buff data file (4 defs), 6 display-meta entries, roster-test count update, and new test coverage proving the heal/buff kits land through the real turn-engine seams and the beta pool gates acquisition while the full catalog keeps resolving owned instances. No engine, gacha mechanism, save, or migration changes.

## Tasks (TDD order)

1. **Failing tests first**
   - `data/companion/Companions.roster.test.ts`: count 10→12, grade counts `{4,4,3,1,0}`; `BETA_COMPANIONS` = exactly `[than_nong, khai_minh]`; every beta id resolves in `COMPANIONS`; effective beta rates `{huyen:2/3, dia:1/3}`; new-def invariants (support skills carry no `damage`; `appliesBuffs` target `allies_except_self`; khai_minh perks exactly [2,4,6]).
   - `data/buff/CompanionBuffs.test.ts` (new): def-shape invariants — `scaling:'fixed'`, no `application` block, `dispellable:false`, `khai_minh_thanh_ho` marker `per_target`/`latest` + `grantsExternalWard` capability; all 4 resolve in `BUFF_REGISTRY` after aggregate registration.
   - `core/companion/CompanionProgression.test.ts` (extend): real-def kit gating — locked below threshold, open at threshold; khai_minh rank-4 override yields `cooldownTurns:4` on the resolved clone while the definition stays 5 (no mutation).
   - `core/battle/turn/TurnBattleSystem.companionSupport.test.ts` (new): real-def casts through `resolveNextStep` —
     a. `than_nong_hoi_phuc_thuat` lands `than_nong_hoi_phuc` on each living ally, NOT the caster; healed ally recovers `flat` hp at their next turn start (clamp at maxHp).
     b. `than_nong_than_dang` heals more and clears a `test_stun`-style control on landing (`clearsCcOnApply` — reuse the cleanse-test fixture pattern from `appliesBuffs.test.ts`).
     c. `khai_minh_thanh_an` lands `khai_minh_thanh_ho` marker on allies + writes `externalWard` ≈ `khai_minh.stats.maxHp × 0.25` per ally; caster gets none.
   - `core/game` companion-ops tests (extend `GameManagerCompanionOps` suite or add `betaPool` file): seeded `pullCompanion` yields only beta ids; `exchangeCompanion('ho_ly_tinh')` → `unknown_definition`; grandfathered owned non-beta instance resolves kit via `resolveCompanionSkillKit` and entity via the build path (catalog stays authoritative); `saveShapeValidation` accepts an owned non-beta def id.
   - `DuyenPhanTab` render test (existing suite): exchange rows = the 2 beta defs only.
   - `data/skill/TurnSkillDisplayMeta` coverage: the 6 new ids resolve via `turnSkillDisplayMetaOf` (if a cheap accessor test exists — else covered implicitly by data assertions).

2. **Companion defs + beta pool** — append `than_nong` + `khai_minh` to `COMPANIONS` per spec §3.1-3.2; add `BETA_COMPANION_IDS` + derived `BETA_COMPANIONS` exports.

3. **Buff data** — `data/buff/CompanionBuffs.ts` (new file, `COMPANION_BUFFS` export) + spread into `buffs` aggregate in `data/buff/buffs.ts`. 4 defs per spec §3.3.

4. **Acquisition reroute** — `GameManagerCompanionOps.ts`: pull (:101) + exchange (:143) read `BETA_COMPANIONS`; `DuyenPhanTab.vue`: rows from `BETA_COMPANIONS`.

5. **Display meta** — 6 entries in `TURN_SKILL_DISPLAY_META` (`than_nong_basic`, `than_nong_hoi_phuc_thuat`, `than_nong_than_dang`, `khai_minh_basic`, `khai_minh_ho_ve_thuat`, `khai_minh_thanh_an`).

## Verify

- `npx vitest run src/data/companion src/data/buff src/core/companion src/core/battle/turn` (scoped)
- `npm run type-check`
- Wider regression: companion consumers — `npx vitest run src/core/game` after data lands (companion skill kit + ops tests, DuyenPhanTab suite, saveShapeValidation suite).

## Gates

P3 quick → P18 OCR → P4 adversarial QA (quick) → P5 sequential ≥3 → external impl review via mailbox round mg-r2 → merge to master.

P13/P14: not triggered — no UI/wiring/rendering changes (data + tests only). If QA surfaces a runtime doubt, a dev-server spot check of companion panel rendering is cheap, but nothing in this diff affects DOM.

## Risk notes

- `PERSISTENT_BUFF_REGISTRY` auto-includes non-periodic defs — the new defs are battle-only by caller convention (nothing applies them persistently); acceptable per spec §2 evidence.
- `hpRegenPerTurn` heal ticks on the HOLDER's turn start — verified by turnRegen test precedent; the new TBS test asserts the heal amount directly.
- `externalWard` marker expiry is owned by `reconcileExternalWard` — marker def shape copied field-for-field from `son_nhac_ho_the`.
- Balance magnitudes are placeholders deferred to the balance phase (same posture as M-F `baseGains`).
