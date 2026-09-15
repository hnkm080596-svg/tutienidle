# Kiem Tu Reimagined for Turn-Based Combat — Design Spec

Date: 2026-09-15
Status: DRAFT — pending user spec review.
Context: builds on `2026-09-14-stat-system-reimagined-design.md`
(D1–D21), the ATB turn engine, and the structural conventions of
`2026-09-14-phap-tu-reimagined-design.md`. Replaces the realtime-era
Kiem Tu architecture (2 auto-locked routes, 9 dead formation skills,
dead Kiem The / Kiem Y temp / currentSwordIntent pools, unwired on-hit
nodes) with a single-authority path model: the visible path is
**Kiem Pho** — a player-authored 9-slot orb preset with a tail-match
combo engine — and the hidden path is **Ngu Kiem Dao** — a long-grind
cascade of sword-intent forging.

## 1. Decisions locked with the user (brainstorm 2026-09-15)

| # | Decision |
|---|---|
| K1 | **State = `mode`, not route.** `PlayerData.kiemTu = { mode: 'hien' | 'ngu' }` replaces `kiemTuRoute`. Every Kiem Tu starts `hien` at path choice — the tram-cast-count auto-lock at `chooseCultivationPath` dies. |
| K2 | **Ngu = the hidden path, gated by mortal mastery.** A hidden node (`kiem_tu_an`) on the kiem_tu tree becomes visible only when `tram` (Huy Kiem) has reached Lv3. Gate is DERIVED from `skillLevels`/`skillCastCounts` — the same read path that gates `bat_kiem_thuat` today; no `kiemNguUnlocked` field exists. |
| K3 | **All hidden-path gates are pre-path only (user correction).** Mortal precursor skills (`tram`, `linh_bao`, `huy_quyen`) are NOT castable after choosing a cultivation path — the Lv3 mastery must be earned as a Pham Nhan, before Lễ Nhập Môn. This amends the Phap Tu spec's P11 ("mortal skills remain castable post-path") — that spec must be corrected to match. Consequence: a hien player who did not grind `tram` to Lv3 as a mortal can never enter Ngu. |
| K4 | **Ngu is one-way, permanent, no refund.** Taking `kiem_tu_an` flips `mode='ngu'`; hien investment is not refunded (từ bỏ đạo costs). `tram` becomes hidden/unusable for the Ngu player — its 10000 casts are the lore entry fee, not a stat that converts. |
| K5 | **Hien = Kiem Pho. No special, no ultimate, no resource pool.** The basic slot is DYNAMIC: each player turn resolves as the next orb in the preset. `the` is not a kiem_tu resource — the pool belongs to phap_tu content only. |
| K6 | **Preset = contiguous orb sequence, 1–9 slots.** No nulls/gaps — the player places orbs in order and the cycle length IS the placed count (placing Đâm×3 vs Đâm×1 is equivalent — user ruling). One preset, persisted on `PlayerData.kiemTu.preset`. Editable out of combat. |
| K7 | **Manual mode = free orb pick.** In manual input mode the player chooses ANY unlocked orb each turn (not bound to preset order); casts still write to the combo log. Auto mode = run the preset loop. In-combat agency for hien lives entirely in manual orb choice. |
| K8 | **Five orbs, physical only, no cooldowns, one unlock per realm.** Đâm (×1.0, Luyện Khí), Chém (×1.2, bleed, Trúc Cơ), Bổ (×1.8, armor-break, Kim Đan), Hất (×0.6, stun chance, Nguyên Anh), Quét (×0.8 to EACH target — AoE, not split, Hóa Thần). Metal axis dies for kiem_tu — orbs are `might`-scaled physical; `metalPower`/penetration content is not re-authored for this path. |
| K9 | **Combo engine: tail-match, longest-first, additive, full reset.** Every cast appends its orb id to a per-battle log; after each cast the engine checks the tail against the combo table at length 5 → 4 → 3; on match the combo fires ADDITIVELY (the completing orb still resolves normally) and the log resets completely. No lookahead. Log capacity = 5 entries (nothing longer is ever matched). |
| K10 | **37 authored combos, SUFFIX-free, CI-validated.** 15 at length 3, 12 at length 4, 10 at length 5 (pattern table §4.3). The matcher is tail-based, so the collision class is SUFFIX, not prefix: no combo's tail may equal another combo — no len-3 is the last-3 of any len-4/5, no len-4 is the last-4 of any len-5. An architecture test rejects any new entry that violates it. Each combo has its own authored effect — not a per-length formula. (Realm-dependent shadowing is NOT a feature — the same input string must resolve to the same combo at every realm.) |
| K11 | **Discovery is hardcore — no hints.** No cast-log HUD, no codex, no silhouette list, no "combo fired" banner. A combo's only tell is its effect/VFX/damage payload. 3875 possible patterns (5³+5⁴+5⁵), 37 real — 99.045% dead by design. |
| K12 | **Combo max length is realm-gated:** length 3 from Luyện Khí, length 4 from Kim Đan, length 5 from Luyện Hư. Longer combos exist in data but cannot match below their realm (the engine's check length is `min(5, realmComboMax)`). |
| K13 | **Ngu kit: 1 active + 2 passive emblems.** Basic `ngu_kiem_thuat` (active): summons `kiemDaoCount` phi kiếm, all striking the primary target — each an independent damage instance dealing `kiemDaoBase × might` physical, each rolling the Roll Cascade, each independently proccing on-hit/thorns/leech (thorns ×N is an accepted, flagged risk). Surplus swords on a mid-cast kill are wasted — no retarget. +1 Kiếm Ý per cast. Special slot = **Tụ Kiếm Ý** passive emblem showing `X / forgeCost(realmIndex)` progress (not castable). Ultimate slot = **Kiếm Đạo Roll Cascade** passive emblem (not castable) — same emblem pattern as Phap An's `ngo_dao_hon_don`. |
| K14 | **Kiếm Ý → Kiếm Đạo economy.** Kiếm Ý is a banked, persisted pool (no in-battle reset). Sources: +1 per `ngu_kiem_thuat` cast and Cửu Cung node grants (bought with Cảm Ngộ). Auto-conversion at `forgeCost(realmIndex)` Ý → +1 Kiếm Đạo (one more phi kiếm). **Cap = `realmIndex + 1`** (0-based index, mortal=0: LK 2, TC 3, KĐ 4, NA 5, HT 6, LH 7, HThể 8, ĐT 9, ĐK 10) — the realm bounds total forges: while `kiemDaoCount >= cap` NO Ý income is accepted (casts deal damage but grant nothing; Cửu Cung Ý-node purchases are blocked). These are two different moments — a NEW gain at cap is rejected entirely (`kiemY` unchanged), while a lump grant that hits the cap mid-conversion keeps its unforged remainder banked — accumulation (tích lũy) is intended and converts against the next realm's cap AND forge cost. |
| K14b | **Forge cost scales +30% per realm.** `forgeCost(r) = ceil(9999 × 1.3^(r-1))`, `assert(r >= 1)` — LK 9,999 / TC 12,999 / KĐ 16,899 / NA 21,968 / HT 28,559 / LH 37,126 / HThể 48,264 / ĐT 62,742 / ĐK ~81,565 Ý per forge. Banked Ý does NOT carry its old rate — it converts at the NEW realm's higher cost (mild anti-hoard pressure, intended: count can never be banked, only Ý). |
| K15 | **Hợp nhất on breakthrough: count resets to 1, base grows.** On realm advance, the Ngu player's phi kiếm fuse: `kiemDaoBase ×= (1 + 0.3 × kiemDaoCount)` (MERGE_BONUS = 0.3 — a full LK merge of 2 Đạo → ×1.6; a full TC merge of 3 → another ×1.9 → 3.04 total; compounding is user-accepted: "đánh lâu thì xứng đáng"), then `kiemDaoCount = 1`. The temporary damage dip IS the design — each realm is a forge loop (1→cap→merge), and "đột phá sớm hay cày thêm" is the path's core tension. `kiemDaoBase` persists and compounds across realms. |
| K16 | **Roll Cascade = 3 pre-pipeline rolls per damage instance.** The cascade resolves BEFORE the normal damage pipeline (ult roll trước, dmg pipeline sau — user ruling). States `a`/`e`/`d` are unlocked by nodes; locked states mean the roll simply does not happen and the default outcome applies. Pipeline crit still works normally at all times — the cascade ADDS rolls, it never disables the pipeline's. |
| K17 | **Execute is damage, not a kill flag, evaluated live per instance.** `a` = a huge damage multiplier on that instance when `target.hp% < x%` — resolved through the normal pipeline (SurviveLethalGuard, ward, block all still apply). Boss-safe by construction: it is a burst, not an instant-kill. The hp% check reads LIVE state immediately before each instance resolves — an earlier phi kiếm can dig the target below threshold so a later one executes (multi-sword synergy is intentional). `x% = 10% × realmIndex` (caster; `realmIndex` is the existing 0-based realm index — mortal=0, qi_refining=1, foundation_establishment=2 … tribulation=9), cap 50% (Trúc Cơ unlock → 20%). |
| K18 | **Ngu never misses — unconditionally, not via roll.** Every phi kiếm carries `guaranteedHit=true` as path identity, applied before the cascade runs. Roll 2 therefore only decides crit: success → `e` forces the crit; fail/locked → `f` = the default outcome (pipeline crit still rolls normally on non-`e` instances). The accuracy/evasion axis is dead for this path (deliberate identity: Ngự Kiếm bách phát bách trung). Locked `a` → always `b` (no execute check). Locked `d` → no pierce roll → normal armor-mitigated damage. |
| K19 | **No save migration.** Pre-release saves are not carried (same ruling as Phap Tu spec P16); load-time version check rejects pre-rework saves with a clear error. |
| K20 | **Cửu Cung = 9-node 3×3 cluster.** 8 outer nodes grant Kiếm Ý (insight cost + realm gate) — the "spend Cảm Ngộ to raise Kiếm Ý" channel. Trung Cung (center) grants +1 Kiếm Đạo directly and requires all 8 outer nodes purchased. Respects the per-realm cap (K14) — a purchase at cap is blocked, not wasted. |

## 2. Path state model — one authority

```text
PlayerData.kiemTu {
  mode:         'hien' | 'ngu'    // set at path choice 'hien';
                                  // flips to 'ngu' via kiem_tu_an node — one-way
  preset:       string[]          // orb ids, length 1–9, hien only
                                  // (retained, inert, while ngu — never nulled)
  kiemY:        number            // banked Kiếm Ý pool (persisted; hien reads 0)
  kiemDaoCount: number            // current phi kiếm this realm (≥1 while ngu)
  kiemDaoBase:  number            // merged multiplier (starts 1.0; persists, compounds)
}
```

- `mode` is the only discriminator — every consumer keys on it first
  (A3). While `ngu`, `preset` stays stored but inert.
- `kiemY`/`kiemDaoCount`/`kiemDaoBase` exist for every kiem_tu player
  and read baseline values while `hien` (zeroed/defaults, not absent —
  migration/test safety; hien never accrues them).
- **Fresh state at path choice** (the whole object is initialized, the
  auto-mode reader never meets an empty preset):
  `{ mode:'hien', preset:['orb_dam'], kiemY:0, kiemDaoCount:1,
     kiemDaoBase:1 }`. Taking `kiem_tu_an` flips `mode` only — the
  Đạo fields are already at forge baseline. The conversion is a
  TRANSACTION: the `van_kiem_quyet` signature technique is validated
  BEFORE any commit (insight, node ownership, mode), and a post-commit
  equip failure rolls the whole purchase back (learn is idempotent —
  already-learned never blocks the flip) — a save never lands in
  "ngu mode without the signature technique".
- Mutations only through GameManager path ops (one writer, A3):
  `setKiemPhoPreset` (out of combat), `kiem_tu_an` node purchase
  (mode flip), the Kiếm Ý accrual/convert hook (battle side), the
  breakthrough merge hook (realm side).
- The hidden node `kiem_tu_an` sits at the kiem_tu tree root, visually
  offset/sealed like `phap_tu_an` (a different category of choice),
  gated by the new `visibleWhen` display rule: player holds kiem_tu
  AND `skillLevels['tram'] >= 3`. Description names the kit and carries
  the explicit permanent + no-refund warning — the node IS the
  informed choice point.

## 3. Hien kit — the five orbs

| Orb id | Name | ×might | Effect | Realm unlock |
|---|---|---|---|---|
| `orb_dam` | Đâm | 1.0 | — | qi_refining (path start) |
| `orb_chem` | Chém | 1.2 | bleed stack — physical DoT `kiem_thuong`, max 3 stacks, scales off might | foundation_establishment |
| `orb_bo` | Bổ | 1.8 | armor-break debuff (defense-down) | golden_core |
| `orb_hat` | Hất | 0.6 | stun chance → `choang` | nascent_soul |
| `orb_quet` | Quét | 0.8 per target | AoE | soul_transformation |

- Orbs are `kind: 'physical'` damage scaled off `might` — no element
  components, no cooldowns, no resource. Effects are independent — orbs
  never synergize except through combos.
- `kiem_thuong` is a NEW physical-typed DoT debuff (`dot.element:
  'physical'` is already legal in `DotEffectTemplate`); `choang`
  exists; the armor-break debuff is authored new or reuses an existing
  defense-down — whichever already exists in data at implementation
  (Bổ is "phá giáp đơn giản" — simplest available lever, not a new
  mechanic).
- Hất/Quét unlock at Nguyên Anh/Hóa Thần — but combo length 4 opens at
  Kim Đan and 5 at Luyện Hư (K12). Orbs and combo length gate
  independently: an orb you don't own can't be cast and can't appear
  in a fired pattern; a combo longer than the realm cap can't match.

## 4. Combo engine — `KiemPhoSystem`

### 4.1 Per-turn resolution

```text
hien player turn:
  auto mode   → cast = preset[pointer]; pointer = (pointer+1) % preset.length
  manual mode → cast = the orb the player picked (pointer unchanged —
                manual play does not advance the preset cursor;
                resuming auto continues where it left off)
  cast resolves (orb damage + orb effect)
  log.append(orbId); log kept to last 5
  for len in min(5, realmComboMax) down to 3:
      if tail(log, len) === combo.pattern: fire combo; log.clear(); break
```

- The preset pointer, the log, and the 5-orb picker state are
  battle-runtime state owned by `KiemPhoSystem` — reset per battle,
  never persisted (A3: the preset is persisted; the cursor is not —
  each battle starts at slot 1).
- `commitAction` cooldown machinery is not involved — orbs carry no
  cooldown; the preset IS the pacing mechanism.
- A combo that just fired cannot chain into another combo in the same
  cast — the log is empty after reset (one fire per cast, guaranteed
  by construction, no recursion guard needed).

### 4.2 Combo definition shape

```ts
type OrbId =
  | 'orb_dam' | 'orb_chem' | 'orb_bo' | 'orb_hat' | 'orb_quet'

interface KiemPhoCombo {
  id: string                    // 'tam_thich', ...
  pattern: OrbId[]              // canonical orb ids, e.g.
                                // ['orb_dam','orb_dam','orb_dam'];
                                // the log stores OrbId verbatim and
                                // the Đ/C/B/H/Q shorthand in §4.3 is
                                // doc notation ONLY, never runtime
  presetId: CombatVfxPresetId   // REQUIRED — the only player-visible
                                // tell that a combo fired (INV-7)
  // resolved like a mini TurnSkillDefinition — authored effect only:
  damage?: { multiplier: number }              // physical, off might
  appliesBuffs?: { definitionId: string;       // plural — several
                   target: 'self' | 'target' }[]// authored buffs and
                                // several capstone modifiers may each
                                // contribute one; same definitionId
                                // merges stacks, different ids coexist
  targeting?: ActionTargeting                  // defaults: same target
                                               // as the completing cast
}

interface KiemPhoComboModifier {  // the ONLY way a node may alter a
  nodeId: string                // combo — registered by purchased
  priority: number              // capstones; run order = priority ASC,
  matches(combo: KiemPhoCombo): boolean   // then nodeId ASC — NEVER
  apply(combo: KiemPhoCombo): KiemPhoCombo// purchase order (same build,
}                               // same result regardless of history).
                                // apply() returns a DERIVED copy —
                                // mutating the canonical combo would
                                // leak the buff into every later cast.
```

Combo effects resolve through the SAME hit pipeline as the orb (one
additional impact, own absorb pass). They are additive — they never
replace the completing orb's resolution (K9).

### 4.3 Combo table (37 — SUFFIX-free, locked pattern set)

Length 3 (15):

```text
Đ-Đ-Đ Tam Thích        C-C-C Tam Trảm         B-B-B Tam Phách
H-H-H Tam Liêu         Q-Q-Q Tam Tảo          Đ-Đ-C Nhị Thích Nhất Trảm
Đ-Đ-B Nhị Thích Nhất Phách   C-C-Đ Nhị Trảm Nhất Thích
C-C-B Nhị Trảm Nhất Phách    B-B-Đ Nhị Phách Nhất Thích
H-H-Đ Nhị Liêu Nhất Thích    Q-Q-Đ Nhị Tảo Nhất Thích
Đ-C-Đ Thích Trảm Thích       C-Đ-C Trảm Thích Trảm
B-Đ-B Phách Thích Phách
```

Length 4 (12):

```text
Đ-C-B-Đ Thích Trảm Phách Thích     C-B-Đ-C Trảm Phách Thích Trảm
B-C-Đ-B Phách Trảm Thích Phách     H-C-Đ-H Liêu Trảm Thích Liêu
Q-C-Đ-Q Tảo Trảm Thích Tảo         Đ-H-C-Đ Thích Liêu Trảm Thích
Đ-Q-C-Đ Thích Tảo Trảm Thích       C-H-B-C Trảm Liêu Phách Trảm
B-H-C-B Phách Liêu Trảm Phách      Đ-C-C-H Thích Trảm Trảm Liêu
C-Đ-Đ-H Trảm Thích Thích Liêu      B-Đ-Đ-Q Phách Thích Thích Tảo
```

(Suffix-free fix — the original `Đ-C-C-Đ` / `C-Đ-Đ-C` / `B-Đ-Đ-B` had
tail-3s colliding with Nhị Trảm Nhất Thích / Nhị Thích Nhất Trảm /
Nhị Thích Nhất Phách. Any `X-A-A-Y` tail can only end in H or Q to
stay free — an accepted constraint that also gates these three len-4
combos behind the Nguyên Anh / Hóa Thần orb unlocks.)

Length 5 (10):

```text
Đ-C-B-H-Q Ngũ Hành Kiếm            Q-H-B-C-Đ Ngũ Hành Nghịch Chuyển
Đ-C-C-B-Đ Thích Trảm Trảm Phách Thích
C-Đ-B-C-B Trảm Thích Phách Trảm Phách
B-C-Đ-H-Q Phách Trảm Thích Liêu Tảo
Đ-H-B-C-Q Thích Liêu Phách Trảm Tảo
Q-C-Đ-B-H Tảo Trảm Thích Phách Liêu
C-B-H-Q-Đ Trảm Phách Liêu Tảo Thích
B-H-Q-Đ-C Phách Liêu Tảo Thích Trảm
H-Q-Đ-C-B Liêu Tảo Thích Trảm Phách
```

- **Reachability note:** patterns containing an orb the realm hasn't
  unlocked are simply unreachable until then (H first appears at
  Nguyên Anh, Q at Hóa Thần) — no special-casing; the realm gate on
  combo LENGTH (K12) is the only extra rule.
- **Anti-degenerate:** none (user ruling). `[Đ]` spamming Tam Thích
  every 3 casts is the floor, not the ceiling — payoff tiers make
  exotic weaving worthwhile. No orb cooldowns, no combo ICD, no
  diminishing returns.

### 4.4 Discovery contract

- Nothing enumerates combos to the player: no log strip, no codex, no
  silhouette, no "?" entries. The ONLY observable signal is the
  payload — a fired combo's effect must be visibly distinct (VFX/damage
  number), or it is undetectable (deliberate; a combo that looks
  identical to an orb is a content bug).
