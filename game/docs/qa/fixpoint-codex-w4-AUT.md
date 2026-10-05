# Fixpoint audit wave 4 — AUT (authority/consistency)

Auditor: w4-AUT worker. Branch `codex/hoa-cau-fireball-vfx` @ `0afd0b2f` (wave-3 tip).
Read-only on production code; no live Supabase on this box — every SQL-side claim is
SOURCE_PROOF (legs quoted with line numbers); client-side claims are executable and
pinned in `src/services/save/w4aut.repro.test.ts` (22 tests) +
`tests/architecture/saveBoundaryMirrorParity.qa.test.ts` (17 tests) on
`devin/w4-aut-report`.

Wave-3 delta under audit:
- `supabase/migrations/202610050002_beta_save_boundary_mirror.sql` — rewrites
  `public._check_save_payload` (:14-266) to mirror client boundary rejects,
  rewrites `public.create_character` (:271-337) with charset + starter-pick legs,
  normalizes `characters.realm_id` 'pham_nhan'→'mortal' (:341-344).
- `src/App.vue` onResume (:649-678) routes `rejected` live-replacements to
  `saveIssue` + `markFailed('recovery')`.

Verification executed:
- `npx vitest run src/services/save/w4aut.repro.test.ts tests/architecture/saveBoundaryMirrorParity.qa.test.ts`
  — 2 files / 39 tests pass; `npx vitest run src/services/save/` — 26 files / 690 tests pass.
- `npm run type-check` (vue-tsc --build) — clean; `tests/architecture/asciiComments` — pass.
- Full client boundary re-read: `saveShapeValidation.ts` (4809 lines),
  `saveAcceptance.ts`, `GameManagerSaveRestore.ts`, `SaveSystem.ts`,
  `SaveIncompatibleScreen.vue`, `SupabaseCloudSaveService.ts`, plus every
  `path`/`way` slice validator (`MortalPrecursors`, `PhapTuPath`, `KiemTuPath`,
  `CultivationPathKit`).

---

## Findings

### W4-AUT-1 — the migration header's "recoverable, not a wedge" claim is false under remote authority (High)

`_check_save_payload` header (:9-12) argues residual unmirrored classes are
acceptable because a rejected row lands on `SaveIncompatibleScreen` "with export
and delete". Read the recovery surface: under `remoteAuthoritative` capability
that is only half true — **export exists, delete does not**.

- `SaveIncompatibleScreen.vue:63-77` — the reset button's own comment states it
  is "only a CACHE reset: the authoritative load re-fetches the cloud row after
  reload (an unchanged corrupt row lands back on this surface)".
- `SaveSystem.ts:671-698` `deleteSave()` clears **localStorage keys only** — the
  remote row is never touched.
- Remote-mode import (:92-105) is validate + re-export — it cannot write the
  repaired bytes back into `character_saves`.
- Enumerated all 22 public functions across `supabase/migrations/` — **no
  `delete_character` / `reset_character` / save-row delete RPC exists**. Operator
  SQL is the only way to clear a bad row.
- `create_character` returns `CHARACTER_EXISTS` (:285) — no new-character escape.
- `SupabaseCloudSaveService.load` classifies a shape-failed row `'corrupted'` but
  preserves `raw` for export (:725-741) — so export works, but the row wedges
  again on the very next load. Boot, resume, and import all end on the same
  unrecoverable surface.

Consequence: every class in W4-AUT-2 that lands in `character_saves` is a
**permanent, user-invisible wedge** — the account boots forever onto the
incompatible surface until an operator deletes the row. Reachability is
crafted-writer/buggy-writer self-poison only (no cross-user surface), but the
migration's own premise — that residual wedges are recoverable — is documented
wrong, and it is the premise that justified scoping the mirror.

