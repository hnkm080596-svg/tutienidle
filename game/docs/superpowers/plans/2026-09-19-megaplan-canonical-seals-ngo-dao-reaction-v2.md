# Canonical Seals & Ngộ Đạo Reaction Activation — Megaplan v2 (BREAKING REDESIGN)

Status: DRAFT v2 (revised 2026-09-19, rulings D-1…D-7 final) — supersedes the
v1 draft of this mission. Do NOT implement v1.
Program: Post-M7 Combat Content Activation
Mission: Five-Seal Migration + Vạn Pháp Thân Hòa Aura + Production Reaction Wiring
Execution mode: ONE ATOMIC WORKTREE
M7 code baseline: `1d8ab0531631155b7aaa64bf49b40dd6b15c5a65` (M7 Final Battle
Wiring merge — verified via `git log`)
Execution baseline: current `master` tip (`ee7c6057` at last revision — this
doc is itself committed on master; record the real HEAD at S0.1)

> v2 rewrite notes: v1 assumed the five canonical seals were new statuses living
> beside the five legacy elemental ailments. That assumption is rejected. The
> legacy ailments ARE the old representation of the canonical seals; this
> mission is a destructive migration, not an addition. Reaction enablement is
> the Ẩn tâm pháp aura `van_phap_than_hoa` — a live buff capability grant, not
> static membership. All "author five new defs / populate the elemental
> registry / author ten reactions" wording from v1 is replaced by
> "migrate / productionize / validate what already exists".

---

## 0. Mission Purpose

M7 closed the combat runtime architecture. This mission makes the inert
Reaction engine live production gameplay through a **breaking content
migration**:

```
old elemental ailment id  →  canonical seal id  →  all consumers retargeted
bong      → hoa_an        (Hỏa Ấn)
te_cong   → han_tuc       (Hàn Tức)
trung_doc → doc_can       (Độc Căn)
chay_mau  → liet_thuong   (Liệt Thương)
thach_hoa → tran_an       (Trấn Ấn)
```

And the activation rule (Decision 3, FINAL):

```
NO Pháp Tu Ẩn tâm pháp on the player side
  → seals apply normally, Reaction OFF

Pháp Tu Ẩn tâm pháp active
  → battle entry grants van_phap_than_hoa to Ẩn + ALL allies (companions
    included — "đồng đội" explicitly includes companions)
  → every aura holder's OWN canonical seal applications may react
  → Reaction board stays same-source / same-target (aura does NOT merge
    different casters' boards)
```

Canonical rule (locked):

```
source holds van_phap_than_hoa (live instance)
+ committed canonical seal application
+ reactionEligibility = eligible
+ addedStacks > 0
→ Reaction may evaluate
```

Target flow:

```
Production Skill / proc / entry producer (reactionEligibility=eligible)
→ BuffSystem commit (canonical seal def)
→ elemental_application_committed (element from registry, addedStacks>0)
→ ReactionDispatcher (registered once)
→ ReactionTriggerGate (capability via CombatCapabilityQuery over
  live buff capability grants)
→ ReactionSystem → ReactionResolution → CombatOperationBatch
→ CombatScheduler → Domain Authorities → payoff
```

This is a content migration + production wiring mission. It does not redesign
SkillDefinition, BuffSystem, ReactionSystem, CombatScheduler, DamageAuthority,
GaugeAuthority, ActionValidator, or CombatTrace. It DOES extend the ACTIVE
combat contract with one backward-compatible optional field for
instance-local elemental penetration (§6 S0.5P) — an addendum, not a
redesign.

## 1. Source of Truth

This file is the implementation-detail authority:
`game/docs/superpowers/plans/2026-09-19-megaplan-canonical-seals-ngo-dao-reaction-v2.md`

Update parent pointer only:
`game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` — one line
stating post-M7 seal/reaction activation is owned by this megaplan. No duplicated
detail.

**Spec amendment covers TWO changes** (amendment notes, not silent rewrites —
preserve history):

- `docs/specs/2026-09-17-reaction-system-reimagined-spec.md` §"Ailment
  rename/rework map" (:14) asserts `Hàn Tức ≠ te_cong`, `Liệt Thương ≠ chay_mau`,
  `Trấn Ấn ≠ thach_hoa` — SUPERSEDED by Decision 1: the legacy ailments are the
  old representation of the canonical seals and are destructively migrated.
- Same spec §2 (:45) "Reaction Is Exclusive To Ngộ Đạo" and :13 "visible Pháp
  Tu loses automatic reactions" — SUPERSEDED by the aura model: the hidden path
  owns the ENABLING mechanism (`van_phap_than_hoa`); ANY allied entity holding
  the aura may react from its own seal applications — including ordinary Pháp
  Tu and companions. The board remains same-source/same-target.

Stale historical plans (`2026-09-17-megaplan-reaction-system.md`,
`2026-09-17-megaplan-buff-system.md`) contain the old "never migrate legacy
ailments" ruling — they are superseded history; do not amend them, do not
follow them.

Priority when documents disagree:
1. Locked design decisions in this mission brief (§3, §15)
2. Accepted specs/contracts (amended as above)
3. Current canonical production data (`CANONICAL_REACTIONS`)
4. The v1 megaplan draft (non-authoritative)

## 2. Atomic Mission Rule

ONE atomic worktree. Internal checkpoints S0–S5 are not independently mergeable;
multiple internal commits are allowed. Merge only after:

- the five legacy elemental ailment ids are fully replaced (zero production refs)
- five canonical seal defs exist in `LIVE_BUFFS` with correct `element` metadata
- all ten canonical reactions validate against production defs (no `test_*` ids)
- `van_phap_than_hoa` exists, grants `elemental_reaction_enabled`, and is
  applied at the two approved lifecycle seams only (battle entry; hidden-mage
  resurrection re-grant)
- dispatcher registered exactly once on `elemental_application_committed`
- no-Ẩn battles prove seals work with zero reactions
- Ẩn battles prove reactions fire from ordinary-mage, hidden-path, AND
  companion aura holders
- all final gates green; 0 Blocker / 0 High / 0 Medium

Forbidden intermediate states: dispatcher registered with incomplete content;
aura granted with incomplete payoff coverage; only some of the five seals
migrated; any `old_id`/`new_id` dual state left alive; `elemental_reaction_enabled`
reaching the gate through any path other than the live aura buff grant.

## 3. Locked Design Decisions (FINAL — 2026-09-19)

**D1 — Seals are migrated identities, not new statuses.** No dual-apply, no
adapter keeping the old state as a second authority, no permanent alias. This
mission owns the full blast radius (§4 census). Temporary migration helpers may
exist inside the atomic worktree only and are deleted before merge.

