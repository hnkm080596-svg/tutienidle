import type { CombatVfxPresetId } from '../../core/battle/CombatAction'

// Monster attack VFX sweep (2026-10-04) - the VfxAssetManifest seam the
// three-path content design doc (docs/design/2026-09-24, section 2.b)
// described: binds a CombatVfxPresetId to a spritesheet atlas - either a
// shared-library sheet (public/assets/vfx/spritesheets/) or an authored
// Arcadia export (public/assets/vfx/mob-*/) - plus the playback
// metadata the recipe layer needs. The 'sheet' cue primitive added beside
// the analytic primitives renders these atlases; presets without a
// binding keep the analytic primitive presentation (procedural
// fallback), and an un-loaded texture key also falls back.
//
// Because bindings live at preset level, every skill using a bound
// preset (enemy basics, boss specials, companion skills) upgrades
// together - same pipeline as player skills, no fork.
export interface VfxSheetBinding {
  // Atlas texture key for Phaser loader + descriptor dedupe.
  sheetKey: string
  textureUrl: string
  atlasUrl: string
  // Inclusive frame window inside the sheet (frame_N keys). The window
  // trims sheet frames that read as blank or as a second effect's lead-
  // in/out.
  firstFrame: number
  lastFrame: number
  // Playback rate; durationMs = frames * 1000 / fps.
  fps: number
  // Rendered sprite box: displayWidth = fitPx, height preserves the cell
  // aspect (library cells are uniformly 200x150 => 0.75x height).
  fitPx: number
  // Ground VFX anchor at the target's feet with the ground depth; upright
  // anchor sits at the body's center with upright depth.
  grounded: boolean
}

const SHEETS = '/assets/vfx/spritesheets'

function binding(
  sheetKey: string,
  basename: string,
  firstFrame: number,
  lastFrame: number,
  fps: number,
  fitPx: number,
  grounded: boolean,
  dir = SHEETS,
): VfxSheetBinding {
  return {
    sheetKey,
    textureUrl: `${dir}/${basename}.png`,
    atlasUrl: `${dir}/${basename}.json`,
    firstFrame,
    lastFrame,
    fps,
    fitPx,
    grounded,
  }
}

export const VFX_SHEET_BINDINGS: Partial<Record<CombatVfxPresetId, VfxSheetBinding>> = {
  // Slash_21 - wide blue arc; boar's gore and generic weapon-weight hits.
  slash: binding('vfx-sheet-slash-21', 'Slash_21', 0, 15, 30, 110, false),
  // Authored triple gash rake (art/vfx/mob-attacks/Claw.json); tiger,
  // scorpion tail, dragon whelp.
  claw: binding('vfx-sheet-mob-claw', 'claw', 0, 10, 30, 130, false, '/assets/vfx/mob-claw'),
  // Authored converging fang jaws (art/vfx/mob-attacks/Bite.json);
  // wolves, crocodile.
  bite: binding('vfx-sheet-mob-bite', 'bite', 0, 9, 30, 120, false, '/assets/vfx/mob-bite'),
  // SFFXEP 09 - fire swirl burst; flame fox, lava hound.
  fire_burst: binding('vfx-sheet-sffxep-09', 'SFFXEP 09', 2, 20, 30, 140, false),
  // Authored wave crash + droplets (art/vfx/mob-attacks/Water Surge.json);
  // flood serpent and the authored water_surge specials share one
  // element presentation.
  water_surge: binding('vfx-sheet-mob-water', 'water-surge', 0, 12, 30, 150, true, '/assets/vfx/mob-water-surge'),
  // Authored fault crack + dust burst (art/vfx/mob-attacks/Earth
  // Shockwave.json); earthworm cast.
  earth_shockwave: binding('vfx-sheet-mob-earth', 'earth-shockwave', 0, 12, 30, 150, true, '/assets/vfx/mob-earth-shockwave'),
  // Authored heavy slam - shock ring, debris, dim flash
  // (art/vfx/mob-attacks/Boss Ground Slam.json); mud golem slam.
  boss_ground_slam: binding('vfx-sheet-mob-slam', 'boss-ground-slam', 0, 12, 30, 160, true, '/assets/vfx/mob-boss-ground-slam'),
}

export function vfxSheetCombatDescriptors() {
  return Object.values(VFX_SHEET_BINDINGS).map(({ sheetKey, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key: sheetKey,
    textureUrl,
    atlasUrl,
  }))
}
