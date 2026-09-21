# P7 — M2 Plan: Realm-Entry Passive Ownership Migration

Status: ACCEPTED — ChatGPT review PLAN_PASS (v3).
Spec: `m2-realm-passive-ownership.spec.md` (SPEC_PASS, v3).
Base: M1 `ce32f140` on `feat/p7-progression-consolidation`, worktree `.agent-worktrees/p7-progression-consolidation`.

## Execution notes

- TDD order: write/adjust failing tests first per task, then implement, then re-run the touched scope.
- This is an ownership migration with a deliberate behavior activation (the realm ladder becomes deliverable to path players — spec §1). Do not "fix" the new grants; they are the target.
- Save version bumps 68 → 69 — same rejection mechanism as M1, no translator.
- All edits inside the worktree. Local commit only after all gates pass.

## Task 0 — G0/G1 evidence

- Roadmap: no dedicated realm-passive authority phase exists; this mission creates it under the cultivation-path framework (`docs/roadmap.md` cultivation-path sections already read during M1/M2 discovery).
- Task card: mission-graph M2 — `realmRewards[realmId].passiveSkillId`; shared canonical ladder (deduped, way-overridable); `syncRealmPassive` re-pointed; `Technique.passiveSkillIdsByRealm` removed; `innateSkillId` → way kit grant.
- Measured facts (re-verified on this commit):
  - `tu_linh_quyet.passiveSkillIdsByRealm` verbatim ladder (9 entries, Techniques.ts:242).
  - `innateSkillId` on `ngo_dao_chan_quyet`(:91), `ngu_kiem`(:128), `thai_hu_kiem_quyet`(:159), `kim_cang_bat_hoai_the`(:186). `thai_hu_kiem_quyet` is orphaned (no way uses it; `hidden_sword_pathway.techniqueId = 'van_kiem_quyet'`).
  - `syncRealmPassive` seams: `chooseCultivationPath` (:265), `BreakthroughOutcomeService`, `TribulationOutcomeService`. No post-load seam.
  - `grantCultivationPathRealmReward` sole production caller: `TribulationOutcomeService`.
  - `spell_pathway.realmRewards.foundation_establishment = { techniqueId: 'dai_ngu_hanh_quyet_truc_co', artifactId: 'ngu_hanh_chau' }`.
  - Display consumers: `useTechniqueSections` (innate row + Tu Luyện section), `QuanKhiPanel.sealedKitSkillNames` (:78).
  - Techniques persist via `detachSaveValue(techniqueManager.getAll())` → snapshot shape changes → version bump required.
  - `skillManager.has` is the learned-check authority; `progressionOps.learnSkill` does template-lookup + learn; `skillSystem.equipWithoutSlot` equips passives.
- Cycle constraint (review-pinned): `CultivationPathKit` runtime-imports way objects from `KiemTuPath`/`PhapTuPath`/`TheTuPath`; way modules must not runtime-import kit/system values. The ladder therefore lives in a new **leaf data module** that way modules import: `src/data/progression/RealmPassiveLadder.ts` (`import type` only back into core — the established data-module pattern).

## Task 1 — Failing tests first

**New file `src/data/progression/RealmPassiveLadder.test.ts`** (import fails until Task 2 — the TDD red):
- `composeRealmRewards()` → every ladder realm maps to its canonical passive id.
- override: `{ qi_refining: { passiveSkillId: 'x' } }` → `qi_refining.passiveSkillId === 'x'`; other realms canonical.
- suppression: `{ qi_refining: { passiveSkillId: null } }` → `qi_refining.passiveSkillId === null`... (record keeps no passive grant); other realms canonical.
- merge: `{ foundation_establishment: { techniqueId: 't', artifactId } }` → record has all three fields (technique + artifact + canonical passive).
- passthrough: a non-ladder realm key in overrides appears verbatim.

