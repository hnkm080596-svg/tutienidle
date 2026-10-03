# Huyền Kim Sơn Thủy — Reference Image Package

AI-generated composition references for the forensic UI specification.
**Reference only — NOT gameplay truth.** Functional authority is the repository +
canonical contracts (`frontend-contract.md`, `huyen-kim-chrome-art-spec.md`,
`huyen-kim-component-state-matrix.md`). See `huyen-kim-reference-audit.md` for the
per-block classification (EXACT / CORRECTED / FUTURE_IMPLEMENTED / RESERVED / INVALID).

## Scene files (`scenes/`)

| file | scene | shell |
|---|---|---|
| 01-login.jpg | Login | world |
| 02-character-creation.jpg | Character Creation | world |
| 03-dong-fu.jpg | Động Phủ (home) | world |
| 04-character.jpg | Character | imperial-scroll |
| 05-realm.jpg | Realm | imperial-scroll |
| 06-technique.jpg | Technique | imperial-scroll |
| 07-skill.jpg | Skill | imperial-scroll |
| 08-body.jpg | Body (Luyện Thể→Chu Thiên) | imperial-scroll |
| 09-exploration.jpg | Exploration / Sơn Hà Đồ | imperial-scroll |
| 10-combat.jpg | Combat | world |
| 11-alchemy.jpg | Alchemy | imperial-scroll |
| 12-equipment.jpg | Equipment / Khí Đường | imperial-scroll |
| 13-tribulation.jpg | Tribulation | world |
| 14-victory.jpg | Victory | ceremonial-scroll |
| 15-defeat.jpg | Defeat | ceremonial-scroll |
| 16-settings.jpg | Settings | imperial-scroll |
| 17-quest.jpg | Quest | imperial-scroll |

## Notes

- **Inventory intentionally has NO standalone reference.** Its grammar derives from
  Equipment (12-equipment) — shared slot/tab/filter/detail components + the forensic
  spec. Do not add an 18th scene file.
- Three composite overview sheets exist in the source set but are not scene
  references; they are omitted here (duplicated coverage).
- Images are JPEG as supplied; do not recompress or edit.
- Manifest: `reference-manifest.json` (machine form of the table above).
