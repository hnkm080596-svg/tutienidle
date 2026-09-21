# P7-M9 — Companion Domain & Ring-2 Realm Gating — Spec

Status: v2 (external-review approved — M9_SPEC_REVIEWED)
Date: 2026-09-22
Depends on: P7 M1–M8 committed state (master `7e707585`)
Locked inputs: Mortal Chapter design decisions **D3** (Ring-2 systems gated independently by actual realm relevance; no roadmap-UI wheel) and **D4** (Companion domain begins at Trúc Cơ; no Companion-specific materials in Mortal/Luyện Khí content; existing roster data retained for post-Beta content; no save migration work). User directives: "không cần quan tâm đến migration", "giữ data cho content sau beta".

---

## 1. Context and intent

The Mortal Chapter audit (v2) found the entire Companion economy live from character creation — token drops on the Mortal floor-10 boss, a Mortal-completable daily quest, an ungated wheel slot, and ungated domain ops. D4 rules the Companion domain begins at **Trúc Cơ** (`foundation_establishment`); D3 rules each Ring-2 system is gated independently near the point where the player can meaningfully interact with it.

M9 gates the Companion domain and the Trận (formation) slot at Trúc Cơ across four surfaces: domain ops, drop/quest sources, command wheel, and the Chiêu Hiền Quán gacha tabs. It is a gating/consolidation mission — no roster redesign, no balance retuning, no save-shape change (v72 stands).

**Grandfathering (locked by user):** no migration. A save that already owns Companions keeps them fully functional (formation slots, battle EXP); the new gates only block *new acquisition and UI entry* below Trúc Cơ.

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Wheel — Companion | `companion_roster` slot `ALWAYS_AVAILABLE`, opens `CompanionPanel` | `data/ui/commandWheelCatalog.ts` L138-144 |
| Wheel — Trận | `formation_slot` `ALWAYS_AVAILABLE`, opens `TranPhapPanel` | `commandWheelCatalog.ts` L127-133 |
| Wheel — gate primitive | `disabledReason(context)` exists; `CommandWheelDisabledContext.hasFoundationRealm` already computed as `getRealmIndex(player.realmId) >= getRealmIndex('foundation_establishment')` in `DongFuCommandWheel.vue` L35-36; `phap_bao` slot is the working precedent | `commandWheelCatalog.ts` L40-47, L106-116; `components/game/DongFuCommandWheel.vue` |
| Companion ops | `pullCompanion` / `exchangeCompanion` / `feedCompanion` — no realm check anywhere | `core/game/GameManagerCompanionOps.ts` |
| Pull token drops | `chieu_hien_lenh` ×1 on `mortal_ferocious_giant_crocodile` (Mortal floor-10 boss); ×2 on `ferocious_flood_serpent` (Luyện Khí floor-10 boss, lives in `MortalEnemies.ts`); ×3 on a Foundation boss — **keep** | `data/enemy/MortalEnemies.ts`, `data/enemy/FoundationEnemies.ts` |
| Token quest | `daily_chieu_hien_lenh` — kill-20-anything daily, no realm gate; `QuestSystem.isQuestEligible` already honors `QuestDefinition.requiredRealmId` via `getRealmIndex` | `data/quest/quests.ts` L56-62, `core/quest/QuestSystem.ts` L31 |
| Gacha UI | `WorkerLodgePanel` TabBar: `nhan_cong` / `chieu_mo` / `duyen_phan`; the two gacha tabs call `gameManager.companionOps` directly | `components/panels/WorkerLodgePanel.vue`, `worker-lodge/ChieuMoTab.vue`, `worker-lodge/DuyenPhanTab.vue` |
| Building | `chi_hien_quan` = worker lodge (global production capacity, `getWorkerCapacityForLevel`) — Mortal-relevant, **must NOT be realm-gated**; `Building.requiredRealmId` exists but is wrong tool here | `data/building/buildings.ts` L228-251, `core/building/BuildingSystem.ts` L117 |
| Formation commit | `commitFormationLoadout` validates formation id/cells/combatant ownership — no realm check | `core/game/FormationPlacement.ts` L54+ |
| Formation resolve | `resolvePartyFormation` feeds `TurnBattleAdapter` + companion battle EXP | `core/game/FormationPlacement.ts`, `core/game/BattleLootSystem.ts` L347-390 |
| Companion battle EXP | `applyCompanionExp` per kill for formation-assigned companions — inert without owned companions; grandfathered instances keep earning | `BattleLootSystem.ts` |
| Save | `player.companions` / `companionPullsSinceRare` / `duyenPhan` / `formationLoadout` — shape unchanged | `core/player/Player.ts`, `services/save/saveShapeValidation.ts` |
| Other entries | `tran_phap`/`companion` standalone panels mount in `GameRoot.vue`, reached only via `ui.standalonePanel`; wheel is the sole production opener | `components/layout/GameRoot.vue`, `stores/ui.ts` |