**D2 — Dưỡng Kim is penetration, child-instance scope, not potency.** Current
`duong_kim` data uses `channel: 'potency'` — overridden. Locked: `Liệt Thương
+= ceil(P/2)` + Kim penetration `+4% × P` as a modifier bound to the child
instance (spec §33: Sinh modifier lifetime = child ailment lifetime; §36
modifier block `id=duong_kim, reapply=max, lifetime=Liệt Thương lifetime` — the
same child-bound shape as Dưỡng Viêm's periodic potency). Interpretation: the
Liệt Thương child's own periodic metal damage gains the penetration. NOT a
caster-wide stat grant. Implemented via the §6 S0.5P ACTIVE-CONTRACT extension
(`elemental_penetration` channel → `elementalPenetrationBonus` on periodic
request + damage op) — no relabeling of `potency`, no `if (reactionId ===
'duong_kim')` branch, no `source.stats` mutation.

**D3 — Reaction enablement = the Vạn Pháp Thân Hòa aura (FINAL).** The Ẩn tâm
pháp applies `van_phap_than_hoa` at battle entry to the hidden mage and ALL
allied participants — companions explicitly included. Every holder gains
`elemental_reaction_enabled` through the buff's capability grant, evaluated on
the actual seal-application source entity. The aura enables Reaction per
holder; it does NOT merge boards (same-source/same-target stands).

**D4 — Eligibility is opt-in via `reactionEligibility`, origin-agnostic
(FINAL).** Any committed canonical seal application marked `eligible` may
evaluate — skill/proc/passive/entry/survive origins are all legal. The gate
never inspects `origin.kind`. Existing `eligible` lanes stay eligible
deliberately (§8.3 audit documents intent, not suppression). Suppressed lanes
stay suppressed where semantically required (reaction-generated applies,
detonate reseeds, continuation conversions — no recursion).

**D5 — Canonical seals use `application.resistance = 'ailment'` (FINAL), and
so do reaction-generated payoff statuses.** Application pipeline = apply
attempt → resistance roll: seal applications carry the producer's apply
probability (e.g. skill `ailmentChance`), then ailment resistance can reject.
Reaction payoffs apply unconditionally but are equally resistible — a resisted
payoff simply does not land (board already consumed; no rollback).

**D6 — Canonical stacking (FINAL):** all five seals `maxStacks:5`,
`onReapplyStacks:'add'`, `onReapplyDuration:'refresh'`,
`instanceScope:'per_source'`. The `te_cong`/`thach_hoa` 1-stack/`keep` legacy
semantics are intentionally abandoned.

**D7 — Aura lifecycle (FINAL):**
- `van_phap_than_hoa`: `kind:'buff'`, permanent for the battle,
  `maxStacks:1`, non-dispellable, `onReapplyStacks:'keep'`,
  `onReapplyDuration:'keep'` (or the exact equivalent the current
  BuffDefinition model supports).
- `removeOnSourceDeath` MUST NOT be true — hidden-mage death does not remove
  ally instances (default false gives this for free, `BuffDefinition.ts:48`;
  proven at `BuffAcceptance.test.ts:321`).
- Holder death clears its own instance — a resurrected ally has no aura until
  an actual re-grant.
- **Hidden-mage resurrection → idempotent party re-grant** to the entire
  CURRENT allied party (hidden mage + surviving companions + resurrected
  companions): holders keep their single instance; entities that lost it
  regain it. **Event-idempotent, not just state-idempotent** — `BuffSystem.
  apply` emits `buff_applied` even on a no-change reapply (:323 — only
  `elemental_application_committed`/`stacks`/`duration` events are
  suppressed), so the grant seam must SKIP holders already carrying the aura
  (check the live instance before applying) rather than blindly reapply:
  holders get zero events, missing holders get exactly one `buff_applied`.
  This is a lifecycle-layer seam — ReactionSystem never sees resurrection
  logic (§9.3).

**Consume scope (FINAL — "ALL means ALL SOURCES"):** `consumeBuff{scope:'any'}`
and `detonate` consume every caster's instances of the def — A3 + B2 both go.
Same-source Reaction boards do NOT reinterpret generic `any`. Hỏa skills that
spec "consume MY hoa_an" remain source-scoped (`scope:'own'`) — both semantics
coexist; the §6 S0.4 primitive analysis stands.

## 4. Migration Census (verified against `1d8ab053`)

### 4.1 Definitions (all in `src/data/buff/LegacyBuffs.ts`, in `LIVE_BUFFS`)

| old id | def line | kind | element | maxStacks | duration | mechanics carried |
|---|---|---|---|---|---|---|
| `bong` | :119 | ailment | fire | 5 | 4 | periodic `bong.dot` legacy_dot 0.15/tick |
| `trung_doc` | :149 | ailment | wood | 5 | 5 | periodic `trung_doc.dot` legacy_dot 0.2 |
| `chay_mau` | :179 | ailment | metal | 5 | 5 | periodic `chay_mau.dot` legacy_dot 0.2 |
| `te_cong` | :207 | ailment | water | **1** (`keep`) | 4 | periodic `te_cong.dot` legacy_dot 0.25 |
| `thach_hoa` | :267 | ailment | earth | **1** (`keep`) | 4 | statModifier −30% `evasionRate` + `on_hit_proc` 50%→`choang` |

All five migrate to duration **3** (D-2) and `maxStacks:5 add/refresh` (D-6);
`thach_hoa`'s non-spec mechanics are dropped (§7.1).

### 4.2 Producers

- **Element basics (authored Skills → converter):** `CoreSkills.ts` :331 `bong`,
  :400 `trung_doc`, :466 `te_cong`, :540 `chay_mau`, :607 `thach_hoa`.
- **Fixture mirror (test-only, must track):** `TurnBasicAttacks.ts` :36-40.
- **Chain skills:** `PhapTuChainSkills.ts` — applies `bong` (:42,:67,:86,:105,
  :169,:197,:900), `te_cong` (:225,:353,:929), `trung_doc` (:381,:407,:440,:957),
  `chay_mau` (:590,:609,:626), `thach_hoa` (:744). Plus non-canonical
  `troi_chan`/`choang` applies (unchanged — not reaction states).
- **Empowered ults:** `PhapTuEmpoweredUlts.ts` — `bong` :45-46, `te_cong` :60-61,
  `trung_doc` :79.
- **Companions:** `Companions.ts` — `bong` :101,:113; `thach_hoa` :141,:468;
  `trung_doc` :223,:235; `te_cong` :317,:343; `chay_mau` :411,:423.

### 4.3 Consumers / mechanics

- **consume-for-damage** (`consumesAilmentId` + `damagePerStack` →
  `deal_damage.consumeBuff{scope:'any'}`): `PhapTuChainSkills` :131,:150,:166
  (`bong`), :541 (`trung_doc`), :714,:983 (`chay_mau`);
  `PhapTuEmpoweredUlts` :94 (`chay_mau`); `Companions` :249 (`trung_doc`).
  `scope:'any'` consumes EVERY caster's instance on the target — locked
  (D-4/all-sources).
- **`detonateDoT` → `detonate` op:** consumes every live instance whose def
  carries periodic effects (ALL sources), then re-seeds 1 stack suppressed.
  Post-migration it detonates the canonical seal board — intended.
- **`spreadsAilmentId`:** `PhapTuChainSkills` :473,:494,:511 (`trung_doc`) —
  DEAD authored fields: `UNSUPPORTED_EFFECT_FIELDS` in `LegacySkillAdapter` :601 —
  reported, never executed, and no spread mechanic exists in the new spec.
  **Terminal disposition: DELETE the three authored fields in S1** — a
  "rename the dead field and keep it" outcome is forbidden (it would be a
  retained non-running mechanic, exactly the stale semantics this mission
  removes). S0 verifies zero runtime consumers/parity tests expect spread
  behavior; if a hidden consumer is found, escalate to a canonical spread
  primitive design before touching S1.
- **`add_stack` chains:** `PhapTuChainSkills` :87 (`bong`+1), :441,:958
  (`trung_doc`+2), :655,:672,:687 (`chay_mau` +1/+2/+3). Mapped into
  `appliesAilments` folding — they become eligible seal applications.
- **Engine lanes carry ids as data:** `appliesAilment(s)`/`consumesAilmentId`/
  `detonateDoT` on `TurnSkillAction`; `LegacySkillAdapter` conversions;
  `SkillResolver.compileConsumeBuff`; TBS legacy lanes. No id-keyed engine
  branches expected — S0 must PROVE no hardcoded old-id read exists outside data.

### 4.4 Orphaned old-reaction products — DELETE (spec-base ruling)

Zero production producers confirmed (defs + `StatusVfxPresets` entries + test
refs only):

| id | def | disposition |
|---|---|---|
| `doc_the` | `LegacyBuffs` :57 — **display name is literally "Độc Căn"** (the real name collision) | DELETE — frees the name for the wood seal; empties `dot_recovery` production content (engine mechanism intentionally retained — record, do not invent replacement content) |
| `ngung_lo` | :82 | DELETE |
| `khai_son` | :98 | DELETE |
| `dung_nham` | :304 | DELETE |
| `huyet_doc` | :334 | DELETE |
| `hoai_tu` | :235 | DELETE (no producer found — S0 re-verifies) |
| `troi_chan` | :289 | KEEP — live non-canonical CC (skills apply it; never in elemental registry) |
| `choang` | :362 | KEEP — live stun, unrelated |

Census-before-delete: S0 re-runs the producer/consumer check per id; a
discovered live producer re-classifies that def instead of deleting.

Also recorded: `poisonRootPercentPerStack`/`poisonRootMaxStacks`/
`poisonRootThresholdBonusPercent` are progression NODE stats (SaveSystem.ts:123
comment, locales `vi.json`/`en.json` :880s) — a third "Độc Căn" use, unrelated
to the buff layer; no stat-field rename (save-compat), display text only if
needed.

### 4.5 VFX / presentation / text

- `StatusVfxPresets.ts` :22-25,:37 — rekey to seal ids; prune dead-product
  presets; add explicit seal entries (don't rely on the regex fallback :52-55).
- `TurnStatusPresentationEvents` / combat status rows / floating text consume
  buff ids — update consumers and tests.
- `BuffDefinition.name` is the display text — rename to seal names;
  `BuffNames.test.ts`, `SkillMechanicDescriptions.test.ts` (:52,:75,:82,:107)
  assert on ids/text — update.
- `docs/systems/elements-reactions.md` is STALE (still describes
  `TurnReactionManager`/`ELEMENT_REACTIONS` as live) — rewrite in the docs
  sweep; `docs/systems/buffs.md`, `combat-overview.md` — update.

### 4.6 Tests touching the five ids (~20 files)

`buffs.test.ts`, `BuffRegistry.test.ts`(:69), `TurnBasicAttacks`,
`PhapTuChainSkills` assertions, `Companions`, `SkillMechanicDescriptions.test`,
`SkillInventoryParity.qa.test`(:105-126), `LegacySkillAdapter(.converter).test`,
`GameManager.skillPipelineJourney`(:157 — the `doc_chuong`/`trung_doc` DoT-death
journey), `GameManager.phapTuAnPath`(:253), `GameManager.authoredParity`
(:120,:148), `GameManager.talentv4(.qa).test`, `GameManager.battleCycle`(:73),
`CombatSystem.surviveLethal`(:302-400), `CombatSystem.ailmentDamage`(:56-105),
`TurnStatusPresentationEvents.test`, `TurnBuffIdentity.test`, `selfBuff.qa`,
`hoIntercept`, `detonate.test`(:86-265), `BuffSystem.r4-cleanse.reaudit`,
`BuffNames.test`, `TurnOrderStrip.test`(:81), `StatusVfxPresets.test`,
`combat-vfx-spawner.statusRow.test`, `CombatScene.dotPresentation`/
`floatingStatusText` tests, `combat-damage-text.test`, `PhapTuRoutes.test`.

### 4.7 Save impact

None. Battle buffs are not persisted; `BuffPersistence` is the out-of-battle
player-buff lane only and rejects periodic defs. No save migration needed for
the id change.

## 5. Prerequisites — verified on `1d8ab053`

| claim | evidence |
|---|---|
| Production `ElementalStateRegistry` already bound | `GameManagerTurnBattleOps.mintCycleScheduler` :1046-1052 maps all five canonical ids; passed to `BuffSystem` :1078. Second site: `GameManager.ts` :241-247 (persistent lane — harmless; no-op sink, periodic defs rejected there) |
| `elemental_application_committed` emitted by production `BuffSystem` | `BuffSystem.ts` :306-322 — when `getElement(defId)!==null && addedStacks>0`, carries `reactionEligibility` |
| `ReactionDispatcher` exists, production-unregistered | `ReactionDispatcher.ts` (registration deferred per its own header); `mintCycleScheduler` registers only `periodic_operation_settled` + `buff_applied` (:1145-1153) |
| `ReactionTriggerGate`/`ReactionSystem`/`ReactionRegistry` implemented | `core/reaction/`; `validateReactionDefinitions` already enforces unique ids, unique `selectionTiePriority`, canonical pair coverage via `WuxingRelations`, role legality, apply_status buff existence, heal-after-damage ordering |
| `CANONICAL_REACTIONS` exists, `test_*`-bound | `src/data/reaction/ReactionDefinitions.ts` — all 10 relations, locked priorities 10–100; `REACTION_STATUS_BUFF_IDS` = `test_bleed`/`test_defense_break`/`test_defense_erosion`/`test_cam_cong` |
| `elemental_reaction_enabled` granted to nobody | `ELEMENTAL_REACTION_CAPABILITY` (`contracts/capability.ts:11`) consumed only by gate + fixtures; no production grant |
| Capability-descriptor channel exists and is production-wired | `BuffDefinition.capabilities` (:114, open `CapabilityType` string); `BuffRegistry` :340 validates grants — **unknown type throws**; `buffs.getCapabilities(id)` is already the `resolveSourceGrants` port at mint (:1085) |
| `TurnReactionManager`/`ELEMENT_REACTIONS`/`canInitiateWuxingReactions` absent | deleted in buff M4/M-INT |
| Cấm Công channel live | `forbiddenActionTags` on `BuffDefinition` :115; `ActionValidator.forbiddenActionTags` union; TBS consumes (:1732-1842); `qa_cam_cong` fixture proves shape |
| `CombatRng` production-injected; multicast/composite/sequential settlement done | `mintCycleScheduler` rng wiring; `queuedExecutions` drain (TBS :2810+); contract test §98; M7.4 determinism suite |
| Party-wide entry grant pattern exists | `applyEntryBuffs` formation lane applies self-targeted buffs per `battle.players` (:1218-1224); `battle.players` includes companions (:1574) |
| Source-death persistence default | `lifetime.removeOnSourceDeath` default false (`BuffDefinition.ts:48`; `BuffAcceptance.test.ts:321`) — instances persist when the source dies |
| Holder-death cleanup exists | holder death clears its instances (board cleanup contract — verified by existing tests) |
| **No production resurrection mechanic** | all dead→alive transitions are test-only (`perfectClear.test.ts:281` direct flag set; survive-lethal prevents death, never revives) → the re-grant seam is built DORMANT (§9.3) |
| Ẩn tâm pháp exists | `ngo_dao_chan_quyet` (`Techniques.ts:78`) auto-learns `ngo_dao_hon_don`; kit gate = `isPhapTuNgoDao(player) && skillManager.has('ngo_dao_hon_don')` (`CultivationPathRegistry.ts:237-241`) |
| Fixture seals exist with the five ids | `FixtureReaction.fixtureElementalDef` — after real defs land, reconcile fixture/production defs to avoid same-id registry collisions |

## 6. S0 — Destructive-Migration Inventory + Primitive Checks

Mode: read-only + docs. Produce
`game/docs/architecture/2026-09-19-seal-migration-inventory.md`.

- **S0.1** Record actual `git rev-parse HEAD` (execution baseline — master has
  moved past `1d8ab053` via this plan's own doc commits) and verify it
  descends from the M7 closure commit `1d8ab053`; record
  `git status --short`.
- **S0.2** Execute the §4 census in full; classify every reference: migrate /
  delete / keep-noncanonical. Explicit disposition table per mechanic — nothing
  survives "accidentally". Re-verify each §4.4 orphan has zero producers.
- **S0.3** Prove no engine code path reads the five old ids directly outside
  data modules (the mechanics carry ids as data; assert by grep + guard).
- **S0.4 — PRIMITIVE CHECK A: SAME-SOURCE AUTHORED BUFF ACCESS (broad audit,
  not just consume).** Hỏa spec §62 requires Hỏa skills to act on the caster's
  OWN `hoa_an` instance only — read stacks, next-tick modifier, manual tick,
  potency modifier, duration extension, consume. Every authored buff-targeting
  surface currently collapses to `target_definition` (any source) via
  `SkillResolver.targetDefinitionSelector` (:1639):
  - `add_buff_stacks`/`remove_buff_stacks`/`consume_buff_stacks` (:1669)
  - `add_buff_modifier`/`remove_buff_modifier` (:1694)
  - `refresh_buff_duration`/`extend_buff_duration` (:1723)
  - `trigger_buff_periodic` (:1749) — Phần Thiên's manual tick
  - standalone `read_stacks` op (:248 authored shape — verify; the
    `buff_stacks` QUERY already supports `source` at :556-558)
  - `deal_damage.consumeBuff{scope:'own'}` — read is source-scoped
    (:1317-1327) but the emitted `for_each_instance` consume filter is
    `{targetId, definitionId}` only (`ResolvedSkillPlan.ts` :229-236, no
    `sourceId`) — own-priced damage strips every source's board.
  Blast radius: a target can simultaneously hold the player's `hoa_an` AND a
  companion's `hoa_an` — Xích Viêm/Phần Thiên would read or mutate the other
  caster's board, violating the same-source ownership this mission's Reaction
  board relies on.
  **Primitive:** expose `AuthoredBuffSelector` (identity kind —
  `definitionId + source intent + target intent`, :79-95, already used by
  `remove_buff`) on ALL buff-targeting authored ops — no per-op `own`
  booleans; plus `sourceId?` on the `for_each_instance` filter for the
  consume-compiled lane. Runtime `BuffInstanceSelector.kind:'identity'`
  (`contracts/selectors.ts` :9-14) already supports the triple — this is an
  authored/resolver-layer gap, not a new authority.
  **Cardinality pin (regression risk):** `resolveSelector` (:507-525)
  resolves target via `resolveIntentSingle` = `resolveIntentSet(...)[0]` —
  first target only — while today's ops iterate `resolveIntentSet`
  (:1655/:1693/:1722/:1748) supporting `affected_targets`/`all_enemies`/
  `all_allies`. Do NOT reuse `resolveSelector` on multi-target ops. Add
  `resolveSelectorSet` emitting one identity selector per resolved target;
  the SOURCE intent must resolve exactly one entity. Regression tests:
  `all_enemies` and `all_allies` target intents produce one op per target.
- **S0.5P — INSTANCE-LOCAL PENETRATION: ACTIVE-CONTRACT EXTENSION (not a small
  primitive).** `metalPenetration` is a real `StatBlock` stat (:134) and
  `CombatSystemDamageAdapter.resolveLegacyDotAmount` :335 reads
  `source.stats[${element}Penetration]` for elemental damage — but THREE closed
  contract surfaces block instance-local penetration today:
  - `contracts/operations.ts:47-52` — `BuffModifierChannel` is a closed union
    (`'potency'|'periodic_damage'|'next_periodic_damage'|'duration'|
    'application_chance'`); no penetration member.
  - `contracts/periodic.ts:15` — `BuffPeriodicDamageRequest` has no
    penetration field.
  - `contracts/operations.ts:112` — `DealDamageOperation.payload` has no
    penetration field (element/damageProfile/coefficient/hit policies/
    components/scaling/stackCount/snapshot/statSourceId only).
  - `2026-09-17-combat-systems-contract-spec.md` is **FINAL — ACTIVE CONTRACT
    v1.6** — this is a contract extension, not an internal helper.

  Required extension (amend the ACTIVE contract via its addendum mechanism —
  backward-compatible optional fields, no authority redesign):
  1. `BuffModifierChannel` += `'elemental_penetration'`
     (`contracts/operations.ts:47`). Pin the payoff-step surface correctly:
     `duong_kim` rides `add_child_modifier` — extend THAT step's channel
     union `'potency' | 'periodic_damage'` += `'elemental_penetration'` and
     add `operation?: 'add'|'multiply'|'set'` (default `'multiply'`). The
     `apply_status.modifier` union does NOT need the channel — do not widen
     a surface no content uses.
  2. `BuffPeriodicDamageRequest` += `elementalPenetrationBonus?: number`
     (`contracts/periodic.ts:15`) — the resolver folds the channel value HERE,
     not into `coefficient` (it is a mitigation input, not a damage
     multiplier).
  3. The scheduler's periodic request→op 1:1 bridge forwards it onto
     `DealDamageOperation.payload.elementalPenetrationBonus?: number`
     (`contracts/operations.ts:112`).
  4. `CombatSystemDamageAdapter`: `effectivePenetration =
     (source?.stats[${element}Penetration] ?? 0) + (op.elementalPenetrationBonus ?? 0)`
     in the elemental-damage branch — additive at RESOLUTION time only.
     **Never** mutate `source.stats`, never bake it into snapshots.
  5. **Legality guard (mirrors the hitPolicy declared-intent pattern,
     `operations.ts:151-163`):** `elementalPenetrationBonus` is legal ONLY
     when `origin.kind === 'buff_periodic'` AND `damageProfile ===
     'legacy_dot'` AND `element` is an `ElementType` (not `'physical'`).
     Pinned exactly — `legacy_dot` is the only periodic profile that reaches
     `resolveLegacyDotAmount` (:118-128; `detonate_burst` shares the formula
     but is never `buff_periodic` origin). No `profile.supportsPenetration`
     abstraction without a consumer — a future penetration-capable periodic
     profile opens the contract when it arrives. Structural validation
     rejects `element:'physical' + bonus`, non-`legacy_dot` profiles, or any
     non-periodic lane (skill/reaction packets) carrying the field — illegal
     carriers fault loudly, not silently ignored.
  6. **`uses`-lifetime marking:** add `'elemental_penetration'` to
     `BuffPeriodicResolver.DAMAGE_CHANNELS` (:76). Without it, a `uses:1`
     penetration modifier folds but is never pending-marked → never consumed
     → lives forever (contract-correct for ALL lifetimes, not just the
     `buff_lifetime` Dưỡng Kim currently uses). Test: `uses:1` penetration
     modifier consumed by exactly one resolved tick.
  7. Contract-spec addendum records the new field + channel + adapter rule +
     legality bounds.

  **Semantics — additive penetration points, NOT a multiplier.** Penetration
  scale: 1 point = 1% net resistance (`Resistance.ts:15-20`,
  `net = resistance - penetration`). `modifierPayload`
  (`ReactionOperations.ts:95-109`) currently hard-codes `operation:'multiply'`
  — wrong for this channel: with base penetration 0, `multiply` yields 0.
  Therefore `add_child_modifier` gains a generic `operation` field
  (`'add'|'multiply'|'set'`, matching `BuffModifierPayload.operation`;
  default `'multiply'` preserves the three existing potency modifiers), and
  `duong_kim` authors:

  ```ts
  { kind: 'add_child_modifier',
    modifierId: 'duong_kim',
    channel: 'elemental_penetration',
    operation: 'add',
    value: 4 * P }        // +4 points per consumed stack — NOT 1+0.04×P
  ```

  `resolveChannel(instance.modifiers, 'elemental_penetration', 0)` →
  `elementalPenetrationBonus`.

  **Numeric acceptance (mandatory):** P=5 ⇒ bonus `+20` penetration points ⇒
  a target with 40 Metal Resistance resolves as net 20 for that instance's
  ticks. Plus the isolation test: two Liệt Thương instances carrying different
  `duong_kim` modifiers tick different damage — the bonus stays bound to ITS
  instance's requests; no leak to the sibling instance, to skill damage, or to
  other elemental ops. No `if (reactionId === …)` branches anywhere.
- **S0.6** Inventory `reactionEligibility:'eligible'` producers (§8.3) —
  purpose: document intentional eligibility (D-7), NOT suppress non-skill lanes.
- **S0.7** Inventory presentation/log surfaces for `reaction_resolved`,
  `reaction_skipped`, seal names, Cấm Công icon, `van_phap_than_hoa` icon/name.
- **S0.8** Verify the aura grant predicate at composition:
  `this.deps.getActivePlayer()` is already available inside `applyEntryBuffs`
  (:1209); pin whether it exposes the fields `isPhapTuNgoDao` needs (path+way)
  and how `skillManager.has('ngo_dao_hon_don')` is reached from this layer.
  Predicate = "Ẩn tâm pháp active" = `isPhapTuNgoDao(player) &&
  has('ngo_dao_hon_don')` (the same gate the kit uses).
- **S0.9** Verify the apply→resist pipeline for op-driven applies: reaction
  `apply_status` → `apply_buff` op → `BuffSystem` resistance roll (defs carry
  `application.resistance`); confirm a resisted payoff produces no buff and no
  downstream events, with no rollback of consumed board.
- **S0.10** Locate the resurrection seam owner: no production dead→alive
  transition exists (§5). Design the dormant lifecycle hook (§9.3) and record
  where a future revive mechanic must call it.
- **S0.11** Docs amendment sweep — THREE spec items (amendment notes, not
  silent rewrites): (a) reaction spec §"Ailment rename/rework map" :14 — D1
  supersedes the `≠` claims; (b) reaction spec §2 :45 + :13 — aura model
  supersedes "Reaction exclusive to Ngộ Đạo"; (c) **unpark**
  `2026-09-17-hoa-an-ailment-system-spec.md` — its header is `PARKED` (:3) and
  :9 asks the open question "Hỏa Ấn thay thế `bong` hay tồn tại song song" —
  D1 resolves it: `bong → hoa_an` destructive migration. Flip status to
  active + record the D1 amendment; S5 cannot implement from a PARKED spec.
- **S0.12** Spread-field disposition (terminal, before S1): verify zero
  runtime consumers/parity tests depend on `spreadsAilmentId`/`spreadStackPercent`/
  `spreadRefreshesPrimary` — then DELETE the three dead authored fields
  (§4.3). A found consumer escalates to a canonical spread-primitive design.
- **S0.13 — PRIMITIVE: apply-result-dependent payoff modifier.** Defect
  found: `apply_status` emits `apply_buff` then `add_buff_modifier`
  (identity selector, `ReactionOperations.ts:226-248`) with NO dependency —
  a resisted apply returns `{applied:false}` (`BuffSystem.ts:178`, op still
  settles `'resolved'`), the batch continues, and the modifier's identity
  selector finds a STALE same-source `reaction_bleed` instance → the payoff
  modifier lands on the old instance despite the resist. This breaks D-5's
  "resisted payoff → payoff absent" rule.
  **Fix:** extend `DeferredOperation` (`contracts/settlement.ts:48` — the
  existing result-dependent mechanism, currently only
  `heal_from_damage_result` → `deal_damage`) with a new kind, e.g.
  `add_modifier_on_apply_result` — `{resultOperationId → apply_buff op,
  modifier}` — that materializes to `add_buff_modifier` on
  `{kind:'instance', instanceId: result.instanceId}` ONLY when
  `result.applied === true` (`ApplyBuffResult` carries `instanceId` on
  success, :352-363). Binding the returned instanceId also fixes the
  selector staleness generally — the modifier always lands on the exact
  instance the apply committed, never a same-identity ancestor. Never
  post-hoc board queries to guess success.
  **Acceptance:** target holds an existing `reaction_bleed` (potency mod
  +10%) → resisted reapply → stacks/duration/modifier unchanged; only
  `buff_application_failed` emitted; no `add_buff_modifier` materializes.
- **S0.14** Design rulings are in §15 — all resolved; no open items.

## 7. S1 — Seal Replacement + Consumer Migration

### 7.1 Canonical seal definitions

Replace the five legacy defs in `LegacyBuffs.ts` with canonical seal defs —
same def slot, new id/name, spec-based mechanics:

| seal | element | duration | base mechanics |
|---|---|---|---|
| `hoa_an` Hỏa Ấn | fire | **3** | periodic fire DoT — per `hoa-an` spec (heat/pressure) |
| `han_tuc` Hàn Tức | water | **3** | periodic water DoT 0.25 (spec §4: slow/tempo pressure — no additional standalone mechanic is spec-pinned) |
| `doc_can` Độc Căn | wood | **3** | periodic wood DoT 0.2 (poison growth/sustain) |
| `liet_thuong` Liệt Thương | metal | **3** | periodic metal DoT 0.2 (wound/penetration) |
| `tran_an` Trấn Ấn | earth | **3** | **pure stacking setup state — NO standalone mechanics**: spec §5 defines Trấn Ấn as an elemental setup state, never a control status; spec pins no standalone effect → delete BOTH the −30% `evasionRate` statModifier AND the on-hit `choang` proc (do not preserve for parity; §29's "Trấn Ấn processing" reads as lifecycle/stack processing). Consequence note: the earth basic loses all standalone power — feeds reactions only. |

**LOCKED: `duration = 3` holder turns for ALL five** (new spec — overrides
migrated 4/5/5/4/4). All: `kind:'ailment'`, `instanceScope:'per_source'`,
`maxStacks:5, onReapplyStacks:'add', onReapplyDuration:'refresh'`,
`application.resistance:'ailment'`, `dispellable:true`,
`lifetime.scaling:'ailment_scaled'`, `lifetime.clock:'holder_turns'`.
Periodic ids rename to `hoa_an.dot` etc. (keep `legacy_dot` damageProfile so
the dot economy — `dotResistancePercent`, ailmentPotency — keeps working).

### 7.2 Seal-metadata validation (new seam)

`BuffSystem` derives the event element from the REGISTRY, not `def.element` —
so def-vs-registry agreement needs its own check. Add a startup validation
(e.g. `validateCanonicalSealBinding(elements, buffRegistry)`) asserting for each
of the five: mapping exists, def exists, `def.element` matches the mapped
element, `kind==='ailment'`, `instanceScope==='per_source'`,
`maxStacks===5`, `application.resistance==='ailment'`. Malformed canonical
content fails loudly at composition/startup — **documented blast radius: an
invalid seal or reaction def prevents battle mint entirely.** Intentional (no
half-configured reaction graph).

### 7.3 Consumer retarget

Every §4 producer/consumer id-flips to the seal id — basics, chain skills
(apply/consume/spread/add_stack), empowered ults, companions, fixture mirrors,
VFX presets, display names, mechanic descriptions, tests. No dual application:
`bong` ceases to exist; no skill applies old+new.

Orphaned old-reaction products (§4.4) are DELETED after the S0 census
re-verifies zero producers. `troi_chan`/`choang` stay — non-canonical CC, never
in the elemental registry, never reaction states.

### 7.4 S1 acceptance

- The five ids gone from all production data (quoted-id search clean outside
  docs).
- Seal defs load in `LIVE_BUFFS`; startup binding validation passes.
- Migrated tests assert seal behavior (stack growth, refresh, periodic,
  cleanse, death cleanup, per-source isolation) — including `han_tuc`/`tran_an`
  stacking change as deliberate, and `tran_an` having no standalone effect.
- `doc_chuong` journey now produces `doc_can` (update `skillPipelineJourney`/
  `phapTuAnPath`/`authoredParity` journeys).
- Reaction still unregistered — canonical applies emit
  `elemental_application_committed` with nothing consuming it (update
  `ReactionGate.production.test.ts` — it documents the ghost-def state that no
  longer exists).

## 8. S2 — CANONICAL_REACTIONS Productionization

### 8.1 Correct the data, don't rewrite it

`CANONICAL_REACTIONS` already encodes all ten relations (ids, priorities
10–100, formulas). Changes:

- **`duong_kim`:** replace `add_child_modifier{channel:'potency',
  value:1+0.04×P}` with `{channel:'elemental_penetration', operation:'add',
  value:4*P}` via the S0.5P contract extension — additive penetration POINTS
  (1pt = 1% net resistance), child-instance scope (locked): rides only the
  Liệt Thương child's own periodic metal damage requests, dies with the
  child. Requires the new generic `operation` field on the payoff step (the
  existing emitter hard-codes `'multiply'`).
- **`REACTION_STATUS_BUFF_IDS`:** rebind to the four production defs below.
- **Locked values (verbatim):** Tụ Thủy `maxRemaining:5`; Xuyên Thổ
  `fraction = min(0.05×D, 0.25)` × actual resolved reaction damage
  (`heal_from_damage` materializes post-damage via deferred op — verify it
  reads SETTLED damage, not pre-mitigation); Trấn Thủy duration
  `min(2, max(1, D-2))` + `when:{attacker gte 3}` (already encoded :185-190);
  Dung Kim durationOverride `min(3, ceil(D/2))` (already encoded :136);
  Đoạn Mộc bleed `stacks:1+floor(A/2)` + potency modifier `1+0.05×D` (already
  encoded :147-155).

### 8.2 Secondary production status defs (literal shapes — nothing left to the implementer)

All four share: `kind:'debuff'`, `polarity:'debuff'`, `element: undefined`
(non-elemental status — never in the elemental registry → structurally cannot
react, spec §30), `instanceScope:'per_source'`,
`application:{resistance:'ailment'}` (D-5: payoffs are resistible — apply
attempt → resistance roll), `dispellable:true`, `lifetime.scaling:'fixed'`
(debuffs, not ailments — `ailment_scaled` is for the five seals),
`lifetime.clock:'holder_turns'`, no `removeOnSourceDeath` (default false —
payoff debuffs persist through caster death, consistent with the seals).
Values marked *(authored)* are spec-silent tuning knobs, not architecture.

```ts
defense_break:
  name: 'Phá Giáp'
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' }
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' }
    // base only — Dung Kim always supplies durationOverride
    // min(3, ceil(D/2)) (already encoded :136)
  statModifiers: [{ stat: 'defense', percent: -0.04 }]
    // percent multiplies stacks at StatCalculator → each stack = −4% defense;
    // reaction applies A stacks. Do NOT double-encode 4%×A in both places.

defense_erosion:
  name: 'Xói Giáp'
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' }
  lifetime: { clock: 'holder_turns', duration: 4, scaling: 'fixed' }
    // *(authored)* longer-lived than break's 1-3 override: "erosion" is the
    // persistent variant; reaction applies A stacks, no override
  statModifiers: [{ stat: 'defense', percent: -0.04 }]  // −4% defense per stack

cam_cong:
  name: 'Cấm Công'
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' }
  lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' }
    // base only — Trấn Thủy always supplies durationOverride clamp(D-2,1,2)
  forbiddenActionTags: ['attack']   // NOT stun — heal/buff/cleanse/defend/
                                    // utility stay legal; holder still takes turns

reaction_bleed:
  name: 'Xuất Huyết'   // NOT 'Chảy Máu' — that name retired with the
                       // chay_mau → liet_thuong migration (the metal seal is
                       // 'Liệt Thương'); do not reuse it for the bleed status
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' }
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' }  // *(authored)*
  periodic: [{
    id: 'reaction_bleed.dot',
    type: 'damage',
    element: 'physical',        // REQUIRED by PeriodicDamageDefinition (:62) —
                                // "non-elemental status" means the DEF has no
                                // element tag; the damage packet still needs a
                                // channel. 'physical' is the only coherent
                                // choice (non-elemental wound → armor
                                // mitigation, might power — not a wuxing
                                // element that would imply elemental damage).
    damageProfile: 'legacy_dot',
    coefficient: 0.2,           // *(authored)* spec pins no number; mid-tier
                                // legacy DoT value
    scaling: 'dynamic',
    timing: 'holder_turn_end',
    stackScaling: 'multiply',
    canCrit: false, canMiss: false, hitCount: 1,
  }]
  // reaction applies 1+floor(A/2) stacks + child modifier
  // {id:'doan_moc', channel:'potency', value:1+0.05×D} (already encoded
  // :147-155). MUST NOT enter the ElementalStateRegistry.
```

### 8.3 `reactionEligibility` producer audit (D-4/D-7 — document intent)

Current `eligible` emitters — all deliberately eligible (FINAL):

| producer | site | today applies | verdict |
|---|---|---|---|
| `LegacySkillAdapter` ailment applies | :351 | all `appliesAilment(s)` | deliberately eligible — the skill-application lane |
| TBS entry-buff lane | `applyBuffOp` :913-925 (`'eligible'`) | formation buffs + kit `grantsBuffsAtBuild` + `van_phap_than_hoa` | deliberately eligible — non-seal defs; registry gate rejects them anyway |
| `GameManagerTurnBattleOps` `passive_burst` | :842 | arbitrary registered buffId | deliberately eligible — assert no seal-producing content binds here unintentionally |
| `survive_effects` grant | :1623,:1659 | `tu_sinh_ngo` | deliberately eligible — non-seal |
| `CombatProcSystem` | :343 | proc applies | `'suppressed'` today — keep suppressed (semantic: proc ticks are continuations, not applications); if a proc ever intentionally applies a seal it may opt into `eligible` — gate stays origin-agnostic |
| `SkillExecutor` re-seed | :546 | detonate re-seed | `'suppressed'` — re-seed ≠ application |
| `BuffSystem` continuation/conversion | :215,:1132 | — | `'suppressed'` — no recursion |
| `GameManagerPersistentEffectOps` | :411 | out-of-battle | `'suppressed'` |
| Reaction-emitted applies | `ReactionOperations` :222 | conversions/statuses | `'suppressed'` — no recursion |
| TBS `applyBuffOp` other sites | :1670 bossTrigger, :2519 appliesBuff, :3183 intercept-ward | — | `'suppressed'` — keep |

Canonical eligibility rule (locked): canonical seal + `eligible` +
`addedStacks>0` + source holds aura → evaluate. Origin never inspected.

### 8.4 Validation = reuse + production re-run

Do NOT re-implement `validateReactionDefinitions` — run it against production:
`new ReactionRegistry(CANONICAL_REACTIONS, elements, (id) =>
battleBuffRegistry.has(id))` at composition. Supplement with §7.2's
seal-binding validation. Damage-profile check: `'reaction'` exists in
`createDamageProfileCatalog` (`DamageProfiles.ts` :17) — assert referenced
profile keys resolve; no new registry layer. Modifier ids (`duong_viem`,
`doan_moc`, `nhuan_moc`, `duong_kim`) are instance modifier LABELS — validate
shape/channel/lifetime in tests, not a registry.

### 8.5 S2 acceptance

- Production `ReactionRegistry` constructs against the sealed battle registry;
  all 10 relations present; no `test_*` ids referenced by production data.
- Deterministic selection/tie-priority/consume-order/op-order re-verified on
  production data; no ReactionSystem RNG; no foreign mutation.
- Penetration primitive implemented generically and consumed by the damage
  path; `duong_kim` reads it — no relabeling of `potency`.
- All four secondary defs registered with the §8.2 semantics; payoff
  resistance verified (resisted payoff does not land, board stays consumed).
- Dispatcher still NOT registered.

## 9. S3 — Vạn Pháp Thân Hòa Aura + Reaction Switch + Dispatcher

### 9.1 The switch is a live buff grant (D-1/D-3 — FINAL)

`elemental_reaction_enabled` reaches `CombatCapabilityQuery` ONLY through a
live `van_phap_than_hoa` capability grant on the seal-application source.
Lifecycle semantics fall out of the buff model — no latch question:

- Ẩn dies → ally instances persist (`removeOnSourceDeath` default false) →
  allies keep reacting.
- Any holder dies → holder-death clears its instance → resurrected entity has
  NO aura until an actual re-grant (§9.3).
- No snapshot, no membership set — the gate asks the live buff board per event.

**`van_phap_than_hoa` def (literal — every required field pinned):**

```ts
{
  id: 'van_phap_than_hoa',
  name: 'Vạn Pháp Thân Hòa',
  kind: 'buff',
  polarity: 'buff',
  element: undefined,            // non-elemental
  instanceScope: 'per_source',   // REQUIRED — the resurrection-re-grant
                                 // idempotency proof depends on it
  stacking: {
    maxStacks: 1,
    onReapplyStacks: 'keep',
    onReapplyDuration: 'keep',
  },
  lifetime: {
    clock: 'permanent',
    scaling: 'fixed',
    removeOnSourceDeath: false,  // EXPLICIT — the Ẩn-death invariant is
                                 // gameplay-locked, never left to the
                                 // implementation default
  },
  dispellable: false,            // cleanse() gate skips it
  capabilities: [
    { id: 'van_phap_than_hoa.reaction',
      type: 'elemental_reaction_enabled',
      payload: {} },
  ],
}
```

No statModifiers, no periodic, no `application` block (composition applies it;
resistance is meaningless for a self-granted aura).

**Capability type registration:** `CapabilityType` is an open string; unknown
types throw at `BuffRegistry` registration (:340 → validator `:33`). Register
`elemental_reaction_enabled` via a reaction-domain register function in
`createDefaultCapabilityValidators` (mirror `registerProcCapabilities`/
`registerTheTuCapabilities`; constant already exists,
`contracts/capability.ts:11`).

**Capability query adapter:** one small production component —
`has(sourceId, cap) => buffs.getCapabilities(sourceId).some(g => g.capability.type === cap)`
— same live-grant surface `resolveSourceGrants` already uses (:1085).
`StaticCapabilityQuery` stays fixture-only.

### 9.2 Battle-entry grant seam (composition layer owns the aura)

`applyEntryBuffs` (`GameManagerTurnBattleOps.ts:1194`) already has the
party-wide pattern — the Tran Phap lane applies a self-targeted buff per
`battle.players` participant (:1218-1224). Add the Ẩn-aura grant in the same
lane:

```
if (isPhapTuNgoDao(player) && skillManager.has('ngo_dao_hon_don'))   // S0.8 pins the accessor
  for (const participant of battle.players.filter(p => p.entity.alive))
    entries.push({ definitionId: 'van_phap_than_hoa',
                   sourceId: <Ẩn entity id — battle.players[0]>,
                   targetId: participant.entity.id })
```

`battle.players` includes companions (:1574) → companions receive the aura and
CAN react (FINAL — "đồng đội" includes companions). Enemies never enter
`battle.players` → never granted. The aura rides the entry lane's `eligible`
apply — harmless: non-seal defs never reach the gate (registry rejects first).

### 9.3 Hidden-mage resurrection re-grant seam (DORMANT — no production revive)

Locked rule: Ẩn resurrects → re-grant `van_phap_than_hoa` to the entire current
allied party, idempotently. **Production has no dead→alive path today** (§5) —
build the seam dormant:

- The composition/lifecycle layer exposes the re-grant routine (same grant
  loop as §9.2 over living `battle.players`, sourced by the Ẩn entity).
- **Event-idempotent grant, not blind reapply:** `BuffSystem.apply` emits
  `buff_applied` even when `addedStacks=0`/`created=false` (:323). The seam
  checks each living participant for an existing `van_phap_than_hoa`
  instance (same source+def identity) and applies ONLY to missing holders —
  existing holders produce zero events, missing holders produce exactly one
  `buff_applied`, and `per_source`+`keep` remains the structural guarantee
  that a duplicate can never form even if the check is bypassed.
- Trigger surface: a lifecycle call (e.g. `onParticipantRevived(entityId)`)
  that any future revive mechanic must invoke when the revived entity is the
  Ẩn aura source.
- Today the seam is exercised only by tests driving a revive transition
  directly (mirroring `perfectClear.test.ts:281`'s flag-set pattern). Document
  that any future resurrection content MUST call this seam — ReactionSystem
  never owns resurrection logic.

### 9.4 Dispatcher registration (composition root)

Inside `mintCycleScheduler` — same shape `FixtureReaction.attachFixtureReaction`
rehearsed, using the live-grant query:

```
→ BuffSystemBoardQuery(buffs, elements)
→ ReactionTriggerGate(capabilityQuery, elements)     // adapter over getCapabilities
→ ReactionRegistry(CANONICAL_REACTIONS, elements, registry.has)
→ ReactionSystem(registry, boardQuery, gate)
→ ReactionDispatcher(gate, system, elements, resolutionToBatch)
→ scheduler.registerImmediateHandler('elemental_application_committed', …)
```

Exactly once, inside the existing mint. Boards remain same-source
(`instanceScope:'per_source'` + board query — re-prove on production data).

### 9.5 S3 acceptance — Vạn Pháp Thân Hòa lifecycle cases

- **Case A — entry:** Ẩn enters → Ẩn + ALL companions hold aura → every holder
  may react from its own eligible seal applications.
- **Case B — Ẩn death:** Ẩn dies → its own instance gone (holder cleanup);
  surviving allies KEEP aura → still react.
- **Case C — ally death:** companion dies → its aura removed; resurrects → no
  aura → cannot react (no re-grant fired for ally revival).
- **Case D — Ẩn resurrection:** Ẩn resurrects → party-wide idempotent re-grant:
  Ẩn regains aura, resurrected companions regain aura, surviving holders show
  no duplicate capability (still exactly one instance each).
- **Case E — cleanse:** cleanse attempts on `van_phap_than_hoa` → aura remains
  (`dispellable:false` — assert via the cleanse lane, not just the flag).
- **Case F — no Ẩn:** no tâm pháp → no aura → seals apply, zero reactions.
- Positive: eligible skill-origin seal applies react; suppressed cannot.
  Ordinary-mage + companion + hidden-path applications all covered.
- **Origin-agnosticism proof (synthetic):** a direct `ApplyBuffRequest` with
  `origin.kind:'proc'` + `reactionEligibility:'eligible'` on a canonical seal
  from an aura holder MUST react — proving the gate ignores origin.
  Production `CombatProcSystem` stays `'suppressed'` per §8.3 — this mission
  does NOT flip it.
- Registration-exactly-once guard; second-`ReactionRegistry`/board-store guard.

## 10. S4 — Production-Data Re-Proof Matrix

These contracts are ALREADY closed at engine/fixture level — this checkpoint
re-proves them against production defs and production wiring. If a proof fails,
fix content/wiring; do not reflexively redesign the engine.

- All 10 relations load and resolve with real defs (production-data coverage —
  lower-level whole-stack integration acceptable in place of 10 full
  Playwright runs).
- One application ⇒ ≤1 reaction; `addedStacks≤0` (cap refresh) ⇒ none;
  periodic ticks ⇒ none; reaction-produced stacks ⇒ no recursion;
  sequential multicast ⇒ each subcast settles before the next (Ngộ Đạo
  multicast + composite pick already ride `this.rng` — re-prove determinism
  same-seed).
- Source isolation: caster A cannot consume caster B's board (incl.
  companion-applied seals) — while `scope:'any'` consume/detonate mechanics
  intentionally eat all sources (both invariants coexist — test both).
- Death mid-reaction: consume + damage commit; later invalid ops skip
  (`invalid_target_state`); no rollback, no crash.
- Resisted payoff: ailment resistance rejects a `cam_cong`/`defense_break`/
  `reaction_bleed`/`defense_erosion` apply → payoff absent, board consumed,
  no rollback. Includes the stale-instance case: resisted `reaction_bleed`
  reapply onto an existing same-source instance leaves stacks/duration/
  modifier untouched — the S0.13 deferred modifier never materializes
  (`buff_application_failed` only).
- Cấm Công: attack rejected; heal/buff/cleanse/defend/utility legal; turn
  still occurs (production `cam_cong` def).
- Aura lifecycle: Cases A–F from §9.5.
- Determinism: same seed + commands ⇒ identical element picks, multicast,
  applications, selection, damage, final state, trace.
- Trace: `rootActionId`/`castId`/`subcastIndex`/application `eventId`/
  `causationEventId`/`reactionId`/origin `'reaction'` reconstructable.

## 11. S5 — Hỏa Kit + Route Closure + Presentation + E2E

### 11.1 Hỏa kit (canonical ids — reuse locked identities)

`dan_hoa_quyet`, `xich_viem_xuyen_tam` (+ `xich_viem_next_tick` modifier),
`phan_thien_hoa_vuc`, `cuu_tieu_viem_bao` — authored through the canonical
SkillDefinition pipeline only; locked spec: `2026-09-17-hoa-an-ailment-system-
spec.md` **(unparked + D1-amended at S0.11 — never implement from a PARKED
spec)** + buff spec §60-63 + skilldef spec §61/§71. Same-source access (read
stacks, modifiers, duration ops, manual tick, consume — spec §62) uses the
§6 S0.4 identity-selector primitive across ALL buff-targeting ops; generic
`any` lanes unchanged (D-4). If a mechanic cannot be expressed, classify the
missing primitive and
add the smallest generic one; never a skill-specific escape hatch. These are
ordinary-Pháp-Tu route skills — they apply seals and only react while an aura
holder (D-3).

### 11.2 Route mechanics

- DoT route: consume/detonate mechanics retargeted to seal ids (§4.3) —
  all-source semantics locked (D-4).
- Nổ route: `consumesAilmentId`→`consumeBuff{scope:'any'}` — same ruling.
- `ailmentStackBonus` route profile applies to seal applications (generic —
  verify, don't special-case).
- Ngộ Đạo: composite pick + multicast unchanged (already `this.rng`); the
  element pool = the five basics → post-migration each subcast applies the
  corresponding seal `eligible` → reacts while aura held.

### 11.3 Presentation

`reaction_resolved`/`reaction_skipped` → combat log/VFX mapping (observational
only); seal names/icons + `van_phap_than_hoa` icon in status strip; Cấm Công
icon. Presentation never decides outcomes.

### 11.4 E2E (P13/P14 — from this worktree, real browser)

- Journey A: ordinary Pháp Tu, no Ẩn — seals apply (visible in UI), no reaction.
- Journey B: Ẩn present — aura on party visible; seal applies → visible
  reaction payoff (log + VFX); companion-applied seal reacts too.
- Journey C: Khắc payoff incl. one Cấm Công case if exposed in UI.
- Journey D: multicast — sequential reactions, no freeze, no duplicate.

## 12. Deletion / Forbidden-Compatibility Sweep

After migration, assert absent in production:

- The five old ids (any residual reference = migration incomplete).
- `TurnReactionManager`, `ELEMENT_REACTIONS`, `canInitiateWuxingReactions`
  (already deleted — keep asserted).
- `test_*` status ids referenced by production reaction data.
- Orphaned old-reaction product defs `doc_the`, `ngung_lo`, `khai_son`,
  `dung_nham`, `huyet_doc`, `hoai_tu` (census-verified first).
- A second `elemental_reaction_enabled` channel: no `StaticCapabilityQuery`
  production membership, no second granting mechanism — the live
  `van_phap_than_hoa` buff grant is the ONLY channel.
- `van_phap_than_hoa` granted outside the two approved seams (battle entry;
  hidden-mage resurrection re-grant).
- `removeOnSourceDeath:true` or `dispellable:true` on `van_phap_than_hoa`.
- Duplicate effective capability via reapply (per_source + keep ⇒ impossible —
  assert).
- Reaction-path branches on `cultivationPath`/`cultivationWay`/`skillId`/
  `origin.kind` inside `core/reaction` — the Ẩn check lives in the composition
  layer, never in reaction core.
- A second `ReactionRegistry`/elemental board store; a second dispatcher
  registration.
- Temporary migration helpers — none survive merge.

## 13. Architecture Guards (typed/structural preferred over regex)

- Canonical seal↔element binding validation at composition (§7.2):
  `fire→hoa_an`, `water→han_tuc`, `wood→doc_can`, `metal→liet_thuong`,
  `earth→tran_an`; `def.element` agrees with each mapping; `kind:'ailment'`,
  `per_source`, `maxStacks:5`, `application.resistance:'ailment'`. Fail-fast —
  documented blast radius: malformed canonical content prevents battle mint.
- `ElementalStateRegistry` maps exactly those five (both construction sites:
  battle mint + persistent lane).
- `CANONICAL_REACTIONS` = exactly the 10 canonical pairs vs `WuxingRelations`;
  validates against the production battle registry.
- No `test_*` ids referenced by production reaction data.
- `ReactionDispatcher` registered exactly once on
  `elemental_application_committed`.
- `elemental_reaction_enabled` provable only via live `van_phap_than_hoa`
  grants — guard: no production `StaticCapabilityQuery` carrying it; aura def
  has `dispellable:false`, no `removeOnSourceDeath:true`, `maxStacks:1`;
  reapply yields no duplicate effective capability.
- `core/reaction` never imports path/way/skill-content modules.
- `reaction_bleed`/`defense_break`/`defense_erosion`/`cam_cong` never enter
  the `ElementalStateRegistry` — structural non-reactability.
- Instance-local penetration exists ONLY via the §6 S0.5P contract fields —
  guard: no `source.stats` mutation for penetration, no alternative
  penetration injection path (no statModifier hack, no profile bypass),
  structural validation rejects the field on `element:'physical'` or
  non-`buff_periodic` origins, and the bonus provably stays bound to its own
  instance's damage requests.

## 14. Gates

- P3: `npm run type-check` + focused vitest during work; `npm run verify`
  (type-check + build + full suite) for completion. Focused scopes: `buff2`,
  `reaction`, `skilldef`, `scheduler`, `TurnBattleSystem` contract/determinism,
  `GameManager` journeys, `ActionValidator`, architecture guards, migrated
  data tests.
- P18 OpenCodeReview: coverage 100%, all Medium+ fixed + rerun.
- P4: DEEP QA (this activates previously inert combat behavior): attack list —
  cross-source consume, refresh trigger, periodic trigger, recursion, >1
  reaction per application, Cấm Công-as-stun, resisted payoffs, death
  mid-reaction, stale board on multicast, double registration, capability leak
  (no-Ẩn battle), aura cleanse attempt, Ẩn-death persistence, ally-resurrect
  losing aura, Ẩn-resurrect re-grant idempotency, companion aura reaction,
  detonate-vs-board interaction, RNG drift, battle end during settlement,
  save/load with seals (assert no persistence path).
- P5: ≥3 sequential passes per AGENTS.md, each over the post-fix state.

## 15. Design Decisions — ALL RULED (2026-09-19)

- **D-1 RESOLVED:** `elemental_reaction_enabled` is granted ONLY by the live
  `van_phap_than_hoa` buff capability — no `StaticCapabilityQuery` production
  membership, no second authority. Granted to Ẩn + all allied participants
  (companions included) at battle entry; idempotent party re-grant on
  hidden-mage resurrection via the §9.3 dormant lifecycle seam.
- **D-2 RESOLVED:** all five seals `duration:3` holder turns (new spec
  overrides migrated 4/5/5/4/4).
- **D-3 RESOLVED:** `tran_an` follows new spec — pure suppression/setup state,
  no hard CC, no auto-Cấm Công; the legacy −30% evasion and on-hit `choang`
  proc are NOT preserved (spec pins neither).
- **D-4 RESOLVED:** `scope:'any'`/`detonate` consume ALL sources; `scope:'own'`
  consumes the current caster only. Both semantics coexist; boards stay
  same-source for reactions regardless.
- **D-5 RESOLVED:** spec-base — orphan legacy reaction products deleted after
  census (`doc_the` deletion frees the "Độc Căn" name; `dot_recovery` loses its
  only production carrier — engine intentionally retained). Seals AND
  reaction-generated payoff statuses use `application.resistance:'ailment'`.
- **D-6 RESOLVED:** all five seals `maxStacks:5`, `add`, `refresh`,
  `per_source`; `han_tuc`/`tran_an` 1-stack legacy semantics abandoned.
- **D-7 RESOLVED:** eligible lanes stay deliberately eligible; the gate is
  origin-agnostic; suppressed lanes stay suppressed where semantically
  required.

**No open design items.** Authored defaults explicitly marked tunable in §8.2
(status base durations where spec is silent) are content knobs, not
architecture decisions.

## 16. Post-Mission

Future content consumes the finished runtime: reaction balance tuning, Ẩn
progression depth, real resurrection mechanics (must invoke the §9.3 seam),
more elemental routes, boss/enemy reaction participation (explicitly deferred —
enemies never hold the aura this mission), presentation polish. None may create
alternate combat authorities.