Root-cause class: AUT-08 (authority contract documents a property the system
doesn't provide). Fix options for the coordinator: (a) extend the mirror to the
full residual set (big), (b) add a remote `delete_character` / save-reset RPC so
the wedge claim becomes true, or (c) correct the header comment to
"operator-recoverable only" and accept the residual surface as load-gate-by-design.

Evidence: SOURCE_PROOF + code read of the recovery surface.

### W4-AUT-2 — residual server-accepts/client-rejects classes; every one is a permanent wedge (High)

The mirror's own stated rule (:168-170) is "every payload class the client load
seams reject must be rejected here too, or a row the server marks 'ready' wedges
on its next client read." It mirrors the named subset; below is the complete
enumeration of what it does NOT mirror. Each row: SQL accepts (no leg or a
weaker leg) → `_classify_save_row` marks it `'ready'`
(`202609300001:333-366` only checks object/schema/version/owner) → client load
rejects → wedge per W4-AUT-1.

Repro: `w4aut.repro.test.ts` executes the starred cases through the real gates —
every one passes shape-or-later SQL legs by source, and the client rejects it.

**Player-scalar / object legs with no SQL leg at all:**

| Class (craft) | Client rejection | SQL leg | Pinned |
|---|---|---|---|
| `realmLevel` non-int / `<1` / `>18` | `saveShapeValidation.ts:556-571` (vượt maxLevel) | none | ✓ (99, 0) |
| `physiqueGrade` out of enum | :541-554 | none | — |
| `cultivation` non-finite / over cap | :578-594 | none | — |
| `baseStats` / `externalModifiers` / `persistentTimedEffects` shape+finite | :602-625, :1448-1640 | none | — |
| `talentLevels` non-object / int≥1 / ≤maxLevel / owned-only | :731-768 | none | ✓ (5, 99) |
| `skillInsight` > `totalSkillInsightGained`; accumulator bounds | :993-1031 | none | — |
| `attributePoints` bound vs global level | :1036-1046 | none | — |
| `breakthroughGrade` at mortal (any presence/type) | :1056-1084 | realm≥1 only | ✓ (-1, "2") |
| `breakthroughGrade` negative / `>6` / `>max(1,tiers)` post-initiation | :1056-1084 | `<1` only | ✓ (99, 1e999) |
| `purchasedNodeIds` mirror consistency | :1086-1112 | none | — |
| stage claims (completedStageIds / perfect clears realm pins) | :1114-1202 | none | — |
| `grantedRealmPassiveIds` + modifier replay | :1204-1443 | none | — |
| `highestFoundationAchieved` enum + realm-coherence + earnability witness | :1643-1696 (FOUNDATION_LABELS, `great_dao` needs `hiddenBreakthroughRealmIds`) | realm≥2: non-empty string only (:204-207) — accepts `'garbage'`, `'imperial'` with no body records | ✓ (imperial, garbage) |
| `combatAiStrategy`, `skillLevels` retired key, `skillCastCounts` | :1698-1739 | none | — |
| `techniqueProgress`, `artifact`, `cultivationOvercharge`, `nodeFreePurchaseRecord`, `nodeOneShotGrants`, `phaGiapCarry`, `hiddenBeastKills`, `lastSavedAt`, `autoWorkerCapacity` | :1740-1833, :2081-2235 | none | — |
| `companions` / `companionGifts` (realm pins, moment table, claim witness) | :2224-2680 | none | — |
| `perfectClearSeconds` floor, `autoFarmStage`, `formationLoadout` | :2265-2398 | none | — |
| `nodeLevels` deep legs: finite/negative/`core_` pin / F-A19-1 ownership / **prereq replay** | :1836-1987 | only the 5 element-root claims (:235-253) | — |
| `cultivationPath`/`cultivationWay` both-or-neither + way∈module.ways | :1989-2047 | mortal pair-ban only (:211-214); committed pair recognized only when way === 'spell_pathway' | ✓ (cross-module, path-without-way) |
| `validateSpellPathPersistedState`: element∈ELEMENT_ORDER∪null, `route` retire, element-way ownership | :2060 + `PhapTuPath.ts:182-245` | only `element='fire'` under committed pair | — |
| `validateSwordPathPersistedState`: swordPath required for sword path, `mode` retire, preset 1-9 orb ids | :2060 + `KiemTuPath.ts:74-120` | none | — |
| `hidden_spell_pathway` kit (3 `ngo_dao_*` skills) + `hidden_*` ways | `saveAcceptance.ts:292-301` | none — hidden ways skip all committed-pair legs | — |
| `player.name` jsonb-number coercion (`"name":55` for character '55') | requireNonEmptyString | `->>'name'` coerces → equality still passes (:81) | — |

**Top-level slice legs:**

| Class | Client rejection | SQL leg |
|---|---|---|
| `techniques[]` entries beyond id-strings; way-holder 0-or-1 + id == `way.techniqueId` + canonical progression | `saveAcceptance.ts:124-211` | length ≥1 only (:195-198) — accepts `[{id:'bogus'}]` ✓ |
| `skills[]` deep: dup ids, retired keys, `totalExperience ≤ mirror`, M-QI-05 skill-core coverage loops | :2722-3031 | only 'hoa_cau_thuat' membership under committed fire (:229-233) |
| `quests`, `buildings` (dup instanceId, crafting singleton, maxLevel, realm tier, accrual pin), `productionSites` + `workerCycles` spans | :3036-3431 | none |
| `alchemyJobs` + reservation witness replay | :3435-3575 | none |
| `decompose` slice | :4296-4327 | none |
| `tribulation` committed outcome + **receipt replay** + commit witness | :4332-4607 | none |
| `materials`/`pills` realm-domain pins + pull-token suppression | :4642-4758 | none |
| `equipment[]` envelope (slots/grades/affixes/forge budget/soft cap), `equipmentSlots` enhance/pity/realm ceilings | :3634-4118 | array-presence only |
| `autoWorkerCapacity>0` ↔ `chi_hien_quan` instance | :4194-4207 | none |
| body progression integrity + hidden perfection integrity | `saveAcceptance.ts:231,239` | none |
| `mortalBoundaryContractViolation` non-pair legs: pick≠'linh_bao' (pre-lock chars), pick-not-in-skills, precursor-missing-`core_` grant, non-mortal+pathless, post-mortal pick persisted | `saveAcceptance.ts:219` + `MortalPrecursors.ts:44-102` | only mortal key-ban (:211-214) + pick-equality (:164-167) — accepts `mortalBasicSkillId:'linh_bao'` on a qi_refining save ✓ |
| `pendingTalentEntitlement` deep: `realmId === player.realmId` (:860), pool-saturation (:871-885), offered ⊆ legal ∩ pool with dedupe (:887-925), actionable-window (:938-976) | same | catalog-membership only (:257-264) — accepts stale-realm + ungrantable offers ✓ (golden_core on qi_refining, mortal on qi_refining) |
| `element→kit` coherence for non-fire elements under committed spell | `saveAcceptance.ts:270-286` (SPELL_KIT_IDS tuple [basic,special]) | only fire/`hoa_cau_thuat` mirrored — `spellPath.element:'water'`+`thuy_tien_thuat` learned but `cultivationWay='spell_pathway'`… still caught by `element='fire'` leg; BUT a non-committed pair (way≠'spell_pathway') escapes all element legs (see cross-module pin) | 

**Confirmed hollow spots (both sides accept — not split-brain, listed for completeness):**
- `selectedTalentIds` unknown catalog id (`'fake_talent_9'`) — W3-AUT-5 still open, now pinned in repro.
- `breakthroughGrade` fractional within `max(1,tiers)` bound — both accept (client bound is not an integer check).
- `player.name` ≠ character name — server *stricter* (identity leg), so no defect.

Blast radius: crafted/buggy self-poison only — but each row classifies `'ready'`,
stays in the authoritative store, and wedges the account per W4-AUT-1.
Severity: **High** as a group — the file's own invariant says these must all be
rejected; the residual surface is ~30 classes, not edge cases.

Evidence: SOURCE_PROOF (SQL legs cited inline) + 18 executable client-gate pins.

### W4-AUT-3 — `create_character` charset `^[[:alnum:] _-]+$` diverges from client `[\p{L}\p{N} _-]` in BOTH directions (Medium)

Client: `CharacterCreationService.ts:45-46` `/^[\p{L}\p{N} _-]{2,20}$/u` on the
trimmed name. Server: `:307` `trim(p_name) !~ '^[[:alnum:] _-]+$'`. POSIX
`[[:alnum:]]` is **locale-dependent** (`LC_CTYPE` of the cluster, fixed at
initdb, invisible to migrations):

- **Server rejects what client accepts** (overshoot): every `\p{N}` member
  outside ASCII `0-9` — `Nd` beyond 0-9 (fullwidth `１２`, Arabic-Indic `١٢`),
  `Nl` (Roman numerals `Ⅻ`), `No` (superscripts `²`, circled `①`) — is outside
  POSIX alnum in *every* glibc locale. Client accepts all of them (pinned).
  Worse: under `LC_CTYPE=C`/POSIX (possible on some clusters) **all non-ASCII
  letters fail** — a name like `Nguyễn Văn` (the primary audience) is
  server-rejected while client-legal. The mirror's truth then depends on the
  cluster's initdb collation — a non-deterministic contract.
- **User-facing path**: `is_character_name_available` (`202608240001:116-124`)
  checks only `normalized_name` uniqueness — no charset. A client-legal name
  with a `²` passes availability, then `create_character` fails with
  `CHARACTER_NAME_UNAVAILABLE` which the service maps to `'name_taken'`
  → "Đạo danh này đã có chủ" (`SupabaseCharacterCreationService.ts:37`).
  Misleading message, but recoverable (user retries a different name).
- **Server accepts what client rejects** (undershoot): glibc UTF-8 locales
  classify some `Mn`/`Mc` marks as alpha via Other_Alphabetic (e.g. U+0901
  chandrabindu) while JS `\p{L}` excludes them → a crafted request can persist a
  name no client produces. Crafted-only, cosmetic identity field → Low within
  this finding.
- **Direction for a real mirror**: Unicode-correctness in PG needs
  `regexp` against code points, not locale classes — e.g. explicit
  `\p` support is not in POSIX regex; the pragmatic fix is a stored allowlist
  range or moving charset validation off POSIX character classes.

Evidence: SOURCE_PROOF for SQL half; client half pinned in
`w4aut.repro.test.ts` charset block (accepts `Đồng²`, `Ⅻabc`, `１２ab`, `١٢ab`,
`Nguyễn Văn`; rejects combining-mark `Te\u0301st`).

### W4-AUT-4 — SQL robustness: `jsonb_each(coalesce(nodeLevels,'{}'))` raises on non-object nodeLevels (Nit)

:236-242 — if `player.nodeLevels` is a scalar/array (`5`, `[]`),
`jsonb_each` throws a PG exception → RPC error 400, not a `SAVE_INVALID` code.
Same verdict, wrong channel — breaks the "rejections carry structured codes"
contract `_check_save_payload` establishes everywhere else. (Client also
rejects, so no wedge; robustness nit only.)

### W4-AUT-5 — a `rejected` live-replacement CAN mutate live state before routing (Medium)

The dispatch question: "can a 'rejected' live-replacement still mutate state
before routing?" — **yes, in the post-preflight window.**

`restoreGameSession` order (`SaveSystem.ts:273-315`):
1. `preflightSaveRegistryReferences` (:280) — pure read, throws before mutation.
2. `player.restoreFromSave` (:284) — commits `this.$state` via
   `Object.assign(this, restoredPlayer)` at `player.ts:475`; later folds can
   still throw (the codebase documents the exact hazard: the
   `getCurrentRealm` precheck at :462-467 exists because a bad realmId
   "survives Object.assign then throws inside addCultivation").
3. `saveOps.restoreFromSave` (`GameManagerSaveRestore.ts:145-491`) — mutates
   techniques, skills, bags, slots, buildings, quests, production, decompose,
   settle, body modifiers, tribulationDirector, then the reconcile chain —
   with throwers documented at :161-163, :451-452.
4. catch → `{status:'rejected'}` → `App.vue:649-678` routes to saveIssue.

So any owner that throws after step 2 leaves the crafted payload live in the
player store + all earlier domain slices. Containment is real:
`markFailed('recovery')` flips `canMutate` false → tick/autosave no-op → the
mutated state never persists, and the saveIssue surface overlays the UI. But
the session now *renders* a hybrid state it never validated, and the surface's
own export button exports the crafted `raw` — not what the live store shows.

Also flagged: the `rejected`→`saveIssue.report('corrupted', …)` relabel
(App.vue:669-673, `useAppLifecycle.ts:445-459`) conflates a runtime restore
failure with payload corruption — diagnostics read "corrupted" for a class that
is really TRN-02 (in-transaction partial application). A payload that passes
all static gates but throws inside a live owner is a permanent wedge loop too:
reset → reload → same throw → same surface.

Pin: `w4aut.repro.test.ts` "post-preflight owner throw" — fixture-injected stub
throws inside `saveOps.restoreFromSave`; result is `'rejected'` while
`player.name` already reads the crafted value. Reachability label:
fixture-injected mechanism pin; production reachability requires a real
post-preflight owner throw (multiple non-total owners sit after the mutation
boundary — class real, no confirmed live thrower found in bounded audit).

### W4-AUT-6 — literal-mirror drift surface doubled; parity pin added (Nit → pinned)

W3-AUT-4 called the hardcoded literal mirrors un-pinned drift bombs. Wave-3
*doubled* the copied-literal surface: realm CASE (10 ids + indices), release
ceiling `> 2`, `v_creation_catalog` (19), `v_parked_talents` (2),
`v_pool_min_realm` (13 talent→index pairs), 4 non-beta root ids +
`hoa_linh_ngo`, `hoa_cau_thuat`, `linh_bao`, `mortal`,
`pham_nhan_chi_cot`, `great_dao`, `pham_cot`, the `v_required_arrays` 9-key
set, the `pendingTalentEntitlement` realm array, and the charset regex.

All verified 1:1 against the TS catalogs **today** — and now pinned:
`tests/architecture/saveBoundaryMirrorParity.qa.test.ts` scans every
migration for the last `create or replace function` redefinition and
asserts each literal
set equals its catalog (REALMS order/indices, `progressionCeilingRealmId`,
`BETA_CREATION_TALENT_IDS`, `PARKED_TALENTS`, `BREAKTHROUGH_TALENT_POOLS`
realm map, `PHAP_TU_ELEMENT_ROOT_IDS` minus `BETA_PLAYABLE_ELEMENTS`,
`SPELL_KIT_IDS.fire[0]`, `BETA_MORTAL_STARTER_SKILL_ID`,
`GREAT_DAO_REWARD_TALENTS`, `FOUNDATION_LABELS`, `REALMS[0]` default,
writer-emitted array keys). The charset regex is documented-only — not
mechanically pin-able across regex engines (W4-AUT-3).

Residual nit: the parity pin always reads the *last* redefinition body in
migration order, so a later rewrite without the literals fails loudly —
but a rewrite that keeps literals while changing leg semantics stays
invisible to it. Acceptable as a drift alarm, not a semantic proof.

### W4-AUT-7 — pre-lock characters (`mortal_basic_skill_id ≠ 'linh_bao'`): SQL accepts their saves, client rejects (Low, deployment-dependent)

`create_character` pins the starter to `'linh_bao'` (:317-321), and the write
gate accepts `mortalBasicSkillId` only when equal to the recorded pick
(:164-167). A character row created before the beta lock (pick e.g.
`'tram'`) writes a mortal save with `mortalBasicSkillId='tram'` → SQL equality
leg *accepts* (matches its own row) but the client contract
(`MortalPrecursors.ts:47-52`: pick must be `linh_bao`) *rejects* → wedge for
legacy rows. Deployment-dependent: if no pre-lock rows exist in prod, vacuous.
Worth a one-line SQL audit query before adjudicating severity.

### W4-AUT-8 — `characters.realm_id` 'pham_nhan' normalization — verified complete (not a finding)

Checked for anything relying on 'pham_nhan': `characters.realm_id` is written
once at create (now `'mortal'`, :341-344 + backfill UPDATE) and read into
`RemoteCharacterMetadata.realmId` (`BackendStatus.ts:109,163`), which
`initializationMetadataFromRemote` (`initializeCharacter.ts:43-53`) *does not
consume* — starter rebuild uses name + talentIds + `mortalBasicSkillId` only.
All other 'pham_nhan' hits are art sprite keys (`CharacterArt.ts`) and the
talent id `pham_nhan_chi_cot` (a name, not a realm). No drift. The column
remains informational and permanently stale after the first realm advance —
consistent with its declared role.

---

## Per-surface verdicts

**`_check_save_payload` mirrored subset — PASS WITH EVIDENCE for its legs,
FAIL on its own stated invariant.** Every leg written mirrors correctly
(verified line-by-line against the client): size/schema/version, player
object + 9 required arrays (writer-emitted set confirmed by pin), name-identity
`<> p_character.name`, selectedTalentIds string/recorded-pick/dedupe/parked/
great-dao/creation-catalog/pool-realm suite (incl. the `pham_cot`→`pham_nhan_chi_cot`
conversion tolerance, matching `TribulationOutcomeService` two-write
semantics), `mortalBasicSkillId` equality, realm CASE + `>2` ceiling +
realm≥1 receipts + realm≥2 foundation witness, mortal path/way key ban,
committed `spell`/`spell_pathway` + `fire` + `hoa_cau_thuat` membership, the 5
element-root gates, and `pendingTalentEntitlement.realmId` catalog membership.
What remains unmirrored is W4-AUT-2 (~30 classes), against the file's own
"every payload class" rule.

**Overshoot scan — PASS with one real exception.** Legit writer payloads emit
`undefined`→omitted keys, so the `?` key-existence legs are safe; `v_required_arrays`
⊆ writer arrays pinned; identity legs are server-stricter by design (never
fired by real writers). The one real overshoot is the charset (W4-AUT-3).

**`create_character` — FAIL.** Charset divergence both directions (W4-AUT-3);
`'linh_bao'` pick pin is correct and now parity-tested; `realm_id` fix verified
complete (W4-AUT-8).

**`App.vue` onResume rejected→saveIssue routing — PASS WITH EVIDENCE.**
`lineage==='replaced'` + `restoreGameSession` `rejected` → `markFailed('recovery')`
+ `saveIssue.report('corrupted', raw)` + early return before `resumeSimulation`.
The residual gap is the mechanism it rides on — post-preflight throws mutate
before routing (W4-AUT-5) — and the `'corrupted'` label conflates runtime
failure with payload corruption.

**SaveIncompatibleScreen "export/delete" claim — FAIL (W4-AUT-1).**
Export real; delete is a cache reset under remote authority; no remote
delete/reset RPC exists; import can't write back; `CHARACTER_EXISTS` blocks
restart.

---

Verdict: **QA_FINDINGS_OPEN** — the wave-3 mirror is correct on every leg it
wrote but covers roughly a third of the client rejection surface it claims to
mirror; the residual classes are permanent remote wedges (not "recoverable" as
the header states); charset diverges both directions; a `rejected` resume can
leave a crafted payload mounted before the saveIssue route; robustness nit on
non-object `nodeLevels`. Repro pins + literal-parity pins land on this branch.
