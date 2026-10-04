# Huyen Kim Son Thuy — Phase 3: Core Progression Screens

Worker audit + plan (AUDIT -> PLAN -> IMPLEMENT). Spec: `TuTienIdle_UI_UX_Redesign_HuyenKimSonThuy_FinalSpec.md`
(SS8.2 Study Mode, SS9 motion architecture, SS15 Character, SS16 Realm, SS17 breakthrough CTA, SS18 Technique,
SS19 Skill Path, SS20 Body Progression, SS44/45 modal+shared components, SS46-48 interaction/semantic states).

Worktree: `.agent-worktrees/huyen-kim-progression`, branch `devin/<ts>-huyen-kim-progression`, base
`origin/devin/huyen-kim-redesign` (Phase-0 tokens merged; Phase-1 primitives PR #78 NOT yet merged —
consumed via unchanged public props/events only; Phase-2 PR #79 files untouched — separate lane).

## G0 task card

- Task: reskin + compose the core progression screens onto the Study Mode template (1 Hero Subject +
  1 Information Rail + 1 Action Rail), using `--hk-*` semantic tokens and existing primitives
  (GameButton / OverlayPanel / Chip / Bar / SlotView / InkNineSlice). Reskin + composition only —
  no gameplay state authority changes, no prop/event/slot signature changes, no save migration.
- Requested observable behavior:
  - Character (drawer, SS15 Dao The): hero block = large portrait on an element disc halo; talents
    render as compact seal chips (hover detail), not scroll cards; actions gather on a bottom rail.
  - Realm (SS16 Thien Lo): realm milestones render as a vertical ascending path, not a flat card
    grid — current = jade marker + player seal, next/available = gold trace, completed = restrained
    jade+gold, locked/coming-soon = ink. Hidden progression stays hidden (SS16.1) — unchanged gating.
    Breakthrough stays the dominant CTA on the action rail (SS17).
  - Technique (SS18 Dao Quyen): hero technique sits inside a 10-rune rank ring (lit = rank), grade
    carried by a seal-tier chip; mastery bar demoted to supporting data.
  - Skill Path (SS19 Dao Mach): node states per SS47-48 — locked = ink silhouette, available = gold
    rim, learned = jade fill, upgradeable = breathing light, selected = strong jade + restrained gold.
    Requirement text stays off the graph (inspector/tooltip owns it).
  - Body Progression (SS20 Dao The / Kinh Mach): chapter nav left, body silhouette + meridian center,
    active chapter (cost/requirement/gains) right; invest lands a node-ignition -> body-glow feedback.
  - CharacterCreation: shared chrome already (InkNineSlice scroll) — selection/interaction accents
    move to hk semantics (selected = jade+gold edge, focus = gold, not cinnabar).
- Single responsibility: L8 screen-space reskin/composition of the six progression surfaces.
- Current owners: `CharacterPanel.vue` (drawer), `RealmPanel.vue` (+ `realm/*Section.vue`),
  `SkillPathPanel.vue` (+ `skill-path/*`), `CharacterCreationScreen.vue`,
  `BreakthroughRequirementPanel.vue` (ceremony modal — preserved).
- Target owners: same files + one new presentational fragment `TechniqueRuneRing.vue`.
- Existing primitives to reuse: `--hk-*` tokens + `.hk-state-*`/`hk-attention`/`hk-breath` (Phase-0),
  `GameButton`, `OverlayPanel`, `Chip`, `Bar`, `SlotView`, `InkNineSlice`, `Eyebrow`, `SysTag`,
  `EmptyState`, `PlayerPortrait`, existing element disc / meridian figure / formation ring art.
- Missing capability: rune-ring + milestone-path + ignition visuals — CSS/SVG only, no new systems.
- Non-goals: Phase-1 primitive internals, Phase-2 top-bar/rail/wheel, combat HUD, tribulation scene,
  new art assets (chrome manifest slots stay 'pending' -> CSS fallback), gameplay logic.

## Audit: current vs target

| Surface | Current | Target (spec) | Plan |
|---|---|---|---|
| CharacterPanel | Compact 112px portrait header; talents = large scroll cards (196x335); details/QuanKhi buttons scattered in headers | SS15 + SS8.2: hero = large portrait + element disc halo + aura; talent = compact seal chip + hover detail; bottom action rail | Hero block restyle (portrait ~168px on `el-*` disc of the chosen way element, formation ring fallback); `.talent-block` -> `.talent-seal` compact chip (SysTag rarity + name, description -> v-tooltip); new `__action-rail` footer holds details toggle + Quan Khi + points chip |
| RealmPanel | Column stack: cultivator, bar, actions, flat 9-card node grid (`.realm-node` flex grid + `::after` dashes), passives, 3 body columns | SS16 Thien Lo vertical path + SS8.2 rails | Nodes -> vertical serpentine path (alternating offsets, gradient connector spine, cloud cap); add `is-next` (first unlockTier > currentTier && !comingSoon) = gold trace; states -> hk colors; layout -> hero(path) + info rail(cultivation/reqs/passives) + action rail(CTA + reqs summary stays beside CTA) |
| Body sections | 3 flat columns side-by-side; rows opacity-only state | SS20: left chapter nav, center silhouette, right cost/gains; ignition feedback | `realm-panel__body` -> grid: nav chips (chapter + lock/progress) | silhouette (`stat-meridian-figure.png`, ignition glow) | active chapter column. Sections unchanged API; each watches its own `completed` to add `.is-ignited` on the row that just landed (~1.4s jade->gold pulse) |
| SkillPathPanel | 3-col + TechniqueBand top + NodeInspector bottom — already near Study Mode | Same shape, hk-token reskin; element/mode tabs -> semantic chip styling | Keep structure; restyle tabs/rails to `--hk-*`; TechniqueBand hero gets rune ring |
| TechniqueSlotCard | Icon + name + tier badge + mastery bar | SS18: 10 runes around technique, grade = seal tier/frame | `TechniqueRuneRing.vue` (SVG, 10 dots, lit = `technique.rank`, `aria-hidden` + text rank stays); grade chip -> seal-tinted border by tier |
| NodeTreePanel | Node cards: purchased = branch-color tint, locked = opacity .5, selected = outline | SS19/47: 5 semantic states | Add `is-available`/`is-upgradable` classes; restyle to locked=ink desat, available=gold rim, purchased=jade fill, upgradable=`hk-breath`-style slow pulse, selected=jade+gold edge; connections locked -> ink subdued, active -> jade |
| CharacterCreation | Paper scroll + cinnabar select accents | shared chrome + hk semantics | Selected -> jade wash + gold edge; focus/kicker accents -> hk gold/jade; structure untouched |
| BreakthroughRequirementPanel | Small confirm modal | SS17 dominant CTA context | Preserved (Phase-1 reskins OverlayPanel); no edit |
| Hidden progression | gated by `record.discovered` / `revealWhen` / `HIDDEN_BRANCH_TAGS` | SS16.1: invisible until discovered | No change — audit-verified already correct |

## Files

Create:
- `src/components/panels/skill-path/TechniqueRuneRing.vue` — SVG 10-dot ring; props `lit:number`,
  `size`; aria-hidden (rank text stays rendered beside it).
- `src/components/panels/realm/BodyChapterNav.vue` — chapter chips (id/label/progress/locked) for the
  SS20 left rail; emits `select`.
- Tests: `src/components/panels/skill-path/TechniqueRuneRing.test.ts`, extend
  `RealmBodySections.test.ts`-adjacent coverage only if needed (sections mount standalone).

Modify:
- `src/components/panels/CharacterPanel.vue` — hero (portrait on element disc), talent seals,
  action rail; keeps `.meridian__*`/`element-*` hooks verbatim (tests pin them).
- `src/components/panels/RealmPanel.vue` — Study Mode grid; Thien Lo path restyle; body chapter
  composition; keeps `.realm-panel__actions`, `.realm-requirement(s)`, `.realm-node*` hooks.
- `src/components/panels/realm/{BodyRefinement,Meridian,ZhouTian}Section.vue` — state colors to hk
  semantics + `is-ignited` pulse on the row that just completed (watch `chapterProgress.completed`).
- `src/components/panels/SkillPathPanel.vue` — rail/section reskin tokens; tab styling.
- `src/components/panels/skill-path/NodeTreePanel.vue` — node state classes + hk restyle.
- `src/components/panels/skill-path/SkillConnections.vue` — ink/jade/gold path colors.
- `src/components/panels/skill-path/{SkillPathList,SkillRoleStrip,NodeInspector,TechniqueSlotCard,
  TechniqueBand,SkillDetailView,NativeCoreDetail}.vue` — token-level reskin where still on legacy vars.
- `src/components/onboarding/CharacterCreationScreen.vue` — selection/focus accents to hk semantics.
- `src/locales/{vi,en}.json` — few new keys (realm `nodes.next`, body chapter nav labels,
  rune ring aria). P16: UI copy stays localized; comments ASCII (P15).

## G1 — Q1-Q12 evidence

- Q1 observable: listed above; failure = same content, plainer skin (no dead affordances).
- Q2 owner: composition/CSS lives in the panel files themselves; no new state owners.
- Q3 state: only component-local `ref`s (active body chapter, ignition timers); no store/save writes.
- Q4 chain: unchanged — panels still read `player`, `gameManager.*Ops`, ui store.
- Q5 reuse: `--hk-*`, `hk-breath`, `.hk-state-*`, GameButton/Chip/Bar/SlotView/InkNineSlice/Eyebrow/
  SysTag, `PlayerPortrait`, existing `el-*` disc + `stat-meridian-figure.png` art.
- Q6 deps: panels -> core read-models only; TechniqueRuneRing is leaf-presentational.
- Q7 separation: invest/breakthrough/allocate calls unchanged — same ops functions on click.
- Q8 consumers: RealmPanel body children = the three sections (only consumer); TechniqueSlotCard
  consumer = TechniqueBand (hero) — `size` prop preserved.
- Q9 queries: all reads already exist (`getBodyChapterProgress`, `isBodyChapterUnlocked`, tier maps).
- Q10 duplicate/interrupt: ignition timers cleared `onBeforeUnmount`; watchers bound to computed
  keys; repeated invests re-trigger via seq counter (same pattern as `unlockTrigger`).
- Q11 regressions: pinned DOM hooks enumerated per file (`.realm-node`, `.node-tree__node`,
  `.meridian__node[data-stat]`, `.technique-band*`, `.zhou-tian-section__*` etc.) — preserved.
- Q12 i18n: new copy via `t()` keys in vi+en; no literals (P16). Comments ASCII-only (P15).

## Risks

- jsdom tests asserting old classes -> mitigated by keeping every asserted selector verbatim.
- Rune ring positioned absolute around SlotView -> overflow/layout inside TechniqueBand hero (fixed
  box, contain overflow).
- Serpentine path in RealmPanel must keep `.realm-node` classes and fit 10 nodes in the card
  viewport -> compact rows, path ~ 44px nodes, internal scroll preserved.
- Body chapter nav: sections mount standalone in tests, so nav lives in RealmPanel only; hidden
  rows stay inside sections (untouched gates).
- PR #78 merges later: my styles sit on scoped composition classes + `--hk-*` vars — no conflict
  with primitive internals; possible cosmetic double-skinning reviewed at merge time.
