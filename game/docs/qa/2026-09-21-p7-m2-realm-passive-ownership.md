# QA Review: P7-M2 realm-entry passive ownership migration

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 23 files under `game/src/**`, `game/tests/**` (diff on `feat/p7-progression-consolidation`); `game/docs/**` excluded (docs-only)

## Scope and Risk Map

`changed-risk-map.mjs` over the 16 production/test paths returned `deepAuditCandidate: false` with all paths unmapped — manually routed:

| Path(s) | Domain routing |
|---|---|
| `GameManagerRealmAdvanceOps.ts` | economy-and-progression, combat-and-tribulation (realm transition grants) |
| `CultivationPathKit.ts`, `KiemTuPath.ts`, `PhapTuPath.ts`, `TheTuPath.ts`, `RealmPassiveLadder.ts` | economy-and-progression (way declarations, ladder composition) |
| `Technique.ts`, `Techniques.ts` | combat (technique model), economy-and-progression |
| `PassiveSkills.ts`, `TurnAnKitSkills.ts` | combat (skill data) |
| `saveVersion.ts` | save-and-cloud |
| `useTechniqueSections.ts`, `TechniquePanel.vue`, `TechniqueSlotCard.vue`, `QuanKhiPanel.vue` | ui-input-lifecycle |
| `cultivation-path-ritual.spec.ts` | e2e oracle |

