# Hỏa Cầu Thuật Fireball VFX Design

> Runtime revision: the original short timeline below is superseded by the
> hand-hold/full-portal timeline at the end of this document.

## Status and scope

Approved direction: a skill-specific visual sequence for `hoa_cau_thuat`, using the supplied red MysticPortal sheets as the magic circle, an editable Arcadia Tụ Hỏa effect, the existing `火 (9)` sheet as the projectile, and the existing `火 (20)` sheet as the landed-hit explosion. This is presentation-only: damage, targeting, cast-time rules, the shared Pháp Tu character clips, and unrelated skills remain unchanged.

The current code does **not** wire these three asset families into Hỏa Cầu. `hoa_cau_comet` currently resolves to generic recipe primitives. The sheet metadata for Fire 9/20 declares 32 frames but only frames 0–26 contain pixels; frames 27–31 are empty. The portal sheet cells are 256×256: OPEN uses occupied frames 1–24 (frame 0 is intentionally empty), ACTIVE 0–51, CLOSE 0–14. `MysticPortal_Data.json` declares 0.8 s OPEN, 1.7 s ACTIVE, and 0.5 s CLOSE; its stated 60 fps does not equal the number of occupied cells divided by duration, so authored durations govern phase timing and frames are resampled across each phase.

## Ownership and assets

- The portal source PNGs are copied, unchanged and versioned, into `public/assets/vfx/hoa-cau-thuat/portal/` with a small Phaser frame manifest generated from measured grid cells. The copies do not replace assets in Downloads.
- Fire 9 and Fire 20 remain at `public/assets/vfx/spritesheets/火 (9).png` and `火 (20).png`, with their existing atlas JSON. Playback explicitly limits them to occupied frames 0–26; it does not overwrite those shared files.
- Arcadia remains an authoring tool outside the game at `E:\tutienidle-tools\arcadia-effects\Arcada Effects`. The new, stable-ID source is `library/Hoa Tu Charge.json`. A separate transparent RGBA export and Phaser playback metadata live under `public/assets/vfx/hoa-cau-thuat/charge/`. The game never loads Arcadia source JSON directly.
- The Tụ Hỏa effect contains only the charge-to-release transition: five red-orange wisps curve inward from around the portal, leave brief fluid trails, merge into a compact red→orange→yellow→white-hot core, compress, then make one compact release flash. No projectile, projectile trail, impact explosion, smoke cloud, text, or new magic circle is baked into that export. Use deterministic seeds, curved-path/force guidance, layered small/medium/core scales, and a 0.55 s export window.

## Runtime timeline and synchronization

Normal animated-player timeline, relative to the admitted `skill_presentation_cast` event:

| Time | Visual and owner |
|---|---|
| 0–0.80 s | Portal OPEN at the cast/magic-circle anchor; the existing shared Pháp Tu attack clip continues independently. |
| 0.80–1.35 s | Portal ACTIVE behind Arcadia Tụ Hỏa. Charge center is the portal center. |
| 1.35 s | Tụ Hỏa's last release-flash frame ends exactly as Fire 9 is spawned. Portal CLOSE begins and overlaps projectile travel. |
| 1.35 s–impact ACK | Fire 9 travels from the portal center to the declared target. The sprite rotates toward travel direction; optional short afterimage uses the same Fire 9 asset, not Tụ Hỏa frames. |
| impact ACK | Fire 9 retires. On a *landed* hit, Fire 20 plays once at the resolved target. Misses/blocked outcomes do not fabricate an explosion. |
| after ACK | Fire 20 finishes; no portal or charge layer remains. |

