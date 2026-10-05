# Fixpoint audit wave 3 — AUT (authority/consistency)

Auditor: w3-AUT worker. Branch `codex/hoa-cau-fireball-vfx` @ `9827f9f8`. Read-only on
production code; no live Supabase (no credentials on this box) — SQL legs verified by
source proof against the client mirror.

Verification executed:
- `npm run type-check` — clean at HEAD.
- `npx vitest run src/services/save/ src/core/betaScopeSkillDomain.test.ts src/services/character/` — 26 files / 654 tests pass.
- `npx vitest run tests/architecture/ src/core/phap-tu/` — 110 files / 974 tests pass (6 expected-fail, 8 skipped).

---

## Findings

### W3-AUT-1 — write path has no legs for the rejection classes the client added (Medium)

Server: `_check_save_payload`
(`supabase/migrations/202610050001_beta_save_talent_entitlement.sql:34-187`) mirrors
identity + the F-TAL-1 talent legs + `mortalBasicSkillId` — nothing else. The client
load seam now rejects several payload classes the write path still accepts; a crafted
writer can commit rows that classify `'ready'` yet no official client can ever load
(`isSaveAcceptable` false → remote treated as absent; the poisoned row keeps
accepting CAS writes and never surfaces).

Unmirrored rejection classes (each confirmed by reading both legs):

| Class | Client rejection | Server leg |
|---|---|---|
| committed `spell_pathway` + non-beta/null element (F-SCOPE-1) | `src/services/save/saveAcceptance.ts:303-318` (throw) + `src/core/phap-tu/PhapTuPath.ts:182-245` `validateSpellPathPersistedState` | none |
| `realmId` not in REALMS (garbage/non-catalog string) | `saveShapeValidation.ts:517-525` `'không tồn tại trong danh sách cảnh giới'` | `CASE` at `:129-140` yields NULL → `v_realm_index = -1` → cap 1, pool gate skipped (`:172` requires `>= 0`) — accepted |
| `realmId` beyond release ceiling (`golden_core`+ — incl. fabricated `kd_*` pool claims at idx ≥ 3) | `saveShapeValidation.ts:527-539` F-REALM-CEILING vs `ReleasePolicy.ts:42` | none — `v_realm_index` happily maps `tribulation` → 9 |
| `nodeLevels` prereq replay + F-A19-1 element-root pinning (foreign-element/fabricated node claims) | `saveShapeValidation.ts` nodeLevels block (:1836-1985) + `:241` | none — no `nodeLevels`/`skillLevels` leg exists anywhere in the SQL |
| `pendingTalentEntitlement` legality (realmId binding, offered ⊆ pool, realm reached) | `saveShapeValidation.ts:826-915` | none |
| cultivation axis coherence (`cultivationPath`/`cultivationWay` values, hidden-way kit coherence) | `saveAcceptance.ts:246-298` | none |

Blast radius: crafted-client self-poison only — no cross-user surface. But (a) W2-3's
"crash over silent wedge" ruling *added* the F-SCOPE-1 rejection post-commit, so any
row committed with a non-beta/null element during the gap is now a `'ready'` row that
can never load; (b) fabricated progression (owned node without prereq chain,
beyond-ceiling realm with `kd_*` claims) stores as `'ready'` authoritative data, so
tooling/analytics reading `'ready'` rows see unproducible state.

Root-cause class: mirror written to F-TAL-1 scope only (the W2-AUT-4 fix boundary);
load-side rejection classes were added without corresponding write-path legs. Same
class as W2-AUT-4 — the remaining unmirrored surface is larger than the talent domain
the mirror targeted. Policy question for adjudicator: is `write_character_save`
meant to reject every unproducible claim, or is load-rejection the intended single
gate? If the latter, this is accepted-by-design and should be documented as such.

Evidence kind: SOURCE_PROOF (both legs quoted above; cannot execute SQL without
credentials).

### W3-AUT-2 — `create_character` name check lacks the client charset leg (Low)

