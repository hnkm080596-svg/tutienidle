# Coordinator gate evidence — NON_INDEPENDENT (self-produced, SWE-2 cap pending)

Bound to frozen state productStateId=3bc7ead8733fe5e0c96336dc6c2334afee53318cabe66efd611d41e17d6e4e1f
(head e1161842, base 6d9af7a9). Same-context evidence; sealed independence pending dispatch.

| Gate | Command / method | Result |
|---|---|---|
| type-check | npm run type-check (vue-tsc --build) | exit 0 |
| unit suite | npx vitest run (full) | 7195 pass / 3 pre-existing env failures (dongFu magick ENOENT x2, SettingsPanel modal) — identical signatures on base 44abadfb |
| OCR (P18) | ocr delegate preview + rule over diff paths | 63 previewed / 48 reviewed / 15 skipped (qa journal); 1 Low (stale RPC overload) FIXED 527388a7 |
| e2e affected | npx playwright test — create-to-combat, accessibility, boot-fresh, save-reload, cultivation-path-ritual x6, presentation/system-ui/turn-combat/wave-vfx/ink-wash/etc | all green; 3 failures pre-existing on base (combat-idle-motion, standing-slot-panel, technique-frozen-warning) — identical signatures serial on base |
| P4 adversarial | tutienidle-adversarial-qa quick, manual routing (all unmappedPaths) | PASS WITH EVIDENCE — docs/qa/2026-09-23-beta-creation-quick.md; 8-invariant ledger; 1 Low deferred (pendingCreationPick never cleared, unreachable) |
| P5 sequential | 3 passes correctness→authority→integration | zero unresolved Medium+; pass blocks in same report |
| boundary matrix | GameManagerSaveRestore.boundary.test.ts v82 describe | 9 assertions incl. zero-mutation, all 4 rejections pinned |
| restore preflight vs shape | static: preflight runs inside restoreFromSave after shape layer; learned↔core-node correspondence at saveShapeValidation.ts:1100-1215 | channels 2+3 enforced |
| boot seam | static: pendingCreationPick consumed only inside onNewCharacter within bootGame(true); throw→grant-catch→boot.fail | fail-closed, stale pick unreachable |
| allocation census | rg CHARACTER_CREATION_ATTRIBUTE_POINTS|invalid_attributes|p_attributes|preferredBasicSkill across src/tests/supabase | zero live references |

Diff census (aggregate 6d9af7a9..e1161842): 72 files, +25853/-328 — production surface:
App.vue, CharacterCreationScreen.vue, EarlyGameBootstrap.ts, GameManagerSaveRestore.ts,
Player.ts, CharacterCreationService.ts, SupabaseCharacterCreationService.ts, saveVersion.ts,
GameSave.fixture.ts, TurnSkillDisplayMeta.ts, vi.json/en.json, migration 202608240001,
EarlyGameSession.ts + 2 economy profiles; rest = tests/fixtures/docs/qa journal.
