// Sound System W1 - the cue manifest (spec 1.2). Pure data: no Tone/Vue/
// Phaser imports. `src: ''` marks a reserved silent slot - the file drop
// fills it; until then the cue is a no-op (never throws).
//
// OQ-C FULL coverage: qualifier families are expanded into one row per
// concrete catalog id (castable skills, reactions, VFX presets, all 37
// Kiem Pho combos, ungthe triggers, Thanh Van times). Family anchor rows
// remain as the qualifier-strip fallback for ids the catalogs do not know
// yet.

import { type AudioChannelId } from './AudioChannels'

export type SynthSoundId =
  | 'uiClick'
  | 'uiConfirm'
  | 'uiCancel'
  | 'toastLoot'
  | 'toastCraft'
  | 'toastUpgrade'
  | 'toastError'
  | 'toastWarning'
  | 'toastSave'
  | 'combatAttack'
  | 'combatHit'
  | 'combatCritical'
  | 'combatDodge'
  | 'combatBlock'
  | 'combatKill'
  | 'battleStart'
  | 'battleVictory'
  | 'battleDefeat'


/**
 * Cue-id string (`domain.verb[.qualifier]`). Manifest rows are keyed by a
 * runtime-generated union (expand() builds qualifier rows), so the type
 * stays `string` - the convention is pinned by the architecture tests
 * (audioManifestCompleteness + i18nKeyParity's cue-id exemption), not by
 * a literal union that would need an edit per asset drop.
 */
export type AudioCueId = string

export interface AudioCueDef {
  // '' = reserved silent slot; string[] = variant pool (round-robin over
  // the decoded subset - every entry is fetched independently).
  readonly src: string | readonly string[]
  readonly channel: AudioChannelId
  readonly volume?: number
  readonly loop?: boolean
  // Min gap between two plays of this cue; default MIN_GAP_MS (60) in AudioManager.
  readonly cooldownMs?: number
  // Fraction to duck the music bus by while this cue plays (0..1, max-active).
  readonly duckMusic?: number
  // SOUND_LIBRARY recipe used until a real file drops. OQ-A: never set on
  // music.*/ambient.* rows - those stay silent.
  readonly synthFallback?: SynthSoundId
}

// --- Catalog enumerations (OQ-C) - mirrors of the data catalogs, inlined so
// this file stays a pure data island inside core/audio. The W9 completeness
// test cross-checks these lists against their sources of truth.

// Every skillId that can appear on turn_cast_start (skill defs in
// src/data/skill/{Skills,CoreSkills,PhapTuSkills,TheTuSkills,KiemPhoOrbs,
// NguKiemDaoSkills,TurnAnKitSkills,TurnBasicAttacks}.ts minus passive_*,
// plus the 'basic_attack' fallback id).
const CAST_SKILL_IDS = [
  'bach_ung',
  'basic_attack',
  'bat_tu_ba_the',
  'cuong_quyen',
  'da_phap_lien_tuyen',
  'diem_kim_thuat',
  'doc_chuong',
  'generic_physical',
  'hoa_cau_thuat',
  'hoa_tan_diem',
  'hoa_tu_diem',
  'huy_quyen',
  'kim_tan_phong',
  'kim_tu_phong',
  'kim_y_ngung_phong',
  'linh_bao',
  'loan_dau',
  'moc_lan_doc',
  'moc_tu_doc',
  'ngo_dao_hon_don',
  'ngu_kiem_thuat',
  'orb_bo',
  'orb_chem',
  'orb_dam',
  'orb_hat',
  'orb_quet',
  'phan_chan',
  'phan_kich',
  'quan_the',
  'son_nhac',
  'tam_muoi_chan_hoa',
  'tam_muoi_potency',
  'tham_the',
  'thanh_tuyen_duong_linh',
  'tho_bang_loa',
  'tho_cau_thuat',
  'tho_tu_nhan',
  'thuy_dao_lan',
  'thuy_ngan_lien',
  'thuy_tien_thuat',
  'tram',
  'tran_ap',
  'tro_kich',
  'trong_nhac',
  'trong_phan_kich',
  'tu_the',
  'van_moc_sinh_co',
  'van_phap_tuy_tam',
  'water_surge',
] as const

