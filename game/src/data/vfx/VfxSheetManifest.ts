import type { CombatVfxPresetId } from '../../core/battle/CombatAction'

// Monster attack VFX sweep (2026-10-04) - the VfxAssetManifest seam the
// three-path content design doc (docs/design/2026-09-24, section 2.b)
// described: binds a CombatVfxPresetId to a spritesheet atlas from the
// shared library (public/assets/vfx/spritesheets/) plus the playback
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
): VfxSheetBinding {
  return {
    sheetKey,
    textureUrl: `${SHEETS}/${basename}.png`,
    atlasUrl: `${SHEETS}/${basename}.json`,
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
  // SFFXEP 27 - pale claw rakes; tiger, scorpion tail, dragon whelp.
  claw: binding('vfx-sheet-sffxep-27', 'SFFXEP 27', 4, 20, 30, 130, false),
  // SFFXEP 31 - closing crescent jaw; wolves, crocodile.
  bite: binding('vfx-sheet-sffxep-31', 'SFFXEP 31', 0, 15, 30, 120, false),
  // SFFXEP 09 - fire swirl burst; flame fox, lava hound.
  fire_burst: binding('vfx-sheet-sffxep-09', 'SFFXEP 09', 2, 20, 30, 140, false),
  // Water FX 10 - rolling wave hit; flood serpent and the authored
  // water_surge specials share one element presentation.
  water_surge: binding('vfx-sheet-water-fx-10', 'Water FX 10', 10, 44, 36, 150, true),
  // Earth_07 - rock eruption; earthworm cast.
  earth_shockwave: binding('vfx-sheet-earth-07', 'Earth_07', 0, 15, 24, 150, true),
  // Explosion_10 - heavy ground blast for the mud golem slam.
  boss_ground_slam: binding('vfx-sheet-explosion-10', 'Explosion_10', 4, 34, 30, 160, true),
}

export function vfxSheetCombatDescriptors() {
  return Object.values(VFX_SHEET_BINDINGS).map(({ sheetKey, textureUrl, atlasUrl }) => ({
    kind: 'atlas' as const,
    key: sheetKey,
    textureUrl,
    atlasUrl,
  }))
}