Client: `CharacterCreationService.ts:45-46` `isValidCharacterName` requires
`/^[\p{L}\p{N} _-]{2,20}$/u`. Server (`202610050001:266-269`) checks only
`char_length(trim(p_name)) between 2 and 20` + `normalized_name` uniqueness; the table
constraint (`202608240001_online_auth_character.sql:63`) repeats length only. A crafted
RPC creates a character named `!!`, `-- --`, or emoji-adjacent punctuation that the UI
contract forbids; the name then binds `player.name` in every save (load side only
`requireString`s it, so the row stays loadable). Permanent out-of-contract identity row.

Root cause: mirror covers length but not charset.

### W3-AUT-3 — `characters.realm_id` default `'pham_nhan'` is not a catalog realm (Nit, latent)

`202608240001:50` `realm_id text not null default 'pham_nhan'`; client REALMS order
(`src/data/realms/realm.ts`) starts at `'mortal'`. Verified no consumer reads it into
player state: `parseRemoteCharacterMetadata` (`BackendStatus.ts:109,163`) carries it,
but `initializationMetadataFromRemote` (`initializeCharacter.ts:43-55`) maps only
name + talentIds + validates `mortalBasicSkillId`. Latent: any future SQL leg or
reader that consumes the column hits an unknown realm (`getRealmIndex` → -1, CASE →
NULL). Report as drift-marker, not a live defect.

### W3-AUT-4 — hardcoded literal mirrors are un-pinned drift bombs (Nit)

These SQL literals were verified 1:1 against the TS catalogs today, but nothing guards
the next catalog edit:

- `v_creation_catalog` 19 ids (`202610050001:58-63`) vs `BETA_CREATION_TALENT_IDS`
  (`core/betaScope.ts:98-128`) vs `create_talent_roll` allow-list (`:201-209`) —
  three copies of the same list.
- `v_parked_talents` (`:64`) vs `PARKED_TALENTS`; `v_pool_min_realm` keys (`:65-71`)
  vs `BREAKTHROUGH_TALENT_POOLS` realm keys; realm CASE (`:129-140`) vs REALMS order;
  `0.15` (`:215`) vs `PHAM_COT_OFFER_CHANCE` (`Talents.ts:290`).
- `pham_nhan_chi_cot` literal (`:159-161`) vs `GREAT_DAO_REWARD_TALENT_IDS` set: client
  uses the *set*, SQL uses the single id — adding a second reward id is silently
  accepted server-side without witness while the client still rejects it.

No defect today; recommend a comment/checklist pinning each literal to its TS source.

### W3-AUT-5 — symmetric hole: no known-talent leg on either side + spec coverage gaps (Nit)

Neither side pins `selectedTalentIds ⊆ known catalog union`. An out-of-catalog id
('fake_talent_9') passes every leg on both sides (not dup/parked/great-dao/pool;
counted toward the ceiling only). Consistent today — symmetric hollow spot, not
split-brain. Same for non-string array elements: client `validateStringEntries`
flags them; SQL `jsonb_array_elements` tolerates/coerces, but the recorded-pick
containment leg still bites so practical rejection holds.

Coverage gaps in `tests/integration/supabase/authority.spec.ts` W2 blocks: no pins
for the duplicate-id leg, garbage `realmId`, non-string array elements, the charset
gap (W3-AUT-2), or an injection-rate sanity check.

---

## Per-surface verdicts

**F-TAL-1 ↔ `_check_save_payload` mirror — PASS WITH EVIDENCE.**
Every client rule has an equivalent SQL leg: recorded-pick containment with the
two-arm `highestFoundationAchieved === 'great_dao'` tolerance (`:116-128`, matching
`TribulationOutcomeService.ts:251,323-355` — witness and conversion are co-written in
one transition); ceiling `cardinality > 1 + greatest(idx,0)` (`:141`); dup via
`cardinality <> count(distinct)` (`:144-148`, catches dup-of-dups); parked pair
(`:153-157`); witness rule (`:159-161`); creation-catalog ≤ 1 (`:164-168`); pool-realm
gate skipped when index < 0 (`:172-181`, same as client `talentRealmIndex < 0 →
continue` at `saveShapeValidation.ts:702`); realm CASE order == REALMS order exactly
(mortal 0 .. tribulation 9); `getRealmIndex` -1 ↔ SQL NULL → cap 1 both sides.
Empty/NULL payload array → `coalesce(..., [])` → containment fails whenever the
recorded pick is non-empty (`characters_one_talent` forces cardinality = 1, so a
recorded pick always exists). Mirror-complete for its declared scope; see W3-AUT-1
for what it doesn't cover.

