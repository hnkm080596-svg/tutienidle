import { defineStore } from 'pinia'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../core/player/Player'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  isCombatAiStrategy,
} from '../core/battle/CombatAiStrategy'
import {
  addCultivation,
  breakthrough as breakthroughSystem,
} from '../core/cultivation/CultivationSystem'

import { calculateOfflineProgress, type OfflineResult } from '../core/idle/OfflineProgressSystem'
import { calculateOfflineTime } from '../core/idle/GameClock'
import { getActiveCultivationSpeedPercent, splitCultivationSpeedWindow, TU_LINH_TRAN_DURATION_MS } from '../core/economy/TuLinhTranBalance'
import { buildGameSave, computeRestoreIdentity, type GameSave, type RestoreTimeAuthority } from '../services/save/SaveSystem'
import { cloudSaveCoordinator } from '../services/cloudSave/CloudSaveServiceFactory'
import { asBaseStats, createBaseStats } from '@/core/stats/StatBlock'
import { STAT_DOMAIN } from '@/core/stats/StatDomain'
import { getEffectiveMainStatCap } from '@/core/stats/StatCap'
import { MAIN_STAT_KEYS } from '@/core/stats/StatTypes'
import type { StatType } from '@/core/stats/StatTypes'
import type { GameManager } from '@/core/game/GameManager'
import { getCurrentRealm, getRequiredCultivation } from '@/core/realm/realmSystem'
import { cultivateTick } from '@/core/cultivation/CultivationTick'
import { accrueCultivationInsight } from '@/core/cultivation/CultivationInsight'
import type { StatModifier } from '@/core/stats/StatCalculator'
import { normalizeArtifactProgress } from '@/core/artifact/ArtifactProgression'
import {
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/core/player/PlayerVisualForm'

// Dirty-check cho setExternalModifiers (perf-optimize-pass Task 5).
// App.vue goi setExternalModifiers() MOI TICK (10Hz) voi mang MOI do
// GameManager.getAggregatedModifiers() dung lai; gan reference moi lam
// getter `finalStats` invalidate moi tick du noi dung buff/technique
// khong doi -> moi consumer tinh lai vo ich. O day giu lai "chu ky" noi
// dung cua lan gan gan nhat de bo qua cac lan gan trung noi dung.
//
// Vi sao SNAPSHOT theo GIA TRI (string) chu khong deep-compare voi
// `this.externalModifiers`: nguon modifier (BuffSystem/SkillSystem) co
// the tra ve CHINH object cu va mutate tai cho (vd stacks doi). Khi do
// hai ben cua phep so sanh tro cung object nen deep-compare luon thay
// "giong nhau" va ta se bo sot thay doi that. Chu ky copy gia tri ra
// string nen bat duoc dung truong hop nay.
//
// WeakMap theo store instance (KHONG phai bien module dung chung) de
// m-i pinia instance - nh-t l- trong test, m-i test t-o pinia m-i - c-
// snapshot rieng, va snapshot tu thu hoi cung store. Khong dung vao
// state/save shape.
interface ExternalModifierSnapshot {
  // Dung gia tri ma state dang giu sau lan gan gan nhat (proxy reactive
  // cua Pinia). Neu noi khac thay mang nay (load save, $reset, $patch)
  // thi reference lech -> ta gan lai thay vi tin vao chu ky cu.
  applied: StatModifier[]

  signature: string
}

const lastExternalModifiers = new WeakMap<object, ExternalModifierSnapshot>()

// QA-002 idempotency (Task 9.2) - payload-identity guard cho
// restoreFromSave(), cung pattern lastExternalModifiers phia tren:
// WeakMap theo store instance, non-reactive, khong persist vao save
// (dev phase - khong migration). Luu ket qua OfflineResult cua lan
// restore gan nhat; cung payload goi lai = no-op tra Y HET ket qua do
// (chong double-credit offline cultivation + double Object.assign khi
// boot flow bi retry/recovery chay 2 lan), payload KHAC = ap day du
// (boot lai voi save moi hon van hoat dong). Identity la
// `lastSavedAt|cultivation` tu save - cap gia tri nay khac ham y save
// da doi (lan save sau luon co lastSavedAt moi hon).
interface RestoredPayloadSnapshot {
  identity: string

  offline: OfflineResult
}

const lastRestoredPayloads = new WeakMap<object, RestoredPayloadSnapshot>()

// Ky tu dieu khien lam dau phan cach - khong bao gio xuat hien trong
// id/sourceId/stat/tag (toan chuoi dinh danh do code sinh), nen hai mang
// khac noi dung khong the vo tinh trung chu ky vi ghep chuoi.
const SIGNATURE_SEPARATOR = '\u0001'

// "Noi dung giong het" = cung so luong, cung THU TU, va tung entry khop
// TOAN BO field cua StatModifier co anh huong toi calculateStats
// (id/sourceId/sourceType/stat/tag + 7 field so). Thu tu duoc tinh vao
// vi mang nay duoc spread thang vao pipeline; giu chat hon can thiet o
// cho nay chi khien ta gan lai thua (an toan), khong bao gio bo sot.
// `?? ''` phan biet duoc 0 ("0") voi undefined ("").
function externalModifierSignature(modifiers: StatModifier[]): string {
  const parts: (string | number)[] = [modifiers.length]

  for (const modifier of modifiers) {
    parts.push(
      modifier.id,
      modifier.sourceId,
      modifier.sourceType,
      modifier.stat,
      modifier.tag ?? '',
      // stat-system-reimagined review fix: domain decides whether the
      // gate delivers a gated-stat modifier - same-fields-different-
      // domain MUST break the signature or the new grant never lands.
      modifier.domain ?? '',
      modifier.flat ?? '',
      modifier.percent ?? '',
      modifier.multiplier ?? '',
      modifier.stacks ?? '',
      modifier.maxStacks ?? '',
      modifier.perLevelFlat ?? '',
      modifier.perLevelPercent ?? '',
    )
  }

  return parts.join(SIGNATURE_SEPARATOR)
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerData => createDefaultPlayer(),

  getters: {
    cultivationRequired(state) {
      return getRequiredCultivation(state.realmId, state.realmLevel)
    },

    // Dung lai dung cong thuc cultivationRequired - truoc day tu tinh
    // "realmLevel * 100" (sai, khong khop getRequiredCultivation that
    // su dung o noi khac), nay chi con 1 nguon cong thuc duy nhat.
    cultivationProgress(): number {
      return Math.min(this.cultivation / this.cultivationRequired, 1)
    },

    // Stats cuoi cung = baseStats + modifiers (equipment/talent, tinh)
    // + externalModifiers (buff/technique, do GameManager gop moi tick).
    // Day la nguon duy nhat UI/CombatEntity nen doc.
    // ARCH-002 (M7): formula lives in resolvePlayerFinalStats() - the same
    // owner the battle entry path resolves through (post-reset, fresh
    // aggregation instead of this mirror field).
    finalStats(state) {
      return resolvePlayerFinalStats(state, state.externalModifiers)
    },

    // The character's visual form - derived FROM the entity itself
    // (realmId + cultivationPath), one single source. Everywhere the
    // character appears reads from here: PhaserCanvas writes the registry
    // gate for CombatScene/MainScene, TranPhapPanel sends it to the
    // preview scene. Art content (textures/anchors) lives in
    // PLAYER_VISUAL_PROFILES on the presentation side - this is only the id.
    visualProfileId(state): PlayerVisualProfileId {
      return resolvePlayerVisualProfileId({
        realmId: state.realmId,
        cultivationPath: state.cultivationPath,
        cultivationWay: state.cultivationWay ?? undefined,
      })
    },

    // Armed/unarmed art discriminator (user ruling 2026-09-29, Q2):
    // mortal-only - the basic-skill pick decides the reskin: 'tram' fights
    // with a sword ('pham_nhan'), 'linh_bao'/'huy_quyen' go unarmed
    // ('pham_nhan_unarmed'). Resolved once here; every visual surface reads
    // it through the playerVisualArmed registry gate or the payload mirror.
    visualArmed(state): boolean {
      const mortal =
        state.cultivationPath === undefined ||
        (state.cultivationPath as string) === 'mortal'
      return mortal && (state.mortalBasicSkillId ?? 'tram') === 'tram'
    },
  },

  actions: {
    // Base cultivation speed = BASE_CULTIVATION_PER_SECOND, times the
    // 'cultivation_speed' of the chosen talent (2026-08-27). Other
    // sources - buffs/tam phap/equipment - still have NO cultivation-
    // speed path. `cultivationPerSecond` is the snapshot SAVED into the
    // save, used to compute offline progress on load (boot path:
    // useAppLifecycle -> CloudSaveCoordinator.load -> restoreFromSave).
    // Returns the ACTUAL tu vi just granted (after clamping at
    // "required", see
    // addCultivation()).
    cultivate(deltaSeconds: number): number {
   // P6-M1 - the shared production cultivation tick owns the whole
      // step (speed composition, timed modifiers, clamped write, lifetime
      // accrual, insight conversion). The store only supplies the
      // wall-clock now.
      return cultivateTick(this, deltaSeconds, Date.now())
    },

    breakthrough(): boolean {
      return breakthroughSystem(this)
    },

    // Goi boi App.vue moi tick voi ket qua tu
    // GameManager.getAggregatedModifiers(). Store khong tu tinh
    // buff/technique modifier, chi luu lai de finalStats dung.
    // Dirty-check (perf-optimize-pass Task 5, xem ghi chu dau file):
    // KHONG gan reference moi neu noi dung y het lan gan truoc - giu
    // nguyen object cu de getter `finalStats` (va moi computed phai
    // sinh) khong invalidate 10 lan/giay khi buff/technique khong doi.
    setExternalModifiers(modifiers: StatModifier[]) {
      const previous = lastExternalModifiers.get(this)

      const signature = externalModifierSignature(modifiers)

      // `previous.applied === this.externalModifiers` bao dam chi bo qua
      // khi state VAN dang giu dung mang ta gan lan truoc - neu load
      // save/$reset/$patch da thay mang khac thi chu ky cu vo nghia,
      // phai gan lai.
      if (
        previous !== undefined &&
        previous.signature === signature &&
        previous.applied === this.externalModifiers
      ) {
        return
      }

      this.externalModifiers = modifiers

      // Luu lai DUNG gia tri state tra ve (proxy reactive cua Pinia),
      // khong phai `modifiers` tho, de phep so sanh reference o tren
      // dung o tick sau.
      lastExternalModifiers.set(this, { applied: this.externalModifiers, signature })
    },

    // Modifier "tinh" tu equipment (xem ghi chu kieu PlayerData).
    // Goi ngay sau equip/unequip/enhance, khong phai moi tick -
    // khac setExternalModifiers o tren. player.modifiers is the SHARED
    // bucket for many static sources (realm passive, Luyen The -
    // distinguished by sourceType/id prefix; permanent pills now write
    // baseStats directly, no longer a modifier bucket), so it may only
    // duoc thay THE phan sourceType 'equipment', khong duoc gan de ca
    // mang - gan de tung xoa sach moi nguon khac moi lan equip/reload.
    setEquipmentModifiers(modifiers: StatModifier[]) {
      this.modifiers = [
        ...this.modifiers.filter(modifier => modifier.sourceType !== 'equipment'),
        ...modifiers,
      ]
    },

    // Nhan gameManager tu App.vue thay vi tu giu instance trong
    // store - GameManager khong phai reactive state cua Vue (xem
    // ghi chu trong GameManager.ts/App.vue), store chi pass-through.
    save(gameManager: GameManager) {
      // lastSavedAt phai duoc cap nhat TRUOC khi ghi file,
      // neu khong offline progress lan sau se bi tinh du
      // (vi file luu moc thoi gian cu hon thoi diem save that).
      this.lastSavedAt = Date.now()

   // R10 (AR-12): this.$state is a live reactive Pinia proxy -
      // buildGameSave() owns making a detached-value snapshot safe from
      // that (JSON round-trip, not structuredClone, since structuredClone
      // cannot handle Proxy objects at any nesting depth). Callers just
      // pass the state through.
      return cloudSaveCoordinator.save(buildGameSave(this.$state, gameManager))
    },

    restoreFromSave(save: GameSave, timeAuthority?: RestoreTimeAuthority) {
      // R10 (AR-12) - payload-identity guard: WHOLE-payload hash (qua
      // computeRestoreIdentity - exclude lastSavedAt), khong con
      // fingerprint 2-field. Cung save goi lai = no-op; save KHAC (du
      // cung lastSavedAt|cultivation) ap day du.
      const payloadIdentity = computeRestoreIdentity(save)
      const previousRestore = lastRestoredPayloads.get(this)

      if (previousRestore !== undefined && previousRestore.identity === payloadIdentity) {
        return previousRestore.offline // elapsed 0 - no-op dung nghia, tra lai ket qua lan truoc
      }

      // GameClock la nguon duy nhat tinh thoi gian offline.
      // lastSavedAt cua save file chinh la lastOnlineAt cua GameClockState.
      // B1-D - under remote authority the accrual bound is the SERVER
      // window (progression_cutoff_at -> serverNowUtc), never the client
      // clock or the editable payload marker; a live replacement accrues
      // zero by definition. The bound still flows through
      // calculateOfflineTime so the max cap applies.
      const offlineSeconds =
        timeAuthority?.kind === 'cold-boot'
          ? calculateOfflineTime(
              { lastOnlineAt: timeAuthority.sinceMs },
              timeAuthority.untilMs,
            ).offlineSeconds
          : timeAuthority?.kind === 'live-replacement'
            ? 0
            : calculateOfflineTime({
                lastOnlineAt: save.player.lastSavedAt,
              }).offlineSeconds

      // EM-02 - the saved cultivationPerSecond snapshot folds in timed
      // buffs (Tu Linh Tran) that expire mid-window; boosted-rate x
      // whole-window over-grants. Re-derive the un-buffed base rate and
      // pay each expiry-boundary segment its own live percent through
      // the same seconds->cultivation conversion authority.
      const savedTimedEffects = save.player.persistentTimedEffects ?? []
      // r12-AUT: bound the cultivation window at now on BOTH ends -
      // under cold-boot a crafted-future lastSavedAt could otherwise
      // position a payable window in the future (same clamp as saveOps
      // settleNowMs). The splitter sorts bounds into positive segments,
      // so a future-positioned start/end pair still mints - the start
      // must clamp too (crafted future -> degenerate now..now window).
      const windowStartMs = Math.min(save.player.lastSavedAt, Date.now())
      const windowEndMs = Math.min(windowStartMs + offlineSeconds * 1000, Date.now())
      const percentAtSave = getActiveCultivationSpeedPercent(savedTimedEffects, windowStartMs)
      const unbuffedCultivationPerSecond = save.player.cultivationPerSecond / (1 + percentAtSave)
      const offline: OfflineResult = {
        elapsedSeconds: offlineSeconds,
        cultivation: splitCultivationSpeedWindow(savedTimedEffects, windowStartMs, windowEndMs).reduce(
          (sum, segment) =>
            sum +
            calculateOfflineProgress(segment.seconds, unbuffedCultivationPerSecond * (1 + segment.percent))
              .cultivation,
          0,
        ),
      }

      // R10 (AR-12, S4 follow-up) - deep-clone before assigning: a plain
      // Object.assign shallow-copies nested fields (baseStats, modifiers,
      // ...), so this.baseStats becomes the SAME object as
      // save.player.baseStats. A later in-place store mutation then
      // leaked back into the
      // caller's `save` object - corrupting it for any later reuse (the
      // payload-identity guard above included: a second restoreFromSave
      // call with the SAME `save` reference would see a hash that changed
      // out from under it and wrongly treat it as a new payload). A
      // restore input must be treated as a value, same principle as
      // buildGameSave's snapshot-is-a-value fix (S1).
      //
      // M1 (ARCH-001) - the player slice is REPLACE semantics, not merge:
      // overlay the payload onto createDefaultPlayer() so fields the save
      // does not declare reset to defaults instead of keeping the previous
      // session's values, then drop state keys the result does not have
      // (any dynamic $state key outside PlayerData would otherwise survive
      // a restore - a plain assign only overwrites, never removes).
      const clonedPlayer = structuredClone(save.player)

      // Mission A6 - whitelist before the spread: only keys declared by
      // createDefaultPlayer() may enter $state. A foreign key in the
      // payload (hand-edited save, foreign payload) would otherwise be
      // spread onto the store AND re-serialized by every later
      // buildGameSave - self-replicating junk.
      const allowedPlayerKeys = new Set(Object.keys(createDefaultPlayer()))

      for (const key of Object.keys(clonedPlayer)) {
        if (!allowedPlayerKeys.has(key)) {
          Reflect.deleteProperty(clonedPlayer, key)
        }
      }

      // Same whitelist inside baseStats - a key that is not a current
      // StatType (legacy/renamed/foreign) drops here; dev-stage rule:
      // drop or reject, never translate.
      const allowedStatKeys = new Set(Object.keys(createBaseStats()))
      const filteredBaseStats: Record<string, number> = {}

      for (const [key, value] of Object.entries(clonedPlayer.baseStats)) {
        if (
          allowedStatKeys.has(key) &&
          Number.isFinite(value) &&
          value >= 0 &&
          // Main stats are indivisible points (level-up and pills only
          // ever grant integers) - a fractional claim is crafted data.
          (!(MAIN_STAT_KEYS as readonly string[]).includes(key) || Number.isInteger(value))
        ) {
          filteredBaseStats[key] = value
        }
      }

      const restoredPlayer: PlayerData = {
        ...createDefaultPlayer(),
        ...clonedPlayer,
        // Keys the save never declared fall back to createBaseStats()
        // baselines instead of staying undefined. Set inside the
        // construction literal so the restore writes the record exactly
        // once.
        baseStats: asBaseStats({
          ...createBaseStats(),
          ...filteredBaseStats,
        }),
      }

      // Retired pill-permanent:<stat> flat modifiers (pre-rework saves)
      // are folded into baseStats once, then dropped below: the bucket
      // must not keep paying while the cap gate only reads baseStats,
      // and the earned points stay visible to every baseStats reader.
      // Only MAIN_STAT_KEYS fold - every legit legacy entry was a
      // main-stat grant, so the shared effective cap binds every fold.
      const isRetiredPillPermanent = (modifier: StatModifier | null | undefined): boolean =>
        typeof modifier?.id === 'string' && modifier.id.startsWith('pill-permanent:')
      const mainCap = getEffectiveMainStatCap(restoredPlayer)
      const foldedRetiredIds = new Set<string>()
      const foldRetiredPillPermanents = (modifiers: StatModifier[] | undefined): void => {
        for (const modifier of modifiers ?? []) {
          // Only main-stat zombies fold: pill-permanent:* was always a
          // main-stat grant channel, so a non-main claim (domain stat,
          // foreign key) is crafted data, not a legacy save.
          if (
            !isRetiredPillPermanent(modifier) ||
            !(MAIN_STAT_KEYS as readonly string[]).includes(modifier.stat)
          ) {
            continue
          }
          // A legacy save could carry the same entry in two buckets;
          // the fold credits it once. An invalid-flat copy does not
          // consume the id - a later valid copy still credits.
          if (foldedRetiredIds.has(modifier.id)) {
            continue
          }
          const gain = modifier.flat ?? 0
          if (!Number.isFinite(gain) || gain <= 0) {
            continue
          }
          foldedRetiredIds.add(modifier.id)
          const key = modifier.stat
          restoredPlayer.baseStats[key] = Math.min(
            mainCap,
            (restoredPlayer.baseStats[key] ?? 0) + gain,
          )
        }
      }

      // Same one-shot fold in every static-modifier bucket a legacy
      // save could carry: player.modifiers, player.externalModifiers
      // and persistentTimedEffects[].modifiers are all filtered by
      // isCurrentShapeModifier below, so a folded zombie is dropped
      // from whichever channel carried it.
      foldRetiredPillPermanents(restoredPlayer.modifiers)
      foldRetiredPillPermanents(restoredPlayer.externalModifiers)
      for (const effect of restoredPlayer.persistentTimedEffects ?? []) {
        foldRetiredPillPermanents(effect?.modifiers)
      }

      // The main-stat clamp runs AFTER normalizeArtifactProgress below:
      // the effective cap depends on the realm, and a crafted save can
      // pair a big realm claim with a big stat claim - normalize fixes
      // the realm first, then the clamp reads the corrected cap.

      // Same whitelist for StatModifier.stat fields persisted on the
      // player slice - a modifier whose stat is not a current StatType
      // drops (never renamed), and a modifier on a domain-gated stat
      // only survives when it declares the OWNING domain: an absent or
      // wrong tag would be rejected by applyDomainGate on every
      // recompute, so the inert zombie is dropped at restore instead.
      const isCurrentShapeModifier = (modifier: StatModifier): boolean => {
        if (modifier === null || typeof modifier !== 'object') {
          return false
        }
        if (isRetiredPillPermanent(modifier)) {
          return false
        }
        if (!allowedStatKeys.has(modifier.stat)) {
          return false
        }
        const owningDomain = STAT_DOMAIN[modifier.stat]
        return owningDomain === undefined || modifier.domain === owningDomain
      }

      restoredPlayer.modifiers = (restoredPlayer.modifiers ?? []).filter(isCurrentShapeModifier)
      // externalModifiers is the per-tick aggregate mirror the
      // GameManager rewrites every tick from live buff/technique
      // sources - it holds no persisted authority of its own, so the
      // restored copy clears here and repopulates on the next tick.
      restoredPlayer.externalModifiers = []
      // r12-COR: bound the wall-clock window a persisted timed effect
      // may claim. appliedAtMs > now is impossible provenance - clamp it
      // so a forged future application date cannot park a buff ahead of
      // time; expiresAtMs beyond appliedAtMs + the longest authored
      // window (TU_LINH_TRAN_DURATION_MS) mints a months-long buff off
      // a forged stamp - clamp to the authored bound. Honest saves are
      // untouched (no authored effect exceeds its duration).
      restoredPlayer.persistentTimedEffects = (restoredPlayer.persistentTimedEffects ?? []).map(
        (effect) => {
          const appliedAtMs = Number.isFinite(effect.appliedAtMs)
            ? Math.min(effect.appliedAtMs, Date.now())
            : effect.appliedAtMs
          const expiresAtMs =
            Number.isFinite(effect.expiresAtMs) && Number.isFinite(appliedAtMs)
              ? Math.min(effect.expiresAtMs, appliedAtMs + TU_LINH_TRAN_DURATION_MS)
              : effect.expiresAtMs
          return {
            ...effect,
            appliedAtMs,
            expiresAtMs,
            modifiers: (effect.modifiers ?? []).filter(isCurrentShapeModifier),
          }
        },
      )

      // Reject a nonsense realmId BEFORE the assign lands it: a crafted
      // save with an unresolvable realm survives Object.assign then
      // throws inside addCultivation below - leaving the live store
      // poisoned and the payload uncommitted, so every retry replays
      // the crash. Fail before the payload mutates anything.
      getCurrentRealm(restoredPlayer.realmId)

      for (const key of Object.keys(this.$state)) {
        if (!(key in restoredPlayer)) {
          Reflect.deleteProperty(this.$state, key)
        }
      }

      Object.assign(this, restoredPlayer)

      // Node level (plan sec6.1) - save cu giua v46 thieu object nay;
      // thieu = chua linh ngo node nao, KHONG duoc de undefined keo
      // getNodeLevel/aggregate crash toan UI (nguyen nhan "khong xoa
      // duoc save" - app chet truoc khi toi duoc Settings).
      this.nodeLevels ??= {}
      this.purchasedNodeIds ??= []

      // Combat AI strategy (plan sec10.2) - save khong co field hoac gia
      // tri sai dung default 'nearest'. Khong migration (development
      // build), fallback du cho development save.
      this.combatAiStrategy = isCombatAiStrategy(save.player.combatAiStrategy)
        ? save.player.combatAiStrategy
        : DEFAULT_COMBAT_AI_STRATEGY

      // Route the offline grant through addCultivation() - same
      // clamp-at-required rule as before (the old `+=` then
      // Math.min was a copy of that rule), plus the M2 Hai Nap
      // overflow bank.
      const cultivationBefore = this.cultivation + this.cultivationOvercharge

      addCultivation(this, offline.cultivation)

      const offlineGained =
        this.cultivation + this.cultivationOvercharge - cultivationBefore

      // T3-26 - the modal reports what the player actually received:
      // addCultivation clamps at the tier requirement (or banks into
      // cultivationOvercharge), so the theoretical elapsed*rate figure is
      // wrong whenever the cap binds. Store and return the real delta.
      const offlineResult = { ...offline, cultivation: offlineGained }

      // M2 - Ngo Dao (spec sec4.3 row 20): the insight_per_cultivation
      // accumulator settles the offline grant too, through the SAME
      // threshold/counters as the online cultivate() path.
      accrueCultivationInsight(this, offlineGained)

      // Ban Menh Phap Bao (doc sec10.2) - sua moi invariant sai ngay sau
      // blind Object.assign() o tren: nghe khong khop, thieu state du
      // du gate, grade/path sai enum, realm/level/EXP vuot tran.
      normalizeArtifactProgress(this)

      // Value-domain coherence on the persisted pool: the base-stat
      // record rebuilds onto authored defaults - main stats clamp to
      // the shared cap (a save claiming more is corrupt or crafted -
      // same bound every legitimate writer already enforces), and every
      // non-main key resets to its authored initial value because no
      // persisted writer ever changes them (attribute allocation and
      // permanent_stat pills write MAIN_STAT_KEYS only). Runs AFTER
      // normalize: the cap is realm-derived, so the clamp reads the
      // corrected realm claim, not the crafted one.
      const normalizedCap = getEffectiveMainStatCap(this)
      const authoredBaseStats = createBaseStats()
      const authoredKeys = new Set(Object.keys(authoredBaseStats))
      const mainKeys = new Set<string>(MAIN_STAT_KEYS)
      for (const key of Object.keys(this.baseStats)) {
        if (!authoredKeys.has(key)) {
          delete (this.baseStats as Record<string, number>)[key]
        }
      }
      for (const key of Object.keys(authoredBaseStats) as StatType[]) {
        this.baseStats[key] = mainKeys.has(key)
          ? Math.min(normalizedCap, this.baseStats[key])
          : authoredBaseStats[key]
      }

      // M1 (ARCH-001) - commit the payload identity only AFTER the whole
      // apply succeeded: a mid-restore throw leaves it uncommitted so a
      // retry with the same payload re-applies instead of being skipped
      // by the guard above.
      lastRestoredPayloads.set(this, { identity: payloadIdentity, offline: offlineResult })

      return offlineResult
    },
  },
})