// Every reactionId in src/data/reaction/ReactionDefinitions.ts (5 sinh + 5 khac).
const REACTION_IDS = [
  'duong_viem',
  'luyen_tho',
  'duong_kim',
  'tu_thuy',
  'nhuan_moc',
  'tuc_viem',
  'dung_kim',
  'doan_moc',
  'xuyen_tho',
  'tran_thuy',
] as const

// CombatVfxPresetId members (src/core/battle/CombatAction.ts) that route
// to combat.impact.* - the W9 completeness test derives this list from the
// binding's routing table, so it cannot drift from the special cases:
//   kiem_combo_* -> combat.kiem.combo.*; tu_luc -> combat.kiem.tu_luc;
//   boss_ground_slam -> combat.boss.slam. Every other emitted preset owns
//   an expanded row here (ngu_kiem_flight does emit action_impact via
//   NguKiemDaoSkills.presetId - no special route, so it keeps its row).
const IMPACT_PRESET_IDS = [
  'slash',
  'claw',
  'arcane_impact',
  'fire_burst',
  'water_surge',
  'earth_shockwave',
  'metal_slash',
  'wood_spikes',
  'lightning_strike',
  'wind_blade',
  'holy_radiance',
  'shadow_burst',
  'kiem_orb_dam',
  'kiem_orb_chem',
  'ngu_kiem_flight',
  'hoa_cau_comet',
  'thuy_tien_dart',
  'doc_chuong_palm',
  'diem_kim_point',
  'tho_cau_boulder',
  'tram_slash',
  'linh_bao_burst',
  'huy_quyen_strike',
  'tam_muoi_aura',
] as const

// Every combo id in src/data/skill/KiemPhoCombos.ts (37, prefix-free form).
const KIEM_COMBO_IDS = [
  'nhat_tuyen',
  'liet_ngan',
  'tam_phach',
  'tam_lieu',
  'tam_tao',
  'khai_ngan',
  'nhi_thich_nhat_phach',
  'thau_ngan',
  'nhi_tram_nhat_phach',
  'nhi_phach_nhat_thich',
  'nhi_lieu_nhat_thich',
  'nhi_tao_nhat_thich',
  'hoi_tuyen',
  'diep_ngan',
  'phach_thich_phach',
  'thich_tram_phach_thich',
  'tram_phach_thich_tram',
  'phach_tram_thich_phach',
  'lieu_tram_thich_lieu',
  'tao_tram_thich_tao',
  'thich_lieu_tram_thich',
  'thich_tao_tram_thich',
  'tram_lieu_phach_tram',
  'phach_lieu_tram_phach',
  'thich_tram_tram_lieu',
  'tram_thich_thich_lieu',
  'phach_thich_thich_tao',
  'ngu_hanh_kiem',
  'ngu_hanh_nghich_chuyen',
  'thich_tram_tram_phach_thich',
  'tram_thich_phach_tram_phach',
  'phach_tram_thich_lieu_tao',
  'thich_lieu_phach_tram_tao',
  'tao_tram_thich_phach_lieu',
  'tram_phach_lieu_tao_thich',
  'phach_lieu_tao_thich_tram',
  'lieu_tao_thich_tram_phach',
] as const

// Thanh Van time variants (src/presentation/background/BackgroundVariant.ts).
const MUSIC_HOME_TIMES = ['morning', 'noon', 'evening', 'night'] as const

function sfx(overrides?: Partial<AudioCueDef>): AudioCueDef {
  return { src: '', channel: 'sfx', ...overrides }
}

function ui(overrides?: Partial<AudioCueDef>): AudioCueDef {
  return { src: '', channel: 'ui', ...overrides }
}

function music(overrides?: Partial<AudioCueDef>): AudioCueDef {
  return { src: '', channel: 'music', loop: true, ...overrides }
}