**Escalation decision — bounded to quick:** the change moves one progression channel (realm-entry passives) and one grant channel (way initiation passives). Save impact is a dev-phase version bump (v68 rejected, no migration — identical policy to M1's v68). Every invariant is pinned by deterministic tests (6154-test suite green) and the full chain was verified live in-browser this session: real ritual → hidden-way commit → both passive channels equipped without slot → real foundation tribulation → second ladder rung granted. No clock/offline, economy, or Phaser lifecycle surface touched. Materiality confidently bounded.

## Invariant Ledger

| # | Invariant | Oracle | Result |
|---|-----------|--------|--------|
| I1 | Realm-entry passive source is the committed way's `realmRewards[realm].passiveSkillId` | `syncRealmPassive` impl + live save | Holds — `passive_linh_khi_cam_ung` + `passive_truc_co_y_chi` granted at `qi_refining`/`foundation_establishment` live |
| I2 | Way-less/corrupt pair grants nothing | `GameManager.realmPassiveSkill.test.ts` + `getActiveWayDefinition` early-return | Holds |
| I3 | Passives equipped without consuming loadout slots | live save slice | Holds — `equipped:true`, no `loadoutSlots` on all three passives |
| I4 | Initiation passives via way `passiveSkillIds`, prefight preflight atomic | contract test + live ritual | Holds — `ngo_dao_hon_don` learned at commit |
| I5 | Technique swap cannot alter realm passives | `equipTechnique` now pure delegate + test | Holds |
| I6 | `passiveSkillId: null` suppression authored | `composeRealmRewards` merge semantics | Holds — falsy read, `grantCultivationPathRealmReward` still returns true |
| I7 | Non-passive overrides (technique/artifact) merge with canonical passive | `spell_pathway` `foundation_establishment` override | Holds — `dai_ngu_hanh_quyet_truc_co` + `ngu_hanh_chau` merge correctly |
| I8 | Idempotent repeat sync | `skillManager.has` guard + test | Holds |
| I9 | E2E oracle asserts the rendered contract | live DOM vs spec assertions | **Violated, fixed (F1)** — asserted localized name, card renders raw id for unlearned skills |
| I10 | Declared passives are `type:'passive'` defs | contract test | **Gap, hardened (F2)** — guard added |
| I11 | `tu_linh_quyet` remains fully removed | residue census | Holds — zero live refs, only retirement comments |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run verify` (type-check + build + vitest) | 707 files / 6154 tests green (4 expected-fail) | Full suite on latest state |
| `npx vitest run src/core/player/CultivationPathContract.test.ts` | 30/30 green | Includes new passive-type guard |
| Balance fingerprint (`BalanceMatrix.test.ts`) | Regenerated; 30 cells shifted; all gates pass | Documented in `docs/balance/2026-09-21-p7-m2-realm-passive-activation.md` |
| P13/P14 live session (worktree dev server :5917) | Full chain driven end-to-end | See below |
| Residue census (`passiveSkillIdsByRealm`, `innateSkillId`, `tu_linh_quyet`) | 0 live refs | Retirement comments only |

### Live runtime evidence (P13/P14)

- Guest save `tien-hiep-idle-save:guest` staged to mortal Lv18 + `skillCastCounts.linh_bao=10000` → real Quán Khí ritual → sealed `Pháp Tu Ẩn — Ngộ Đạo Chân Quyết` card rendered (kit line: `van_phap_tuy_tam · da_phap_lien_tuyen · ngo_dao_hon_don`) → committed.
- Persisted v69: `realmId=qi_refining`, `cultivationPath=spell`, `cultivationWay=hidden_spell_pathway`.
- Skill slice: `ngo_dao_hon_don` + `passive_linh_khi_cam_ung` both `unlocked:true, equipped:true`, no `loadoutSlots` (equipWithoutSlot live for both channels).
- Technique panel: `Ngộ Đạo Chân Quyết` renders only the Chiến Đấu section — zero passive rows (obsolete rendering removed).
- Staged `qi_refining:12` → real Trúc Cơ tribulation (quiz + Lôi Kiếp endurance) → `foundation_establishment:1`; `grantedRealmPassiveIds=[qi_refining, foundation_establishment]`; `passive_truc_co_y_chi` learned + equipped without slot. Ladder rung delivered through the way's `realmRewards` — the previously dead channel now works.
- Two-path matrix (required legs): (a) fresh char → real ritual → `sword`/`sword_pathway` → persisted `passive_kiem_tam_lanh_liet` (way initiation) + `passive_linh_khi_cam_ung` (realm rung), both `equipped:true` without `loadoutSlots`; (b) fresh char → real ritual → `spell`/`spell_pathway` → staged `qi_refining:12` → real Trúc Cơ tribulation → `foundation_establishment:1` with the full reward record delivered: `passive_truc_co_y_chi` equipped-no-slot + `dai_ngu_hanh_quyet_truc_co` learned/equipped + `ngu_hanh_chau` artifact initialized at `foundation_establishment`/`pham`. The `composeRealmRewards` technique/artifact merge path proven live.
- 0 console errors across all sessions (only pre-existing Tone.js AudioContext warnings).

## Findings

### QA-2026-09-21-M2-1: e2e oracle asserted localized passive name the sealed card never renders
- Severity: Medium
- Status: Confirmed → fixed (test-file write inside QA allowlist)
- Invariant: I9
- Preconditions: `tests/e2e/cultivation-path-ritual.spec.ts` hidden-way card test after adding the `Ngộ Đạo Hỗn Độn` kit assertion
- Reproduction: `npm run test:e2e` → `toContainText('Ngộ Đạo Hỗn Độn')` fails; the card renders `skillManager.get(id)?.name ?? id` and `get()` only searches LEARNED skills, so an unlearned kit renders raw ids
- Expected: assertion matches rendered text (`ngo_dao_hon_don`)
- Actual: assertion expected the localized name
- Evidence: live DOM capture — `Bộ kỹ năng: van_phap_tuy_tam · da_phap_lien_tuyen · ngo_dao_hon_don`
- Test file: `tests/e2e/cultivation-path-ritual.spec.ts` (fixed: assertion + comment)
- Owner subsystem: e2e oracle layer
- Blast radius: playwright-only spec; no production impact. The raw-id fallback is pre-existing UX (kit names render as ids until learned), out of M2 scope to change.

### QA-2026-09-21-M2-2: contract tests never asserted declared passives are `type:'passive'`
- Severity: Low (coverage gap — latent authoring footgun)
- Status: Confirmed → hardened (test-file write inside QA allowlist)
- Invariant: I10
- Preconditions: a way author places an active-skill id in `passiveSkillIds` or `realmRewards[].passiveSkillId`
- Reproduction: declaration would pass all previous contract checks (id resolves in `KNOWN_SKILL_IDS`) and `equipWithoutSlot` would then equip an ACTIVE skill without a slot — free loadout bypass
- Expected: contract test rejects non-passive defs in passive channels
- Actual: no type assertion existed
- Evidence: code inspection of contract test + `SkillManager.get`/`SKILLS` type field
- Test file: `src/core/player/CultivationPathContract.test.ts` (new `it('all declared passives resolve to defs of type passive')` — passes on current catalog, guards future declarations)
- Owner subsystem: contract-test layer
- Blast radius: test-only hardening; no production change

## Pre-existing notes (not task-caused)

- P15 scanner limitation: `ts.createScanner().scan()` cannot resume after `${}` template substitutions — comments later in a file containing a template literal are not scanned. Surfaced while auditing comment compliance in `KiemTuPath.ts`/`PhapTuPath.ts`/`TheTuPath.ts`. Recommend a follow-up infra fix; out of M2 scope.
- Sealed hidden-way card renders raw skill ids (`skillManager.get` learned-skill lookup + `?? id` fallback). Pre-existing UX; recording for a future polish pass.