**`src/core/player/CultivationPathContract.test.ts`** — new `describe('P7-M2 realm passive ownership')`:
- every way: `way.passiveSkillIds ⊆ way.ownedContent.skillIds` (empty set trivially passes).
- every way's `realmRewards` records satisfy `techniqueId !== undefined || artifactId !== undefined || passiveSkillId !== undefined`. A `passiveSkillId: null` record IS a deliberately authored suppression directive — `null` counts as a declared field even though runtime grants nothing for it.
- every non-null `realmRewards[*].passiveSkillId` and every `way.passiveSkillIds` member ∈ `KNOWN_SKILL_IDS`.
- composed tables: for each of the six ways, `realmRewards` contains exactly the 9 canonical realms (+ any way extras) and `realmRewards[r].passiveSkillId === CANONICAL_REALM_PASSIVE_LADDER[r]` (no way overrides at M2 — pin that none overrides/suppresses so a future override is a conscious diff).

**`src/core/game/GameManager.realmPassiveSkill.test.ts`** (new):
- sword ritual: `chooseCultivationPath('sword','sword_pathway')` → player at `qi_refining` has `passive_linh_khi_cam_ung` learned + `equipped` (equipWithoutSlot), plus `passive_kiem_tam_lanh_liet` learned + equipped.
- body ritual: `chooseCultivationPath('body','body_pathway')` → `passive_kim_cang_y_chi` learned + equipped without slot (pin all three initiation-passive owners: sword, hidden-spell, body).
- missing-template zero-mutation for a `passiveSkillIds` member: register skill templates minus `passive_kim_cang_y_chi`, attempt body ritual → returns false AND zero mutation (`cultivationPath`/`cultivationWay` unset, realm still mortal, technique not learned, no skill granted). (The hidden-spell case is already pinned by the phapTuAnPath test via the new preflight.)
- hidden-spell ritual grants `ngo_dao_hon_don` (already covered by phapTuAnPath test — keep, update comments only).
- `syncRealmPassive` idempotent: call again → no duplicate/no error.
- way-less player (`createDefaultPlayer`, mortal) → `syncRealmPassive` no-op; forged pair (`cultivationPath='sword'`, `cultivationWay` unset or mismatched) → no grant even at `qi_refining` (canonical ladder does not leak — the fail-closed pin).
- `equipTechnique('ngu_kiem')` alone does NOT learn `passive_kiem_tam_lanh_liet` (ownership moved off technique).
- `grantCultivationPathRealmReward(sword, foundation_establishment)` → `true` (record exists) while granting no technique/artifact; and `syncRealmPassive` at `foundation_establishment` grants `passive_truc_co_y_chi`.

