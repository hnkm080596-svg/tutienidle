# P7 — Locked Design Decisions

Human-approved resolutions to the six blocking notices (2026-09-21). This document is the authority; where `system-inventory.md`/`terminology.md`/`ui-inventory.md`/`naming-migration.md` mark a question open, this file supersedes.

## D1 — Technique progression model: Hybrid (rank auto, grade transacted)

- **Rank 0–10** progresses automatically through normal technique usage/progression. No currency spend, no manual per-rank investment.
- At **Rank 10** progression halts at the current grade (bottleneck).
- **Grade advancement** is an explicit player transaction requiring ALL of: Rank 10 + required material(s) + realm/eligibility requirements.
- On successful grade advance: grade increments, **rank resets to the start of the new grade** — rank progression resumes.
- **Quality** is completely independent of rank AND grade; never auto-increases through either.
- The technique-side progression concept is renamed to **`mastery` / `masteryProgress`** — NOT `skillInsight` (that pool stays node/skill-upgrade only).
- Loop: `use technique → rank up → rank 10 bottleneck → spend material + satisfy eligibility → grade up → resume`.

## D2 — Realm-entry passive ladder: way-owned `realmRewards`, uniform content for now

- `Technique.passiveSkillIdsByRealm` is removed entirely.
- Ownership: `canonical Way → realmRewards[realmId] → passiveSkillId`.
- `syncRealmPassive` migrates to resolve the passive from the active Way's realm reward.
- This phase preserves the EXISTING passive list unchanged, shared across all Ways — **no** six differentiated sets (that would be new content scope).
- Schema stays Way-capable: prefer a shared canonical ladder reference/deduplicated authoring so individual Ways can override later without another migration.

## D3 — Generic Skill Loadout: RETIRE entirely

- Remove generic `equipped` / `loadoutSlot` / `loadoutSlots` combat-loadout authority from `Skill` (persisted fields dropped; save rejection handles old payloads).
- Remove/replace `SkillLoadoutStrip` / `RadialSkillSelector` anywhere they imply player-configurable combat slots the runtime ignores.
- **No replacement universal player-configurable slot UI** — no new 3-slot loadout either.
- Mortal uses the same role contract: `tram` → basic role; unsupported roles stay empty until content/path progression provides them.
- Post-path, combat actives resolve exclusively from the canonical Way/Pathway-owned authority.
- **B/S/U is a resolver-facing semantic contract, NOT a mandatory authored shape.** Pathways may expose different structures or leave roles empty; resolvers/UI normalize into the combat-facing contract (`TurnCombatSkillBar` shows resolved roles).
- Target: `canonical Way/Pathway → resolved combat roles → combat/UI`; for Mortal: `mortal precursor skill → resolved combat role`.

## D4 — Body progression: single `BodyProgression` authority, chapter registry

- `BodyProgressionSystem` owns a `BodyChapter` registry: unified ownership, lifecycle, persistence, querying, registration.
- Body Refinement → chapter; Meridian Opening → chapter; future Trúc Cơ+ body progression = new chapter definition/state, NOT a new engine.
- Chapters may retain specialized rules/strategies — "one authority" ≠ one giant conditional implementation.
- Persisted state migrates away from `bodyRefinementCompletedTiers`, `bodyRefinementCurrentTierProgress`, `openedMeridianIds` toward chapter-keyed canonical state.
- Meridian→Đại Đạo coupling: preserve the existing gameplay requirement; migrate it into a **canonical chapter-derived fact** exposed by BodyProgression; the deferred breakthrough resolver reads that fact, not legacy fields/engines. The formula itself is NOT redesigned this phase.
- Target: `BodyProgression chapter state → canonical derived fact → deferred breakthrough resolver`.

## D5 — UI information architecture: Hybrid consolidation (C)

- **SkillPathPanel** owns the Way progression surface: way identity, canonical Technique card, node tree/pathway structure, resolved combat-role progression.
- **RealmPanel** owns realm progression AND hosts unified BodyProgression chapters as sections/tabs/subviews — no standalone body panels.
- **Remove** standalone `TechniquePanel`; remove `LuyenThePanel` as an independent progression surface; remove generic loadout UI (D3).
- **Scripture Pavilion**: lose the gameplay-facing Công Pháp tab; becomes lore/reference only. It may describe techniques/schools/history but must NOT mirror authoritative technique progression state. `SkillPathPanel` = live authoritative state; `Scripture Pavilion` = lore/reference. No second "canonical technique codex".

## D6 — Naming: spine English, leaves VN (narrow N2 amendment)

- Canonical domain identity / persistence spine uses **semantic English**; VN/romanized lore names must not be new machine-facing path/way/technique identity values.
- New canonical path values: `CultivationPathId = 'sword' | 'spell' | 'body'` (`kiem_tu`→`sword`, `phap_tu`→`spell`, `the_tu`→`body`).
- New canonical way values: `CultivationWayId = 'sword_pathway' | 'hidden_sword_pathway' | 'spell_pathway' | 'hidden_spell_pathway' | 'body_pathway' | 'hidden_body_pathway'` (visible/main way ↔ `*_pathway`; the ẩn/ngộ/ứng ways ↔ `hidden_*_pathway`).
- Canonical Technique IDs introduced/migrated in this authority cut are English — they belong to the spine.
- Leaf content ids (skills, nodes, materials, zones, `ngu_hanh`/`ngo_dao`/`ngu_kiem`/`kiem_pho` as authored content underneath a Way) stay VN under N2 — **no** repo-wide ~500-id rename.
- Lore/content concepts keep their distinction: `cultivationWay = sword_pathway` while main-node/display content = Ngự Kiếm — lore names are not baked into canonical identity.
- Direct identity cut: no legacy persisted-value compat layer (save rejection already applies).