// Expand one catalog id list into `prefix<id>` rows with shared options.
function expand(
  ids: readonly string[],
  prefix: string,
  row: AudioCueDef,
): Record<string, AudioCueDef> {
  const out: Record<string, AudioCueDef> = {}
  for (const id of ids) out[`${prefix}${id}`] = row
  return out
}

export const AUDIO_CUES: Readonly<Record<string, AudioCueDef>> = {
  // ---- UI (spec 1.2) ----
  'ui.click': ui({ synthFallback: 'uiClick' }),
  'ui.tab': ui({ synthFallback: 'uiClick' }),
  'ui.toast.loot': ui({ synthFallback: 'toastLoot' }),
  'ui.toast.craft': ui({ synthFallback: 'toastCraft' }),
  'ui.toast.upgrade': ui({ synthFallback: 'toastUpgrade' }),
  'ui.toast.save': ui({ synthFallback: 'toastSave' }),
  'ui.toast.warning': ui({ synthFallback: 'toastWarning' }),
  'ui.toast.error': ui({ synthFallback: 'toastError' }),
  'ui.confirm': ui({ synthFallback: 'uiConfirm' }),
  'ui.cancel': ui({ synthFallback: 'uiCancel' }),
  'ui.modal.open': ui(),
  'ui.modal.close': ui(),
  'ui.panel.open': ui({ synthFallback: 'uiClick' }),
  'ui.panel.close': ui({ synthFallback: 'uiCancel' }),
  'ui.wheel.open': ui({ synthFallback: 'uiClick' }),
  'ui.wheel.close': ui({ synthFallback: 'uiCancel' }),
  'ui.wheel.select': ui({ synthFallback: 'uiConfirm' }),
  'ui.purchase': ui({ synthFallback: 'toastLoot' }),
  'ui.equip': ui({ synthFallback: 'uiClick' }),
  'ui.error': ui({ synthFallback: 'toastError' }),

  // ---- Combat ----
  'combat.cast': sfx({ cooldownMs: 80, synthFallback: 'combatAttack' }),
  ...expand(CAST_SKILL_IDS, 'combat.cast.', sfx({ cooldownMs: 80 })),
  'combat.hit': sfx({ cooldownMs: 80, synthFallback: 'combatHit' }),
  'combat.crit': sfx({ cooldownMs: 120, duckMusic: 0.3, synthFallback: 'combatCritical' }),
  'combat.dodge': sfx({ synthFallback: 'combatDodge' }),
  'combat.block': sfx({ synthFallback: 'combatBlock' }),
  'combat.death': sfx({ synthFallback: 'combatKill' }),
  // Deliberately unbound: the 'death' emit already routes to
  // combat.death; 'kill' stays armed for a distinct kill-confirm asset.
  'combat.kill': sfx({ synthFallback: 'combatKill' }),
  'combat.hurt': sfx({ cooldownMs: 80, synthFallback: 'combatHit' }),
  'combat.survive_lethal': sfx({ duckMusic: 0.4, synthFallback: 'combatBlock' }),
  'combat.heal': sfx({ cooldownMs: 100, synthFallback: 'toastSave' }),
  'combat.turn_ready': sfx({ synthFallback: 'uiConfirm' }),
  'combat.impact': sfx({ cooldownMs: 80, synthFallback: 'combatHit' }),
  ...expand(IMPACT_PRESET_IDS, 'combat.impact.', sfx({ cooldownMs: 80 })),
  // Armed-reserved: enemy spawns ride the pendingEnemySpawns snapshot
  // (combat-vfx-spawner), which has no cue hook yet - these rows voice
  // the moment a spawn binding lands.
  'combat.spawn': sfx({ cooldownMs: 120, synthFallback: 'toastWarning' }),
  'combat.spawn.elite': sfx({ cooldownMs: 120, synthFallback: 'toastWarning' }),
  'combat.spawn.boss': sfx({ duckMusic: 0.4, synthFallback: 'battleStart' }),
  'combat.buff.apply': sfx({ cooldownMs: 120, synthFallback: 'toastSave' }),
  'combat.debuff.apply': sfx({ cooldownMs: 120, synthFallback: 'toastWarning' }),
  'combat.dot.apply': sfx({ cooldownMs: 120, synthFallback: 'toastWarning' }),
  'combat.buff.expire': sfx({ cooldownMs: 120 }),
  // Armed-reserved: status_vfx_updated emits on stack/refresh change
  // (TurnStatusPresentationEvents); the VFX scene consumes it but the
  // audio binding does not - whether stack ticks should voice is a
  // sound-design call deferred to asset time.
  'combat.buff.stack': sfx({ cooldownMs: 120 }),
  'combat.reaction': sfx({ duckMusic: 0.4, synthFallback: 'combatCritical' }),
  ...expand(REACTION_IDS, 'combat.reaction.', sfx({ duckMusic: 0.4 })),
  'combat.loot': sfx({ cooldownMs: 120, synthFallback: 'toastLoot' }),
  'combat.essence': sfx({ cooldownMs: 80, synthFallback: 'toastCraft' }),
  // Armed-reserved: TurnBattleSystem charge init and release are silent
  // today - no emit exists for either; wired when charge hooks land.
  'combat.charge': sfx({ synthFallback: 'combatAttack' }),
  'combat.release': sfx({ duckMusic: 0.3, synthFallback: 'combatCritical' }),
  'combat.boss.slam': sfx({ duckMusic: 0.5, synthFallback: 'combatCritical' }),
  'combat.kiem.combo': sfx({ cooldownMs: 80, synthFallback: 'combatHit' }),
  ...expand(KIEM_COMBO_IDS, 'combat.kiem.combo.', sfx({ duckMusic: 0.3 })),
  'combat.kiem.tu_luc': sfx({ cooldownMs: 120 }),
  'combat.thetu.reflect': sfx({ synthFallback: 'combatBlock' }),
  'combat.ungthe': sfx({ synthFallback: 'combatAttack' }),
  'combat.ungthe.intercept': sfx({ synthFallback: 'combatDodge' }),
  'combat.ungthe.counter': sfx({ synthFallback: 'combatHit' }),
  'combat.phaptu.proc': sfx({ cooldownMs: 120 }),
  'combat.hothe.absorb': sfx({ cooldownMs: 120, synthFallback: 'combatBlock' }),
  'combat.ward': sfx({ cooldownMs: 120 }),
  'combat.ward.grant': sfx({ synthFallback: 'toastSave' }),
  'combat.ward.break': sfx({ synthFallback: 'combatBlock' }),
  // Armed-reserved: countdownProgress is a snapshot field; no tick emit
  // exists to key off yet (spec marks this P2).
  'combat.countdown.tick': ui({ synthFallback: 'uiClick' }),
  // Armed-reserved: 'turn_end' is a skill-trigger name, not an emitted
  // event - no producer exists today.
  'combat.turn_end': sfx(),
  'combat.exit': ui({ synthFallback: 'uiCancel' }),
  'combat.start': sfx({ duckMusic: 0.3, synthFallback: 'battleStart' }),
  'combat.victory': sfx({ duckMusic: 0.7, synthFallback: 'battleVictory' }),
  'combat.defeat': sfx({ duckMusic: 0.7, synthFallback: 'battleDefeat' }),
  'combat.select': ui({ synthFallback: 'uiClick' }),

  // ---- Progression ----
  'progress.node_unlock': sfx({ synthFallback: 'toastUpgrade' }),
  'progress.path_choose': sfx({ duckMusic: 0.4, synthFallback: 'uiConfirm' }),
  'progress.breakthrough': sfx({ duckMusic: 0.7, synthFallback: 'battleVictory' }),
  'progress.talent_pick': sfx({ synthFallback: 'uiConfirm' }),
  'progress.reroll': ui({ synthFallback: 'uiClick' }),
  'progress.create': sfx({ synthFallback: 'uiConfirm' }),
  'progress.perfect': sfx({ duckMusic: 0.5, synthFallback: 'toastUpgrade' }),
  'progress.hidden_open': sfx({ duckMusic: 0.5, synthFallback: 'toastWarning' }),
  // Armed-reserved: no producer passes this cue id today (QuanKhiPanel
  // announces with progress.path_choose) - voices when one lands.
  'progress.quan_the': sfx({ synthFallback: 'toastSave' }),

  // ---- Tribulation ----
  // No tribulation.start row: presentation_session_started is silent for
  // tribulation sessions - tribulation_started owns the start cue
  // (combatAudioBinding.ts); an armed row here would double-voice.
  'tribulation.begin': sfx({ duckMusic: 0.5, synthFallback: 'battleStart' }),
  'tribulation.thunder': sfx({ cooldownMs: 150, duckMusic: 0.4, synthFallback: 'combatCritical' }),
  'tribulation.chapter': sfx({ synthFallback: 'toastWarning' }),
  'tribulation.answer.ok': ui({ synthFallback: 'uiConfirm' }),
  'tribulation.answer.fail': ui({ synthFallback: 'toastError' }),
  'tribulation.victory': sfx({ duckMusic: 0.7, synthFallback: 'battleVictory' }),
  'tribulation.fail': sfx({ duckMusic: 0.7, synthFallback: 'battleDefeat' }),

  // ---- Craft / farm ----
  'craft.start': sfx({ synthFallback: 'toastCraft' }),
  'farm.arm': ui({ synthFallback: 'uiConfirm' }),
  'farm.stop': ui({ synthFallback: 'uiCancel' }),
  'farm.cycle': sfx(),

  // ---- Stingers / ambient / music ----
  'stinger.announce': sfx({ duckMusic: 0.6, synthFallback: 'battleStart' }),
  'stinger.offline': sfx({ duckMusic: 0.6, synthFallback: 'toastSave' }),
  // One-shot transition stingers on the sfx channel - not looped music.
  'ambient.cultivate.on': sfx({ duckMusic: 0.5 }),
  'ambient.cultivate.off': sfx({ duckMusic: 0.5 }),
  'music.menu': music(),
  'music.home': music(),
  'music.combat': music(),
  'music.tribulation': music(),
  // Armed-reserved: ROUTE_MUSIC emits only the bare music.home id today;
  // per-time variants voice when the driver learns time-of-day.
  ...expand(MUSIC_HOME_TIMES, 'music.home.', music()),
}

