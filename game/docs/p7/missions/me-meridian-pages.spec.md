# M-E — Meridian Page Model — Spec

Status: v2 (post spec-review: fail-closed pin, page-unlock integrity invariant, page-order invariant)
Date: 2026-09-22
Depends on: master `9744dd53` (post-M-C)
Locked inputs: Mortal Chapter decision **D2** — Kinh Mạch/Bát Mạch becomes a per-realm **page** model: `unlockedPageRealmIndex <= currentRealmIndex`, pages never re-lock, a mortal page exists only if mortal meridian content is approved (none exists today).

---

## 1. Context and intent

The meridian chapter today is a single flat list of 9 Luyện Khí-paced meridians with no realm/page concept: `requiredRealmLevel 2→18` only paces investment *inside* qi_refining — the gate is `realmId === 'qi_refining'` scoped, so a mortal player actually SKIPS it and could invest if any caller reached the chapter (spec-time finding, §2 correction). The UI also renders the entire future page to a fresh mortal character. D2 wants the realm-page structure made explicit so future realms get their own meridian pages with monotonic, never-relocking unlock — and so the mortal chapter stops presenting qi_refining content as if it were current.

Non-goals: new meridian content, balance changes, the parked invest caller (M13), save-shape changes, `BodyRefinement` chapter changes (D1 is M-F).

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Data model | `MeridianDefinition` — flat 9-entry list, `requiredRealmLevel`, no realm/page field | `data/realm/Meridians.ts` |
| Chapter gate | `invest()` blocks only `realmId==='qi_refining' && realmLevel < requiredRealmLevel` — at mortal the check is skipped (returns... actually it invests! mortal CAN invest today — `realmId==='mortal'` skips the qi_refining pace check entirely) — see §3.1 correction below | `core/realm/body/MeridianChapter.ts` L59 |
| Sequence | strict-prefix `openedIds` — `next = MERIDIANS[openedIds.length]` | `MeridianChapter.ts` |
| UI | `MeridianSection` flat list; all 9 rows visible at mortal; status = opened/next/locked by index | `components/panels/realm/MeridianSection.vue` |
| Save | `bodyProgression.meridian.openedIds: string[]` — unchanged | save schema v72 |
| Invest caller | none — M13 PARKED, UI is read-only | `MeridianChapter.ts` header |

**Correction discovered at spec time:** the current invest gate does NOT block mortal investment — `realmId === 'qi_refining'` is false for mortal so the pace check is skipped and `invest()` would consume materials if a caller existed. The parked caller masks this today. The page model must make mortal investment structurally impossible (page locked), not just pace-blocked.

## 3. Target design

### 3.1 Data model — `pageRealmId`

`MeridianDefinition` gains `pageRealmId: string` — the realm that owns the page this meridian belongs to. All 9 existing meridians get `pageRealmId: 'qi_refining'`. Page identity = the realm id itself (one page per realm, derived grouping — no separate page table).

### 3.2 Page-unlock predicate (the D2 contract)

```ts
isMeridianPageUnlocked(player, pageRealmId) =
  playerIndex !== -1 && pageIndex !== -1 && playerIndex >= pageIndex
```

**Fail-closed contract (pinned):** if `getRealmIndex(player.realmId) === -1` OR `getRealmIndex(pageRealmId) === -1` → `false`. An unresolved page id (typo, retired realm) or an unresolved player realm is LOCKED, never silently open — `>=` alone would fail open for `pageIndex === -1`.

Monotonic by construction (realm index never decreases). A mortal player's index 0 < qi_refining's 1 → page locked. Foundation+ → page stays unlocked forever (never re-locks).

### 3.3 Chapter gate change