- `player.kiemTu` stores NO discovered-combo set — discovery is
  player-knowledge, not account state. (If a future softening ever
  wants a discovered-list, that is a NEW field and a NEW design
  decision, not a flag on this spec.)

## 5. Ngu kit — Ngự Kiếm Đạo

### 5.1 Three slots

| Slot | Id | Kind |
|---|---|---|
| basic | `ngu_kiem_thuat` | active — N phi kiếm, cascade per instance, +1 Kiếm Ý |
| special | `tu_kiem_y` | passive emblem — Kiếm Ý progress `X / forgeCost` (never castable; `selectAction`/`selectForcedAction` treat it as absent) |
| ultimate | `kiem_dao_cascade` | passive emblem — Roll Cascade status (never castable) |

- `ngu_kiem_thuat` reuses the id of the retired `passive_ngu_kiem_thuat`
  node's namesake (the old node dies in §7 — no live collision).
- Each phi kiếm: `damage = kiemDaoBase × might`, physical, primary
  target only, independent cascade roll, independent
  on-hit/thorns/leech.
- **Mid-cast kill:** the instance loop BREAKS on target death —
  surplus swords never existed for gameplay purposes: no cascade
  roll, no on-hit/thorns/leech proc, no battle RNG consumed.
- Cooldown 0 — every Ngu turn is a cast (like `tram`'s role before).
  Kiếm Ý +1 per CAST, not per phi kiếm.

### 5.2 Roll Cascade — per-instance, pre-pipeline

```text
guaranteedHit = true              // path identity, unconditional (K18)
for each phi kiếm instance:
  if target dead → break          // surplus swords: no roll, no proc,
                                  // no RNG consumed (§5.1)
  Roll 1 (Trảm Sát)   [node 'a' unlocked?]:
      live (target.currentHp / target.maxHp) < x%
                       → a: instance gains EXECUTE_MULT damage
      else                   → b: nothing
  Roll 2 (Chí Mạng)   [node 'e' unlocked?]:
      roll success     → e: forceCrit on this instance
      else             → f: default — pipeline crit rolls normally
  Roll 3 (S.Thương Chuẩn) [node 'd' unlocked?]:
      roll success     → c: sát thương chuẩn — bypasses armor fully
      else             → d: pierces PIERCE_FRACTION of armor
  → instance enters the normal damage pipeline
    (accuracy — guaranteedHit already set, always lands;
     crit — e forces it, otherwise the pipeline rolls it;
     armor — c skips it, d reduces it, baseline applies it)
```

- Locked state → the roll DOES NOT happen and the default applies:
  no `a` → always `b`; no `e` → always `f` (no forced crit — the
  pipeline's own crit still applies); no `d` → normal armor
  mitigation (neither `c` nor `d`).
- Unlock order (user-proposed, kept): `a` @ Trúc Cơ, `e` @ Kim Đan,
  `d` @ Nguyên Anh — authored as kiem_tu-tree nodes on the Ngu branch.
- `x%` execute threshold = `10% × realmIndex` of the CASTER, cap 50%.
- Roll-2 success rate and `PIERCE_FRACTION`/`EXECUTE_MULT` are tunable
  constants owned by the cascade module (first-pass: pierce ~60%,
  execute ~×10 — the balance pass owns final values; implementers do
  not invent axes). Roll-2 rate may additionally scale with the `e`
  node's level ("tỉ lệ cao hơn" — user).
- **Determinism:** per-instance rolls use the battle RNG — order is
  instance index ascending; documented for replay determinism.

### 5.3 Kiếm Ý → Kiếm Đạo, merge

```text
gain:    +1 kiemY per ngu_kiem_thuat cast; +<node-granted> per
         Cửu Cung node — ACCEPTED ONLY WHILE kiemDaoCount < cap;
         at cap the gain is a no-op (the emblem shows a capped state)
convert: forgeCost = ceil(9999 * 1.3^(realmIndex - 1))
         // assert(realmIndex >= 1) — mortal (0) can never be Ngu;
         // fail-fast so a stray caller doesn't get ~7.7k "costs"
         // LK 9999 / TC 12999 / KD 16899 / NA 21968 / HT 28559 /
         // LH 37126 / HThe 48264 / DT 62742 / DK ~81565
         while (kiemY >= forgeCost AND kiemDaoCount < realmCap):
             kiemY -= forgeCost; kiemDaoCount += 1
         conversion runs ONLY inside the gain hook — after an
         Ý-mutating event (cast or Cửu Cung grant), NEVER inside the
         breakthrough transaction; a lump grant's remainder past the
         cap forge stays banked (accumulation is intended — tích lũy)
cap:     kiemDaoCap = realmIndex + 1     // realmIndex = existing
                                        // 0-based index, mortal=0:
                                        // LK 2, TC 3, KĐ 4, NA 5,
                                        // HT 6, LH 7, HThể 8, ĐT 9,
                                        // ĐK 10
merge (on realm breakthrough, exactly once, in this order):
    const mergedCount = kiemDaoCount   // snapshot BEFORE any reset
    kiemDaoBase *= (1 + 0.3 * mergedCount)   // MERGE_BONUS = 0.3
    kiemDaoCount = 1
    // kiemY untouched — banked Ý converts on the NEXT gain event,
    // against the NEW realm's cap
```

- Conversion is automatic and immediate — the special-slot emblem is a
  progress display, never a button (Tụ Kiếm Ý "không bấm được").
- Merge hooks the existing realm-advance op for kiem_tu+ngu players
  only — a `mode === 'ngu'` check inside the breakthrough path, not a
  generic realm listener.
- The merge dip is intentional (K15): pre-breakthrough count is
  banked power, not current power. The gain-gate keeps a capped realm
  from stockpiling further Ý — the only carry-over into the next
  realm is the banked remainder, which the user accepts as
  accumulation ("càng về sau nâng càng dễ").

### 5.4 Cửu Cung cluster

- 3×3 visual cluster on the Ngu branch. 8 outer nodes: each grants a
  Kiếm Ý lump (insight cost, realm-gated — amounts are balance-pass).
  Trung Cung: +1 `kiemDaoCount` directly, prereq = all 8 outer nodes,
  blocked at cap.
- An Ý-grant node is UNPURCHASABLE while `kiemDaoCount >= cap` (the Ý
  couldn't be received — buying it would be a trap purchase); the UI
  shows the capped state on the cluster.
- The name deliberately echoes the retired `kiem_tran_cuu_cung`
  formation — the 9th formation's flavor survives as the hidden
  path's constellation.

## 6. Node tree — new shape

```text
kiem_tu root (path start — mode 'hien')
├── orb branches ×5 (each under its orb's realm gate):
│   ├── ~5 growth nodes per orb (damage/effect/stack/duration levers)
│   └── 1 capstone transformation per orb
│       (e.g. "combos containing ≥2 Chém apply +2 bleed stacks")
└── kiem_tu_an (hidden root — visibleWhen: tram Lv3, §2)
    └── Ngu branch:
        ├── cascade unlock nodes: a @ Trúc Cơ / e @ Kim Đan / d @ Nguyên Anh
        ├── per-instance growth (multiplier, pierce rate, execute rate)
        └── Cửu Cung 3×3 (8 Ý-grants + Trung Cung)
```

- Orb-subtree topology (~5 + capstone per orb) is the draft the user
  supplied — counts are content-pass, not load-bearing.
- Capstone transformations are implemented ONLY through
  `KiemPhoComboModifier` (§4.2): a purchased capstone registers a
  match→mutate rule evaluated at combo fire; the pattern matcher
  itself never special-cases nodes (A8 — modifiers are the stable
  category of variation).
- The `routeTag`/route-switch machinery from the Phap Tu spec does NOT
  exist here: hien has no routes (the earlier "2 route" answer was
  superseded by the preset design — routes are dead for kiem_tu).

## 7. Kill list — retired machinery

Every entry below is **retire-if-present**: the list was audited
against `master`@2026-09-15 (local == `origin/master`), but
implementation happens later — each item is removed only after
verifying no surviving consumer references it at that time. An item
already gone is a no-op, not a conflict.

| Item | Fate |
|---|---|
| `kiemTuRoute` + tram-count auto-lock in `chooseCultivationPath` | replaced by `kiemTu.mode` — path choice always lands `hien` |
| 9 `kiem_tran_*` skills + `TRAN_SEQUENCE` keystones + `getFormationSwordCount` | retired — orbs replace formations; TRAN_SEQUENCE's realm ladder is superseded by §3's unlock table |
| `bat_kiem_thuat` (charge special), `tru_tien_kiem_tran`, `kiem_khai_thien_mon` | retired — Ngu has no charge special; hien has no ult; `TurnBattleAdapter`'s kiem_tu static maps die with them |
| `the` pool usage by kiem_tu | retired — `currentThe`/THE_GAIN_* remain phap_tu-owned; kiem_tu never touches them |
| `currentSwordIntent`, `swordIntentDamageRatio`, `grantsSwordIntentPerHit`, `SkillResourceType 'sword_intent'` | retired — dead since the realtime era; remove field, scaling hook, resource type, and RESOURCE_FIELD entry |
| `KiemTuResourceSystem` (Kiếm Thế / Kiếm Ý tạm pools, `initKiemTuBattleResources`) | retired — hien has no pool; Ngu's Kiếm Ý is a persisted pool, not a battle pool |
| `KiemYSystem` (boss-kill tier → 0.5%/tier multiplier) | retired — superseded by Kiếm Ý/Đạo; boss kills no longer feed a kiem-tu axis |
| 9 on-hit nodes (`onHitEffect` machinery + `OnHitEffectKind`) | retired — cascade rolls own Ngu's per-hit variance; orb effects own hien's |
| SwordZone (`grantsSwordZone`, `SwordZone.ts`) | retired — no surviving content references it |
| `bat_kiem_an` node + its 9999-count prereq | replaced by `kiem_tu_an` (gate = `tram` Lv3 alone — the old 9999 count was redundant: Lv3 already means 10000 casts) |
| `KiemTuCombatHud` slider (Tụ Lực 3–9s) + manual ult button | retired — channel is gone; replaced by §10 UI surfaces |
| `KIEM_TRAN_SLOT_INDEX`, ghost unequip ids (`ngu_kiem_thuat`/`van_kiem_trieu_tong`/`kiem_khai_thien_mon` in path-choice code), `usesSwordIntentResource`/`resourceLabel 'Kiếm Ý'` | retired with their consumers |
| `PlayerHudLayer.updateKiem` / `kiemBarBridge` Kiếm-Thế/Kiếm-Ý-tạm read | rewritten — hien shows nothing (no pool); ngu shows Kiếm Ý progress |
| `passive_ngu_kiem_thuat`, `passive_van_kiem_trieu_tong`, `passive_thai_hu_nhat_kiem`, `passive_phieu_van_bo`, `passive_pha_thien_nhat_kich`, `bat_kiem_*` growth/Kiếm-Ý nodes, `kiem_tran_ult_*`, `bat_kiem_ult_*` nodes | retired — replaced by §6 tree |
| BattleSystem channel code (`initChannelState`/`updateChanneling`/`resolveChannelTick`/`setChannelTickSeconds`) if any survived into turn infra | verify and remove — channel primitive was realtime-only; `chargeTurns` on TurnSkillDefinition stays (it's a generic engine primitive, not kiem-tu-owned) |

**Kept / repurposed:**

- `tram` (Huy Kiếm) — mortal skill, cast-count auto-level, the Ngu
  gate. Unchanged mechanically; hidden for kiem_tu players.
- Realm passives + Ngự Kiếm Tâm Kinh / Thái Hư Kiếm Quyết techniques —
  generic crit/defense stats still apply; numbers are balance-pass.
- `van_kiem_quyet` (Vạn Kiếm Quyết — the orphaned technique) —
  REPURPOSED as the Ngu path's signature technique: its name is the
  phi-kiếm storm verbatim. Content-authored in implementation (e.g.
  Kiếm Ý gain / cascade-rate tiers) — the repurpose is approved in
  principle, exact tier effects are content-pass.
- `chargeTurns` engine primitive — stays for other content; no
  kiem-tu consumer remains.

**Dead-id hygiene:** retired ids must not appear in default loadouts,
unlock lists, `skillCastCounts` seeds, enemy/ally buff data, or i18n
nav labels — the same rule as the Phap Tu spec's kill list.

**Teardown order is dependency-first** — part of the legacy surface is
still on the LIVE damage path (`swordIntentDamageRatio` is genuinely
consumed by `DamageCalculator`; `currentSwordIntent`/`currentKiemThe`/
`currentKiemYTemp` still sit on `CombatEntity`). Remove in this order,
never fields-first:

```text
content producers (skill/node defs writing sword intent / the / old ids)
  → old scaling definitions (swordIntentDamageRatio on skills)
  → DamageCalculator consumer (the ratio read)
  → CombatEntity fields (currentSwordIntent / currentKiemThe /
    currentKiemYTemp)
  → resource enum / converters / fixtures (SkillResourceType
    'sword_intent', RESOURCE_FIELD entries)
  → dead-id sweep (no retired id referenced anywhere)
```

Deleting `CombatEntity` fields first and chasing compile errors upward
is explicitly the wrong order.

## 8. Turn-engine integration contract

- Ownership layout (parallel to `core/phap-tu/PhapTuRoutes.ts`):
  `core/kiem-tu/KiemPhoSystem.ts` owns preset cursor, combo log, and
  the combo table resolver; `core/kiem-tu/NguKiemDao.ts` owns the Roll
  Cascade, Kiếm Ý accrual/conversion, and the merge rule. Neither is
  reached by the other path's consumers (INV-1).
- `participant.basic` for hien is resolved PER-TURN by `KiemPhoSystem`
  (auto → preset cursor; manual → player-picked orb). The engine sees
  an ordinary `TurnSkillDefinition`-shaped orb cast; the preset cursor
  is invisible to it.
- hien `participant.special`/`ultimate` are absent (undefined) — the
  selector's basic/fallback path handles every turn.
- Ngu's passive emblems occupy the special/ultimate slots as
  non-castable markers for HUD only — the selector must treat them as
  absent for action choice (same contract as Phap An's
  `ngo_dao_hon_don` emblem, per that spec).
- Combo fires are additional action impacts inside the same cast
  resolution — presentation gets them as ordinary impact data (a VFX
  preset id is REQUIRED per combo — K11's discoverability depends on
  the payload being visible).
- `applyTurnStartDeltas`/regen hooks: nothing kiem-tu-specific — Kiếm Ý
  accrual rides the cast hook only.
- **Two generic engine primitives must be added (A8 — no skillId
  branches in the engine):**
  - `HitResolveOptions.guaranteedHit?: boolean` — skips the
    accuracy/evasion roll entirely. `NguKiemDao` sets it on every phi
    kiếm impact (K18); `CombatSystem`/`ActionImpactSystem` only see the
    flag, never `ngu_kiem_thuat` by name.
  - Resolved armor policy on the damage impact — e.g.
    `armorPierceFraction?: number` + `armorBypass?: boolean` (or a
    discriminated `armorPolicy` union). The cascade's Roll 3 result is
    carried into the pipeline as THIS FIELD — `DamageCalculator`
    executes the policy (normal → pierce → bypass) and never reads
    cascade state. The primitive is reusable by any future
    "xuyên X% giáp" content.

## 9. Save/migration surface

- `PlayerData.kiemTu` added with the §2 shape; `kiemTuRoute` field
  removed. **No save migration** — load-time version check rejects
  pre-rework saves with a clear error (K19, same mechanism as the
  Phap Tu spec).
- `preset` persists (it's a build choice); cursor/log never persist.
- `kiemY`/`kiemDaoCount`/`kiemDaoBase` persist — they are the Ngu
  grind, the whole point of the path.
- The Ngu unlock is derived (`tram` Lv3), never stored.

## 10. Invariants (tests/QA)

1. **Mode single-owner:** every kiem_tu consumer reads `kiemTu.mode`
   first; hien code never touches `kiemY`/`kiemDao*`, ngu code never
   reads `preset`.
2. **Preset shape:** 1–9 contiguous orb ids, all unlocked by realm —
   `setKiemPhoPreset` rejects invalid arrays; cursor always
   `< preset.length` (wrap arithmetic, never a stale index).
3. **Combo determinism:** longest-first + full reset — at most one
   combo fires per cast; a fired combo can never chain into another in
   the same cast; the log never exceeds 5 entries.
4. **Suffix-free data:** no combo's tail equals another combo — no
   len-3 is the last-3 of any len-4/5, no len-4 is the last-4 of any
   len-5 (architecture test; the matcher is tail-based, so PREFIX
   checks would guard the wrong property).
5. **Additive resolution:** the completing orb always resolves
   normally — a combo fire never eats or alters the orb's own
   damage/effect.
6. **Realm gating:** combos longer than `realmComboMax` cannot match;
   orbs above the realm cannot be cast or placed in the preset.
7. **Hardcore discovery:** no UI surface enumerates unfired combos or
   the live cast log, and NO combo name/id may resolve to presentation
   text (no display-meta entry, no name flash — a name IS enumeration).
   A fired combo's only tell is its distinct VFX/damage payload (data
   test: every combo entry has a unique `presetId`).
8. **Ngu gate:** `kiem_tu_an` invisible/unpurchasable unless kiem_tu
   AND `tram` Lv3; taking it is irreversible; hien nodes grant no
   effects while `mode==='ngu'` (query-time mode filter, same
   derivation principle as routeTag filtering in the Phap Tu spec).
9. **Cascade bounds:** `guaranteedHit` is unconditional path identity
   (set before the cascade, not by it); rolls happen only for unlocked
   states; `a` is a damage multiplier — it can never bypass
   SurviveLethalGuard/ward semantics; the instance loop breaks on
   target death so dead-target swords consume no RNG and no procs.
10. **Kiếm Ý economy:** Ý income applies only while
    `kiemDaoCount < realmIndex + 1` (at cap: casts grant nothing,
    Cửu Cung Ý-nodes are unpurchasable); conversion is all-or-nothing
    `forgeCost(realmIndex)`→1, runs only inside the gain hook,
    bounded by the realm cap; a gain's remainder past the cap forge
    stays banked; the breakthrough transaction never mutates `kiemY`;
    merge happens exactly once per breakthrough, snapshots the count
    before reset, and always resets count to 1.
11. **Base persistence:** `kiemDaoBase` never decreases; merge can only
    grow it (bonus ≥ 0); `kiemDaoCount` is always ≥ 1 while ngu.
12. **No dead ids in fresh saves:** no retired skill/buff/node id
    appears in fresh-save-loadable content (same rule as Phap Tu
    spec §10.12).
13. **Manual/auto parity:** a manual orb pick and the same orb via
    preset produce identical resolution (damage, effect, log append) —
    input mode never changes mechanics.
14. **`the` isolation:** kiem_tu content never reads or writes
    `currentThe`; phap_tu content never reads `kiemY`/`kiemDao*`.

## 11. Residual notes / open details

- **37 combo effects are a SEPARATE design pass** (user ruling
  2026-09-15: "effect combo + skill pháp tu + thể tu sẽ được thiết kế
  riêng kỹ càng hơn sau — chúng ta chỉ đang làm path trước"). This
  spec fixes the contract (§4.2), the pattern table, and the
  required-`presetId` rule; a combo entry may ship with a stub effect
  only if marked such — full effect authoring is a follow-up spec,
  same treatment as the Pháp Tu / Thể Tu skill-effect details.
- **Độ Kiếp cap is 10 by formula (`realmIndex + 1`, locked by user)**
  — 10 independent cascade-rolled damage instances per cast at the
  ceiling (~18.3k × might per cast if every realm merged at full cap;
  realized value is far lower because most merges fire at count < cap).
  MERGE_BONUS 0.3 compounding is deliberately generous — user-accepted.
- **Forge cost compounds +30%/realm (locked):** `9999 × 1.3^(r-1)` →
  a ĐK forge costs ~81.6k Ý (~22.7h at 1 cast/s); the full ideal curve
  is ~2.43M Ý (~676h continuous combat). Fallback if the balance pass
  finds this too steep: linear `9999 × (1 + 0.3(r-1))` → ĐK ~34k
  (~9.4h), full curve ~1.39M. Do not swap silently in implementation —
  the two are a 2× economy difference.
- **Forge pacing vs realm pacing are independent clocks.** At
  +1 Ý/cast and ~1 cast/s (speed 100, 10 ticks/s), an LK forge
  (9,999 Ý) ≈ 2.8h of continuous combat and a ĐK forge (~81.6k Ý)
  ≈ 22.7h — early realms pass faster than a forge, so
  most breakthroughs will merge at count < cap and realized base
  growth sits far below the §-table ceilings (full-cap-merge numbers
  are the ideal, not the expectation). If full-cap-in-realm should be
  achievable, the balance levers are: Ý-per-cast scaling with realm
  (e.g. +realmIndex), larger Cửu Cung lump grants, or a lower 9999
  constant. Do not "fix" this silently in implementation — it is a
  balance decision.
- **Roll-2 success rate source:** first-pass a module constant;
  whether `e`-node level feeds it is a content decision. No new
  StatType is introduced (D18: a one-content ratio lives in the
  cascade module, not the stat union).
- **Hất stun rate** needs an authored chance (first-pass ~15–25%,
  balance-pass) — CC on a spammy kit interacts with boss CC resist;
  verify against the existing resist rules rather than inventing a
  kiem-tu exception.
- **Bổ armor-break** reuses the simplest existing defense-down debuff
  if one exists in data, else authors `pha_giap_debuff` — no new
  mechanic.
- **Orb sub-node counts** (~5 + capstone per orb) and Cửu Cung Ý
  grant amounts are content-pass numbers.
- **UI debt acknowledged:** hien preset editor (9-slot strip + orb
  palette, out-of-combat), manual-mode orb picker (5 buttons replacing
  the 3-slot skill bar), combo fire VFX (the only discovery channel),
  Ngu emblems (Kiếm Ý `X/forgeCost(realmIndex)` progress + cascade status), the
  `kiem_tu_an` hidden-node reveal with its permanent/no-refund
  warning, breakthrough merge feedback ("3 phi kiếm hợp nhất — base
  ×1.9"), and `kiemBarBridge` rewrite all need presentation work in
  the implementation plan (P14 will verify visually).
- **Naming:** `mode: 'ngu'` matches the user's vocabulary (Ngự Kiếm
  Đạo); the family concept stays "Kiếm Ẩn" (parallel to Pháp Ẩn /
  Thể Ẩn) — player-facing strings must not blur path-name vs
  hidden-concept (same note as Phap Tu spec §11).
- **Phap Tu spec erratum:** K3 amends Phap Tu spec P11 — mortal
  precursors are pre-path-only for ALL hidden paths. The Phap Tu spec
  should be updated to match when it is next touched.