// Forward slots: armed rows with neither a producer nor an armed-reserved
// marker (combat.kiem.tu_luc, combat.impact.lightning_strike) are
// catalog-expansion slots by convention - they voice the moment their
// qualifier is emitted, and the completeness test keeps them from
// drifting out of sync with the catalogs they index.

/**
 * exact match -> strip one trailing qualifier segment and retry -> undefined.
 * `combat.cast.foo` lands on `combat.cast`; unknown ids return undefined.
 */
export function resolveAudioCue(id: string): AudioCueDef | undefined {
  // Non-string ids (a map lookup miss handing `undefined`) would throw
  // on `.length` - playCue promises never to throw, so coerce here.
  if (typeof id !== 'string' || id.length === 0) return undefined
  let key = id
  while (key.length > 0) {
    // Own-property check: AUDIO_CUES is a plain object, so `AUDIO_CUES[key]`
    // alone resolves Object.prototype members ('constructor', 'toString'...)
    // into non-cue values that crash downstream in playCue.
    if (!Object.prototype.hasOwnProperty.call(AUDIO_CUES, key)) {
      const cut = key.lastIndexOf('.')
      if (cut < 0) return undefined
      key = key.slice(0, cut)
      continue
    }
    const def = AUDIO_CUES[key]
    if (def !== undefined) return def
    const cut = key.lastIndexOf('.')
    if (cut < 0) return undefined
    key = key.slice(0, cut)
  }
  return undefined
}