**`create_talent_roll` + `create_character` binding — PASS WITH EVIDENCE.**
Distributions identical: both draw 9 weighted-without-replacement over the same 19
enabled beta ids (client sequential roulette `Talents.ts:292-308` ≡ server
`-ln(rand)/weight` exponential-race `ORDER BY ... LIMIT 9` `:200-209`), then inject
`pham_cot` at a uniform slot among all 9 (client `result[floor(rand()*len)]`
`Talents.ts:309-311` ≡ `rolled_ids[1+floor(random()*cardinality)]` `:215-218`), gated
0.15 both sides (`PHAM_COT_OFFER_CHANCE` ↔ literal) + server additionally gates on
`enabled`. Response `ORDER BY array_position(rolled_ids, t.id)` (`:222`) makes
`response[i] ≡ talent_ids[i]`, so the client's `slice(0,3)` == server binding
`p_talent_ids <@ talent_ids[1:3]` (`:262-264`). `cardinality(rolled_ids) <> 9 → raise`
fails closed if the catalog ever shrinks; disabling a talent post-roll cannot shrink
the stored slice (binding reads the stored array, not a fresh lookup). Fewer-than-3
offer edge is unreachable today and fail-closed at roll time.

**F-SCOPE-1 split-brain probe — FAIL (W3-AUT-1).**
Server accepts + classifies `'ready'` a committed `spell_pathway` save with
null/non-beta element that the client rejects at shape *and* acceptance. Direction:
server-accepts-what-client-rejects. Sibling unmirrored classes enumerated in W3-AUT-1.

**`betaScopeSkillDomain` vs other read surfaces — PASS WITH EVIDENCE.**
`treeNodeFor` verdicts consistent with `betaSkillTreeFor`/`betaCombatRolesFor`/
respec/devReset across mortal (initiation-pending), non-beta way (scope-hidden at
any level via `requiredWay` — all dormant-way nodes carry stamps:
`sword_pathway`/`hidden_sword_pathway`/`body_pathway`/`hidden_body_pathway`),
corrupt pair, foreign elementTag, dormant view tags, and `levelsSkillId` kits. The
W2-2 residual — owned non-admitted node rendering 'purchased' with raw
`canUpgrade` — was hunted for reachability: every non-root element node requires
its `<el>_root` prereq (`PhapTuNodes.builders.ts`), every root requires committed
element (F-A19-1) which F-SCOPE-1 makes unloadable for non-beta elements, and every
other admission failure mode is scope-hidden before the owned branch — so the
mismatch state is unreachable through the load seam. Not a finding.

**`authority.spec` W2 blocks (~:616,:672) — PASS WITH EVIDENCE.**
Assertions map to real SQL legs: rejections exercise `writeSave` →
`_check_save_payload` (parked/noWitness/twoCreation/lowRealm/atPool/witnessed) and
`create_character` slice binding (index-5 pick → `INVALID_TALENT_SELECTION`);
draw-order assertion reads the RPC response against stored `talent_ids`. Cannot
execute against a live DB (no credentials) — mapping verified by source only.
Coverage gaps folded into W3-AUT-5.

**New drift hunted — findings above.** pham_cot `enabled` parity confirmed
(re-enabled by `202610020001` + `202610030001` — W2-AUT-5 stays rejected); talents
table weights == client weights; `characters_one_talent`/`_creation_catalog`/
`linh_bao`/`base_attributes` (server-fixed all-1s, client sends none) consistent.

---

Verdict: **QA_FINDINGS_OPEN** — F-TAL-1/roll/binding/beta-scope mirrors verified
clean; the write-path mirror stops at its declared talent scope while the client now
rejects six further payload classes (W3-AUT-1), plus charset (W3-AUT-2) and three
drift/coverage nits.