**`src/core/game/GameManager.cultivationPathRewards.test.ts`**: update the sword test — return `true`, still `player.artifact` undefined and equipped technique unchanged (comment: passive-only record, delivery is syncRealmPassive's channel).

**`src/core/game/GameManager.phapTuAnPath.test.ts`**: update comments only (innateSkillId → `way.passiveSkillIds`); behavior assertions unchanged — the missing-template test still fails atomically via the new preflight.

**`tests/e2e/cultivation-path-ritual.spec.ts`** (~line 462, the `hidden_spell_pathway` leg): after `expect(hiddenCard).toContainText('Ngộ Đạo')`, add `expect(hiddenCard).toContainText('Ngộ Đạo Hỗn Độn')` — the sealed card's kit line comes from `sealedKitSkillNames`, so this proves `way.passiveSkillIds` feeds the UI consumer once the technique lookup is gone. The existing post-choice `learnedIds` assertion for `ngo_dao_hon_don` stays.

**Save boundary**: extend an existing save-shape test (or the new realm-passive test file's boundary section): `version: 68` payload rejected; `CURRENT_SAVE_VERSION` accepted. Check existing tests use the symbol — if a version assertion exists it already covers this; add an explicit `68`-rejected case only where the suite already pins old-version rejection (e.g. `saveShapeValidation.test.ts` pattern).

## Task 2 — Ladder leaf module

New `src/data/progression/RealmPassiveLadder.ts`:

```ts
import type { CultivationPathRealmReward } from '../../core/player/CultivationPathKit'

export const CANONICAL_REALM_PASSIVE_LADDER: Readonly<Record<string, string>> = { /* 9 entries verbatim */ }

export function composeRealmRewards(
  overrides: Readonly<Record<string, CultivationPathRealmReward>> = {},
): Record<string, CultivationPathRealmReward> {
  const table: Record<string, CultivationPathRealmReward> = {}
  for (const [realmId, passiveSkillId] of Object.entries(CANONICAL_REALM_PASSIVE_LADDER)) {
    table[realmId] = { passiveSkillId }
  }
  for (const [realmId, reward] of Object.entries(overrides)) {
    const base = table[realmId] ?? {}
    table[realmId] = {
      ...reward,
      passiveSkillId: reward.passiveSkillId !== undefined ? reward.passiveSkillId : base.passiveSkillId,
    }
  }
  return table
}
```

Note: `passiveSkillId` absent in an override inherits the canonical pick; `null` suppresses. Header comment: authored at composition time — runtime resolves the way record only (D2).

## Task 3 — Contract types (`CultivationPathKit.ts`)

- `CultivationPathRealmReward`: add `passiveSkillId?: string | null` (+ comment: delivered by syncRealmPassive; null suppresses canonical).
- `PathWayDefinition`: add `passiveSkillIds?: readonly string[]` after `skillIds` (+ comment: initiation passives, equipWithoutSlot; must be ⊆ ownedContent.skillIds).
- Update `skillIds` comment: remove the "hidden_spell_pathway's third kit member is a technique-carried passive" aside → "initiation passives ride `passiveSkillIds`".

## Task 4 — Way declarations

- `KiemTuPath.ts`: `sword_pathway` → `realmRewards: composeRealmRewards()`, `passiveSkillIds: ['passive_kiem_tam_lanh_liet']`, add the id to `ownedContent.skillIds` (append after `KIEM_PHO_ORB_IDS` — it is a way-owned grant; check uniqueness test stays green). `hidden_sword_pathway` → `realmRewards: composeRealmRewards()` only. Import from `../../data/progression/RealmPassiveLadder`.
- `PhapTuPath.ts`: `spell_pathway` → `realmRewards: composeRealmRewards({ foundation_establishment: { techniqueId: 'dai_ngu_hanh_quyet_truc_co', artifactId: 'ngu_hanh_chau' } })`. `hidden_spell_pathway` → `realmRewards: composeRealmRewards()`, `passiveSkillIds: [HIDDEN_SPELL_PASSIVE_ID]` (reuse the existing constant — ownedContent already lists it). Update the innateSkillId comments (:295, :317) to name `passiveSkillIds`.
- `TheTuPath.ts`: both ways → `realmRewards: composeRealmRewards()`; `body_pathway` → `passiveSkillIds: ['passive_kim_cang_y_chi']` + ownedContent.skillIds append.

## Task 5 — Runtime (`GameManagerRealmAdvanceOps.ts`)

- Import `getActiveWayDefinition` (extend the existing `../player/CultivationPathKit` import).
- `syncRealmPassive`: replace technique read with `getActiveWayDefinition(player)?.realmRewards?.[realm.id]?.passiveSkillId`; keep the existing `getCurrentRealm(player.realmId)` lookup as-is (it throws on an unknown id — do NOT add an unreachable `if (!realm)` guard), keep `skillManager.has`, template lookup, `learn` + `equipWithoutSlot` tail. Update the doc comment (way-owned reward; technique swap no longer affects it).
- `equipTechnique`: delete the `innateSkillId` block and its doc paragraph (equip stays a pure technique op).
- `chooseCultivationPath`: replace the `techniqueTemplate.innateSkillId` preflight check with a `way.passiveSkillIds` template loop (same zero-mutation position, before `applyPathChoice`); after the `skillIds` grant loop add the `way.passiveSkillIds` grant loop using `skillManager.has` guard + `progressionOps.learnSkill` + `skillSystem.equipWithoutSlot`. Update the M9 comment (third kit member now declared on `passiveSkillIds`).

## Task 6 — Technique model + data

- `Technique.ts`: remove `passiveSkillIdsByRealm` + `innateSkillId` fields and their comments.
- `Techniques.ts`: remove the `tu_linh_quyet` ladder block + comment; remove the 4 `innateSkillId` declarations and the line-75 comment referencing the mechanism. (Technique bodies otherwise unchanged — `thai_hu_kiem_quyet` stays an authored orphan; M3 owns its disposition.)

## Task 7 — Display consumers

- `useTechniqueSections.ts`: delete the `innateSkillId` combat row and the whole `passiveSkillIdsByRealm`/`cultivationRows` Tu Luyện section; drop the now-unused `getCurrentRealm` import and the `skillName` helper (only those rows use them). With `skillName` gone, the `gameManager` parameter is unused — remove it from `buildTechniqueSections` and update the two call sites (`TechniquePanel.vue:35`, `TechniqueSlotCard.vue:115`), which then no longer need to source `gameManager` for this call (leave their `gameManager` bindings if used elsewhere; remove only if newly unused).
- `QuanKhiPanel.vue`: `sealedKitSkillNames` → `[...(way.skillIds ?? []), ...(way.passiveSkillIds ?? [])]` mapped to names; update the comment (way-declared kit: loadout skills + initiation passives). Drop the `gameManager.techniqueManager` read.

## Task 8 — Comments that name the retired mechanism

- `PhapTuPath.ts` :295/:317 (done in Task 4).
- `data/skill/TurnAnKitSkills.ts` :31 — "granted at the ritual via innateSkillId" → `hidden_spell_pathway.passiveSkillIds`.
- `data/skill/PassiveSkills.ts` header — point at `RealmPassiveLadder`/`realmRewards` instead of `Technique.passiveSkillIdsByRealm`.

## Task 9 — Save version

- `saveVersion.ts`: `CURRENT_SAVE_VERSION = 69` + v69 changelog line (P7-M2: `Technique` snapshot drops `passiveSkillIdsByRealm`/`innateSkillId`; v68 rejected, no migration).
- `docs/p7/mission-graph.md`: fix the stale M8 "v68 bump" note → M8 owns the final version decision (v68 is M1's, v69 M2's).

## Task 10 — Gates (in order)

1. `npm run type-check` + scoped vitest (`RealmPassiveLadder`, `CultivationPath`, `GameManager.cultivationPathRewards`, `GameManager.realmPassiveSkill`, `GameManager.phapTuAnPath`, `BreakthroughOutcomeService`, save/skill suites that touched technique shape).
2. E3 simplify pass over the diff.
3. `npm run verify` (full — persisted-shape + core runtime change).
4. Residue census: zero `passiveSkillIdsByRealm`/`innateSkillId` outside mission docs; `git grep` both identifiers.
5. P18 OCR (delegation mode) over the diff.
6. P13/P14 — dev server from this worktree, two staged legs:
   a. Ritual leg: stage a mortal-cap save → run the ritual → `sword`/`sword_pathway` → confirm `passive_linh_khi_cam_ung` + `passive_kiem_tam_lanh_liet` learned+equipped (skill panel and/or save snapshot), TechniquePanel renders without the removed rows, zero console errors.
   b. Major-realm leg: stage a `spell`/`spell_pathway` player at the `qi_refining` cap and drive the tribulation → `foundation_establishment` transition → confirm `passive_truc_co_y_chi` granted AND the existing composed-record rewards (`dai_ngu_hanh_quyet_truc_co` equip + `ngu_hanh_chau` artifact) still land exactly once; repeat-call idempotence; save persists; zero console errors.
7. P4 adversarial QA (quick) → `docs/qa/` report.
8. P5 — ≥3 sequential passes with evidence blocks; a Medium+ fix on the last pass forces another pass over the new state.
9. External review until `IMPL_PASS`.
10. G5 evidence report (architecture-worker-workflow) → `m2-realm-passive-ownership.notes.md`, written against the externally-reviewed final state; commit.
    **Gate re-entry rule:** any external-review finding that changes production code re-enters at affected P3 → P18 → triggered P13/P14 → P4 → sequential P5 → external re-review; the G5 report is then generated/updated on that final state before commit.

## Risks / watch items

- `GameManager.cultivationPathRewards.test.ts` sword case return flip (false→true) — the pinned return-semantics change; keep the artifact/technique assertions to preserve the test's original intent.
- `useTechniqueSections` section removal: `TechniquePanel`/`TechniqueSlotCard` consumers must still compile; check for tests snapshotting the Tu Luyện section.
- Contract test "no id owned by two ways" — the two new ownedContent ids are unique; ladder ids deliberately stay out of ownedContent.
- ASCII-comment ratchet (`tests/architecture/asciiComments.test.ts`): keep new comments ASCII-only; regenerate `baselines/asciiComments.json` via `node scripts/p15-baseline.mjs` if the ratchet flags legitimate comment churn.
- `version:68` literals in test helpers/e2e staging scripts — sweep for hardcoded versions.