## D7 — Mastery accrual source: battle rewards only (semantic migration)

- `drops.techniqueInsight` → `techniqueMastery` (rename/migrate the existing reward channel).
- Battle-victory rewards are the ONLY mastery source this phase. No per-cast accrual, no cultivation-tick accrual — rank pace must not couple to attack speed/cooldowns/rotation length.
- `skillInsight` remains the separate Skill/Node pool; never reused for technique.
- Mastery grants go through a **dedicated Technique progression API/event** — battle loot calls the API, it does not own rank mutation. Future sources plug into the same API.
- Flow: `battle victory → techniqueMastery reward → mastery progress → auto rank advance → rank 10 cap → explicit grade transaction`.

## D8 — Technique Quality: fully modeled axis, no upgrade path (deferred mechanic)

- `quality` exists in the canonical Technique model (Chất axis), with an explicit valid initial value at grant.
- Persisted + exposed to UI/read models.
- Independent of rank AND grade — neither progression nor grade advance may raise it.
- No player-facing quality transaction; battle rewards/bosses/cultivation/random events must not implicitly mutate it.
- No temporary material sink invented just to make it mutable.
- Future mutation happens through a **dedicated Technique-domain operation** (design the op seam now; the mechanic stays deferred).
- Model: `Technique = identity + grade + rank/mastery + quality`.

## D9 — Technique Grade ceiling: realm-index derived

- Max reachable grade derives from the player's current realm via a canonical helper (`getTechniqueGradeCeiling(realmId)` or equivalent realm-domain capability) — no per-technique grade table, no scattered realm arithmetic.
- Mortal → no technique at all (not a zero grade — absent).
- `qi_refining` → ceiling 1; `foundation_establishment` → ceiling 2; future realms extend by the same rule.
- `realm determines grade CEILING`, not grade: entering a realm makes the next grade *eligible*; grade advances only via `rank 10 + material + eligibility + below ceiling → grade +1`.
- No Cửu→Tiên Phẩm ladder data authored — speculative content is out of scope.
- Invariant: `technique.grade <= techniqueGradeCeiling(currentRealm)`.

## D10 — Path starter basics: `tram`/`huy_quyen`/`linh_bao` authored as real content

- These are **path starter basic identities**, NOT a mortal loadout: Sword→`tram`, Body→`huy_quyen`, Spell→`linh_bao` — each maps to the resolved BASIC role.
- Mortal stays minimal: BASIC=`tram`, SPECIAL=empty, ULTIMATE=empty.
- `huy_quyen`/`linh_bao` get real authored definitions this phase; no fabricated mortal special/ultimate.
- Post-initiation, the canonical Path/Way authority resolves/unlocks the path's starter basic — acquisition comes from path progression authority, not the mortal precursor table.
- Legacy precursor/cast-threshold tables that treat the three as one mortal loadout are removed/rewritten.

## D11 — Technique-gated node prerequisites: schema only

- Add first-class prerequisites: `requiredTechniqueRank` / `requiredTechniqueGrade`, evaluated against the **canonical Technique state** — never inferred from path/way/realm/skills/node ownership.
- Path/Way owns tree selection; technique state may gate availability *within* the tree; technique never determines or mutates path/way identity.
- Deliver: schema + resolver/evaluator + validation/tests. **No authored gates** — no invented rank/grade placements (balance/content scope).
- Existing node availability stays behaviorally unchanged.

## D12 — Canonical technique ids: semantic English

- Way id = structural spine; technique id = semantic identity of the actual art; display name = lore.
- English `snake_case`, `_art` suffix; no `pathway`/`way` in the id; not derived from display names.
- Way → technique is enforced by reference, not name encoding.
- Names (subject to way-semantics check at authoring): `five_elements_art`, `dao_insight_art`, `sword_control_art`, `myriad_swords_art`, `diamond_body_art`, `responsive_body_art`.

## D13 — Ops model (autonomous phase run)

- One phase worktree `.agent-worktrees/p7-progression-consolidation` on `feat/p7-progression-consolidation`, branched from master HEAD (P1–P6 treated as base).
- Per mission: SPEC → ChatGPT review until pass → PLAN → ChatGPT review until pass → IMPLEMENT (repo gates) → external review until pass → local mission commit.
- Local mission commits authorized; final merge to local master authorized ONLY when every mission is green + final integration gates pass + no HIGH/MEDIUM findings + no locked decision violated. Post-merge verification on master required.
- No push, no force-push, no history rewrite.
- Locked decisions outrank reviewer preference; conflicts recorded, not relitigated. If implementation proves a locked decision impossible/lossy/contradictory → emit `[C2C] NOTICE` with evidence.
- Per mission, missing product/design decisions → `[C2C] NOTICE`, never guess.

## Previously locked (user directive, unchanged)

- `tu_linh_quyet` removed completely — not as mortal fallback, not as compat.
- Special breakthrough formulas deferred; no P7 architecture may be forced by them.
- Save policy: version bump rejects old saves; no field translators.
- Numerical balance/playtest outcomes are NOT completion criteria.
