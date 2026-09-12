# Talent Catalog v4 — M2 (nhóm tu luyện) Implementation Plan

Spec: `game/docs/specs/2026-09-03-talent-catalog-v4-design.md` §4.3/§6/§7/§8.
Roadmap: §0.11 B4. Scope này chỉ M2 — M3 (sản xuất: hoa_hau_thong_than,
bach_luyen_thanh_khi) là branch/merge kế tiếp.

## Slice 0 — Save v61 fields

New PlayerData fields (defaults; save-shape validation + round-trip test):

- `cultivationOvercharge: number` (Hải Nạp bank)
- `tribulationBonusStacks: number` (Lôi Kiếp victory stacks)
- `nodeFreePurchaseRecord: Record<string, number>` (Vấn Đạo refund ledger)
- `phaGiapCarryStacks: number` (Phá Giáp cross-battle carry)

## Slice 1 — `hai_na` (Hải Nạp)

- `addCultivation()` (`core/cultivation/CultivationSystem.ts`) clamps at
  `required` and discards overflow. With talent: overflow banks into
  `player.cultivationOvercharge` instead.
- `breakthroughSystem()` minor-tier path (`cultivation = 0; realmLevel++`)
  pours the bank into the new tier — via `addCultivation` (respects the
  new `required` cap; any excess stays in the bank).
- Owner: CultivationSystem. Talent check via `collectTalentEffects` —
  need a new effect kind `cultivation_overcharge` (or `hasTalent` lookup).
- Tests: overflow banks only with talent; pour-on-breakthrough lands in
  new tier; no talent → current clamp behavior unchanged; round-trip.

## Slice 2 — `ngo_dao` (Ngộ Đạo offline insight)

- `insight_per_cultivation` accumulator already runs online in
  `player.ts cultivate()`. Offline path: `restoreFromSave` adds
  `offline.cultivation` directly to `this.cultivation` (bypasses
  `addCultivation` and the insight branch).
- With talent: after applying offline cultivation, run the same
  accumulator loop (`cultivationInsightAccumulator`) for the offline
  amount — same threshold constant, same counters.
- The offline grant is a raw `+=` today (no required-clamp); keep that
  semantic — only add the insight branch. Note: offline grant ignores
  the required cap BY DESIGN (pre-existing), do not reroute through
  addCultivation here (that would change behavior beyond the talent).
- Tests: offline with talent banks insight; without talent unchanged;
  accumulator partial carry preserved.

## Slice 3 — `ho_tich_bat_phat` (Hậu Tích Bạt Phát)

- Curve: multiplier = `0.5 + 0.1 * (realmLevel - 1)`, clamped >= 0.01 —
  applied to cultivation gain while talent held.
- Hook: `player.ts cultivate()` call site — multiply `gained` before
  `addCultivation` (keeps CultivationSystem's required-clamp authority;
  the curve is a talent-owned rate modifier, not cultivation math).
- Pure helper `hauTichRateMultiplier(realmLevel)` + tests for the curve
  endpoints (t1 = 0.5, t12 = 1.6).
- Tests: with talent realmLevel 1 gain halved, realmLevel 12 gain +60%;
  without talent unchanged.

## Slice 4 — `loi_kiep` (Lôi Kiếp)

- `TribulationDirector.applyLightningDamage` gets a talent-driven
  intensity multiplier ×2. Director has no player dep — inject via deps
  (a `lightningIntensityMultiplier()` getter supplied by the
  GameManager/tribulation-ops seam that reads the player's talents).
- Victory → `tribulationBonusStacks++` on the real player; each stack
  = +10% to the five attributes (strength/dexterity/intelligence/
  attunement/vitality) via persistent `player.modifiers` entries with
  `sourceId: 'talent_loi_kiep'` — attributes derive the combat stats, so
  "toàn chỉ số" is honored through the existing derivation pipeline
  instead of per-stat entries.
- Victory hook: wherever tribulation victory already commits rewards
  (TribulationOutcomeService / the victory branch — confirm during impl).
- Cap: spec allows unbounded stacking (≤9 in practice = realm count).
- Tests: damage doubled with talent (fixed-seed/director-level), victory
  adds stack + modifiers, defeat/cooldown unchanged, no talent → no stack.

## Slice 5 — `van_dao` (Vấn Đạo)

- `purchaseNode`/`upgradeNode` (`core/progression/NodeSystem.ts`): 50%
  roll at purchase time → skip `skillInsight` deduction, record
  `nodeFreePurchaseRecord[nodeId]++` (kept even if talent later removed —
  refund accounting stays honest).
- `devResetBranch` refund path: subtract recorded free purchases so
  refund = amount ACTUALLY paid.
- BattleLootSystem insight grant (~line 268): ×2 with talent.
- Baseline rebalance per spec: `SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT`
  1 → 0.6 (data quái explicit `skillInsight` entries stay — the
  constant already covers derived rewards; reducing authored explicit
  values is a wider data pass — flag if drift shows it matters).
- Tests: seeded roll free vs paid; record written only on free;
  refund respects record; loot insight doubled with talent.

## Slice 6 — `phaGiapCarryStacks` (Phá Giáp carry)

- M1 stacks live on the runtime Skill's `passiveModifiers[].stacks`
  (skillManager copy), reset per battle via `PassiveSystem.resetStacks`.
- On battle end (victory or retreat — spec says "kill giữ 50% tầng sang
  trận sau": bank at battle end regardless of outcome? Spec wording:
  carry triggers on kill contribution — simplest faithful read: bank
  `floor(stacks/2)` at battle end when talent held), write
  `player.phaGiapCarryStacks`.
- At battle start (or talent passive init), pre-seed the Phá Giáp
  passive's `metalPenetration` stacks from `phaGiapCarryStacks`
  (still capped by its max 5 via normal stack logic).
- Decay: reset to 0 when realmId changes (checked at seed time —
  compare player's current realm vs the one the stacks were banked in?
  Simpler: reset on `realmId` change events — check during impl; spec
  intent is "cột mốc mới xóa vết kiếm cũ").
- Tests: bank at battle end, seed at next battle, realm-change decay.

## Slice 7 — Catalog + descriptions

- Add 4 missing M2 definitions (ho_tich_bat_phat, loi_kiep, van_dao,
  hai_na) with real effect kinds; move ngo_dao from M2_PENDING.
- All 5 get weight > 0 → rollable. Update `Talents.test.ts` pool pins
  (12 → 17) and effect-kind handling in `collectTalentEffects` /
  `getInsightPerCultivation` (ngo_dao already uses
  `insight_per_cultivation`).

## Cross-cutting

- New effect kinds need `TalentEffect` union extension +
  `collectTalentEffects` plumbing (`core/talent/TalentEffects.ts`).
- Verification: full mode (save schema + combat-adjacent systems).
- QA: adversarial quick + QA report; P14 live check on main checkout
  after merge (talent roll → verify M2 talents appear in creation roll).

## Out of scope (explicit)

- M3 production talents + their Trận/Phù parked entries.
- Rebalancing enemy-authored `skillInsight` fields individually.
- Any new UI — talents surface through existing creation roll +
  effect description strings.
