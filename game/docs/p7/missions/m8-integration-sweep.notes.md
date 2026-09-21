# P7-M8 — Mission notes (integration sweep + final validation)

## G0 — Task card

- **Authorized outcome:** final integration sweep for the P7 phase — save-version decision, dead-authority sweep, docs synchronization, full verification, adversarial QA, P5 sequential review, merge gate.
- **Owner:** the phase itself — no new runtime authority; M8 is evidence, not code.
- **Stop condition:** sweep evidence recorded, docs synced, `npm run verify` green on the final state, merge to `master`.

## Save-version decision — NO bump (v72 stands)

Accumulated cuts: v68 (M1 identity spine) → v69 (M2 realm-passive ownership) → v70 (M3 canonical technique) → v71 (M4 role contract) → v72 (M5 body progression). M6 added `player.techniqueProgress` — an **optional derived mirror** republished by `TechniqueSystem` on restore (absent is legal; no reader requires persistence). M7 changed no persisted state (panel topology + transient ui store only). Every save ≤ v71 is already rejected by the v72 boundary; no new persisted-shape requirement exists to distinguish. Convention preserved: version rejection, no translators.

## Dead-authority sweep — clean

| Retired surface | Result |
|---|---|
| `tu_linh_quyet` / Tụ Linh Quyết (locked removal) | Zero live refs — only removal-proofing comments + a gating test asserting it can never resolve as a drop |
| `passiveSkillIdsByRealm`, `innateSkillId` | Zero refs |
| `learnByDrop`, `equipTechnique`, `unequipSkillIds` | Zero refs |
| `loadoutSlot(s)` (skill save fields) | Only `RETIRED_SKILL_ENTRY_KEYS` — the intentional fail-closed rejection list |
| `openedMeridianIds`, `luyenTheTiers` (flat body fields) | Zero refs |
| `scripturePavilionTab`, `TechniquePanel`, `LuyenThePanel`, `TechniqueCodex` | Zero refs (RealmPanel comment is provenance-only) |
| `standalonePanel` retired ids (`technique`, `luyen_the`) | No writer can emit them (union type + catalog-driven); all writers use live ids |
| Pre-M1 identity values (`kiem_tu`/`phap_tu`/`the_tu` as path/way ids) | Zero as path/way ids; surviving strings are leaf namespaces outside M1 scope (node-tree `branchTag`s, `PlayerVisualProfileId`, buff/talent ids) — mission-graph non-goal |
| `TuLinhTranBalance` | Untouched per M1 plan whitelist — separate economy system, unrelated to `tu_linh_quyet` |
| Orphaned wheel icons | `wheelIconPath` derives from `slot.id` — removed slots never fetch; no orphan references |

## Docs synchronization

- `docs/roadmap.md` — new `# Phase P7 — Progression Consolidation` section (mission ledger + canonical progression statement).
- `docs/naming-conventions.md` — N2 family-map amendment: path/way/technique identity = mechanic family → English (D6); `phap_tu/kiem_tu` grandfathering rescinded.
- `docs/p7/mission-graph.md` — completion ledger appended (M1–M8).
- `docs/systems/{body-refinement,techniques,ui-and-i18n}.md`, `docs/ui-components.md` — synced in M7.

## Gates

- P3: `npm run verify` green on the M7 final state (719 files / 6337 tests + 5 expected-fail; type-check + build clean). M8's own delta is docs-only.
- P18 OCR (M7 diff): 27/27 reviewable files, zero Medium+.
- P13/P14 (M7, worktree dev server :5917): 30/30 legs, 0 console errors — wheel topology, mortal + committed SkillPathPanel, RealmPanel body sections, lore-only Scripture Pavilion, overlay exclusion, staged-save round-trip. Bonus live evidence: malformed staged save (missing `swordPath`) failed closed at login.
- P4 QA (M7): `docs/qa/2026-09-21-p7-m7-ui-consolidation-quick.md` — PASS WITH EVIDENCE, zero confirmed defects, one Low deferred (`MeridianSection` direct `openedIds` display read — equivalent under prefix invariant).
- P5 sequential (M7): 3 passes, zero unresolved Medium+.
- External review bridge: unavailable since M7 (SEND_FAILED — page-side send verification broken; doctor-healthy infra). Documented; not an AGENTS.md hard gate.
