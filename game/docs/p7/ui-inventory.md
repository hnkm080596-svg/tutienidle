# P7 — UI / Navigation Inventory

Read-only census of progression-facing surfaces and how the player reaches them. `StandalonePanel` union: `presentation/contracts/panelIds.ts` L37. Wheel layout: `data/ui/commandWheelCatalog.ts`.

## Navigation map today

```
DongFuCommandWheel (4 rings)
├─ Ring 1  Nhân Vật → left_panel 'character'   (CharacterPanel)
│          Cảnh Giới → standalone 'realm'      (RealmPanel)
│          Kỹ Năng   → standalone 'skill'      (SkillPathPanel)
│          Tâm Pháp  → standalone 'technique'  (TechniquePanel)
├─ Ring 2  Luyện Thể → standalone 'luyen_the'  (LuyenThePanel)
│          Nhiệm Vụ  → standalone 'quest'
│          Pháp Bảo  → standalone 'artifact'   (gate: Trúc Cơ + way def)
│          Phù       → future (NEVER_AVAILABLE)
│          Trận      → standalone 'tran_phap'
│          Đồng Đội  → standalone 'companion'
├─ Ring 3  buildings: teleport_array, pill_room, gathering_outpost,
│          chi_hien_quan, equipment_hall
└─ Ring 4  Tàng Kinh Các → left_panel 'scripture_pavilion'
           Cài Đặt       → left_panel 'settings'

Hidden entries:
  Quán Khí → standalone 'quan_khi', opened ONLY from CharacterPanel
             button, ONLY for kiem_tu ways (route switch machinery)
```

## Progression surfaces — what each shows/does

| Surface | File | Content | P7 relevance |
|---|---|---|---|
| CharacterPanel | `components/panels/CharacterPanel.vue` | Portrait+aura, realm name, main-stat allocation (+points), talents, chosen-kit line, Quán Khí button (kiem only). | KEEP — character identity surface. |
| RealmPanel | `components/panels/RealmPanel.vue` | Cultivation bar, major-breakthrough button, realm passive nodes. | KEEP candidate; may absorb cultivation chapter UI. |
| SkillPathPanel | `components/panels/SkillPathPanel.vue` | 3 cols: SkillPathList (all learned actives) | center: NodeTreePanel or SkillDetailView | right: SkillLoadoutStrip; NodeInspector bottom. Way-strict tree selection. | Central P7 surface — loadout column, technique absence, tree hosting all open. |
| SkillLoadoutStrip | `panels/skill-path/SkillLoadoutStrip.vue` | 5 realm-gated slots + specialization chips + RadialSkillSelector. Shows mortal fallback text when 0 slots. | Combat-inert post-path (see inventory F1). RETIRE/REPLACE candidate. |
| TechniquePanel | `panels/TechniquePanel.vue` | Equipped technique hero + sections (via `useTechniqueSections`); comments already say equip is automatic by profession. | REPLACE candidate — fold into SkillPath/Progression hub or become way-technique view. |
| TechniqueSlotCard | `panels/loadout-sections/TechniqueSlotCard.vue` | Reused card: TechniquePanel + TechniqueCodex. | Follows technique decision. |
| TechniqueCodex | `panels/scripture/TechniqueCodex.vue` | Catalog of ALL TECHNIQUES (owned bright, unowned '???'), paginated grid + hero card. | RETIRE candidate — no technique library under canonical model. Scripture pavilion keeps Lore tab. |
| LuyenThePanel | `panels/LuyenThePanel.vue` | Read-only 6-tier progress list (Tinh Hoa auto-invest). | REPLACE candidate — does not scale to multi-chapter body progression. |
| QuanKhiPanel | `panels/QuanKhiPanel.vue` | Kiếm Tu route-switch ritual UI. | KEEP — kiem machinery, entry stays in CharacterPanel. |
| ScripturePavilion | `panels/ScripturePavilionPanel.vue` | Tabs: Công Pháp (TechniqueCodex) + Lore. | Technique tab likely dies → pavilion becomes lore-only or tab set changes. |
| StageSelectPanel | left_panel 'stage_select' | Stage picker. | Orthogonal KEEP. |
| TurnCombatSkillBar | `game/combat/hud/TurnCombatSkillBar.vue` | Fixed basic/special/ultimate buttons + dynamic-basic (orb picker) + emblem slot. | Already canonical role contract in UI — the model other surfaces should mirror. |

## Observed incoherence (evidence for notices)

1. **Progression is fragmented across 5 standalone panels** (realm/skill/technique/luyen_the/quan_khi) + 1 left panel (scripture codex). No single place answers "where am I in progression".
2. **The skill panel's right column is a loadout combat ignores post-path** — equipping a node-unlocked active skill into a slot does nothing. UI promises authority that doesn't exist (inventory F1).
3. **Technique occupies a Ring-1 slot** equal to Realm/Skill while being (a) auto-equipped, (b) possibly redundant with way identity, (c) duplicated by the codex surface.
4. **Body progression is a Ring-2 read-only list** with no interaction — fine for auto-invest, but the model caps at mortal; the UI has no concept of chapters.
5. **RealmPanel owns the only breakthrough button** while initiation (the most consequential breakthrough) lives elsewhere entirely (ritual flow via useBreakthrough/useTribulation + CharacterPanel gates).
6. **Mortal players see**: CharacterPanel + RealmPanel + SkillPathPanel (list+detail+dead loadout) + LuyenThePanel + Scripture — i.e. the *largest* panel count with the *least* content, and a Technique panel that shows `tu_linh_quyet` which is scheduled to die.

## Information architecture options (for the human decision)

- **A — Status quo + removals.** Keep 5-panel layout; delete technique panel/codex, strip loadout column for path players. Smallest UI delta; keeps fragmenting progression.
- **B — Consolidated Progression hub.** One standalone panel ("Tu Hành"/"Progression") with sections: Realm chapter (cultivation+breakthrough), Way identity, Technique progression, Node tree, Body chapters. CharacterPanel keeps attributes/identity; wheel Ring 1 shrinks to Nhân Vật + Tu Hành (+ Kỹ Năng if kept separate). Matches the "single authority per concern" mental model; largest UI build cost.
- **C — Hybrid.** Keep Realm + SkillPath as the two progression panels; fold Technique card into SkillPathPanel (it's way-owned), fold body chapters into RealmPanel (they are realm-scale progression). Medium delta; kills the 5-way split without inventing a new hub.

Recommendation: C — lowest-risk consolidation that resolves F1/F3/F4/F6 without a new navigation paradigm.

**DECIDED (D5, 2026-09-21): Option C + lore-only pavilion.** SkillPathPanel owns way identity + canonical technique card + node tree + resolved combat-role progression. RealmPanel owns realm progression + unified BodyProgression chapters as subviews. Standalone `TechniquePanel`, `LuyenThePanel`, and all generic loadout UI are removed. Scripture Pavilion loses the Công Pháp tab — lore/reference only, never a second authoritative technique mirror.