Implementation finding: the shipping impact-marker gate requires the newly added shared Pháp Tu attack and special cast clips to have authored markers. Frame inspection places the basic attack release at clip-local frame 10 (1,312.5 ms at 8 fps), and the special cast release at frame 12. The basic Hỏa Cầu timeline therefore keeps Tụ Hỏa at its full 550 ms, shortens portal OPEN to 612.5 ms, releases Fire 9 at 1,162.5 ms, and reserves 150 ms for travel before the 1,312.5 ms impact ACK. The nominal 0.8/0.55/0.7125 s example above applies only when a played clip actually has a 2,062.5 ms deadline. The implementation derives all boundaries from the **actual played clip**, not a hard-coded duration. If the clip or source texture is unavailable, it falls back safely to the recipe clock without delaying mechanical ACK. The game domain remains the only owner of hit/miss/damage facts. `castTime: 1.6` remains untouched; it is not used as a second visual clock.

## Presentation integration

A focused `HoaCauFireballPresentation` component owns only the four visual actors (portal, charge atlas, Fire 9, Fire 20), with `start`, `sample/update`, `resolve`, `cancel`, and `destroy` lifecycle operations. CombatScene admits it only for `hoa_cau_thuat`/`hoa_cau_comet`, after the existing cast admission and clip selection. It consumes source/target anchors and the played-clip impact deadline, but never applies damage or acknowledges impact itself. The generic `hoa_cau_comet` aura/burst visuals are suppressed for this skill so the new sequence is not doubled; other recipes remain unchanged. On battle end, stale playback token, target disappearance, profile rebind, or scene shutdown, retire all sprites and timers. Reduced-motion mode keeps the circle/core/projectile readable without spiral/pulse/flash intensity.

## Validation and acceptance

1. Arcadia JSON validates with `node tools/validate.mjs`; it opens in Arcadia and visibly shows inward motion and a compact final frame. RGBA export has transparent empty pixels, exactly declared cell dimensions/count, and reproducible frame output.
2. Structural asset tests verify portal and Fire 9/20 frame grids, occupied ranges, alpha, and atlas bounds. No empty padded cells play.
3. Unit/integration tests verify phase order, release timestamp, projectile spawn exactly after Tụ Hỏa, arrival at impact ACK, landed-only Fire 20, miss/cancel cleanup, and no duplicate generic preset visuals. The shared Pháp Tu character art stays untouched.
4. Type-check, build, focused tests, and an in-game combat playback review at gameplay scale must pass before claiming the full skill is visually complete. Asset validation or Arcadia preview alone is not production-scene proof.

## Exclusions

No new character cast animation, no new projectile painting, no Fire 20 redesign, no gameplay balance changes, no global VFX renderer rewrite, and no changes to other element pathways.

## Runtime revision: full portal cycle and hand hold

- 0–625 ms: raise the hand to the existing shared Pháp Tu atlas frame 12; no portal yet.
- 625–1425 ms: show all occupied OPEN frames 1–24, offset 24 px in front of the palm.
- 1425–3125 ms: show all ACTIVE frames 0–51 and retime the Arcadia charge across the same 1700 ms. The compact charge sits a further 48 px in front of the circle.
- 3125 ms: end charge, launch the existing Fire 9 horizontally, and start CLOSE.
- 3125–3625 ms: show all CLOSE frames 0–14 while Fire 9 travels. Keep the palm pose held.
- 3687.5 ms: Fire 9 reaches the target and the presentation ACK occurs. Only a landed receipt shows the existing Fire 20 at that same height. The character lowers the hand after CLOSE.

The Fireball-only clip reuses the original Pháp Tu frames in a 34-frame playback sequence; frame 12 is repeated through clip index 29, and the existing lowering frames follow. Shared basic/special cast markers and gameplay damage rules are unchanged. The source Arcadia charge stays editable at 550 ms; its exported 18 frames are retimed over ACTIVE in Phaser.

Pixel comparison measured the two raw cross-sheet edge jumps at about 0.06 mean alpha difference, versus about 0.009–0.010 for ordinary neighboring frames. A complete pair scan found no near-identical edge frame; skipping to the closest would discard large parts of the 0.8/1.7/0.5 s cycle. Runtime uses exactly the prior phase's final frame as a 180 ms opacity bridge while the next phase begins. No source art is changed.