Invariants to preserve: `nhan_cong` tab and the whole worker-capacity flow stay Mortal-available; `phap_bao` gate unchanged; `talisman_slot` stays `NEVER_AVAILABLE`; quest `requiredRealmId` semantics unchanged for existing foundation quests; grandfathered companions still resolve in formations and gain battle EXP; token material registry entry stays (Foundation+ sources still produce it).

## 3. Target design

### 3.1 Canonical unlock predicates (domain authority)

Two separate named predicates — they share today's threshold but are different rules (D3: formation's unlock "defined separately"; keeping them un-coupled avoids smearing authorities):

- `core/companion/CompanionAvailability.ts` (NEW, tiny):
  - `COMPANION_UNLOCK_REALM_ID = 'foundation_establishment'`
  - `isCompanionDomainUnlocked(realmId)` → `getRealmIndex(realmId) >= getRealmIndex(COMPANION_UNLOCK_REALM_ID)`
- `core/game/FormationPlacement.ts`:
  - `FORMATION_UNLOCK_REALM_ID = 'foundation_establishment'`
  - `isFormationUnlocked(realmId)` → same index comparison

**Formation threshold — NEW decision M9-F1 (not derived from D3/D4).** D3 only constrains: Formation "is NOT part of the normal Mortal chapter. Do not expose it as usable Mortal progression", with an independently-gated unlock "based on companion/build-system progression" — it does not pin a value. Counter-evidence exists: `doc_hanh_tran` is player-only and has real solo value, so Mortal/Luyện Khí availability was defensible. M9 explicitly locks **`FORMATION_UNLOCK_REALM_ID = 'foundation_establishment'`** as its own product decision (recorded as M9-F1): the wheel slot and commit path belong to the party-progression surface whose anchor point is the companion domain (Trúc Cơ); keeping a distinct predicate preserves D3's independent-gate rule so a later product call can lower it by editing the single constant. `resolvePartyFormation` stays ungated — committed loadouts still resolve in combat, so the gate costs only new-commit/UI entry below Trúc Cơ.

### 3.2 Domain gates (authoritative)

- `GameManagerCompanionOps.pullCompanion()` / `exchangeCompanion()` / `feedCompanion()`: check `isCompanionDomainUnlocked(player.realmId)` **first**, before any bag/companion read or mutation; new fail reason `'realm_locked'` on all three result unions.
- `commitFormationLoadout(player, loadout)`: reject (return `false`, no mutation) when `!isFormationUnlocked(player.realmId)`.
- Companion battle EXP: **unchanged** — grandfathered companions keep earning; no-companion players are already inert.

### 3.3 Source migration (D4 hard rule)

- Remove `chieu_hien_lenh` drop entries from `mortal_ferocious_giant_crocodile` and `ferocious_flood_serpent` (the only Mortal/Luyện Khí sources). Foundation boss drop stays — now the sole drop source.
- `daily_chieu_hien_lenh` gains `requiredRealmId: 'foundation_establishment'` — existing `isUnlocked` filters it at activation.
- **Stale-active closure (external-review fix):** `requiredRealmId` alone only gates *activation* — a quest already sitting in `QuestManager.active` (restored save written before the gate existed) would keep progressing and paying out. `reconcileActiveQuests` (the same lifecycle seam that activates, invoked at boot/restore/daily-rollover/realm transition) gains an inverse pass: any active quest that is registered but no longer `isUnlocked` is dropped via a new `QuestManager.deactivate(questId)`. Claim/progress signatures stay player-free; the gate holds at the reconcile boundary.

### 3.4 Presentation gates

