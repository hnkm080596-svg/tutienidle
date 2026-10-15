# character-art-infra — Spec

Status: IMPLEMENTED (wave scaffold; mapping table is the live seam)
Date: 2026-09-28
Depends on: enemy-art-wave1 (per-entity animated override, reskin registry pattern)

## 1. Goal

Wire the NEWSPRITE **character** dump (`Assets/Resources/assets/character/`)
into combat the same way wave-1 wired monsters: authored atlas clips instead
of static PNGs — for the **player** now, and for **companions** later, without
another architecture change. The user supplies the per-entity art assignment;
this wave builds the machine and binds the one placeholder set that exists
today (`zuofeng`).

Player ruling (2026-09-28): every current visual profile
(`mortal`, `phap_tu`, `kiem_tu`, `the_tu` — the six in-progress player sets
share the same pipeline) binds `zuofeng` as placeholder until the user drops
the real per-profile art. Companion binding is intentionally EMPTY — the user
assigns companion art when the new sets land.

## 2. Source dump inventory

`character/` holds 10 animated characters + 2 NPC (`npc/official`,
`npc/scout` — flat PNGs, no anim; out of scope this wave).

Per character:

- `anim/<slug>-idle/` 7-25 frames, `anim/<slug>-attack/` 11-18,
  `anim/<slug>-ult/` 14-23 — canvas varies per character (624² and larger)
- `anim/death/` — only 5 of 10 have it (gaosheng, qingshuangzi, youzhu,
  yuejianxin, zuofeng); the rest synthesize death in the packer
- `avatar/` — role PNGs: roster / battle-card / battle-status / action-bar +
  a bare `<slug>.png`
- `portrait/` — full-body, half-body, queue
- `closeup/`, `radar-chart/` — present on ~6 characters
- zuofeng extra: `anim/zuofeng-attack-white-black-no-sword/` — an alternate
  swordless attack set; packed pipeline ignores it (no binding yet)

## 3. Decisions (D)

- **D1 — same reskin amendment as enemies.** `CharacterArt.ts` is the one
  registry: `CHARACTER_ART` (slug -> clips + avatar), `CHARACTER_RESKIN_MAP`
  (profile id -> slug), `ANIMATED_CHARACTER_KEYS`. Catalogue registration,
  per-entity animated override, atlas-miss avatar fallback, and the
  preload/bundle enumeration mirror `MonsterArt` 1:1.
- **D2 — resolution by PROFILE ID, not texture key.** The player's combat
  entity key is `profile.combatTextureKey` today; the reskin intercepts at
  `playerProfile.id` (`resolveCharacterArtSlug(profileId)`) — the same level
  the user's art assignment is expressed in.
- **D3 — `ult` enters the clip union as OPTIONAL, like `attack`.** The dump
  has authored ultimate sequences; the contract (CombatAnimationName,
  CombatAnimationCatalogue) gains `ult`, play-once, destination `standby`.
- **D4 — ult fires on slot role, not a guess.** `turn_cast_start` carries
  `slotRole` (`'basic' | 'special' | 'ultimate'`, derived in the engine from
  `declared.action.slot === actor.ultimate|special`). The renderer plays
  `ult` for ultimate casts, `attack` otherwise; catalogue-less entities
  no-op as before.
- **D5 — pack all 10, wire 1.** `pack-character-art.mjs` emits every
  character (sheets + atlas + avatar + staged avatar-roles/portraits/
  closeups/radar) into `public/assets/characters/animated/` with one
  manifest — every slug is addressable for future bindings without
  re-running the packer. Only `zuofeng` is registered + loaded.
- **D6 — death synthesized where missing** (last attack frame darkened 55%),
  identical to the enemy packer.
- **D7 — scale per emission.** Characters whose uniform-grid capacity
  overflows 4096² sheets are emitted at `scale: 0.75` (gaosheng, jinglian,
  qingshuangzi, weiqi, xuandao, youzhu, yuejianxin, ziyuan); zuofeng and
  fenli pack at full resolution.
- **D8 — idle-union feet anchor**, identical to wave-1: emitted `sourceSize`
  is the idle clip's union bbox so runtime `setOrigin(0.5,1)` plants feet.

## 4. Contract amendments

- `CombatAnimationName` += `'ult'` (documented optional, like `attack`).
- `CombatAnimationCatalogue` += `ult?: AtlasClip`.
- `TRANSITION_DESTINATION` += `ult -> standby`.
- `CombatScenePayload` += `slotRole?: string`; `emitTurnCastStart` emits it.
- `CombatGridViewHost.playerProfile` narrows to `{ id, combatTextureKey }`
  (CombatScene + TranPhap preview both satisfy it).
- `combat-action-feedback.onAttack` picks `ult` vs `attack` by slotRole.

## 5. Out of scope / non-goals

- Companion bindings (empty map rows pending user assignment).
- NPC art (`official`, `scout`), closeup/radar-chart consumers, avatar-role
  consumers (all files STAGED on disk under the variant dir for future UI
  waves).
- Character SFX (the dump has none under `character/`; enemy-sfx dirs are
  per-monster).
- Per-skill clips, `idle_to_standby`/`standby_to_idle` transitions (dump has
  none; playback snaps as designed).
- Recolored character variants (recipe exists in the packer; no need yet).

## 6. Load-surface note

`animatedCombatEntities()` enumeration drives both preload and the combat
bundle — registered character slugs load their sheets automatically; the 9
unwired packed characters sit on disk only (~94MB total for 10 variants,
~18MB loaded for zuofeng). Profile PNGs still load: the static form stays
reachable and other scenes consume them.
