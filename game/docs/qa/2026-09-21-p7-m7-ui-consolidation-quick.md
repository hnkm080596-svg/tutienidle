# QA Report — P7-M7 Progression UI Consolidation (quick)

Date: 2026-09-21 · Mode: quick · Scope: M7 task-owned diff (panel topology consolidation: TechniqueBand/BodyRefinementSection/MeridianSection, retired TechniquePanel/LuyenThePanel/TechniqueCodex, wheel slot removal, i18n key relocation, `scripturePavilionTab` removal)

## Task-owned inputs

Staged diff minus docs/spec files. Excluded from review inputs: `docs/**` (spec/plan/system docs — reviewed separately for sync), deleted-file payloads (retired components; port targets reviewed instead).

## Risk-map result and bounding

Mapper: `deepAuditCandidate: true` ("cross-system change: 3 domains"), `unmappedPaths`: `useTechniqueSections.ts`, `commandWheelCatalog.ts`, `en.json`, `vi.json`, `panelIds.ts`.

**Stayed quick — risk confidently bounded by inspection:**
- No `GameSave` slice, version, or restore-path change; `standalonePanel`/`leftPanelMode`/`scripturePavilionTab` are transient session state — only `battleRunMode`/`combatInputMode` persist (ui.ts:192).
- No economy/progression transaction change: TechniqueBand delegates to the same `realmAdvanceOps.tryAdvanceTechniqueGrade` the retired panel used (verbatim port).
- No Phaser scene/lifecycle change; the `pinia-phaser-sync` domain hit is a heuristic on `stores/ui.ts`.
- Unmapped paths routed manually: `useTechniqueSections` (comment-only diff), `commandWheelCatalog` (slot entries vs `DongFuCommandWheel` consumers — verified), locales (729/729 key parity + relocated subtrees verified), `panelIds` (union members vs all writers/readers — verified).

## Invariant ledger

| ID | State/owner | Hypothesis | Invariant | Check | Result |
| --- | --- | --- | --- | --- | --- |
| INV-M7-1 | `ui.standalonePanel` / ui store | A writer still emits retired `'technique'`/`'luyen_the'` → dead panel id, silent no-op | Synchronization | Grep all `openStandalonePanel`/`standalonePanel =` writers | No retired-id writers; all live ids (`skill`, `realm`, `artifact`, `quan_khi`, `quest`, `tran_phap`, `companion`); `useTribulation` writes `'quan_khi'` only. Clean |
| INV-M7-2 | persisted ui flags | A dead panel id survives reload via persisted ui state | Recoverability | `persistAutomationFlags` persists only battle/combat-input flags | Panel ids transient; clean |
| INV-M7-3 | `scripturePavilionTab` removal | Leftover reader/writer or persisted tab state | Synchronization | Grep `scripturePavilionTab` + `panels.scripture.tabs` | Zero non-test references; state+action+type fully removed |
| INV-M7-4 | `mountedStandalone` (GameRoot) | Lazy mount set/template retains retired mounts | Lifecycle | Read GameRoot mount map + watch | Only live mounts; Set keyed by union type — retired ids un-addable |
| INV-M7-5 | i18n keys | `t()` calls reference relocated/removed keys (not compile-checked) | Synchronization | Enumerate every `panels.*` key in new/touched components vs both locales | 19/19 keys present vi+en; 729/729 parity; no stale `panels.technique.`/`panels.luyenThe.`/`panels.scripture.tabs.`/`skillPath.subtitle` references |
| INV-M7-6 | TechniqueBand upgrade | Repeated/rapid `upgradeGrade` click double-applies grade | Exactly-once | Port diff vs retired panel + disabled gating via `canUpgradeGrade`/`stateVersion` | Verbatim delegate to synchronous `tryAdvanceTechniqueGrade`; same semantics; live `Nâng Cảnh` button verified (leg7) |
| INV-M7-7 | body subviews | Sections mutate or bypass `BodyProgressionSystem` | Ownership | Read both sections | `BodyRefinementSection` reads via chapter fns only; `MeridianSection` uses `getBodyChapterProgress` — plus one direct `openedIds` membership read (see F-1) |
| INV-M7-8 | moved components | `loadout-sections` moves changed behavior | Equivalence | Diff moved files vs HEAD | `NodeTreePanel`/`SkillConnections` byte-identical; `TechniqueSlotCard` comment-only |
| INV-M7-9 | wheel topology | Removed slots break icon/label/catalog consumers | Recoverability | Catalog vs `DongFuCommandWheel` (`data-wheel-slot`, `wheelIconPath` derives from `slot.id`) | No orphan references; live wheel shows 14 slots, no retired entries (leg1) |
| INV-M7-10 | ScripturePavilion | Lore-only renders + left-panel route intact | Synchronization | `FunctionOverlayPanel` mode map + live leg | `mode === 'scripture_pavilion'` → panel; 0 tab buttons live (leg5) |

## Runtime evidence (P13/P14, same session)

30/30 checks green, 0 console errors: wheel slot topology (14 slots, no `technique`/`luyen_the`); mortal SkillPathPanel (`Phàm Nhân` + technique empty state); committed SkillPathPanel on staged v72 sword save (`Kiếm Tu`, `Ngự Kiếm Tâm Kinh`, `Cấp 4`, `Nâng Cảnh`); RealmPanel body sections + meridian rows; ScripturePavilion lore-only (0 tab buttons); wheel re-open closes standalone panel (closeHomeOverlays live); staged way+technique persisted round-trip. Bonus: a malformed staged save (missing `swordPath`) failed closed at login — v72 preflight works live.

## Findings

- **F-1 (Low, deferred):** `MeridianSection.vue:26` reads `player.$state.bodyProgression.meridian.openedIds` directly for per-row membership instead of deriving `opened` from `chapterProgress.completed` (`index < completed`). Semantically identical under the canonical prefix invariant (M5 integrity enforces openedIds = strict prefix); a display read, not a write or authority bypass. Safe to defer; noted for future consolidation if a chapter-scoped membership read is added.

## Verdict

**PASS WITH EVIDENCE** — zero confirmed defects; one Low deferred finding recorded. Deep escalation evaluated and documented above: materiality bounded (transient ui state only, verbatim port, no persistence/combat boundary crossed).