`invest()` blocks in order:
1. `!next` or insufficient `thongMachDanCost` → 0 (unchanged).
2. **Page locked**: `!isMeridianPageUnlocked(player, next.pageRealmId)` → 0 (new — makes mortal/future-realm-mismatch investment structurally impossible).
3. **Page pace**: `player.realmId === next.pageRealmId && player.realmLevel < next.requiredRealmLevel` → 0 (generalizes the current qi_refining-only check to the page's owning realm — same semantics, realm-keyed).
4. `requiresThienDiaChiKieu` aux check → 0 (unchanged).

Effect: at mortal, investing is impossible (page locked); at qi_refining, pace gate as today; at foundation+, page unlocked → sequence+aux only (lower-realm completability post-advance preserved).

### 3.4 UI — paged section

`MeridianSection` becomes paged:

- Derive pages from `MERIDIANS` grouped by `pageRealmId` (array order preserved → flat `openedIds` prefix semantics unchanged).
- Page tabs/headers show one row per derived page. A page whose `pageRealmId` is not yet unlocked renders as **locked-preview**: a page-level gate label ("mở khóa ở Luyện Khí" via existing realm-name i18n) + all rows `locked` (no `next` row — the sequential affordance belongs to an unlocked page).
- At mortal: the only page is qi_refining → locked-preview state (replaces today's "full list presented as current").
- At qi_refining: current behavior preserved (opened/next/locked rows).
- At foundation+: page unlocked; rows all `locked`/`next`/`opened` by sequence with no realm pace labels needed (pace gate doesn't apply cross-realm — the `requiredRealmLevel` label should only render while `player.realmId === page.pageRealmId`).

Row status semantics on an UNLOCKED page are unchanged (opened/next/locked-by-sequence). On a LOCKED page every row is `locked` and no cost/aux/gate line renders.

### 3.5 Save/integrity

`openedIds` stays a flat strict-prefix list — meridian ids are stable and page membership is derived, so **no save-shape change, no version bump**. `validatePersistedState` unchanged. `integrityIssues` gains one **cross-field invariant**: every opened meridian's `pageRealmId` must be unlocked at `player.realmId` — a payload like `mortal` + `openedIds=['nham_mach']` is a strict-prefix pass but semantically impossible (realm progression never decreases), and would otherwise emit `bat-mach:*` modifiers on a locked page after restore. No legitimate save can contain it (the invest gate makes it unreachable), so flagging it is safe.

### 3.6 Page-ordering authoring invariant

Flat `openedIds` + derived page grouping is only sound if `pageRealmId` is **non-decreasing by realm index** in canonical `MERIDIANS` order (each page a contiguous block; a closed page never reappears). `[qi, qi, foundation, qi]` would group into 2 pages but break the shared sequence/topology. Pinned as a data-authoring invariant with a test; `listMeridianPages` accepts a definitions param so a fabricated two-page array can characterize grouping without adding fake content to the catalog.

## 4. Files

| File | Why |
|---|---|
| `data/realm/Meridians.ts` | `pageRealmId` field + assignments |
| `core/realm/body/MeridianChapter.ts` | page-unlock + page-pace gates in `invest()` |
| `core/realm/body/MeridianPages.ts` (new, small) | `isMeridianPageUnlocked` + `listMeridianPages` derived grouping — the single predicate owner so UI/chapter share it |
| `components/panels/realm/MeridianSection.vue` | paged rendering + locked-page state |
| `MeridianChapter.test.ts` / `MeridianSection.test.ts` (or wherever section tests live) | gate + render tests |
| locales (vi/en as existing) | page lock label if a new key is needed |

## 5. Invariants → tests

1. `isMeridianPageUnlocked` is monotonic: mortal→locked, qi_refining→unlocked, foundation→unlocked, and it never re-locks across realm advance.
2. `invest` at mortal returns 0 even with sufficient materials (page locked — fixes the spec-time discovered gap where mortal investment was only masked by the parked caller).
3. `invest` at qi_refining below `requiredRealmLevel` returns 0; at/above returns cost (unchanged semantics).
4. `invest` at foundation+ invests if sequence+aux allow (lower-realm completability preserved).
5. Strict-prefix `openedIds` ordering unchanged; integrity additionally rejects opened meridians whose page is locked at the player's realm (§3.5).
6. Mortal UI renders the qi_refining page as locked-preview (no `next` row); qi_refining UI identical to today; cross-realm rows show no pace label.

## 6. Resolved at spec time

- **Mortal investment gap** — current gate only pace-blocks inside qi_refining; mortal investment was accidentally possible. The page model closes it structurally (finding recorded, fixed in-mission since it's the same coherent gate).
- **No mortal page** — no mortal meridian content exists; mortal renders the qi_refining page as locked-preview, not an empty state.
- **`openedIds` stays flat** — page membership is derived from definitions; no save migration (out of scope anyway).
- **`requiredRealmLevel` stays authored per-meridian** — it paces within the owning page's realm, not a global unlock.