- `commandWheelCatalog.ts` + `DongFuCommandWheel.vue`: `CommandWheelDisabledContext` gains `companionDomainUnlocked`/`formationUnlocked`, resolved in the component from the **authoritative predicates** (`isCompanionDomainUnlocked`/`isFormationUnlocked`) — the two M9 slots consume their own domain flag (lock badge + `'Cần đạt Trúc Cơ'` copy as `phap_bao`). Keying the wheel off generic `hasFoundationRealm` was rejected in impl review: it would silently drift from the domain gates if M9-F1/D4 thresholds ever diverge.
- `WorkerLodgePanel.vue`: filter the two gacha tabs out of the TabBar list when `!isCompanionDomainUnlocked(player.realmId)` (panel reads realm via the same store-derived player it already uses; `nhan_cong` always present). Hiding rather than disabling matches D3's "visible close to usable" rule inside an already-open panel; the wheel slot remains the locked-teaser surface.

## 4. Files

| File | Why |
|---|---|
| `core/companion/CompanionAvailability.ts` (new) | owns the unlock rule — one authority |
| `core/game/GameManagerCompanionOps.ts` | enforces the rule at the 3 acquisition/feed ops |
| `core/game/FormationPlacement.ts` | owns formation commit; adds predicate + gate |
| `core/quest/QuestSystem.ts` + `core/quest/QuestManager.ts` | reconcile drops stale ineligible quests (`deactivate`) |
| `data/enemy/MortalEnemies.ts` | removes 2 violating drop entries |
| `data/quest/quests.ts` | `requiredRealmId` on the daily token quest |
| `data/ui/commandWheelCatalog.ts` | `disabledReason` on 2 slots |
| `components/panels/WorkerLodgePanel.vue` | gacha tab filtering |
| `components/panels/worker-lodge/ChieuMoTab.vue` + `DuyenPhanTab.vue` + `components/panels/CompanionPanel.vue` | `'realm_locked'` reason rendering (exhaustive switches) |
| `locales/vi.json` + `en.json` | `realmLocked` error copy |
| `data/formation/TranPhap.ts` (header comment) + `docs/systems/companions.md` | sync stale "unlocked from the start" / "không realm gate" / old token-source statements |
| Tests: `GameManagerCompanionOps` / `FormationPlacement` / `ChieuHienLenhDrops` / `DongFuCommandWheel` / `ChiHienQuan.integration` / `CompanionPanel` / `TranPhapPanel` | invariants below |

## 5. Invariants → tests

1. `pullCompanion`/`exchangeCompanion`/`feedCompanion` → `{ ok:false, reason:'realm_locked' }` at `mortal` and `qi_refining`; succeed at `foundation_establishment`. Existing happy-path fixtures are rebased to a foundation player (they currently default to mortal); explicit locked-realm coverage is added.
2. `commitFormationLoadout` returns `false` and leaves `player.formationLoadout` untouched below Trúc Cơ; unchanged behavior at/above.
3. Data assertion: no enemy definition with `realmId ∈ {mortal, qi_refining}` drops `chieu_hien_lenh`; no quest with `requiredRealmId < foundation` rewards it. Stale-active closure: progress restored on an ineligible quest is dropped at reconcile; kills after reconcile do not count; claim fails.
4. Wheel: `disabledReason` returns the lock string at Mortal/Luyện Khí and `null` at Trúc Cơ+ for both slots; clicking a locked slot opens nothing.
5. Grandfather regression: an owned companion still resolves through `resolvePartyFormation` and earns battle EXP at `mortal` (existing BattleLootSystem tests cover; confirm no new realm gate leaks into combat).
6. `nhan_cong` tab and worker capacity unaffected (existing building/worker tests stay green); gacha tabs hidden below Trúc Cơ.

## 6. Non-goals

- Beta roster (Thần Nông / Khai Minh), roster disposition of the existing 10, `unlockThresholds` rework, companion realm curve → M-G.
- Save migration / version bump — v72 stands; grandfathering only.
- Artifact (`phap_bao`) — already gated; `talisman_slot` — stays hidden.
- Formation UX redesign; `TranPhapPanel` internals.
- Foundation-era token income/balance retuning (balance phase owns).

## 7. Resolved at spec time

- **Feed is gated** — D4 says "Companion progression starts at TRÚC CƠ"; feeding is progression, so grandfathered companions can't be fed below Trúc Cơ either. Consistent with the wheel gate (roster panel unreachable anyway).
- **`duyenPhan` needs no separate gate** — only earned via pulls.
- **Roster panel hidden below Trúc Cơ even for grandfathered saves** — grandfathering preserves combat function, not management UI; acceptable per "no migration" + D3 visibility rule.
- **`chieu_hien_lenh` material definition stays** in `materials.ts` — Foundation+ sources still produce it.
