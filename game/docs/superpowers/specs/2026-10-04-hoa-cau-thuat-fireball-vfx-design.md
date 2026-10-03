# Hỏa Cầu Thuật Fireball VFX Design

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

The currently selected 17-frame shared attack clip at 8 fps has no impact marker, so `clipImpactMs` resolves at 2,062.5 ms. The 1.35–2.0625 s flight is therefore about 712.5 ms in this art configuration. The implementation must derive the deadline from the **actual played clip** (not hard-code 2,062.5 ms) and use the runner's existing impact ACK as the authoritative arrival boundary. If the clip or source texture is unavailable, fall back safely to the recipe clock; scale or suppress visual phases without delaying mechanical ACK. The game domain remains the only owner of hit/miss/damage facts. `castTime: 1.6` remains untouched; it is not used as a second visual clock.

## Presentation integration

A focused `HoaCauFireballPresentation` component owns only the four visual actors (portal, charge atlas, Fire 9, Fire 20), with `start`, `sample/update`, `resolve`, `cancel`, and `destroy` lifecycle operations. CombatScene admits it only for `hoa_cau_thuat`/`hoa_cau_comet`, after the existing cast admission and clip selection. It consumes source/target anchors and the played-clip impact deadline, but never applies damage or acknowledges impact itself. The generic `hoa_cau_comet` aura/burst visuals are suppressed for this skill so the new sequence is not doubled; other recipes remain unchanged. On battle end, stale playback token, target disappearance, profile rebind, or scene shutdown, retire all sprites and timers. Reduced-motion mode keeps the circle/core/projectile readable without spiral/pulse/flash intensity.

## Validation and acceptance

1. Arcadia JSON validates with `node tools/validate.mjs`; it opens in Arcadia and visibly shows inward motion and a compact final frame. RGBA export has transparent empty pixels, exactly declared cell dimensions/count, and reproducible frame output.
2. Structural asset tests verify portal and Fire 9/20 frame grids, occupied ranges, alpha, and atlas bounds. No empty padded cells play.
3. Unit/integration tests verify phase order, release timestamp, projectile spawn exactly after Tụ Hỏa, arrival at impact ACK, landed-only Fire 20, miss/cancel cleanup, and no duplicate generic preset visuals. The shared Pháp Tu character art stays untouched.
4. Type-check, build, focused tests, and an in-game combat playback review at gameplay scale must pass before claiming the full skill is visually complete. Asset validation or Arcadia preview alone is not production-scene proof.

## Exclusions

No new character cast animation, no new projectile painting, no Fire 20 redesign, no gameplay balance changes, no global VFX renderer rewrite, and no changes to other element pathways.
