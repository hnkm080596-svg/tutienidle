/**
 * baseStats write-authority guard (ruling 2026-09-29).
 *
 * `player.baseStats` is the "real points" pool the hidden-lineage
 * predicate reads (HiddenLineage.isHiddenBreakthroughEligible). The
 * ruling that made permanent_stat pills write baseStats directly came
 * with exactly one enumeration: only TWO income channels may write it.
 *
 *   1. Level-up allocation - GameManagerProgressionOps.allocateAttributePoint
 *   2. Pills - PillSystem.useProfessionPill (permanent_stat + random_main_stat)
 *
 * Both share one bound: getEffectiveMainStatCap. Anything else that
 * needs to move a stat (equipment, buffs, nodes, body refinement)
 * belongs to the modifier/assembly channels and must NOT touch
 * baseStats - that is what keeps the predicate honest.
 *
 * Restore/replace paths (save load, entity mint) assign the whole
 * object or re-derive it through StatBlock/assembly, never mutate
 * baseStats fields in place - those are data movement, not income.
 *
 * Explicitly OUT of scope: test/simulation files (fixtures and driven
 * sessions set up state directly; they are not production authority)
 * and dev-only scripts (they run at build time, never on live state).
 *
 * SCAN MODEL: the guard walks the real TypeScript AST (typescript is
 * already a dev dep via vue-tsc), so whitespace, comments, parens,
 * template/unicode string forms and multi-line layouts cannot hide a
 * write. Coverage: assignment + compound ops, ++/--, delete, for-of/
 * for-in and destructuring targets, Object.assign/defineProperty/
 * defineProperties, Reflect.get/set/defineProperty/deleteProperty/
 * apply/getOwnPropertyDescriptor, .call/.apply on structural names
 * (dot, bracket and const-key callee spellings, parenthesized callees,
 * bare identifiers bound via destructuring or member capture), callee-
 * root aliases (`const O = Object`, `globalThis.Reflect`), Pinia
 * `$patch` (literal, spread, indirect and .call/.apply forms - any
 * opaque receiver flagged), `$state` forged-state replacement and
 * assign-injection (dot, bracket and const-key spellings), pool aliases
 * (rooted access, destructured incl. parameter destructuring and
 * binding-element initializers, parameter default bindings, bracket
 * and const-string-key forms, transitive `const b = a` copies, casts
 * and ternary/`??`/`||` initializers), alias-rooted bare-identifier
 * arguments (`Object.assign(bs, ...)`), nested-indirect callees
 * (`X.call.call(fn, ...)`), `new Proxy(pool)`, toRef/toRefs/
 * storeToRefs write-throughs, reflective reads (Reflect.get,
 * getOwnPropertyDescriptor), root aliases through globalThis/window/
 * self chains, `with` statements, spelled-token payload literals
 * (`{baseStats: ...}`/`{$state: ...}` carried by variable),
 * enumeration-then-narrow member writes inside guarded blocks,
 * test-file import barriers (`import './x.test'` in production),
 * computed/const-key object props (`{[K]: v}` where K='baseStats'),
 * and .vue template lanes (event handlers incl. dynamic `@[expr]`/
 * `#[expr]` argument names, bindings, interpolations, v-model incl.
 * `:arg` and modifier forms). R8 additions: member-position pool
 * aliases (`box.bs = pool` then `box.bs.qi = 9` - accessPath tracking),
 * pool-as-call-arg funnel (`bump(player.baseStats)` with an opaque
 * callee - read-shaped callees enumerated via READ_*), write-ish
 * member calls on ANY root (`P.set(t,k,v)`, lodash-style
 * merge/patch/setIn) when a spelled key or poolish arg is present,
 * for-of/for-in/switch pools spelling a token, eval/`new Function`,
 * 5+-char spelled fragments into string-search members
 * (`k.startsWith('baseS')`), `*.test*` specifier literals in ANY
 * position (import.meta.glob, Worker URLs), `String()`/template
 * literalize, and HTML-comment/nested-mustache-aware template scan.
 * R9 additions: container carriers (`const arr=[pool]` -> `arr[0].x`,
 * `{wrap:{bs:pool}}` nested propAliases, `new Map([[k,pool]])`),
 * pool-carrier/closure call args (`opaque([pool])`,
 * `opaque(() => pool.qi)`, `[pool].forEach(cb)` receiver), IIFE/
 * unresolvable callees (`(0,fn)(pool)`), assignment-pattern
 * destructuring (`({baseStats:x}=player)` gated on poolish RHS),
 * later-write const keys (`K='baseStats'` after decl), class field/
 * param-prop pool binds (`this.pool`), global-name destructuring
 * (`const {eval:e}=globalThis`), member-position dynamic code
 * (`x.eval(c)`, `x.constructor(c)`), string-eval schedulers
 * (setTimeout/setInterval spelled arg), opaque/test-spec `import()`
 * (literalize + data:/blob: channels), new Worker/SharedWorker,
 * `??=`/`&&=`/`||=` on the $state slot, `delete store.$state`,
 * `*.test*` specifier shapes with `*`/`{`/`?` chars (glob patterns,
 * query suffixes), `Object.assign({...}, pool)` fresh-clone
 * exemption, `/player/i` root naming (replaces the `Store$` suffix
 * that over-matched settingsStore) and the pool-arg funnel extended
 * to invoked-member resolution for `.call/.apply/.bind`
 * (`opaque.call(t,pool)` flagged, `Math.min.call(t,v)` exempt via
 * read-shape on the invoked member).
 * R10 additions: for-of element bindings (`for (const w of [pool])`),
 * member-position owners (`gm.player`, `{player:{baseStats}}` nested
 * destructure) tracked as owner aliases vs pool aliases - owner paths
 * reach `x.baseStats` without flagging `x.qi`, comparison guards
 * (`v === player.baseStats`), container-return reads (`arr.at/slice/
 * pop/find`, `arr.entries()`, `const w=arr`), bound pool containers
 * passed to opaque callees, class accessors/methods returning the
 * pool (`get pool(){}` -> `this.pool`), key assembly through pure
 * string methods (`join`/`concat`/trim/case/repeat/pad literalize),
 * indirect opaque code (`eval.call/apply/bind`, `globalThis.eval`
 * capture, `Reflect.apply`/`Reflect.construct`, `const W=Worker`),
 * DOM code-injection sinks (innerHTML/outerHTML/srcdoc writes,
 * insertAdjacentHTML/document.write calls), the Vue attr-comment
 * lane (`title="<!--"` no longer blanks live directives after it),
 * and Vue reader callees (`computed`/`watch`) counted read-shaped.
 * R11 additions: call/new/conditional/await receivers feeding a
 * `.<leaf>` write (`usePlayerStore().baseStats.qi = 9`), renamed-root
 * owners (`const mgr = usePlayerStore()`), bound-identifier carriers
 * (`opaque(wrap)` where `wrap = {ref: pool}`), Map round-trips and
 * bound-var for-of iteration (`for (const w of poolArr)`), number
 * literalize (`.at(-1)`, `String.fromCharCode`, atob/btoa,
 * repeat/pad), member-position spelled keys (`o.k = 'baseStats'` ->
 * `x[o.k]` resolves via constPropKeys), `$state` destructure and
 * `storeToRefs(store)`/`toRefs` destructure aliases, `$subscribe`
 * callback state params, object-literal rhs destructure match
 * (`const {ref:r} = {ref: pool}`), owner-copy binding
 * (`{...player}`, `Object.assign({}, player)`), closure writes
 * through read-shaped callees (`arr.map(() => pool.qi = 9)`),
 * guarded-block narrowing (element/pinned/poolish writes only -
 * plain local writes beside a spelled test stay quiet),
 * console.warn/error/* and Object.freeze/seal counted read-shaped,
 * loop-var shadowing (a bound non-pool `player` beats the root
 * regex), and the .vue lane (v-for alias pool writes, `v-html`
 * expression sinks, `javascript:` attribute URLs, spelled `v-model`
 * member segments, mustaches inside tag attrs skipped).
 * R13 additions: `$state` alias/destructure bindings (`const s =
 * store.$state`, `const { $state } = store`), bound pool thunks
 * (`const f = () => pool; f().x`), bound all-literal array consts
 * (`const a=['baseStats','x']; x[a[0]]`, `x[a.at(0)]`), enumeration
 * element carriers (`for (const [k,v] of Object.entries(player))` +
 * `[k,v]` callback destructure writes inside `k==='baseStats'`
 * guards), container propagation (ELEMENT_READS element binds,
 * CONTAINER_RETURNS copy binds, `[...arr]` spread, `new Map/Set`
 * poolish args, `m.set(k,pool)`/`m.add(pool)` carriers feeding
 * `m.get(k)` element reads), storeToRefs/toRefs member-path roots
 * (`storeToRefs(store).baseStats.value`), v-for pool iterables
 * (`v-for="w in poolContainers"`), thisArg/seed carriers
 * (`[1].map(fn, pool)`, `arr.reduce(cb, pool)`), TSX/JSX script-kind
 * parsing (corpus `.tsx/.jsx/.mjs` files scanned), call-yielding-pool
 * member receivers (`f().x`, `m.get(k).x`, `arr.at(0).x`), param/
 * catch-clause shadowing of binding names (a `(sA) => sA.x = 1`
 * param reads the local, not the file-level `sA` alias - evaluated
 * under withShadow like the body itself), let/var mutable names
 * barred from constKeys, `toRef(obj, field)` pinned to
 * baseStats/$state fields only, and the `.vue` v-pre lane masked.
 * R15 additions: write-target resolution follows the receiver chain
 * only (`writeTargetPoolish`) - pool reads inside element keys, call
 * args or literal interiors of the TARGET expression are no longer
 * counted as writes (fixes the `{...player.baseStats}.qi = 9` clone-
 * write FP), while inline carriers still resolve (`[player][0].x`,
 * `{s: pool}.s.x`); conditional/coalesce/branch key spellings
 * (`x[c?'baseStats':'y']`) resolve via spellsToken everywhere a
 * pinned key is tested; non-declaration `=` binds (`x = pool`,
 * `x = y = pool`, `s = store.$state`, container literals) propagate
 * aliases and non-poolish rebinds clear them; `Object.assign(target,
 * ownerish)` binds target as an owner; `{player: p} = src` binds the
 * spelled owner prop; opaque `require(k)` and `import.meta.glob`
 * specs flag as unscanned-code lanes; `rest.spread`/`bind`-arg
 * spelled payloads ({baseStats: ...} literals) to unresolvable
 * callees flag; DOM second-tier sinks (textContent/innerText/src/
 * href) flag when the RHS payload itself spells a pool write;
 * `v-model="rec[k]"` on an unbound root is a shape (FP2) while
 * `v-model="player[k]"` flags; every local tree walker is iterative
 * (`walkAll`) and a sourcefile whose AST exceeds MAX_NODE_DEPTH is
 * flagged rather than crashing the scan.
 * R14 additions: owner-yielding callee bindings (`const f =
 * usePlayerStore; f()`, `function getP() { return usePlayerStore() }`
 * declarations and owner-returning arrows), same-file pool-param
 * call sites (`function f(s) { s.baseStats.qi = 9 }; f(player)` -
 * inter-procedural within one file only, cross-file is the bound),
 * `const { baseStats } = store.$state` + `$state` enumeration
 * (`Object.entries(store.$state)` in for-of/callback/bound-array
 * lanes), `store.$onAction(({store}) => ...)` context destructure,
 * owner-copy receivers (`Object.assign({}, player).baseStats`,
 * `{...player}.baseStats`), nested pool carriers (`[{bs: pool}]`
 * arrays, `{wrap:{bs:pool}}` objects + `const [c] = [{bs:pool}]`
 * member paths feeding .vue `v-for="{bs} in carriers"`
 * destructures), and inspect-time for-of
 * loop-var shadowing (`const s=pool; for (const s of rows)` - the
 * row name suppresses file aliases inside the loop body only).
 *
 * R16 (AUT-R15 adjudication - callback-param pools + param lanes):
 * generic callback params on a pool-carrying channel now bind the
 * pool element via enumElems - `[pool].forEach(b => {b.qi=9})`,
 * `Object.values(player).forEach(cb)`, `arr.entries()` on a bound
 * carrier, `watch(()=>pool, b=>...)`, `(async()=>pool)().then(cb)`,
 * `Array.prototype.forEach.call(arr, cb)` (S1/S2/S3); `paramNames`
 * scope per function so `f(p) { p.baseStats.qi=9 }`/`p[k]`/`delete
 * p[k]` flag at the definition site while `f(player)` call-side
 * stays the documented owner-arg bound (S6/S7); `let k='baseStats'`
 * seeds constKeys and ANY reassignment clears it, enum member
 * literals land in constPropKeys (`player[K.B]`), opaque element
 * keys on poolish/param receivers flag (S4); `computed`/`ref`-family
 * decls bind refAliases so `c.value.qi` resolves (S2); renamed and
 * namespace owner imports (`as registry`, `* as ns`) resolve through
 * ownerFactories/nsNamespaces incl. opaque-callee funnel args
 * (S5/S6); `Object.create(poolish)` binds ownerAliases (S10);
 * `<textarea>`/`<title>` rawtext joined the inert mask, test
 * specifier matching covers `tests?`/`__tests__`/`e2e` path
 * segments, and fake `// describe(` comments no longer mark test
 * files (S8/S9 in helpers/scanTs.ts). F-adjudications: a spelled
 * element key must RIDE a poolish/param receiver so `dto['baseStats']`
 * stays a shape write (F1); `{player}=dto` destructures shadow the
 * bound name on non-poolish rhs (F2 - shorthand `{player}` supplies
 * propNameText from el.name since propertyName is absent); owner
 * factories are the exact name set, not a `use*` regex (F3);
 * `Array.from` is read-shaped (F8).
 *
 * R16 fix-ups after probe verification: walkAll now pushes children
 * reversed so the LIFO pop visits siblings in SOURCE order - pass-1
 * bindings (`const arr = [player.baseStats]`) exist before a later
 * sibling (`for (const e of arr)`, `const v = arr[0]`) is collected
 * (previously reverse order left poolContainers empty at the consumer,
 * silencing bound-carrier enumeration). poolishBindingSource also
 * counts a spelled `.baseStats`/`['baseStats']` slot on a
 * poolish-name/owner receiver even when the root is a plain local
 * literal, so `[player.baseStats]` marks its binding a pool carrier.
 * v-for iterables count any poolish ident inside the source
 * expression (`v-for="v in Object.values(player)"`, `v-for="v in
 * player"`) as a pool-carrying iterable (S12).
 *
 * R17 (AUT-R16 adjudication): destructure-pattern write targets now
 * walk pattern interiors (`({a: pool.qi} = src)`, `[x.baseStats] =
 * ...` - R16 F1); `new C(pool)` / `new Map([[k,pool]])` constructor
 * args mark the result a pool carrier (F2); reflective proto/
 * descriptor reads yield poolish carriers
 * (`Object.getPrototypeOf(player)`, `getOwnPropertyDescriptors`,
 * `getOwnPropertyDescriptor` with a spelled key - F3); spelled
 * path-key args flag beside a poolish arg (`f(player,
 * 'baseStats.qi', v)` / `f(player, ['baseStats','qi'], v)` - lodash
 * .set-style funnels, F4); opaque-code globals bind through literal
 * members (`{e: eval}`, `o.e = eval`, `[eval]`, `{F2} = {F2:
 * Function}`) into opaqueCodePaths/rootAliases, member-rooted
 * indirect calls flag (`globalThis.eval.call(null, code)`), and
 * aliased schedulers flag on any arg (F5/F6); array bindings of
 * pool-carrying elements mark containers (F7). FP adjudications:
 * `assign({...fresh}, pool)` under isStructuralCall drops the bare
 * `pool(a)` clause (clone, FP9); `{ $state } = cfg` destructure
 * requires a state-ish source (FP10). Bound: `getPlayer().baseStats
 * .qi` through an opaque getter (F8 - getter origin unprovable);
 * rooted schedulers with an opaque arg (function-vs-string).
 *
 * Honest residual bound (documented, not hidden): computed keys that
 * never spell the name (`p[k]` with a computed k, Reflect.set with a
 * variable key), opaque payload data flow where no `baseStats`/`$state`
 * token appears and no poolish root is visible (`Object.assign(cfg,
 * payloadVar)` on a local), runtime name enumeration
 * (`Object.keys`/`Reflect.ownKeys` then `ps[name]` without a spelled
 * comparison or fragment), imported bindings, cross-file pool-param
 * lanes (a callee in another file whose param writes `p.baseStats` -
 * the fnPoolParams lane covers same-file calls only), `x.$state`
 * carried to an opaque callee (`applySnapshot(store.$state)` -
 * indistinguishable from the corpus idiom where `player.$state` IS
 * the state argument of every helper call; the same lane via
 * `fn(player)` is equally invisible), deep transitive
 * aliasing beyond the ordered-declaration lanes above, fragments
 * shorter than 5 chars, generator-carried pools (`poolGen()` calls
 * that yield the pool across a boundary the declaration lanes cannot
 * see), and writes authored inside the allowlisted files
 * themselves - the allowlist IS the trust boundary. The `*.test.*`
 * exemption requires a
 * vitest/describe/it/test marker in the file text - a smuggler could
 * fake the marker inside a comment, which is why the real stop is the
 * import barrier: a file no production module imports writes nothing.
 * Corpus boundary: only `src/` + `electron/` production files are
 * scanned; files at the `game/` root, `tools/`, `scripts/` or
 * `public/` are dev/build tooling that never ships as runtime code -
 * a spelled write there is human-review territory.
 * Those are human-review lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  srcCorpus,
  SCAN_TIMEOUT,
  looksLikeTestFile,
  isTestSpecifier,
  templateExpressions,
  stripVueInert,
} from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const ELECTRON_DIR = join(GAME_ROOT, 'electron')

interface AllowedFile {
  path: string
  contract: string
}

const ALLOWED: AllowedFile[] = [
  {
    path: 'src/core/game/GameManagerProgressionOps.ts',
    contract:
      'Level-up allocation authority: allocateAttributePoint spends attributePoints into baseStats, bounded by getEffectiveMainStatCap.',
  },
  {
    path: 'src/core/pill/PillSystem.ts',
    contract:
      'Pill stat channel authority: useProfessionPill writes permanent_stat/random_main_stat grants into baseStats, bounded by the same cap (canUseProfessionPill).',
  },
  {
    path: 'src/stores/player.ts',
    contract:
      'Restore-time migration fold: retired pill-permanent:* modifiers fold their earned flat into baseStats once during load (bounded by getEffectiveMainStatCap); the modifier is dropped so the fold is idempotent, not a new grant channel.',
  },
]

/** Replace `v-pre` element subtrees in a .vue template with blanks
 * (newlines preserved): their contents are never evaluated, so any
 * expression inside is a false-positive source, not a lane. */
function maskVPreRegions(text: string): string {
  let out = text
  const openRe =
    /<([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)\bv-pre\b((?:"[^"]*"|'[^']*'|[^>"'])*?)>/g
  let m: RegExpExecArray | null
  const blanks: [number, number][] = []
  while ((m = openRe.exec(text)) !== null) {
    const tag = m[1]
    const openEnd = openRe.lastIndex
    const isSelfClose = /\/\s*>$/.test(m[0])
    let end: number
    if (isSelfClose) {
      end = openEnd
    } else {
      const closeIdx = text.indexOf(`</${tag}`, openEnd)
      end = closeIdx === -1 ? openEnd : closeIdx
    }
    blanks.push([m.index, end])
  }
  if (blanks.length === 0) return text
  const chars = out.split('')
  for (const [s, e] of blanks) {
    for (let i = s; i < e && i < chars.length; i++) {
      if (chars[i] !== '\n') chars[i] = ' '
    }
  }
  return chars.join('')
}

/** Script text of a source file (vue SFCs contribute script blocks only). */
function scriptText(path: string, text: string): { body: string; jsx: boolean }[] {
  if (path.endsWith('.vue')) {
    return scriptBlocksOf(text).map((b) => ({ body: b.body, jsx: b.jsx }))
  }
  return [{ body: text, jsx: path.endsWith('.tsx') || path.endsWith('.jsx') }]
}

/** Transparent wrappers around an expression: parens, nonnull, as,
 * satisfies, angle-bracket casts - they never change which object the
 * expression yields. */
function unwrapExpr(e: ts.Expression): ts.Expression {
  let cur = e
  for (;;) {
    if (
      ts.isParenthesizedExpression(cur) ||
      ts.isNonNullExpression(cur) ||
      ts.isAsExpression(cur) ||
      ts.isSatisfiesExpression(cur)
    ) {
      cur = cur.expression
    } else if (cur.kind === ts.SyntaxKind.TypeAssertionExpression) {
      cur = (cur as ts.TypeAssertion).expression
    } else if (
      ts.isBinaryExpression(cur) &&
      cur.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      // `(0, x)` yields x - a comma-sequence alias lane.
      cur = cur.right
    } else {
      return cur
    }
  }
}

const GLOBAL_ROOTS = new Set([
  'globalThis',
  'window',
  'self',
  'parent',
  'frames',
  'top',
])
const REFLECTIVE_READ_NAMES = new Set(['get', 'getOwnPropertyDescriptor', 'has'])
const REF_FACTORIES = new Set(['toRef', 'toRefs', 'storeToRefs'])
// `computed`/`ref`-family calls whose RESULT carries the pool behind
// `.value`: `computed(() => player.baseStats)` -> `c.value.qi` is a
// pool write (R15 S2).
const REF_VALUE_FACTORIES = new Set([
  'computed', 'ref', 'shallowRef', 'customRef', 'toRef',
])
const INDIRECT_NAMES = new Set(['bind', 'call', 'apply'])
/** Read-shaped members on a pool container that yield the pool
 * element(s) or a pool-carrying container (`arr.at(0)`, `m.get(k)`,
 * `arr.slice()`, `arr.entries()`). */
const POOL_ELEMENT_METHODS = new Set([
  'at', 'find', 'findLast', 'pop', 'shift', 'slice', 'flat',
  'flatMap', 'concat', 'filter', 'map', 'entries', 'values', 'keys',
  'get', 'splice', 'toReversed', 'toSorted', 'toSpliced', 'with',
  'reverse',
])
/** Global names a destructure (`const {eval: e} = globalThis`) can
 * capture into a local handle. */
const GLOBAL_NAMES = new Set([
  'eval', 'Function', 'Object', 'Reflect', 'Proxy', 'Worker',
  'SharedWorker', 'Promise', 'globalThis', 'window', 'setTimeout',
  'setInterval', 'document', 'import', 'require', 'process',
])
/** A root that names the live pool owner. `player` anywhere in the
 * root identifier (playerData, playerStore, myPlayer, savePlayer)
 * counts; a `Store$` suffix alone does NOT (settingsStore/uiStore
 * over-match - verified FP). */
const POOLISH_ROOT_RE =
  /player|^ps$|^store$|^usePlayerStore$|^playerStore$|^playerState$/i
// SCREAMING_CASE names are constants (PLAYER_ID,
// PLAYER_ANIMATION_PREFIXES, MAIN_STAT_KEYS), never mutable store
// roots - the `/player/` substring is a deliberate conservatism, not
// an invitation to flag every constant that spells one.
const SCREAMING_CONST_RE = /^[A-Z0-9_$]+$/
const poolishName = (t: string): boolean =>
  POOLISH_ROOT_RE.test(t) && !SCREAMING_CONST_RE.test(t)
// A call returning the pool OWNER only when the callee is a
// store-factory shape: `use*` factories (`usePlayerStore`,
// `usePlayer`) or an exact poolish name (`playerStore()`, `ps()`).
// A plain domain function naming `*Player*`
// (`resolvePlayerFinalStats`, `buildPlayerRewardReceiver`,
// `createPlayerRewardReceiver`) returns a DERIVED value, not the
// store - it is not an owner source.
// Exact store-factory names only: a `use*` composable that merely
// contains 'player' (`usePlayerView`) returns a DTO, not the owner
// (R15 F3). Renamed imports land in `ownerFactories` instead.
const OWNER_FACTORY_NAMES = new Set([
  'usePlayerStore', 'usePlayer', 'usePlayerState',
  'playerStore', 'playerState', 'ps', 'store',
])
const isOwnerFactoryName = (t: string): boolean =>
  OWNER_FACTORY_NAMES.has(t)
const isOwnerFactoryCallee = (callee: ts.Expression): boolean => {
  return ts.isIdentifier(callee) && isOwnerFactoryName(callee.text)
}

/** Static knowledge a file's declarations yield: which identifiers are
 * bound to what. */
interface Bindings {
  aliases: Set<string>
  /** Identifier bound to the pool OWNER (`const s = player`) - not
   * the pool itself. `s.baseStats` reaches the pool; `s.qi` does not
   * (the owner's own field is a different key domain). */
  ownerAliases: Set<string>
  payloadAliases: Set<string>
  constKeys: Map<string, string>
  rootAliases: Map<string, string>
  memberAliases: Map<string, { member: string; root: string }>
  /** Dotted access paths bound to the pool: `box.bs`, `this.pool`,
   * `box.nested.deep` (literalized element keys joined as segments). */
  propAliases: Set<string>
  /** Dotted access paths bound to the pool OWNER: `this.player =
   * player`, `get f() { return player }`. */
  ownerPropPaths: Set<string>
  /** Identifier bound to a container literal whose elements include
   * the pool: `const arr = [pool]` -> element access `arr[0]` yields
   * the pool. Also covers object-literal carriers `{ref: pool}`. */
  poolContainers: Set<string>
  /** Member positions bound to a spelled string: `const o = {k:
   * 'baseStats'}` or `o.k = 'baseStats'` -> constPropKeys['o.k'].
   * Feeds `x[o.k]` element keys. */
  constPropKeys: Map<string, string>
  /** Loop variables proven NOT pool: `for (const player of rows)`
   * where the iterable carries no pool - the name shadows the
   * player-ish root regex but the source pins its domain. */
  shadowed: Set<string>
  /** .vue v-for variable names: `<div v-for="row in rows">` -
   * template expressions share the module binds, and a spelled
   * baseStats write on a v-for alias is a lane. */
  vForNames: Set<string>
  /** .vue v-for loop vars whose iterable carries the pool:
   * `v-for="bs in poolBuckets"` with `poolBuckets = [player.baseStats]`
   * - `bs.<any>` writes the pool even with no spelled leaf. */
  vForPoolNames: Set<string>
  /** Identifier bound to a thunk that returns the pool:
   * `const f = () => player.baseStats` - `f()` yields it. */
  poolThunks: Set<string>
  /** Param names a `store.$onAction(({store: s}) => ...)` context
   * destructure binds to the store: the framework feeds the owner
   * into the param, so a function-likes param shadow must NOT drop
   * it (it is an owner binding, not a local). */
  onActionBound: Set<string>
  /** Identifier bound to a thunk that returns the pool OWNER:
   * `function getP() { return usePlayerStore() }` - `getP()` yields
   * the store whose `.baseStats` is the pool. */
  ownerThunks: Set<string>
  /** Same-file functions whose params are used as pool roots in the
   * body (`function f(s) { s.baseStats.qi = 9 }`): a call feeding an
   * owner into a marked index is a lane the local scan cannot see. */
  fnPoolParams: Map<string, Set<number>>
  /** Element names bound to Object.entries/values of a pool owner:
   * `for (const [k,v] of Object.entries(player))` or a `.map/.forEach`
   * callback destructure over the same - a member write on `v` inside
   * a spelled-key narrow is a lane. */
  enumElems: Set<string>
  /** `const e = Object.entries(player)` - a bound entries/values array
   * feeding for-of or callback destructures. */
  enumArrays: Set<string>
  /** `const a = ['baseStats', 'x']` - a bound array whose every element
   * literalizes; `x[a[0]]` / `x[a.at(0)]` resolve the spelled key. */
  arrayConsts: Map<string, readonly string[]>
  /** Names declared with let/var - a constKeys entry for them goes
   * stale on the first reassignment. */
  mutableNames: Set<string>
  /** Names of parameters of the enclosing function-likes currently in
   * scan scope: a `p.baseStats` member write inside `f(p)` writes
   * whatever callers feed - flagging the definition site is the only
   * static handle on the cross-file lane (R15 S6/S7). */
  paramNames: Set<string>
  /** `const c = computed(() => player.baseStats)` / `ref(pool)` - a
   * ref whose `.value` member IS the pool slot (R15 S2). */
  refAliases: Set<string>
  /** Renamed owner-factory imports: `import { usePlayerStore as
   * registry }` -> `registry()` yields the owner (R15 S5). */
  ownerFactories: Set<string>
  /** `import * as ns` namespace bindings - `ns.usePlayerStore()`
   * resolves through the namespace (R15 S5). */
  nsNamespaces: Set<string>
  /** Dotted member paths bound to an opaque-code global:
   * `const o = {e: eval}` / `o.e = eval` -> `o.e(code)` runs code
   * through a path the GLOBAL_NAMES callee scan cannot see (R16 F5). */
  opaqueCodePaths: Set<string>
  /** Named function whose body writes `this.baseStats`/`this.$state`:
   * `f.call(player)` / `f.apply` / `f.bind` or `player.m = fn; m()`
   * carries the owner as `this` (R17 B2). */
  thisWriters: Set<string>
  /** Member paths bound to a name in thisWriters: `player.m = fn`
   * then `player.m()` dispatches the this-writer (R17 B2). */
  thisWriterPaths: Map<string, string>
}

/** Evaluate a spelled string position: literal, const-key binding, or
 * a concat of spelled pieces (`'$'+'patch'`). Returns undefined when
 * any part is not statically spelled. */
const LITERALIZE_DEPTH_CAP = 400

function literalize(e: ts.Expression | undefined, b: Bindings, depth = 0): string | undefined {
  if (e === undefined || depth > LITERALIZE_DEPTH_CAP) return undefined
  const un = unwrapExpr(e)
  if (ts.isStringLiteral(un) || ts.isNoSubstitutionTemplateLiteral(un)) {
    return un.text
  }
  if (ts.isIdentifier(un)) {
    return b.constKeys.get(un.text)
  }
  // `a[0]` / `a[i]` on a bound all-string array (`const a = ['baseStats']`).
  if (ts.isElementAccessExpression(un) && un.argumentExpression !== undefined) {
    const arrRecv = unwrapExpr(un.expression)
    if (ts.isIdentifier(arrRecv)) {
      const arr = b.arrayConsts.get(arrRecv.text)
      const idx = literalizeNumber(un.argumentExpression, b)
      if (arr !== undefined && idx !== undefined) {
        return arr[idx < 0 ? arr.length + idx : idx]
      }
    }
  }
  // `'a'+'a'+'a'+...` - left-associative chains iterate on the left
  // spine so deep concats cannot blow the call stack.
  if (
    ts.isBinaryExpression(un) &&
    un.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const parts: string[] = []
    let cur: ts.Expression = un
    for (;;) {
      const u = unwrapExpr(cur)
      if (
        ts.isBinaryExpression(u) &&
        u.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const r = literalize(u.right, b, depth + 1)
        if (r === undefined) return undefined
        parts.unshift(r)
        cur = u.left
        continue
      }
      const head = literalize(u, b, depth + 1)
      if (head === undefined) return undefined
      parts.unshift(head)
      break
    }
    return parts.join('')
  }
  // `base${'S'}tats` - a template whose every embedded expression spells.
  if (ts.isTemplateExpression(un)) {
    let joined = un.head.text
    for (const span of un.templateSpans) {
      const mid = literalize(span.expression, b, depth + 1)
      if (mid === undefined) return undefined
      joined += mid + span.literal.text
    }
    return joined
  }
  // `String.raw\`baseStats\`` - the cooked value equals the template
  // pieces verbatim; a tag that is not String.raw returns undefined.
  if (ts.isTaggedTemplateExpression(un)) {
    const tag = unwrapExpr(un.tag)
    const isStringRaw =
      (ts.isPropertyAccessExpression(tag) &&
        tag.name.text === 'raw' &&
        ts.isIdentifier(unwrapExpr(tag.expression)) &&
        (unwrapExpr(tag.expression) as ts.Identifier).text === 'String') ||
      (ts.isIdentifier(tag) && tag.text === 'String.raw') ||
      (ts.isIdentifier(tag) && b.constKeys.get(tag.text) === 'String.raw')
    if (isStringRaw) {
      const t = un.template
      if (ts.isNoSubstitutionTemplateLiteral(t)) return t.text
      if (ts.isTemplateExpression(t)) {
        let joined = t.head.text
        for (const span of t.templateSpans) {
          const mid = literalize(span.expression, b, depth + 1)
          if (mid === undefined) return undefined
          joined += mid + span.literal.text
        }
        return joined
      }
    }
  }
  // String('x') incl. rooted forms (globalThis.String, window.String).
  // Symbol keys are NOT resolved: `p[Symbol.for('baseStats')]` writes a
  // symbol-keyed prop, never the string pool - resolving it would flag
  // a same-named but disjoint key domain (a real false positive).
  if (ts.isCallExpression(un)) {
    const callee = unwrapExpr(un.expression)
    const isStringCtor =
      (ts.isIdentifier(callee) && callee.text === 'String') ||
      (ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'String' &&
        resolveRoot(callee.expression, b) === '')
    if (
      isStringCtor &&
      un.arguments.length === 1 &&
      un.arguments[0] !== undefined
    ) {
      return literalize(un.arguments[0], b, depth + 1)
    }
    // `td.decode('baseStats')` / `new TextDecoder().decode(x)` - a
    // pure decoder call yields its literal argument verbatim (R15 S4).
    if (
      (ts.isPropertyAccessExpression(callee) && callee.name.text === 'decode') &&
      un.arguments[0] !== undefined
    ) {
      const dec = literalize(un.arguments[0], b, depth + 1)
      if (dec !== undefined) return dec
    }
    // Pure string methods on spelled receivers: `[a,b].join('')`,
    // `'x'.concat(y)`, trim/case/repeat/pad - deterministic assembly
    // channels for the key name.
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) {
      const m =
        ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : literalize(callee.argumentExpression, b, depth + 1)
      const recv = unwrapExpr(callee.expression)
      // `['a','b'].join('')` AND its split/reverse precursors:
      // `'baseStats'.split('').join('')`, `.split('').reverse().join('')`.
      if (m === 'join') {
        const piecesOf = (recv0: ts.Expression): string[] | undefined => {
          const r = unwrapExpr(recv0)
          if (ts.isArrayLiteralExpression(r)) {
            const parts: string[] = []
            for (const el of r.elements) {
              const piece = ts.isSpreadElement(el)
                ? el.expression
                : (el as ts.Expression)
              const lit = literalize(piece, b, depth + 1)
              if (lit === undefined) return undefined
              parts.push(lit)
            }
            return parts
          }
          if (ts.isCallExpression(r)) {
            const rc = unwrapExpr(r.expression)
            if (
              ts.isPropertyAccessExpression(rc) ||
              ts.isElementAccessExpression(rc)
            ) {
              const rm =
                ts.isPropertyAccessExpression(rc)
                  ? rc.name.text
                  : literalize(rc.argumentExpression, b, depth + 1)
              if (rm === 'split') {
                const src = literalize(rc.expression, b, depth + 1)
                if (src === undefined) return undefined
                if (r.arguments.length === 0) return [src]
                const sep = literalize(r.arguments[0], b, depth + 1)
                return sep === undefined ? undefined : src.split(sep)
              }
              if (rm === 'reverse') {
                const inner = piecesOf(rc.expression)
                return inner === undefined ? undefined : [...inner].reverse()
              }
            }
          }
          return undefined
        }
        const parts = piecesOf(recv)
        if (parts !== undefined) {
          const sep =
            un.arguments[0] !== undefined
              ? literalize(un.arguments[0], b, depth + 1)
              : undefined
          return parts.join(sep ?? ',')
        }
      }
      // `['a','b'].at(1)` on an array literal of spelled pieces; also
      // `a.at(i)` on a bound all-string array.
      if (m === 'at') {
        const idx = literalizeNumber(un.arguments[0], b)
        if (idx !== undefined) {
          if (ts.isArrayLiteralExpression(recv)) {
            const el = recv.elements[idx < 0 ? recv.elements.length + idx : idx]
            if (el !== undefined) {
              const lit = literalize(el as ts.Expression, b, depth + 1)
              if (lit !== undefined) return lit
            }
          } else if (ts.isIdentifier(recv)) {
            const arr = b.arrayConsts.get(recv.text)
            if (arr !== undefined) {
              return arr[idx < 0 ? arr.length + idx : idx]
            }
          }
        }
      }
      // `String.fromCharCode(...)` - encoded key assembly.
      if (m === 'fromCharCode' && resolveRoot(recv, b) === 'String') {
        const nums: number[] = []
        let ok = true
        for (const a of un.arguments) {
          const num = literalizeNumber(a, b)
          if (num === undefined) {
            ok = false
            break
          }
          nums.push(num)
        }
        if (ok) return String.fromCharCode(...nums)
      }
      const recvLit = literalize(recv, b, depth + 1)
      if (recvLit !== undefined && m !== undefined) {
        const arg0 =
          un.arguments[0] !== undefined
            ? literalize(un.arguments[0], b, depth + 1)
            : undefined
        switch (m) {
          case 'concat': {
            const rest: string[] = []
            let ok = true
            for (const a of un.arguments) {
              const lit = literalize(a, b, depth + 1)
              if (lit === undefined) {
                ok = false
                break
              }
              rest.push(lit)
            }
            if (ok) return recvLit + rest.join('')
            break
          }
          case 'trim':
            return recvLit.trim()
          case 'toLowerCase':
            return recvLit.toLowerCase()
          case 'toUpperCase':
            return recvLit.toUpperCase()
          case 'repeat': {
            const n = literalizeNumber(un.arguments[0], b)
            if (n !== undefined && n >= 0 && n <= 4096) return recvLit.repeat(n)
            break
          }
          case 'slice':
          case 'substring': {
            const a = literalizeNumber(un.arguments[0], b)
            if (a === undefined) break
            const bArg =
              un.arguments[1] !== undefined
                ? literalizeNumber(un.arguments[1], b)
                : undefined
            return m === 'slice'
              ? recvLit.slice(a, bArg)
              : recvLit.substring(a, bArg)
          }
          case 'substr': {
            const a = literalizeNumber(un.arguments[0], b)
            if (a === undefined) break
            const bArg =
              un.arguments[1] !== undefined
                ? literalizeNumber(un.arguments[1], b)
                : undefined
            return recvLit.substr(a, bArg)
          }
          case 'charAt': {
            const a = literalizeNumber(un.arguments[0], b)
            if (a !== undefined) return recvLit.charAt(a)
            break
          }
          case 'charCodeAt': {
            const a = literalizeNumber(un.arguments[0], b)
            if (a !== undefined) return String(recvLit.charCodeAt(a))
            break
          }
          case 'at': {
            const a = literalizeNumber(un.arguments[0], b)
            if (a !== undefined) return recvLit.at(a)
            break
          }
          case 'replace':
          case 'replaceAll': {
            const a1 =
              un.arguments[1] !== undefined
                ? literalize(un.arguments[1], b, depth + 1)
                : undefined
            if (arg0 !== undefined && a1 !== undefined) {
              return m === 'replace'
                ? recvLit.replace(arg0, a1)
                : recvLit.replaceAll(arg0, a1)
            }
            break
          }
          case 'padStart': {
            const n = literalizeNumber(un.arguments[0], b)
            if (n !== undefined) {
              const fill =
                un.arguments[1] !== undefined
                  ? literalize(un.arguments[1], b, depth + 1)
                  : ' '
              if (fill !== undefined) return recvLit.padStart(n, fill)
            }
            break
          }
          case 'padEnd': {
            const n = literalizeNumber(un.arguments[0], b)
            if (n !== undefined) {
              const fill =
                un.arguments[1] !== undefined
                  ? literalize(un.arguments[1], b, depth + 1)
                  : ' '
              if (fill !== undefined) return recvLit.padEnd(n, fill)
            }
            break
          }
        }
      }
    }
    // `atob('...')` / `btoa` - base64-encoded key assembly (browser
    // globals resolvable through root aliases).
    if (ts.isIdentifier(callee)) {
      const name = b.rootAliases.get(callee.text) ?? callee.text
      if (
        (name === 'atob' || name === 'btoa') &&
        un.arguments[0] !== undefined
      ) {
        const arg = literalize(un.arguments[0], b, depth + 1)
        if (arg !== undefined) {
          return name === 'atob'
            ? Buffer.from(arg, 'base64').toString('binary')
            : Buffer.from(arg, 'binary').toString('base64')
        }
      }
    }
  }
  // Member-position key binding: `o.k` / `o['k']` where the object
  // spelled a literal value earlier (`const o = {k:'baseStats'}` or
  // `o.k = 'x'`).
  if (
    ts.isPropertyAccessExpression(un) ||
    ts.isElementAccessExpression(un)
  ) {
    const p = accessPath(un, b)
    if (p !== undefined) {
      const v = b.constPropKeys.get(p)
      if (v !== undefined) return v
    }
  }
  return undefined
}

/** Evaluate a spelled NUMBER position: literal, const-key digits, or
 * unary +/- on a spelled operand - feeds index/string-method args. */
function literalizeNumber(e: ts.Expression | undefined, b: Bindings): number | undefined {
  if (e === undefined) return undefined
  const un = unwrapExpr(e)
  if (ts.isNumericLiteral(un)) return Number(un.text)
  if (ts.isIdentifier(un)) {
    const v = b.constKeys.get(un.text)
    return v !== undefined && /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : undefined
  }
  if (ts.isPrefixUnaryExpression(un)) {
    const v = literalizeNumber(un.operand, b)
    if (v === undefined) return undefined
    if (un.operator === ts.SyntaxKind.MinusToken) return -v
    if (un.operator === ts.SyntaxKind.PlusToken) return v
  }
  return undefined
}

/** Resolve a member-access root through one-level aliases and global
 * roots (`window`, `self`, `globalThis.globalThis`, `const O=Object`). */
function resolveRoot(expr: ts.Expression, b: Bindings): string {
  let cur: ts.Expression = expr
  const names: string[] = []
  while (ts.isPropertyAccessExpression(cur)) {
    names.unshift(cur.name.text)
    cur = cur.expression
  }
  if (ts.isIdentifier(cur)) {
    const aliased = b.rootAliases.get(cur.text)
    names.unshift(aliased ?? cur.text)
  }
  while (names[0] !== undefined && GLOBAL_ROOTS.has(names[0])) names.shift()
  return names.join('.')
}

interface CalleeInfo {
  member: string
  root: string
}

/** Resolve a call callee across spellings: `x.y()`, `x['y']()`,
 * `x['$'+'y']()`, `x[K]()`, `(x.y)()`, bare `f()` where f was bound to
 * a member via capture or destructuring. */
function resolveCallee(expr: ts.Expression, b: Bindings): CalleeInfo | undefined {
  const callee = unwrapExpr(expr)
  if (ts.isPropertyAccessExpression(callee)) {
    return { member: callee.name.text, root: resolveRoot(callee.expression, b) }
  }
  if (ts.isElementAccessExpression(callee)) {
    const name = literalize(callee.argumentExpression, b)
    if (name !== undefined) {
      return { member: name, root: resolveRoot(callee.expression, b) }
    }
    return undefined
  }
  if (ts.isIdentifier(callee)) {
    const bound = b.memberAliases.get(callee.text)
    if (bound !== undefined) {
      return { member: bound.member, root: bound.root === '__expr__' ? '' : bound.root }
    }
    return { member: callee.text, root: '' }
  }
  return undefined
}

/** Is `node` a property/element access naming baseStats, a reflective
 * read returning the pool (`Reflect.get`, `Object.getOwnPropertyDescriptor`),
 * or a ref factory bound to the pool name (`toRef(x,'baseStats')`)?
 * Callee roots resolve through aliases; keys literalize concats and
 * const bindings. */
/** Is the RECEIVER of a member access a pool owner? The root naming
 * policy: an identifier that is a bound alias/container or matches
 * the player-ish root regex is a pool owner; a member leaf carrying
 * `player` (`gm.player`, `store.state.player`, `x.playerData`) is
 * too. `cfg.baseStats` on an unbound local is a shape, not the pool. */
function receiverPoolish(e: ts.Expression, b: Bindings): boolean {
  const u = unwrapExpr(e)
  if (ts.isIdentifier(u)) {
    if (b.shadowed.has(u.text)) return false
    return (
      b.aliases.has(u.text) ||
      b.ownerAliases.has(u.text) ||
      b.poolContainers.has(u.text) ||
      b.enumElems.has(u.text) ||
      poolishName(u.text)
    )
  }
  if (ts.isPropertyAccessExpression(u) || ts.isElementAccessExpression(u)) {
    const p = accessPath(u, b)
    if (
      p !== undefined &&
      (b.propAliases.has(p) || b.ownerPropPaths.has(p))
    ) {
      return true
    }
    const leaf =
      ts.isPropertyAccessExpression(u)
        ? u.name.text
        : literalize(u.argumentExpression, b)
    // `c.value` on a pool-bound ref (`computed(() => player.baseStats)`)
    // resolves the pool slot itself (R15 S2).
    if (leaf === 'value') {
      const rootU = unwrapExpr(u.expression)
      if (ts.isIdentifier(rootU) && b.refAliases.has(rootU.text)) {
        return true
      }
    }
    if (leaf !== undefined && poolishName(leaf)) return true
    // `$state` is a Pinia-name member: `x.$state.baseStats` reaches
    // the pool through the state slot even when `x` is opaque.
    if (leaf === '$state') return true
    // `this.$store` / `getCurrentInstance().proxy.$store` - the Options-API
    // store member on an opaque root (R15 S11).
    if (leaf === '$store' || leaf === '$pinia') return true
    return receiverPoolish(u.expression, b)
  }
  // `{...player}.baseStats` - a spread copy of the owner carries the
  // same member refs; `.baseStats` on the result IS the pool object.
  if (ts.isObjectLiteralExpression(u)) {
    return u.properties.some(
      (p) =>
        ts.isSpreadAssignment(p) && receiverPoolish(p.expression, b),
    )
  }
  // `(c ? pool : other).x`, `(pool ?? {}).x`, `(await s).x` - the
  // receiver of the write is whatever the inner expr yields.
  if (ts.isConditionalExpression(u)) {
    return (
      receiverPoolish(u.whenTrue, b) || receiverPoolish(u.whenFalse, b)
    )
  }
  if (
    ts.isBinaryExpression(u) &&
    (u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      u.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      u.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
  ) {
    return receiverPoolish(u.left, b) || receiverPoolish(u.right, b)
  }
  if (ts.isAwaitExpression(u)) {
    return receiverPoolish(u.expression, b)
  }
  // Call/new receivers resolve by callee SHAPE:
  //  - `usePlayerStore()` / `new PlayerStore()` - a store-factory name
  //    (`use*` + poolish, or an exact poolish identifier) yields the
  //    owner. A plain domain function naming `*Player*`
  //    (`resolvePlayerFinalStats`, `createPlayerRewardReceiver`)
  //    returns a DERIVED value, not the pool - it is NOT a source.
  //  - `store.get('baseStats')` / `store.get('$state')` - pinned key.
  //  - `storeToRefs(store)` / `toRef(store,'baseStats')` - ref factory
  //    bound to a poolish arg yields a pool-linked ref.
  //  - `(() => player.baseStats)()` - an IIFE returning the pool.
  // An opaque call result (`getStore()`, `makePlayer()`) is the
  // documented bound - no static proof.
  if (ts.isCallExpression(u) || ts.isNewExpression(u)) {
    const callee = unwrapExpr(u.expression)
    if (
      isOwnerFactoryCallee(callee) ||
      (ts.isIdentifier(callee) && b.ownerFactories.has(callee.text)) ||
      (ts.isNewExpression(u) &&
        ts.isIdentifier(callee) &&
        poolishName(callee.text))
    ) {
      return true
    }
    // `new C(pool)` / `new Map([[k, pool]])` - a constructor fed the
    // pool yields a carrier whose member reads can surface it (R16 F2).
    if (
      ts.isNewExpression(u) &&
      u.arguments !== undefined &&
      u.arguments.some((a) => receiverPoolish(a, b))
    ) {
      return true
    }
    // `ns.usePlayerStore()` - an owner factory reached through a
    // namespace import (R15 S5).
    if (
      ts.isPropertyAccessExpression(callee) &&
      isOwnerFactoryName(callee.name.text) &&
      ts.isIdentifier(unwrapExpr(callee.expression)) &&
      b.nsNamespaces.has(
        (unwrapExpr(callee.expression) as ts.Identifier).text,
      )
    ) {
      return true
    }
    if (ts.isIdentifier(callee)) {
      // `const f = () => pool; f()` - a bound thunk call.
      if (b.poolThunks.has(callee.text)) return true
      // `function getP() { return usePlayerStore() }; getP()` or
      // `const f = usePlayerStore; f()` - owner-yielding calls whose
      // `.baseStats` member IS the pool.
      if (b.ownerThunks.has(callee.text) || b.ownerAliases.has(callee.text)) {
        return true
      }
      // `storeToRefs(store)` / `toRefs(store)` as a bare callee - the
      // ref-map call yields an owner-linked ref table.
      const bound = b.memberAliases.get(callee.text)
      const m = bound !== undefined ? bound.member : callee.text
      if (REF_FACTORIES.has(m) && u.arguments !== undefined) {
        if (m === 'toRef') {
          const field = u.arguments[1]
          if (
            field !== undefined &&
            (spellsToken(field, 'baseStats', b) || spellsToken(field, '$state', b))
          ) {
            return true
          }
        } else if (u.arguments.some((a) => receiverPoolish(a, b))) {
          return true
        }
      }
    }
    if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
      if (containsPoolAccess(callee.body, b)) return true
    }
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) {
      const m =
        ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : literalize(callee.argumentExpression, b)
      const arg0 =
        u.arguments !== undefined && ts.isCallExpression(u)
          ? u.arguments[0]
          : u.arguments?.[0]
      if (m === 'get' && u.arguments !== undefined) {
        // `x.get(k)` / `db.get(player, 'baseStats')` - a spelled key
        // in ANY arg position selects the pool slot.
        if (
          u.arguments.some(
            (a) => spellsToken(a, 'baseStats', b) || spellsToken(a, '$state', b),
          )
        ) {
          return true
        }
      }
      if (m !== undefined && REF_FACTORIES.has(m) && u.arguments !== undefined) {
        if (m === 'toRef') {
          // toRef(obj, 'field') writes through to ONE field - only a
          // pinned field name is a pool lane (toRef(player, 'x') on a
          // non-pool field is a plain ref).
          const field = u.arguments[1]
          if (
            field !== undefined &&
            (spellsToken(field, 'baseStats', b) || spellsToken(field, '$state', b))
          ) {
            return true
          }
        } else if (u.arguments.some((a) => receiverPoolish(a, b))) {
          // toRefs/storeToRefs produce a ref MAP of the whole owner -
          // `.baseStats` on it reaches the pool.
          return true
        }
      }
      // `Object.assign({}, player)` shallow-copies the owner's member
      // refs onto a fresh literal - `.baseStats` on the result IS the
      // same pool object. A member callee arm for that lane.
      if (m === 'assign' && u.arguments !== undefined) {
        return u.arguments.slice(1).some(
          (a) =>
            receiverPoolish(a, b) ||
            (ts.isIdentifier(unwrapExpr(a)) &&
              (b.ownerAliases.has(
                (unwrapExpr(a) as ts.Identifier).text,
              ) ||
                poolishName(
                  (unwrapExpr(a) as ts.Identifier).text,
                ))),
        )
      }
      // `Object.create(player)` - the result inherits the owner's
      // `baseStats` object by reference through the prototype chain:
      // writing `.baseStats.qi` on it hits the live pool (R15 S10).
      if (m === 'create' && arg0 !== undefined) {
        return receiverPoolish(arg0, b)
      }
      // `Object.getPrototypeOf(player)` yields the proto carrying the
      // pool member by reference; `Object.getOwnPropertyDescriptors
      // (player)` yields a descriptor map that resurfaces it (R16 F3).
      // `Object.getOwnPropertyDescriptor(player, 'baseStats')` - the
      // pinned name spelled in the key position.
      if (
        (m === 'getPrototypeOf' || m === 'getOwnPropertyDescriptors') &&
        arg0 !== undefined
      ) {
        return receiverPoolish(arg0, b)
      }
      if (m === 'getOwnPropertyDescriptor' && u.arguments !== undefined) {
        return u.arguments.some((a) => spellsToken(a, 'baseStats', b))
      }
      // Member callee on a poolish receiver yields a pool member -
      // `this.pool.get()`, `s.factory()` semantics resolve at the
      // callee-name level only when the receiver itself is poolish.
      if (receiverPoolish(callee.expression, b)) return true
    }
  }
  return false
}

function isBaseStatsAccess(node: ts.Node, b: Bindings): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === 'baseStats' && receiverPoolish(node.expression, b)
  }
  if (ts.isElementAccessExpression(node)) {
    // `x['baseStats']` / `x[o.k]` / `x[c ? 'baseStats' : 'other']`:
    // a computed key that spells the pinned token in ANY branch IS a
    // spelled pool slot - the receiver binding is irrelevant (the
    // enumeration smuggle deliberately uses an opaque one).
    return spellsToken(node.argumentExpression, 'baseStats', b)
  }
  if (ts.isCallExpression(node)) {
    const info = resolveCallee(node.expression, b)
    if (info === undefined) return false
    if (
      (info.member === 'get' && info.root === 'Reflect') ||
      (info.member === 'getOwnPropertyDescriptor' && info.root === 'Object')
    ) {
      return node.arguments.some((a) => spellsToken(a, 'baseStats', b))
    }
    // toRef(obj, 'baseStats') - the returned ref writes through to the pool.
    if (REF_FACTORIES.has(info.member)) {
      return node.arguments.some((a) => spellsToken(a, 'baseStats', b))
    }
    if (info.member === 'get' && info.root === '') {
      // Destructured/unknown-root `get` - flag when the pool name is spelled.
      return node.arguments.some((a) => spellsToken(a, 'baseStats', b))
    }
  }
  return false
}

/** Dotted path of a member/element access: `a.b.c`, `this.pool`,
 * `a['k']`/`a[K]` literalized to `a.k`, `a[i]` unresolved. */
/** Iterative preorder walk - recursion on a deeply nested expression
 * (a generated 20k-member chain) overflows the call stack. */
function walkAll(root: ts.Node, cb: (n: ts.Node) => boolean | void): void {
  const stack: ts.Node[] = [root]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (cb(n) === true) continue
    // Push children reversed so the LIFO pop walks them in SOURCE
    // order - pass-1 bindings (`const arr = [pool]`) must exist before
    // a later sibling (`for (const e of arr)`) is collected (R16 S3).
    const kids: ts.Node[] = []
    n.forEachChild((c) => {
      kids.push(c)
    })
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i]
      if (k !== undefined) stack.push(k)
    }
  }
}

/** Member chains deeper than this are treated as opaque - a
 * pathological generated chain cannot turn the scan quadratic or
 * crash it. Documented residual bound. */
const ACCESS_PATH_CAP = 512

function accessPath(e: ts.Expression, b: Bindings): string | undefined {
  const parts: string[] = []
  let cur: ts.Expression = e
  for (;;) {
    if (parts.length > ACCESS_PATH_CAP) return undefined
    const u = unwrapExpr(cur)
    if (ts.isPropertyAccessExpression(u)) {
      parts.unshift(u.name.text)
      cur = u.expression
      continue
    }
    if (ts.isElementAccessExpression(u)) {
      const k = literalize(u.argumentExpression, b)
      if (k === undefined) return undefined
      parts.unshift(k)
      cur = u.expression
      continue
    }
    if (ts.isIdentifier(u)) {
      parts.unshift(u.text)
      return parts.join('.')
    }
    if (u.kind === ts.SyntaxKind.ThisKeyword) {
      parts.unshift('this')
      return parts.join('.')
    }
    return undefined
  }
}

/** Does the subtree contain a baseStats access, a bare pool alias, a
 * path-alias member access, or an alias-rooted member access? */
function containsPoolAccess(node: ts.Node, b: Bindings): boolean {
  let found = false
  const stack: ts.Node[] = [node]
  const visit = (n: ts.Node): void => {
    if (found) return
    if (isBaseStatsAccess(n, b)) {
      found = true
      return
    }
    if (
      ts.isIdentifier(n) &&
      b.aliases.has(n.text) &&
      !isDeclarationName(n)
    ) {
      found = true
      return
    }
    if (
      ts.isPropertyAccessExpression(n) ||
      ts.isElementAccessExpression(n)
    ) {
      const p = accessPath(n, b)
      if (p !== undefined && b.propAliases.has(p)) {
        found = true
        return
      }
      const root = unwrapExpr(n.expression)
      if (ts.isIdentifier(root) && b.aliases.has(root.text)) {
        found = true
        return
      }
      // container-carried pool: `arr[0]` where `arr = [pool]`.
      if (
        ts.isElementAccessExpression(n) &&
        ts.isIdentifier(root) &&
        b.poolContainers.has(root.text)
      ) {
        found = true
        return
      }
      // call-yielding-pool receiver: `f().x` where f is a bound pool
      // thunk, or `m.get(k).x` / `arr.at(0).x` on a pool carrier -
      // the member IS a pool member.
      if (ts.isCallExpression(root)) {
        const c = unwrapExpr(root.expression)
        if (ts.isIdentifier(c) && b.poolThunks.has(c.text)) {
          found = true
          return
        }
        if (
          ts.isPropertyAccessExpression(c) ||
          ts.isElementAccessExpression(c)
        ) {
          const cm =
            ts.isPropertyAccessExpression(c)
              ? c.name.text
              : literalize(c.argumentExpression, b)
          if (
            cm !== undefined &&
            POOL_ELEMENT_METHODS.has(cm) &&
            receiverPoolish(c.expression, b)
          ) {
            found = true
            return
          }
        }
      }
    }
    n.forEachChild((c) => {
      stack.push(c)
    })
  }
  while (stack.length > 0) visit(stack.pop()!)
  return found
}

/** Peel nested `=` assignments to the deepest RHS:
 * `x = y = src` binds both x and y to src's poolishness. */
function deepestAssignRhs(e: ts.Expression): ts.Expression {
  let cur = e
  for (;;) {
    const u = unwrapExpr(cur)
    if (
      ts.isBinaryExpression(u) &&
      u.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      cur = u.right
      continue
    }
    return u
  }
}

/** True when ANY branch of `e` literalizes to `token` - `literalize`
 * itself, or a conditional/coalesce/or/and arm
 * (`k = c ? 'baseStats' : 'other'` must not hide the spelled key). */
function spellsToken(e: ts.Expression | undefined, token: string, b: Bindings): boolean {
  if (e === undefined) return false
  const u = unwrapExpr(e)
  if (literalize(u, b) === token) return true
  if (ts.isConditionalExpression(u)) {
    return spellsToken(u.whenTrue, token, b) || spellsToken(u.whenFalse, token, b)
  }
  if (
    ts.isBinaryExpression(u) &&
    (u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      u.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      u.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
  ) {
    return spellsToken(u.left, token, b) || spellsToken(u.right, token, b)
  }
  return false
}

/** Identifier used as the declared name of a binding is never a use. */
function isDeclarationName(n: ts.Node): boolean {
  const p = n.parent
  return (
    p !== undefined &&
    ((ts.isVariableDeclaration(p) && p.name === n) ||
      (ts.isParameter(p) && p.name === n) ||
      (ts.isBindingElement(p) && (p.name === n || p.propertyName === n)) ||
      (ts.isPropertyAssignment(p) && p.name === n) ||
      (ts.isPropertySignature(p) && p.name === n) ||
      (ts.isMethodSignature(p) && p.name === n) ||
      (ts.isInterfaceDeclaration(p) && p.name === n) ||
      (ts.isTypeAliasDeclaration(p) && p.name === n) ||
      (ts.isEnumMember(p) && p.name === n) ||
      (ts.isFunctionDeclaration(p) && p.name === n) ||
      (ts.isClassDeclaration(p) && p.name === n) ||
      (ts.isImportSpecifier(p) && (p.name === n || p.propertyName === n)) ||
      (ts.isImportClause(p) && p.name === n) ||
      (ts.isNamespaceImport(p) && p.name === n) ||
      (ts.isPropertyAccessExpression(p) && p.name === n))
  )
}

/** Iterative max-depth of an AST - a generated 20k-member chain
 * would overflow the recursive passes, so depth beyond the cap flags
 * the file instead of crashing (fail-closed). */
const MAX_NODE_DEPTH = 4000
function maxNodeDepth(root: ts.Node): number {
  let max = 0
  const stack: Array<{ n: ts.Node; d: number }> = [{ n: root, d: 0 }]
  while (stack.length > 0) {
    const { n, d } = stack.pop()!
    if (d > max) max = d
    if (d > MAX_NODE_DEPTH) return d
    n.forEachChild((c) => {
      stack.push({ n: c, d: d + 1 })
    })
  }
  return max
}

const COMPOUND_ASSIGN = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

/** Names of the reflective write APIs the scan pins. */
const STRUCTURAL_WRITE_NAMES = new Set([
  'assign',
  'set',
  'defineProperty',
  'defineProperties',
  'deleteProperty',
])

interface Offender {
  file: string
  text: string
}

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []

  // Corpus = shipped runtime (src + electron). `scripts/` is dev
  // tooling: it legitimately references `*.test*` globs and Node-side
  // `.write` sinks (process.stdout) that are not write lanes -
  // extending the corpus there proves false positives, not coverage.
  const corpus = [...srcCorpus(SRC_DIR)]
  if (existsSync(ELECTRON_DIR)) corpus.push(...srcCorpus(ELECTRON_DIR))

  for (const file of corpus) {
    if (looksLikeTestFile(file.path, file.text)) continue
    const rel = relative(GAME_ROOT, file.path).replaceAll('\\', '/')
    const allowed = ALLOWED.find((a) => a.path === rel)
    const text = readFileSync(file.path, 'utf8')

    const flaggedTexts = new Set<string>()
    const flag = (snippet: string): void => {
      const norm = snippet.slice(0, 160).replace(/\s+/g, ' ').trim()
      if (flaggedTexts.has(norm)) return
      flaggedTexts.add(norm)
      const offender = { file: rel, text: norm }
      if (allowed) {
        violations.push(offender)
      } else {
        unclassified.push(offender)
      }
    }

    // ---- pass 1: collect bindings (aliases, const keys, roots) ----
    const binds: Bindings = {
      aliases: new Set<string>(),
      ownerAliases: new Set<string>(),
      payloadAliases: new Set<string>(),
      constKeys: new Map<string, string>(),
      rootAliases: new Map<string, string>(),
      memberAliases: new Map<string, { member: string; root: string }>(),
      propAliases: new Set<string>(),
      ownerPropPaths: new Set<string>(),
      poolContainers: new Set<string>(),
      constPropKeys: new Map<string, string>(),
      shadowed: new Set<string>(),
      vForNames: new Set<string>(),
      vForPoolNames: new Set<string>(),
      poolThunks: new Set<string>(),
      ownerThunks: new Set<string>(),
      onActionBound: new Set<string>(),
      fnPoolParams: new Map<string, Set<number>>(),
      thisWriters: new Set<string>(),
      thisWriterPaths: new Map<string, string>(),
      enumElems: new Set<string>(),
      enumArrays: new Set<string>(),
      arrayConsts: new Map<string, readonly string[]>(),
      mutableNames: new Set<string>(),
      paramNames: new Set<string>(),
      refAliases: new Set<string>(),
      ownerFactories: new Set<string>(),
      nsNamespaces: new Set<string>(),
      opaqueCodePaths: new Set<string>(),
    }

    // Literal property with a given name: `{ name: x }`, `{ 'name': x }`,
    // `{ [K]: x }` / `{ ['ba'+'seStats']: x }` where K is a const binding.
    const hasPropNamed = (n: ts.Node, name: string): boolean => {
      let hit = false
      walkAll(n, (x) => {
        if (hit) return true
        if (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) {
          const nm = x.name
          if (
            (ts.isIdentifier(nm) || ts.isStringLiteral(nm) || ts.isNoSubstitutionTemplateLiteral(nm)) &&
            nm.text === name
          ) {
            hit = true
            return true
          }
          if (ts.isComputedPropertyName(nm)) {
            const lit = literalize(nm.expression, binds)
            if (lit === name) {
              hit = true
              return true
            }
          }
        }
        return
      })
      return hit
    }
    const hasBaseStatsProp = (n: ts.Node): boolean => hasPropNamed(n, 'baseStats')
    const hasStateProp = (n: ts.Node): boolean => hasPropNamed(n, '$state')

    const hasSpread = (n: ts.Node): boolean => {
      let hit = false
      walkAll(n, (x) => {
        if (hit) return true
        if (ts.isSpreadAssignment(x) || ts.isSpreadElement(x)) {
          hit = true
          return true
        }
        return
      })
      return hit
    }

    const hasPayloadAlias = (n: ts.Node): boolean => {
      let hit = false
      walkAll(n, (x) => {
        if (hit) return true
        if (ts.isIdentifier(x) && binds.payloadAliases.has(x.text)) {
          hit = true
          return true
        }
        return
      })
      return hit
    }

    // Does the initializer yield the pool itself (not a copy)?
    // Covers wraps (parens/casts/as/satisfies), conditionals `c ? pool
    // : other`, coalesce `pool ?? {}`, transitive aliases (`b = a`
    // where a is an alias) and `new Proxy(pool|alias, ...)`.
    const isPoolRootAccess = (e0: ts.Expression): boolean => {
      const e = unwrapExpr(e0)
      if (isBaseStatsAccess(e, binds)) return true
      if (ts.isIdentifier(e)) {
        // A bare identifier is NOT pool-shaped on its own (that would
        // flag every `fn(player)` funnel arg) - it must be bound to a
        // pool-yielding initializer to count.
        return binds.aliases.has(e.text) || binds.poolContainers.has(e.text)
      }
      if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
        const p = accessPath(e, binds)
        if (p !== undefined && binds.propAliases.has(p)) return true
        // alias-rooted member: `s.qi` where `s` is a pool alias.
        const root = unwrapExpr(e.expression)
        if (ts.isIdentifier(root) && binds.aliases.has(root.text)) return true
        // container-carried pool: `arr[0]` where `arr = [pool]`.
        if (
          ts.isElementAccessExpression(e) &&
          ts.isIdentifier(root) &&
          binds.poolContainers.has(root.text)
        ) {
          return true
        }
        // `storeToRefs(store).baseStats` / `toRefs(store)['baseStats']` -
        // a pinned member on a ref-map call reaches the pool ref.
        if (
          ts.isCallExpression(root) &&
          (ts.isPropertyAccessExpression(e)
            ? e.name.text === 'baseStats' || e.name.text === '$state'
            : spellsToken(e.argumentExpression, 'baseStats', binds) ||
              spellsToken(e.argumentExpression, '$state', binds))
        ) {
          const rc = unwrapExpr(root.expression)
          const rm =
            ts.isPropertyAccessExpression(rc)
              ? rc.name.text
              : ts.isIdentifier(rc)
                ? rc.text
                : undefined
          const rarg = root.arguments[0]
          if (
            rm !== undefined &&
            REF_FACTORIES.has(rm) &&
            rarg !== undefined &&
            (ownerSource(rarg) ||
              isPoolRootAccess(rarg) ||
              (ts.isIdentifier(unwrapExpr(rarg)) &&
                poolishName((unwrapExpr(rarg) as ts.Identifier).text)))
          ) {
            return true
          }
        }
      }
      if (ts.isConditionalExpression(e)) {
        return isPoolRootAccess(e.whenTrue) || isPoolRootAccess(e.whenFalse)
      }
      if (
        ts.isBinaryExpression(e) &&
        (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        return isPoolRootAccess(e.left) || isPoolRootAccess(e.right)
      }
      if (ts.isNewExpression(e)) {
        const ci = resolveCallee(e.expression, binds)
        const ctor =
          ci !== undefined ? (binds.rootAliases.get(ci.member) ?? ci.member) : undefined
        if (ci !== undefined && ci.root === '' && ctor === 'Proxy') {
          const a0 = e.arguments?.[0]
          return a0 !== undefined && isPoolRootAccess(a0)
        }
      }
      // `arr.at(0)` / `arr.slice()` / `m.get(k)` - read-shaped members
      // on a pool carrier that yield the pool element(s).
      if (ts.isCallExpression(e)) {
        const callee = unwrapExpr(e.expression)
        // `(() => player.baseStats)()` - an IIFE returning the pool.
        if (
          ts.isArrowFunction(callee) ||
          ts.isFunctionExpression(callee)
        ) {
          if (containsPoolAccess(callee.body, binds)) return true
        }
        // `const f = () => player.baseStats; f()` - a bound thunk call
        // yields the pool the same way an inline IIFE does.
        if (ts.isIdentifier(callee) && binds.poolThunks.has(callee.text)) {
          return true
        }
        if (
          ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)
        ) {
          const m =
            ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : literalize(callee.argumentExpression, binds)
          if (
            m !== undefined &&
            POOL_ELEMENT_METHODS.has(m) &&
            isPoolRootAccess(callee.expression)
          ) {
            return true
          }
          // `store.get('baseStats')` / `toRef(store,'baseStats')` /
          // `db.get(player, 'baseStats')` - a spelled key in ANY arg
          // position (or any conditional branch of it) selects the pool.
          if (
            e.arguments !== undefined &&
            (m === 'get' || (m !== undefined && REF_FACTORIES.has(m))) &&
            e.arguments.some(
              (a) =>
                spellsToken(a, 'baseStats', binds) ||
                spellsToken(a, '$state', binds),
            )
          ) {
            return true
          }
        }
      }
      return false
    }

    // `x.$state`, `x['$state']`, `x[S]`, `x['$'+'state']`,
    // `x[c ? '$state' : other]`.
    const isStateSlot = (x: ts.Node): boolean => {
      if (ts.isPropertyAccessExpression(x)) return x.name.text === '$state'
      if (ts.isElementAccessExpression(x)) {
        return spellsToken(x.argumentExpression, '$state', binds)
      }
      return false
    }

    // A `player`/`store`-ish root: the live pool owner, not a look-alike
    // local. Used to scope spelled-payload-prop flagging so
    // `assign(cfg.mods, {baseStats: x})` on a non-pool object is not a
    // false positive while `merge(player, {baseStats: x})` still lands.
    // Bare poolish-named identifiers count ONLY in binding positions
    // (`const s = player` yields a pool alias); a bare `player` arg to
    // `fn(...)` is the funnel arm's job, not a pool-shaped value.
    // The pool OWNER itself (not the pool): a bare `player`-ish
    // identifier, a call/new yielding an owner (`usePlayerStore()`,
    // `storeToRefs(store)`, `store.get('$state')`, `new PlayerStore()`),
    // or a shallow copy carrying the owner's members (`{...player}`,
    // `Object.assign({}, player)`).
    const ownerSource = (e: ts.Expression): boolean => {
      if (isPoolRootAccess(e)) return false
      if (ts.isIdentifier(e)) return poolishName(e.text)
      if (ts.isObjectLiteralExpression(e)) {
        // `{...player}` copies the owner's member refs - the copy is
        // itself an owner (forged.baseStats is the same pool object).
        // `{...player.baseStats}` is a SHALLOW CLONE of the pool -
        // writes land on the clone, so it is not a source.
        return e.properties.some(
          (p) =>
            ts.isSpreadAssignment(p) && ownerSource(p.expression),
        )
      }
      if (ts.isCallExpression(e) || ts.isNewExpression(e)) {
        const callee = unwrapExpr(e.expression)
        if (
          isOwnerFactoryCallee(callee) ||
          (ts.isNewExpression(e) &&
            ts.isIdentifier(callee) &&
            poolishName(callee.text))
        ) {
          return true
        }
        if (
          ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)
        ) {
          const m =
            ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : literalize(callee.argumentExpression, binds)
          const arg0 = e.arguments?.[0]
          // `store.get('$state')` yields the owner state slot.
          if (m === 'get' && arg0 !== undefined) {
            if (spellsToken(arg0, '$state', binds)) return true
          }
          // `storeToRefs(store)` / `toRefs(store)` - the ref map is an
          // owner proxy: `.baseStats` on it is a pool ref.
          if (
            m !== undefined &&
            REF_FACTORIES.has(m) &&
            arg0 !== undefined &&
            (ownerSource(arg0) ||
              isPoolRootAccess(arg0) ||
              (ts.isIdentifier(unwrapExpr(arg0)) &&
                poolishName(
                  (unwrapExpr(arg0) as ts.Identifier).text,
                )))
          ) {
            return true
          }
          // `Object.assign({}, player)` clones the owner's member refs
          // onto a fresh literal - the result is an owner copy.
          if (m === 'assign' && e.arguments !== undefined) {
            return e.arguments
              .slice(1)
              .some(
                (a) => ownerSource(a) || isPoolRootAccess(a),
              )
          }
        }
      }
      return false
    }
    const poolishBindingSource = (e: ts.Expression): boolean => {
      if (isPoolRootAccess(e) || ownerSource(e)) return true
      // `player.baseStats` / `ps['base'+'Stats']` on a poolish-name or
      // owner receiver - the spelled pool slot even when the root is a
      // plain local (R16 S3: `const arr = [player.baseStats]` must mark
      // `arr` a pool carrier so `for (const e of arr)`/`arr[0]` lanes
      // resolve).
      const u = unwrapExpr(e)
      if (
        ts.isPropertyAccessExpression(u) &&
        u.name.text === 'baseStats' &&
        receiverPoolish(u.expression, binds)
      ) {
        return true
      }
      if (
        ts.isElementAccessExpression(u) &&
        literalize(u.argumentExpression, binds) === 'baseStats' &&
        receiverPoolish(u.expression, binds)
      ) {
        return true
      }
      return false
    }

    // A zero-work thunk whose body yields the pool: `() => pool` or
    // `() => { return pool }` - calling it is an IFFE-shaped access.
    const thunkReturnsPool = (
      fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
    ): boolean => {
      if (fn.body === undefined) return false
      if (ts.isBlock(fn.body)) {
        let ret = false
        walkAll(fn.body, (x) => {
          if (ret) return true
          if (
            ts.isReturnStatement(x) &&
            x.expression !== undefined &&
            containsPoolAccess(x.expression, binds)
          ) {
            ret = true
            return true
          }
          return
        })
        return ret
      }
      return ts.isExpression(fn.body) && containsPoolAccess(fn.body, binds)
    }
    // A zero-work function whose body yields the pool OWNER:
    // `function getP() { return usePlayerStore() }` or
    // `const g = () => player` - the call result is the store, so a
    // `.baseStats` member on it reaches the pool.
    const thunkReturnsOwner = (
      fn: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
    ): boolean => {
      if (fn.body === undefined) return false
      const yields = (e: ts.Expression): boolean => {
        const u = unwrapExpr(e)
        return (
          ownerSource(u) ||
          (ts.isIdentifier(u) &&
            (binds.ownerAliases.has(u.text) || poolishName(u.text)))
        )
      }
      if (ts.isBlock(fn.body)) {
        let ret = false
        walkAll(fn.body, (x) => {
          if (ret) return true
          if (
            ts.isReturnStatement(x) &&
            x.expression !== undefined &&
            yields(x.expression)
          ) {
            ret = true
            return true
          }
          return
        })
        return ret
      }
      return ts.isExpression(fn.body) && yields(fn.body)
    }
    // `function f(s) { s.baseStats.qi = 9 }` - mark which param
    // positions the body uses as a pool root (`p.baseStats` or
    // `p.$state` spelled access). A call feeding an owner into such
    // an index writes the pool through the callee's param.
    const recordPoolParams = (
      name: string | undefined,
      fn: {
        parameters: ts.NodeArray<ts.ParameterDeclaration>
        body?: ts.ConciseBody
      },
    ): void => {
      if (name === undefined || fn.body === undefined) return
      // `function f(s) { s.baseStats.qi = 9 }` marks index 0 so a call
      // feeding a pool owner into it flags. Only WRITE targets count -
      // a param that merely reads `p.baseStats` is a legitimate
      // consumer (the corpus is full of them).
      const paramIdx = new Map<string, number>()
      fn.parameters.forEach((p, i) => {
        if (ts.isIdentifier(p.name)) paramIdx.set(p.name.text, i)
      })
      const indices = new Set<number>()
      // `arguments[i]` addresses param position i even when the param
      // list is empty or differently named (R17 B1).
      const argElemPoolIndex = (t: ts.Expression): number | undefined => {
        const u = unwrapExpr(t)
        if (
          !ts.isPropertyAccessExpression(u) &&
          !ts.isElementAccessExpression(u)
        ) {
          return undefined
        }
        const leaf = ts.isPropertyAccessExpression(u)
          ? u.name.text
          : literalize(u.argumentExpression, binds)
        if (leaf !== 'baseStats' && leaf !== '$state') return undefined
        const recv = unwrapExpr(u.expression)
        if (
          ts.isElementAccessExpression(recv) &&
          ts.isIdentifier(unwrapExpr(recv.expression)) &&
          (unwrapExpr(recv.expression) as ts.Identifier).text ===
            'arguments' &&
          recv.argumentExpression !== undefined
        ) {
          const lit = literalize(recv.argumentExpression, binds)
          const idx =
            lit !== undefined
              ? Number(lit)
              : ts.isNumericLiteral(unwrapExpr(recv.argumentExpression))
                ? Number(
                    (unwrapExpr(recv.argumentExpression) as ts.NumericLiteral)
                      .text,
                  )
                : NaN
          if (Number.isInteger(idx) && idx >= 0) return idx
        }
        return undefined
      }
      if (paramIdx.size === 0) {
        // No named params - only `arguments[i]` lanes can mark.
        walkAll(fn.body as ts.Node, (x) => {
          if (
            ts.isBinaryExpression(x) &&
            COMPOUND_ASSIGN.has(x.operatorToken.kind)
          ) {
            const i = argElemPoolIndex(x.left)
            if (i !== undefined) indices.add(i)
          }
          return
        })
        if (indices.size > 0) binds.fnPoolParams.set(name, indices)
        return
      }
      const markFromTarget = (t: ts.Expression): void => {
        walkAll(t, (x) => {
          // `arguments[i].baseStats = ...` - the receiver is the
          // arguments object addressing param position i (R17 B1).
          if (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x)) {
            const ai = argElemPoolIndex(x as ts.Expression)
            if (ai !== undefined) {
              indices.add(ai)
              return true
            }
          }
          if (
            (ts.isPropertyAccessExpression(x) ||
              ts.isElementAccessExpression(x)) &&
            ts.isIdentifier(unwrapExpr(x.expression)) &&
            paramIdx.has(
              (unwrapExpr(x.expression) as ts.Identifier).text,
            )
          ) {
            const leaf = ts.isPropertyAccessExpression(x)
              ? x.name.text
              : literalize(x.argumentExpression, binds)
            if (leaf === 'baseStats' || leaf === '$state') {
              indices.add(
                paramIdx.get(
                  (unwrapExpr(x.expression) as ts.Identifier).text,
                )!,
              )
            }
          }
          return
        })
      }
      walkAll(fn.body as ts.Node, (x) => {
        if (
          ts.isBinaryExpression(x) &&
          COMPOUND_ASSIGN.has(x.operatorToken.kind)
        ) {
          markFromTarget(x.left)
        } else if (
          (ts.isPrefixUnaryExpression(x) ||
            ts.isPostfixUnaryExpression(x)) &&
          (x.operator === ts.SyntaxKind.PlusPlusToken ||
            x.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          markFromTarget(x.operand)
        } else if (ts.isDeleteExpression(x)) {
          markFromTarget(x.expression)
        } else if (
          (ts.isForOfStatement(x) || ts.isForInStatement(x)) &&
          !ts.isVariableDeclarationList(x.initializer)
        ) {
          markFromTarget(x.initializer as ts.Expression)
        }
        return
      })
      if (indices.size > 0) binds.fnPoolParams.set(name, indices)
    }
    // Bind `name` to the right set for a pool vs owner source.
    const bindAlias = (name: string, src: ts.Expression): void => {
      if (isPoolRootAccess(src)) {
        binds.aliases.add(name)
      } else {
        binds.ownerAliases.add(name)
      }
    }
    const bindPath = (path: string, src: ts.Expression): void => {
      if (isPoolRootAccess(src)) {
        binds.propAliases.add(path)
      } else {
        binds.ownerPropPaths.add(path)
      }
    }
    const isPoolishArg = (e: ts.Expression): boolean => {
      const u = unwrapExpr(e)
      if (isPoolRootAccess(u)) return true
      if (isStateSlot(u)) return true
      if (ts.isIdentifier(u)) return poolishName(u.text)
      if (ts.isPropertyAccessExpression(u)) {
        return poolishName(u.name.text)
      }
      if (ts.isElementAccessExpression(u)) {
        const lit = literalize(u.argumentExpression, binds)
        return lit !== undefined && poolishName(lit)
      }
      if (ts.isCallExpression(u)) {
        const c = unwrapExpr(u.expression)
        return ts.isIdentifier(c) && poolishName(c.text)
      }
      return false
    }

    // The pool object itself inside a container: `[pool]`,
    // `{ref: pool}`, `...[pool]` - a container arg smuggles the pool
    // to an opaque callee through a shape that isPoolRootAccess on
    // the arg alone cannot see.
    const hasPoolCarrier = (e: ts.Node): boolean => {
      // A bound identifier carrier: `const wrap = {ref: pool}` /
      // `const arr = [pool]` - `opaque(wrap)` hands the pool through.
      if (ts.isIdentifier(e)) {
        return (
          binds.poolContainers.has(e.text) ||
          [...binds.propAliases].some(
            (p) => p === e.text || p.startsWith(`${e.text}.`),
          )
        )
      }
      let hit = false
      walkAll(e, (x) => {
        if (hit) return true
        if (ts.isSpreadElement(x) && isPoolRootAccess(x.expression)) {
          hit = true
          return true
        }
        if (ts.isArrayLiteralExpression(x)) {
          if (x.elements.some((el) => isPoolRootAccess(el))) {
            hit = true
            return true
          }
        }
        if (ts.isObjectLiteralExpression(x)) {
          for (const p of x.properties) {
            if (
              (ts.isPropertyAssignment(p) && isPoolRootAccess(p.initializer)) ||
              (ts.isSpreadAssignment(p) && isPoolRootAccess(p.expression))
            ) {
              hit = true
              return true
            }
          }
        }
        return
      })
      return hit
    }
    // A function-expression arg whose body touches the pool: the
    // callee decides when/how the closure runs - unverifiable.
    const hasPoolClosure = (e: ts.Node): boolean => {
      let hit = false
      walkAll(e, (x) => {
        if (hit) return true
        if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) {
          if (containsPoolAccess(x, binds)) {
            hit = true
            return true
          }
        }
        return
      })
      return hit
    }

    const collect = (n: ts.Node): void => {
      // Import barrier: a production file importing a *.test.* file
      // smuggles unscanned code into the corpus boundary.
      if (
        ts.isImportDeclaration(n) ||
        (ts.isExportDeclaration(n) && n.moduleSpecifier !== undefined)
      ) {
        const spec = ts.isImportDeclaration(n)
          ? n.moduleSpecifier
          : (n as ts.ExportDeclaration).moduleSpecifier
        if (
          spec !== undefined &&
          ts.isStringLiteral(spec) &&
          isTestSpecifier(spec.text)
        ) {
          flag(`imports a test file: ${spec.getText()}`)
        }
      }
      // Renamed/namespace owner-factory imports (R15 S5):
      // `import { usePlayerStore as registry }` -> `registry()` yields
      // the owner; `import * as ns` -> `ns.usePlayerStore()` too.
      if (ts.isImportDeclaration(n) && n.importClause !== undefined) {
        const named = n.importClause.namedBindings
        if (named !== undefined && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            const exported = (el.propertyName ?? el.name).text
            if (isOwnerFactoryName(exported)) {
              binds.ownerFactories.add(el.name.text)
            }
          }
        }
        if (named !== undefined && ts.isNamespaceImport(named)) {
          binds.nsNamespaces.add(named.name.text)
        }
      }
      if (
        ts.isImportEqualsDeclaration(n) &&
        ts.isExternalModuleReference(n.moduleReference) &&
        ts.isStringLiteral(n.moduleReference.expression) &&
        isTestSpecifier(n.moduleReference.expression.text)
      ) {
        flag(`import= of a test file: ${n.moduleReference.getText()}`)
      }
      if (ts.isCallExpression(n) && n.arguments[0] !== undefined) {
        const callee = unwrapExpr(n.expression)
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
        const isDynamic = callee.kind === ts.SyntaxKind.ImportKeyword
        // Literalize, not just StringLiteral: `require('./x'+'.test')`
        // and `import(K)` assemble the spec at runtime.
        const specLit = literalize(n.arguments[0], binds)
        if (
          (isRequire || isDynamic) &&
          specLit !== undefined &&
          isTestSpecifier(specLit)
        ) {
          flag(
            `${isRequire ? 'require' : 'dynamic import'} of a test file: ${n.arguments[0].getText()}`,
          )
        }
        // `require(k)` - an unresolvable specifier is unscanned code.
        if (isRequire && specLit === undefined) {
          flag(`opaque require specifier: ${n.getText()}`)
        }
        // `import.meta.glob('./x.test.ts')` - same unscanned-module
        // lane; a split-concat spec still leaves a `.test` fragment
        // inside the arg subtree, and an unresolvable spec is opaque.
        const isGlob =
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'glob' &&
          callee.expression.kind === ts.SyntaxKind.MetaProperty
        if (isGlob) {
          let globHit = false
          if (specLit !== undefined) {
            globHit =
              isTestSpecifier(specLit) ||
              specLit.startsWith('data:') ||
              specLit.startsWith('blob:')
          } else {
            globHit = true
            walkAll(n.arguments[0], (x) => {
              if (
                (ts.isStringLiteral(x) ||
                  ts.isNoSubstitutionTemplateLiteral(x)) &&
                x.text.includes('.test')
              ) {
                globHit = true
                return true
              }
              return
            })
          }
          if (globHit) {
            flag(`import.meta.glob of unscanned code: ${n.getText()}`)
          }
        }
      }
      // `x.$subscribe((mutation, state) => { state.baseStats.qi = 9 })` -
      // the Pinia subscription callback's SECOND param is the live
      // state; bind it as an owner so writes through it resolve.
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(unwrapExpr(n.expression)) &&
        (unwrapExpr(n.expression) as ts.PropertyAccessExpression).name.text ===
          '$subscribe'
      ) {
        const cb = n.arguments[0]
        if (
          cb !== undefined &&
          (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) &&
          cb.parameters[1] !== undefined &&
          ts.isIdentifier(cb.parameters[1].name)
        ) {
          binds.ownerAliases.add(cb.parameters[1].name.text)
        }
      }
      // `store.$onAction(({ store: s }) => { s.baseStats.qi = 9 })` -
      // the Pinia action context carries the live store in `store`;
      // a destructure binding it is an owner alias.
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(unwrapExpr(n.expression)) &&
        (unwrapExpr(n.expression) as ts.PropertyAccessExpression).name.text ===
          '$onAction'
      ) {
        const cb = n.arguments[0]
        if (
          cb !== undefined &&
          (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) &&
          cb.parameters[0] !== undefined &&
          ts.isObjectBindingPattern(cb.parameters[0].name)
        ) {
          for (const el of cb.parameters[0].name.elements) {
            if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) continue
            const propText =
              el.propertyName !== undefined
                ? ts.isIdentifier(el.propertyName) ||
                    ts.isStringLiteral(el.propertyName)
                  ? el.propertyName.text
                  : ts.isComputedPropertyName(el.propertyName)
                    ? literalize(el.propertyName.expression, binds)
                    : undefined
                : el.name.text
            if (propText === 'store' || propText === '$state') {
              binds.ownerAliases.add(el.name.text)
              binds.onActionBound.add(el.name.text)
            }
          }
        }
      }
      // const { baseStats } = x / const { baseStats: b } = x /
      // const { x = p.baseStats } = {} - destructured pool aliases.
      // Function params `f({ baseStats })` are write channels too.
      const bindPattern =
        (ts.isVariableDeclaration(n) || ts.isParameter(n)) &&
        ts.isObjectBindingPattern(n.name)
          ? n.name
          : undefined
      // The rhs of a destructure decides whether the bound name is the
      // pool or a same-named field on an unrelated object: gate every
      // name-spelled alias on a poolish rhs so `{baseStats} = snapshot`
      // binds nothing (writing snapshot.baseStats is a shape, not a
      // lane) while `{baseStats} = player` still binds.
      const declRhs =
        ts.isVariableDeclaration(n) && n.initializer !== undefined
          ? unwrapExpr(n.initializer)
          : undefined
      const rhsIsPoolish =
        declRhs !== undefined &&
        (isPoolRootAccess(declRhs) ||
          isStateSlot(declRhs) ||
          (ts.isIdentifier(declRhs) && poolishName(declRhs.text)) ||
          (ts.isPropertyAccessExpression(declRhs) &&
            poolishName(declRhs.name.text)) ||
          (ts.isElementAccessExpression(declRhs) &&
            (() => {
              const lit = literalize(declRhs.argumentExpression, binds)
              return lit !== undefined && poolishName(lit)
            })()) ||
          (ts.isCallExpression(declRhs) &&
            ts.isIdentifier(unwrapExpr(declRhs.expression)) &&
            poolishName(
              (unwrapExpr(declRhs.expression) as ts.Identifier).text,
            )))
      if (bindPattern !== undefined) {
        for (const el of bindPattern.elements) {
          const prop = el.propertyName
          // `{'baseStats': x}` / `{[K]: x}` - the spelled key resolves
          // through literalize, not just identifier propNames. A
          // shorthand `{player}` has no propertyName - the prop it
          // reads IS the bound identifier (R15 F2).
          const propNameText =
            prop === undefined
              ? ts.isIdentifier(el.name)
                ? el.name.text
                : undefined
              : ts.isIdentifier(prop) || ts.isStringLiteral(prop) ||
                  ts.isNumericLiteral(prop)
                ? prop.text
                : ts.isComputedPropertyName(prop)
                  ? literalize(prop.expression, binds)
                  : undefined
          // `{0: x} = [pool]` - a numeric binding key indexes the
          // array-literal rhs element.
          const numericIndex =
            propNameText !== undefined && /^\d+$/.test(propNameText)
              ? parseInt(propNameText, 10)
              : undefined
          const arrElem =
            numericIndex !== undefined &&
            declRhs !== undefined &&
            ts.isArrayLiteralExpression(declRhs)
              ? declRhs.elements[numericIndex]
              : undefined
          if (
            propNameText === 'baseStats' &&
            ts.isIdentifier(el.name) &&
            (rhsIsPoolish || ts.isParameter(n))
          ) {
            binds.aliases.add(el.name.text)
          } else if (
            propNameText === '$state' &&
            ts.isIdentifier(el.name) &&
            (rhsIsPoolish || ts.isParameter(n))
          ) {
            // `const { $state } = store` - the state slot is an owner.
            binds.ownerAliases.add(el.name.text)
          } else if (
            propNameText !== undefined &&
            poolishName(propNameText) &&
            ts.isIdentifier(el.name) &&
            declRhs !== undefined
          ) {
            if (rhsIsPoolish || ts.isParameter(n)) {
              // `{player: p} = gm` on a poolish/param source - the
              // spelled owner prop binds the owner the name claims.
              binds.ownerAliases.add(el.name.text)
            } else {
              // `{player} = leaderboardEntry` - a bound NON-pool
              // source beats the root regex: the name is a domain
              // object here, not the store (R15 F2). A spelled prop
              // on an unbound rhs is the documented opaque-source
              // bound, same family as `fn(player)`.
              binds.shadowed.add(el.name.text)
            }
          } else if (
            arrElem !== undefined &&
            poolishBindingSource(arrElem) &&
            ts.isIdentifier(el.name)
          ) {
            bindAlias(el.name.text, unwrapExpr(arrElem))
          } else if (
            prop === undefined &&
            ts.isIdentifier(el.name) &&
            el.name.text === 'baseStats' &&
            (rhsIsPoolish || ts.isParameter(n))
          ) {
            binds.aliases.add('baseStats')
          } else if (
            el.initializer !== undefined &&
            poolishBindingSource(el.initializer) &&
            ts.isIdentifier(el.name)
          ) {
            bindAlias(el.name.text, unwrapExpr(el.initializer))
          }
          // `{player: {baseStats: x}} = gm` - a nested pattern under
          // a player-ish key destructures the pool owner's member.
          if (
            (ts.isObjectBindingPattern(el.name) ||
              ts.isArrayBindingPattern(el.name)) &&
            propNameText !== undefined &&
            poolishName(propNameText)
          ) {
            const bindAll = (pat: ts.BindingName): void => {
              if (ts.isIdentifier(pat)) {
                binds.aliases.add(pat.text)
                return
              }
              for (const sub of pat.elements) {
                if (ts.isBindingElement(sub)) bindAll(sub.name)
              }
            }
            bindAll(el.name)
          }
          // const { $patch } = store - the $patch member bound from
          // ANY source is a write lane (the member itself is opaque).
          const boundName =
            propNameText ?? (ts.isIdentifier(el.name) ? el.name.text : '')
          if (boundName === '$patch' && ts.isIdentifier(el.name)) {
            binds.memberAliases.set(el.name.text, { member: '$patch', root: '' })
          }
          // `const { ref: r } = { ref: player.baseStats }` - an
          // object-literal rhs hands the pool through a named prop;
          // match each binding element to its literal initializer.
          if (
            ts.isIdentifier(el.name) &&
            propNameText !== undefined &&
            declRhs !== undefined &&
            ts.isObjectLiteralExpression(declRhs)
          ) {
            for (const p of declRhs.properties) {
              if (!ts.isPropertyAssignment(p)) continue
              const pk =
                ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)
                  ? p.name.text
                  : ts.isComputedPropertyName(p.name)
                    ? literalize(p.name.expression, binds)
                    : undefined
              if (
                pk === propNameText &&
                poolishBindingSource(unwrapExpr(p.initializer))
              ) {
                bindAlias(el.name.text, unwrapExpr(p.initializer))
              }
              // `const { F2 } = { F2: Function }` - the literal prop
              // hands an opaque-code global to the bound name (R16 F5).
              const pInit = unwrapExpr(p.initializer)
              if (
                pk === propNameText &&
                ts.isIdentifier(pInit) &&
                GLOBAL_NAMES.has(pInit.text)
              ) {
                binds.rootAliases.set(el.name.text, pInit.text)
              }
            }
          }
          // `const { baseStats: bs } = storeToRefs(store)` - a ref
          // factory destructure binds pool-linked refs by name.
          if (
            ts.isIdentifier(el.name) &&
            propNameText !== undefined &&
            declRhs !== undefined &&
            ts.isCallExpression(declRhs)
          ) {
            const callee = unwrapExpr(declRhs.expression)
            const cm =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
                ? (ts.isPropertyAccessExpression(callee)
                    ? callee.name.text
                    : literalize(callee.argumentExpression, binds))
                : ts.isIdentifier(callee)
                  ? callee.text
                  : undefined
            if (
              cm !== undefined &&
              REF_FACTORIES.has(cm) &&
              declRhs.arguments[0] !== undefined &&
              (ts.isIdentifier(unwrapExpr(declRhs.arguments[0])) &&
                poolishName(
                  (unwrapExpr(declRhs.arguments[0]) as ts.Identifier).text,
                ))
            ) {
              if (propNameText === 'baseStats') {
                binds.aliases.add(el.name.text)
              } else if (propNameText === '$state') {
                binds.ownerAliases.add(el.name.text)
              }
            }
          }
          // const { assign } = Object / const { get } = Reflect -
          // destructured structural/reflective names.
          const declInit =
            ts.isVariableDeclaration(n) && n.initializer !== undefined
              ? unwrapExpr(n.initializer)
              : undefined
          if (declInit !== undefined && ts.isIdentifier(el.name)) {
            const srcRoot = resolveRoot(declInit, binds)
            const memberName = boundName
            if (
              (srcRoot === 'Object' || srcRoot === 'Reflect') &&
              (STRUCTURAL_WRITE_NAMES.has(memberName) ||
                REFLECTIVE_READ_NAMES.has(memberName))
            ) {
              binds.memberAliases.set(el.name.text, { member: memberName, root: srcRoot })
            }
            // `const { eval: e } = globalThis` / `{ Function: F }` -
            // destructured global names become opaque-code handles.
            // `const {eval: e} = globalThis` - resolveRoot of a pure
            // global root yields '' (all names shifted out).
            if (
              (srcRoot === '' || GLOBAL_ROOTS.has(srcRoot)) &&
              GLOBAL_NAMES.has(boundName)
            ) {
              binds.rootAliases.set(el.name.text, boundName)
            }
          }
        }
      }
      // `({ baseStats: x } = player)` - assignment-pattern destructure
      // (no declaration). Same binding rules as the declaration form.
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isObjectLiteralExpression(unwrapExpr(n.left))
      ) {
        const lhs = unwrapExpr(n.left) as ts.ObjectLiteralExpression
        const rhs = unwrapExpr(n.right)
        const poolish =
          isPoolRootAccess(rhs) ||
          (ts.isIdentifier(rhs) && poolishName(rhs.text)) ||
          (ts.isPropertyAccessExpression(rhs) &&
            poolishName(rhs.name.text)) ||
          (ts.isElementAccessExpression(rhs) &&
            (() => {
              const lit = literalize(rhs.argumentExpression, binds)
              return lit !== undefined && poolishName(lit)
            })()) ||
          (ts.isCallExpression(rhs) &&
            ts.isIdentifier(unwrapExpr(rhs.expression)) &&
            poolishName(
              (unwrapExpr(rhs.expression) as ts.Identifier).text,
            ))
        if (poolish) {
          for (const p of lhs.properties) {
            if (ts.isPropertyAssignment(p)) {
              const key =
                ts.isIdentifier(p.name) ||
                ts.isStringLiteral(p.name) ||
                ts.isNumericLiteral(p.name)
                  ? p.name.text
                  : ts.isComputedPropertyName(p.name)
                    ? literalize(p.name.expression, binds)
                    : undefined
              const target = unwrapExpr(p.initializer)
              if (key === 'baseStats' && ts.isIdentifier(target)) {
                binds.aliases.add(target.text)
              }
            } else if (ts.isShorthandPropertyAssignment(p)) {
              if (p.name.text === 'baseStats') binds.aliases.add('baseStats')
            }
          }
        }
      }
      // `K = 'baseStats'` - a later literal write into a previously
      // declared identifier (constKeys follow assignment order, not
      // declaration kind). Member positions join constPropKeys the
      // same way (`o.k = 'baseStats'` -> `x[o.k]` resolves).
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left)
      ) {
        const lit = literalize(n.right, binds)
        if (lit !== undefined) {
          binds.constKeys.set(n.left.text, lit)
        } else {
          // Reassignment to an unresolvable value clears the binding -
          // `let k = 'baseStats'; k = nextKey()` must not still resolve
          // 'baseStats' at the use site (R15 S4).
          binds.constKeys.delete(n.left.text)
        }
        // `x = player.baseStats` / `s = store.$state` / `x = y = pool` -
        // a plain `=` reassign binds the identifier the same way a
        // declaration does; the deepest RHS resolves chained assigns.
        const rhsDeep = deepestAssignRhs(n.right)
        if (literalize(rhsDeep, binds) === undefined) {
          const nm = n.left.text
          if (isPoolRootAccess(rhsDeep)) {
            binds.aliases.add(nm)
          } else if (isStateSlot(rhsDeep) || ownerSource(rhsDeep)) {
            binds.ownerAliases.add(nm)
          } else {
            const ru = unwrapExpr(rhsDeep)
            let rebound = false
            if (ts.isIdentifier(ru)) {
              if (binds.aliases.has(ru.text)) {
                binds.aliases.add(nm)
                rebound = true
              }
              if (binds.ownerAliases.has(ru.text)) {
                binds.ownerAliases.add(nm)
                rebound = true
              }
              if (binds.poolContainers.has(ru.text)) {
                binds.poolContainers.add(nm)
                rebound = true
              }
            } else if (
              (ts.isArrayLiteralExpression(ru) &&
                ru.elements.some((el) =>
                  poolishBindingSource(unwrapExpr(el)),
                )) ||
              (ts.isObjectLiteralExpression(ru) &&
                ru.properties.some(
                  (p) =>
                    ts.isPropertyAssignment(p) &&
                    poolishBindingSource(unwrapExpr(p.initializer)),
                ))
            ) {
              binds.poolContainers.add(nm)
              rebound = true
            }
            // A non-poolish rebind clears a stale alias: `x = pool;
            // x = cfg` leaves x pointing at cfg, not the pool.
            if (!rebound) {
              binds.aliases.delete(nm)
              binds.ownerAliases.delete(nm)
              binds.poolContainers.delete(nm)
            }
          }
        }
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
          ts.isElementAccessExpression(unwrapExpr(n.left)))
      ) {
        const p = accessPath(n.left, binds)
        const lit = literalize(n.right, binds)
        if (p !== undefined && lit !== undefined) {
          binds.constPropKeys.set(p, lit)
        }
        // `o.f = player.baseStats` / `o.f = player` - member-position
        // pool/owner path binds through an assignment as well.
        if (p !== undefined && lit === undefined) {
          const rd = deepestAssignRhs(n.right)
          if (isPoolRootAccess(rd)) {
            binds.propAliases.add(p)
          } else if (isStateSlot(rd) || ownerSource(rd)) {
            binds.ownerPropPaths.add(p)
          }
        }
      }
      // `Object.assign(clone, player)` - the owner's `baseStats` slot
      // lands on the target; `clone.baseStats` is then the live pool.
      // A `{baseStats: pool}` spelled source prop is the same lane.
      if (ts.isCallExpression(n) && n.arguments.length >= 2) {
        const ci = resolveCallee(n.expression, binds)
        const target = n.arguments[0]
        if (
          ci !== undefined &&
          (ci.member === 'assign' || ci.member === 'assignIn' ||
            ci.member === 'defaults' || ci.member === 'extend' ||
            ci.member === 'merge') &&
          target !== undefined &&
          ts.isIdentifier(unwrapExpr(target)) &&
          n.arguments.slice(1).some((a) => {
            const au = unwrapExpr(a)
            if (ownerSource(au) || isStateSlot(au)) return true
            return (
              ts.isObjectLiteralExpression(au) &&
              au.properties.some(
                (p) =>
                  (ts.isPropertyAssignment(p) ||
                    ts.isShorthandPropertyAssignment(p)) &&
                  ((ts.isIdentifier(p.name) && p.name.text === 'baseStats') ||
                    (ts.isStringLiteral(p.name) &&
                      p.name.text === 'baseStats')) &&
                  (ts.isShorthandPropertyAssignment(p)
                    ? isPoolRootAccess(p.name)
                    : poolishBindingSource(
                        unwrapExpr(
                          (p as ts.PropertyAssignment).initializer,
                        ),
                      )),
              )
            )
          })
        ) {
          binds.ownerAliases.add(
            (unwrapExpr(target) as ts.Identifier).text,
          )
        }
      }
      // `const arr = [player.baseStats]` / `const wrap = {ref: pool}` -
      // container carriers: the pool lives inside a bound literal;
      // element access on the binding yields it, and `opaque(wrap)`
      // hands it to a callee.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init = unwrapExpr(n.initializer)
        if (
          ts.isArrayLiteralExpression(init) &&
          init.elements.some(
            (el) =>
              poolishBindingSource(el) ||
              containsPoolAccess(el, binds) ||
              (ts.isSpreadElement(el) &&
                ts.isIdentifier(unwrapExpr(el.expression)) &&
                binds.poolContainers.has(
                  (unwrapExpr(el.expression) as ts.Identifier).text,
                )),
          )
        ) {
          binds.poolContainers.add(n.name.text)
        }
        // Only NAMED props carry: `{ref: pool}` hands the callee a
        // pool-reachable slot. A spread (`{...player}`, `{...pool}`)
        // either makes an owner copy (bindAlias's domain) or a clone
        // - never a named container carrier. A prop VALUE that merely
        // reads a pool inside a call or spread (`asBaseStats({...pool})`)
        // is a clone of the value, not a carrier of the pool.
        if (
          ts.isObjectLiteralExpression(init) &&
          init.properties.some(
            (p) =>
              ts.isPropertyAssignment(p) &&
              poolishBindingSource(unwrapExpr(p.initializer)),
          )
        ) {
          binds.poolContainers.add(n.name.text)
          // Each declared prop that carries the pool is itself a
          // pool path: `const c = {bs: player.baseStats}` ->
          // `c.bs` IS the pool.
          for (const p of init.properties) {
            if (
              !ts.isPropertyAssignment(p) ||
              !poolishBindingSource(unwrapExpr(p.initializer))
            ) {
              continue
            }
            const pname =
              ts.isIdentifier(p.name) ||
              ts.isStringLiteral(p.name) ||
              ts.isNumericLiteral(p.name)
                ? p.name.text
                : ts.isComputedPropertyName(p.name)
                  ? literalize(p.name.expression, binds)
                  : undefined
            if (pname !== undefined) {
              binds.propAliases.add(`${n.name.text}.${pname}`)
            }
          }
        }
        // `const a = ['baseStats', 'x']` - a bound array whose every
        // element literalizes feeds `x[a[0]]` / `x[a.at(0)]` keys.
        if (
          ts.isArrayLiteralExpression(init) &&
          init.elements.length > 0
        ) {
          const lits: string[] = []
          let ok = true
          for (const el of init.elements) {
            const lit = literalize(el as ts.Expression, binds)
            if (lit === undefined) {
              ok = false
              break
            }
            lits.push(lit)
          }
          if (ok) binds.arrayConsts.set(n.name.text, lits)
        }
        // `const e = Object.entries(player)` / `Object.values(pool)` -
        // a bound enumeration array: for-of/callback element names
        // bind the owner's values.
        if (ts.isCallExpression(init)) {
          const info = resolveCallee(init.expression, binds)
          if (
            info !== undefined &&
            (info.member === 'entries' || info.member === 'values' ||
              info.member === 'keys') &&
            (info.root === 'Object' || info.root === '') &&
            init.arguments[0] !== undefined &&
            (ownerSource(init.arguments[0]) ||
              isPoolRootAccess(init.arguments[0]))
          ) {
            binds.enumArrays.add(n.name.text)
          }
        }
        // `const c = computed(() => player.baseStats)` / `ref(pool)` -
        // a ref whose `.value` member resolves the pool slot (R15 S2).
        if (ts.isCallExpression(init)) {
          const cc = unwrapExpr(init.expression)
          const cm =
            ts.isPropertyAccessExpression(cc)
              ? cc.name.text
              : ts.isElementAccessExpression(cc)
                ? literalize(cc.argumentExpression, binds)
                : ts.isIdentifier(cc)
                  ? cc.text
                  : undefined
          if (cm !== undefined && REF_VALUE_FACTORIES.has(cm)) {
            const refHit =
              cm === 'toRef'
                ? init.arguments[1] !== undefined &&
                  (spellsToken(init.arguments[1], 'baseStats', binds) ||
                    spellsToken(init.arguments[1], '$state', binds))
                : init.arguments.some((a) => containsPoolAccess(a, binds))
            if (refHit) binds.refAliases.add(n.name.text)
          }
        }
        // `const registry = usePlayerStore` - an owner-factory
        // reference alias (R15 S5).
        if (ts.isIdentifier(init) && isOwnerFactoryName(init.text)) {
          binds.ownerFactories.add(n.name.text)
        }
        // `const c = mk()` where mk is a pass-0 pool thunk - the call
        // yields the pool even when the decl sits below (R17). An
        // owner thunk binds ownerAliases the same way.
        if (ts.isCallExpression(init)) {
          const cc = unwrapExpr(init.expression)
          if (ts.isIdentifier(cc)) {
            if (binds.poolThunks.has(cc.text)) {
              binds.aliases.add(n.name.text)
            } else if (binds.ownerThunks.has(cc.text)) {
              binds.ownerAliases.add(n.name.text)
            }
          }
        }
        // `const f = () => player.baseStats` - a thunk bound to the
        // pool; `f()` resolves the same pool root as an inline IIFE.
        // `const g = () => usePlayerStore()` - an owner thunk.
        if (
          ts.isArrowFunction(init) || ts.isFunctionExpression(init)
        ) {
          if (thunkReturnsPool(init)) {
            binds.poolThunks.add(n.name.text)
          } else if (thunkReturnsOwner(init)) {
            binds.ownerThunks.add(n.name.text)
          }
          recordPoolParams(n.name.text, init)
        }
        // `const s5 = store.$state` - the state slot object itself is
        // a pool owner: `s5.baseStats` writes the pool.
        if (isStateSlot(init)) {
          binds.aliases.add(n.name.text)
        }
        // `const cp = arr.slice()` / `arr.filter()` / `new Map([[k,pool]])`
        // - container-returning calls keep the pool inside; element
        // reads (`arr[0]`, `arr.at(0)`, `m.get(k)`, `arr.find()`) yield
        // the pool itself and bind as aliases.
        const ELEMENT_READS = new Set([
          'at', 'find', 'findLast', 'pop', 'shift', 'get', 'front',
        ])
        const CONTAINER_RETURNS = new Set([
          'slice', 'filter', 'map', 'concat', 'flat', 'flatMap',
          'toSorted', 'toReversed', 'toSpliced', 'with', 'reverse',
          'entries', 'values', 'keys',
        ])
        const initRootIsContainer = (e: ts.Expression): boolean => {
          const u = unwrapExpr(e)
          return (
            ts.isIdentifier(u) &&
            (binds.poolContainers.has(u.text) || binds.enumArrays.has(u.text))
          )
        }
        if (ts.isElementAccessExpression(init) && initRootIsContainer(init.expression)) {
          binds.aliases.add(n.name.text)
        }
        if (ts.isCallExpression(init) || ts.isNewExpression(init)) {
          const c = unwrapExpr(init.expression)
          if (
            (ts.isPropertyAccessExpression(c) ||
              ts.isElementAccessExpression(c)) &&
            initRootIsContainer(c.expression)
          ) {
            const m =
              ts.isPropertyAccessExpression(c)
                ? c.name.text
                : literalize(c.argumentExpression, binds)
            if (m !== undefined && ELEMENT_READS.has(m)) {
              binds.aliases.add(n.name.text)
            } else if (m !== undefined && CONTAINER_RETURNS.has(m)) {
              binds.poolContainers.add(n.name.text)
            }
          }
          if (
            ts.isNewExpression(init) &&
            ts.isIdentifier(c) &&
            (c.text === 'Map' || c.text === 'Set' || c.text === 'WeakMap') &&
            init.arguments !== undefined &&
            init.arguments.some(
              (a) => hasPoolCarrier(a) || containsPoolAccess(a, binds),
            )
          ) {
            binds.poolContainers.add(n.name.text)
          }
        }
      }
      // `let k = 'x'` / `var k` - mutable names can be reassigned, so a
      // spelled initializer must NOT leave a constKeys entry behind.
      if (ts.isVariableDeclarationList(n)) {
        const isConst = (n.flags & ts.NodeFlags.Const) !== 0
        if (!isConst) {
          for (const d of n.declarations) {
            const walkName = (pat: ts.BindingName): void => {
              if (ts.isIdentifier(pat)) {
                binds.mutableNames.add(pat.text)
                binds.constKeys.delete(pat.text)
                return
              }
              for (const el of pat.elements) {
                if (ts.isBindingElement(el)) walkName(el.name)
              }
            }
            walkName(d.name)
          }
        }
      }
      // `const { $state } = store` / `const { $state: st } = store` -
      // the state slot destructure binds the pool owner object. The
      // source must itself be state-ish - `{ $state } = cfg` on a
      // plain config is a shape, not the pool (R16 FP10).
      if (
        ts.isVariableDeclaration(n) &&
        ts.isObjectBindingPattern(n.name) &&
        n.initializer !== undefined &&
        (isStateSlot(n.initializer) ||
          receiverPoolish(n.initializer, binds) ||
          ownerSource(n.initializer))
      ) {
        for (const el of n.name.elements) {
          if (!ts.isBindingElement(el)) continue
          const propName =
            el.propertyName !== undefined && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : ts.isIdentifier(el.name)
                ? el.name.text
                : undefined
          if (
            propName === '$state' &&
            ts.isIdentifier(el.name)
          ) {
            binds.aliases.add(el.name.text)
          }
        }
      }
      // `m.set(k, pool)` / `m.add(pool)` - a Map/Set write-through
      // makes the bound map a pool container for `m.get(k)` reads.
      if (ts.isCallExpression(n)) {
        const c = unwrapExpr(n.expression)
        if (
          ts.isPropertyAccessExpression(c) &&
          (c.name.text === 'set' || c.name.text === 'add') &&
          ts.isIdentifier(unwrapExpr(c.expression)) &&
          n.arguments.some((a) => containsPoolAccess(a, binds))
        ) {
          binds.poolContainers.add(
            (unwrapExpr(c.expression) as ts.Identifier).text,
          )
        }
      }
      // `for (const w of poolArr)` / `for (const w of [pool])` - the
      // loop variable binds to elements of a pool-carrying iterable,
      // so `w.field = n` writes the pool. A bound identifier carrier
      // (`const poolArr = [pool]`) resolves through poolContainers.
      // When the iterable provably does NOT carry the pool, the loop
      // var's name is shadowed even if it spells `player` - a bound
      // non-pool beats the root regex.
      if (
        (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
        ts.isVariableDeclarationList(n.initializer)
      ) {
        const iterable = n.expression
        // `for (const [k, v] of Object.entries(player))` / `of enumArr`
        // - the VALUE binding lands in enumElems: inside a spelled-key
        // narrow (`k === 'baseStats'`) a `v.<stat> = x` write is a lane.
        const iterU = unwrapExpr(iterable)
        const enumIterable =
          (ts.isIdentifier(iterU) &&
            (binds.enumArrays.has(iterU.text) ||
              binds.poolContainers.has(iterU.text))) ||
          (ts.isCallExpression(iterU) &&
            (() => {
              const info = resolveCallee(iterU.expression, binds)
              if (
                info === undefined ||
                (info.member !== 'entries' && info.member !== 'values')
              ) {
                return false
              }
              if (
                (info.root === 'Object' || info.root === '') &&
                iterU.arguments[0] !== undefined &&
                (ownerSource(iterU.arguments[0]) ||
                  isPoolRootAccess(iterU.arguments[0]) ||
                  isStateSlot(iterU.arguments[0]))
              ) {
                return true
              }
              // `arr.entries()` / `arr.values()` on a bound carrier
              // (R15 S3: `for (const [,b] of arr.entries())`).
              return (
                binds.enumArrays.has(info.root) ||
                binds.poolContainers.has(info.root)
              )
            })())
        const carries =
          ts.isForOfStatement(n) &&
          (hasPoolCarrier(iterable) ||
            enumIterable ||
            (ts.isIdentifier(unwrapExpr(iterable)) &&
              binds.poolContainers.has(
                (unwrapExpr(iterable) as ts.Identifier).text,
              )))
        for (const d of n.initializer.declarations) {
          if (enumIterable && ts.isArrayBindingPattern(d.name)) {
            // `const [k, v]` - position 1 is the value element.
            const valEl = d.name.elements[1]
            if (
              valEl !== undefined &&
              ts.isBindingElement(valEl) &&
              ts.isIdentifier(valEl.name)
            ) {
              binds.enumElems.add(valEl.name.text)
            }
            const keyEl = d.name.elements[0]
            if (
              keyEl !== undefined &&
              ts.isBindingElement(keyEl) &&
              ts.isIdentifier(keyEl.name)
            ) {
              binds.shadowed.add(keyEl.name.text)
            }
            continue
          }
          if (enumIterable && ts.isIdentifier(d.name)) {
            // `for (const v of Object.values(player))` - v IS a value.
            binds.enumElems.add(d.name.text)
            continue
          }
          const names: string[] = []
          const collectName = (pat: ts.BindingName): void => {
            if (ts.isIdentifier(pat)) {
              names.push(pat.text)
              return
            }
            for (const el of pat.elements) {
              if (ts.isBindingElement(el)) collectName(el.name)
            }
          }
          collectName(d.name)
          for (const name of names) {
            if (carries) {
              binds.aliases.add(name)
            } else {
              binds.shadowed.add(name)
            }
          }
        }
      }
      // class { pool = player.baseStats } - field-declared pool
      // carrier. `this.pool` joins propAliases so in-class writes
      // resolve; the store site itself is flagged in pass 2.
      if (ts.isPropertyDeclaration(n) && n.initializer !== undefined) {
        if (poolishBindingSource(n.initializer)) {
          const nm =
            ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)
              ? n.name.text
              : ts.isComputedPropertyName(n.name)
                ? literalize(n.name.expression, binds)
                : undefined
          if (nm !== undefined) bindPath(`this.${nm}`, n.initializer)
        }
      }
      // `constructor(private pool = player.baseStats)` - param-prop
      // default: the identifier binds the pool AND this.pool mirrors it.
      if (
        ts.isParameter(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        poolishBindingSource(n.initializer) &&
        n.modifiers !== undefined
      ) {
        bindPath(`this.${n.name.text}`, n.initializer)
      }
      // `get pool() { return player.baseStats }` / a class method
      // returning the pool root - `this.pool` / `this.m()` carry it.
      if (
        (ts.isGetAccessorDeclaration(n) || ts.isMethodDeclaration(n)) &&
        n.body !== undefined
      ) {
        let returnedSrc: ts.Expression | undefined
        walkAll(n.body, (x) => {
          if (returnedSrc !== undefined) return true
          if (
            ts.isReturnStatement(x) &&
            x.expression !== undefined &&
            poolishBindingSource(x.expression)
          ) {
            returnedSrc = x.expression
            return true
          }
          return
        })
        if (returnedSrc !== undefined && n.name !== undefined) {
          const nm =
            ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)
              ? n.name.text
              : ts.isComputedPropertyName(n.name)
                ? literalize(n.name.expression, binds)
                : undefined
          if (nm !== undefined) bindPath(`this.${nm}`, returnedSrc)
        }
      }
      // `function getP() { return usePlayerStore() }` /
      // `function f(s) { s.baseStats.qi = 9 }` - declaration-level
      // thunks and pool-param slots (var-init arrows are handled in
      // the declaration arm below).
      if (ts.isFunctionDeclaration(n) && n.name !== undefined) {
        if (thunkReturnsPool(n)) {
          binds.poolThunks.add(n.name.text)
        } else if (thunkReturnsOwner(n)) {
          binds.ownerThunks.add(n.name.text)
        }
        recordPoolParams(n.name.text, n)
      }
      // const s = x.baseStats / const s = x['baseStats'] / proxies /
      // ternaries / transitive aliases - the initializer must BE the
      // pool reference, not a call or literal merely mentioning it.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        poolishBindingSource(n.initializer)
      ) {
        bindAlias(n.name.text, unwrapExpr(n.initializer))
      }
      // const [bs] = [player.baseStats] - positional array binding of a
      // literal array whose element is the pool.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isArrayBindingPattern(n.name) &&
        n.initializer !== undefined &&
        ts.isArrayLiteralExpression(unwrapExpr(n.initializer))
      ) {
        const initElems = (unwrapExpr(n.initializer) as ts.ArrayLiteralExpression).elements
        n.name.elements.forEach((el, i) => {
          if (
            ts.isBindingElement(el) &&
            ts.isIdentifier(el.name) &&
            i < initElems.length
          ) {
            const src = initElems[i]
            const srcU = src !== undefined ? unwrapExpr(src) : undefined
            if (src !== undefined && poolishBindingSource(src)) {
              bindAlias(el.name.text, unwrapExpr(src as ts.Expression))
            } else if (
              srcU !== undefined &&
              ts.isIdentifier(srcU) &&
              GLOBAL_NAMES.has(srcU.text)
            ) {
              // `const [e2] = [eval]` / `[W] = [Worker]` - the element
              // is an opaque-code global handle (R16 F5).
              binds.rootAliases.set(el.name.text, srcU.text)
            } else if (
              src !== undefined &&
              hasPoolCarrier(src)
            ) {
              // `const [c] = [[pool]]` / `[{wrap: pool}]` - the bound
              // element is itself a carrier of the pool (R16 F7).
              binds.poolContainers.add(el.name.text)
            } else if (
              src !== undefined &&
              ts.isObjectLiteralExpression(src)
            ) {
              // `const [c] = [{bs: pool}]` - c is a carrier object;
              // each pool-holding prop binds a `c.<prop>` pool path.
              for (const p of src.properties) {
                if (
                  !ts.isPropertyAssignment(p) ||
                  !(
                    poolishBindingSource(unwrapExpr(p.initializer)) ||
                    containsPoolAccess(p.initializer, binds)
                  )
                ) {
                  continue
                }
                const pname =
                  ts.isIdentifier(p.name) ||
                  ts.isStringLiteral(p.name) ||
                  ts.isNumericLiteral(p.name)
                    ? p.name.text
                    : ts.isComputedPropertyName(p.name)
                      ? literalize(p.name.expression, binds)
                      : undefined
                if (pname !== undefined) {
                  binds.propAliases.add(`${el.name.text}.${pname}`)
                }
              }
            }
          }
        })
      }
      // const box = { bs: player.baseStats } / obj.prop = pool /
      // this.pool = pool - member-position pool aliases.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        ts.isObjectLiteralExpression(unwrapExpr(n.initializer))
      ) {
        const obj = unwrapExpr(n.initializer) as ts.ObjectLiteralExpression
        // Nested literals recurse: `{wrap: {bs: pool}}` records
        // 'box.wrap.bs', not just 'box.wrap'.
        const walkProps = (o: ts.ObjectLiteralExpression, prefix: string): void => {
          for (const p of o.properties) {
            if (!ts.isPropertyAssignment(p)) continue
            const key =
              ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)
                ? p.name.text
                : ts.isComputedPropertyName(p.name)
                  ? literalize(p.name.expression, binds)
                  : undefined
            if (key === undefined) continue
            const path = `${prefix}.${key}`
            const init = unwrapExpr(p.initializer)
            if (poolishBindingSource(init)) {
              bindPath(path, init)
            }
            // `const o = {k: 'baseStats'}` - a member position holding
            // a spelled value resolves `x[o.k]` element keys.
            const lit = literalize(p.initializer, binds)
            if (lit !== undefined) binds.constPropKeys.set(path, lit)
            // `const o = {e: eval}` - a member position holding an
            // opaque-code global resolves `o.e(code)` (R16 F5).
            if (ts.isIdentifier(init) && GLOBAL_NAMES.has(init.text)) {
              binds.opaqueCodePaths.add(path)
            }
            if (ts.isObjectLiteralExpression(init)) walkProps(init, path)
          }
        }
        walkProps(obj, n.name.text)
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        poolishBindingSource(n.right)
      ) {
        if (ts.isIdentifier(n.left)) {
          bindAlias(n.left.text, unwrapExpr(n.right))
        } else if (
          ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
          ts.isElementAccessExpression(unwrapExpr(n.left))
        ) {
          const p = accessPath(n.left, binds)
          if (p !== undefined) bindPath(p, unwrapExpr(n.right))
        }
      }
      // `o.e = eval` - a member-position opaque-code global (R16 F5).
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
          ts.isElementAccessExpression(unwrapExpr(n.left))) &&
        ts.isIdentifier(unwrapExpr(n.right)) &&
        GLOBAL_NAMES.has((unwrapExpr(n.right) as ts.Identifier).text)
      ) {
        const p = accessPath(n.left, binds)
        if (p !== undefined) binds.opaqueCodePaths.add(p)
      }
      // `player.m = fn` where fn is a this-writer (pass 0) - the
      // member path dispatches `this.baseStats` through player (R17).
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
          ts.isElementAccessExpression(unwrapExpr(n.left))) &&
        ts.isIdentifier(unwrapExpr(n.right)) &&
        binds.thisWriters.has((unwrapExpr(n.right) as ts.Identifier).text)
      ) {
        const p = accessPath(n.left, binds)
        if (p !== undefined) {
          binds.thisWriterPaths.set(
            p,
            (unwrapExpr(n.right) as ts.Identifier).text,
          )
        }
      }
      // `x ??= pool` / `x ||= pool` / `x &&= pool` - logical-assign
      // rebinds bind the same aliases as `=` (R17). And `g = () =>
      // pool` - the rebind targets a pool-thunk, not a pool source.
      if (
        ts.isBinaryExpression(n) &&
        (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
          n.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken ||
          n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      ) {
        const isLogical =
          n.operatorToken.kind !== ts.SyntaxKind.EqualsToken
        const rhs = unwrapExpr(n.right)
        if (
          isLogical &&
          poolishBindingSource(n.right) &&
          ts.isIdentifier(n.left)
        ) {
          bindAlias(n.left.text, rhs)
        } else if (
          isLogical &&
          poolishBindingSource(n.right) &&
          (ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
            ts.isElementAccessExpression(unwrapExpr(n.left)))
        ) {
          const p = accessPath(n.left, binds)
          if (p !== undefined) bindPath(p, rhs)
        }
        // `g = () => pool` / `let g; g = () => pool` - a function
        // bound through `=` whose body returns the pool (R17).
        if (
          !isLogical &&
          (ts.isArrowFunction(rhs) || ts.isFunctionExpression(rhs))
        ) {
          let returnsPool = false
          walkAll(rhs.body, (x) => {
            if (returnsPool) return true
            if (
              ts.isReturnStatement(x) &&
              x.expression !== undefined &&
              (isPoolRootAccess(x.expression) ||
                hasPoolCarrier(x.expression))
            ) {
              returnsPool = true
              return true
            }
            if (
              !ts.isBlock(rhs.body) &&
              (isPoolRootAccess(rhs.body) || hasPoolCarrier(rhs.body))
            ) {
              returnsPool = true
              return true
            }
            return
          })
          if (returnsPool) {
            if (ts.isIdentifier(n.left)) {
              binds.poolThunks.add(n.left.text)
            } else if (
              ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
              ts.isElementAccessExpression(unwrapExpr(n.left))
            ) {
              const p = accessPath(n.left, binds)
              if (p !== undefined) binds.poolThunks.add(p)
            }
          }
        }
      }
      // function f(x = player.baseStats) - parameter default binding.
      if (
        ts.isParameter(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        poolishBindingSource(n.initializer)
      ) {
        bindAlias(n.name.text, unwrapExpr(n.initializer))
      }
      // const forged = { baseStats: {...} } / { $state: {...} } /
      // spread of an earlier payload alias - a literal that spells the
      // pool name, carried to a write site through a variable.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init0 = unwrapExpr(n.initializer)
        const isPayloadLiteral =
          ts.isObjectLiteralExpression(init0) &&
          (hasBaseStatsProp(init0) || hasStateProp(init0) || hasPayloadAlias(init0))
        const isPayloadAlias =
          ts.isIdentifier(init0) && binds.payloadAliases.has(init0.text)
        if (isPayloadLiteral || isPayloadAlias) {
          binds.payloadAliases.add(n.name.text)
        }
      }
      // const K = 'baseStats' / const S = '$state' / const P = '$patch'
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const lit = literalize(n.initializer, binds)
        if (lit !== undefined) {
          // let/var seed too: a spelled initializer binds until an
          // actual reassignment clears it (R15 S4 - `let k =
          // 'baseStats'` was invisible under the mutable-names bar).
          binds.constKeys.set(n.name.text, lit)
        }
      }
      // `enum K { B = 'baseStats' }` - enum member literals resolve
      // `player[K.B]` exactly like an `o.k` const-prop key (R15 S4).
      if (ts.isEnumDeclaration(n)) {
        const en = n.name.text
        for (const m of n.members) {
          const mname =
            ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)
              ? m.name.text
              : undefined
          if (
            mname !== undefined &&
            m.initializer !== undefined &&
            ts.isStringLiteral(m.initializer)
          ) {
            binds.constPropKeys.set(`${en}.${mname}`, m.initializer.text)
          }
        }
      }
      // `k++` / `k += x` mutates a spelled key binding opaque.
      if (
        (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
        (n.operator === ts.SyntaxKind.PlusPlusToken ||
          n.operator === ts.SyntaxKind.MinusMinusToken) &&
        ts.isIdentifier(n.operand)
      ) {
        binds.constKeys.delete(n.operand.text)
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind !== ts.SyntaxKind.EqualsToken &&
        COMPOUND_ASSIGN.has(n.operatorToken.kind) &&
        ts.isIdentifier(n.left)
      ) {
        binds.constKeys.delete(n.left.text)
      }
      // const O = Object / const R = Reflect / const W = window /
      // const O = globalThis.Object - reflective-root aliases.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init = unwrapExpr(n.initializer)
        if (
          ts.isIdentifier(init) &&
          (GLOBAL_NAMES.has(init.text) || GLOBAL_ROOTS.has(init.text))
        ) {
          binds.rootAliases.set(n.name.text, init.text)
        } else {
          const rootName = resolveRoot(init, binds)
          if (
            ts.isPropertyAccessExpression(init) &&
            GLOBAL_NAMES.has(rootName)
          ) {
            binds.rootAliases.set(n.name.text, init.name.text)
          }
        }
        // const fn = <something>.$patch / <something>.<structural-name>,
        // incl. bracket form, reflective reads
        // (`Reflect.get(s,'m')`, `Object.getOwnPropertyDescriptor(s,'m')`,
        // its `.value`), and .bind/.call/.apply captures:
        // `const pp = (store.$patch)`, `const q = s.$patch.bind(s)`,
        // `const bp = Function.prototype.bind.call(s.$patch, s)`.
        let memberName: string | undefined
        let target: ts.Expression = init
        if (ts.isCallExpression(target)) {
          const info = resolveCallee(target.expression, binds)
          if (
            info !== undefined &&
            REFLECTIVE_READ_NAMES.has(info.member) &&
            (info.root === 'Object' || info.root === 'Reflect')
          ) {
            const keyArg = target.arguments[1]
            const lit = keyArg !== undefined ? literalize(keyArg, binds) : undefined
            if (lit !== undefined) {
              binds.memberAliases.set(n.name.text, { member: lit, root: '__expr__' })
            }
            return
          }
          // Chained indirection: peel `.bind/.call/.apply` wrappers to
          // reach the invoked member. `fn.bind(t)` / `fn.call(a)` yields
          // the receiver fn; `bind.call(fn, t)` / `X.call.call(fn, ...)`
          // yields arg0.
          const indirectMemberOf = (x: ts.Expression): string | undefined => {
            const u = unwrapExpr(x)
            if (ts.isPropertyAccessExpression(u)) return u.name.text
            if (ts.isElementAccessExpression(u)) {
              return literalize(u.argumentExpression, binds)
            }
            return undefined
          }
          let cur: ts.Expression = target
          for (;;) {
            if (!ts.isCallExpression(cur)) break
            const callee = unwrapExpr(cur.expression)
            const calleeIsAccess =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
            if (!calleeIsAccess) break
            const m = indirectMemberOf(callee)
            if (m === undefined || !INDIRECT_NAMES.has(m)) break
            const recvExpr = (callee as ts.PropertyAccessExpression | ts.ElementAccessExpression)
              .expression
            const recvIsIndirect =
              INDIRECT_NAMES.has(indirectMemberOf(recvExpr) ?? '')
            if ((m === 'call' || m === 'apply') && recvIsIndirect) {
              const arg0 = cur.arguments[0]
              if (arg0 === undefined) break
              cur = arg0
            } else {
              cur = recvExpr
            }
          }
          target = cur
        }
        if (ts.isPropertyAccessExpression(target)) {
          memberName = target.name.text
        } else if (ts.isElementAccessExpression(target)) {
          memberName = literalize(target.argumentExpression, binds)
        }
        if (
          memberName !== undefined &&
          (memberName === '$patch' ||
            STRUCTURAL_WRITE_NAMES.has(memberName) ||
            REFLECTIVE_READ_NAMES.has(memberName))
        ) {
          binds.memberAliases.set(n.name.text, { member: memberName, root: '__expr__' })
        }
      }
    }

    // ---- pass 2: write-site scan shared by every parsed body ----
    const scanBody = (body: string, jsx = false): void => {
      const sf = ts.createSourceFile(
        jsx ? 'probe.tsx' : 'probe.ts',
        `function __scan(){ ${body} }`,
        ts.ScriptTarget.ESNext,
        true,
        jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
      if (maxNodeDepth(sf) > MAX_NODE_DEPTH) {
        flag('pathological expression depth - unverifiable')
        return
      }

      const pool = (n: ts.Node): boolean => containsPoolAccess(n, binds)

      // A member chain whose ROOT resolves to the pool or its owner:
      // the access chain is followed receiver-first only - element
      // keys, call args and literal interiors do NOT make the target
      // poolish (that is what let `({...player.baseStats}).qi = 9`
      // flag as a pool write: the clone read inside the target's own
      // literal was counted).
      const receiverChainPoolish = (t: ts.Expression): boolean => {
        // An expression that resolves to the POOL itself (not a pool
        // field of the owner, not an owner member).
        const elemIsPool = (el: ts.Expression): boolean => {
          const eu = unwrapExpr(el)
          return (
            isPoolRootAccess(eu) ||
            (ts.isIdentifier(eu) &&
              (binds.aliases.has(eu.text) ||
                binds.poolContainers.has(eu.text)))
          )
        }
        let cur: ts.Expression = t
        for (;;) {
          const u = unwrapExpr(cur)
          if (ts.isIdentifier(u)) {
            // Only pool-BOUND roots make the whole chain a pool write:
            // `bs.qi` (bs bound to baseStats) is the pool, while
            // `player.qi`/`s.qi` on an owner root writes an owner
            // field - the `x.baseStats` leaf arm above is what pins
            // the pool slot on owner/poolish-name receivers. enumElems
            // (bound enumeration elements) and vForPoolNames (pool-
            // carrying template loop vars) are pool-bound too.
            return (
              binds.aliases.has(u.text) ||
              binds.poolContainers.has(u.text) ||
              binds.enumElems.has(u.text) ||
              binds.vForPoolNames.has(u.text)
            )
          }
          if (u.kind === ts.SyntaxKind.ThisKeyword) return false
          if (ts.isPropertyAccessExpression(u)) {
            const p = accessPath(u, binds)
            if (p !== undefined && binds.propAliases.has(p)) {
              return true
            }
            // The spelled pool slot itself: `x.baseStats.qi` writes
            // through the pool wherever `x` resolves - on a poolish
            // receiver OR on a function param (the cross-file helper
            // lane: `function f(p) { p.baseStats.qi = 9 }`, R15 S6/S7).
            if (
              u.name.text === 'baseStats' &&
              (receiverPoolish(u.expression, binds) ||
                (ts.isIdentifier(unwrapExpr(u.expression)) &&
                  binds.paramNames.has(
                    (unwrapExpr(u.expression) as ts.Identifier).text,
                  )))
            ) {
              return true
            }
            // `c.value.qi` - a ref bound to the pool: `.value` IS the
            // pool slot (R15 S2).
            if (
              u.name.text === 'value' &&
              ts.isIdentifier(unwrapExpr(u.expression)) &&
              binds.refAliases.has(
                (unwrapExpr(u.expression) as ts.Identifier).text,
              )
            ) {
              return true
            }
            cur = u.expression
            continue
          }
          if (ts.isElementAccessExpression(u)) {
            // A spelled key must RIDE a poolish/param receiver - the
            // enumeration smuggle deliberately uses an opaque one, but
            // `dto['baseStats']` on an unbound DTO is a shape write
            // exactly like `dto.baseStats` (R15 F1). For the OPAQUE-key
            // arm the receiver must be the owner/pool itself - a bare
            // bound ident, a param, or an alias path - never an owner
            // FIELD (`player.nodeLevels[node.id]` keys into a dict
            // slot, and `node.id` cannot name 'baseStats').
            const recvEl = unwrapExpr(u.expression)
            const recvBound =
              (ts.isIdentifier(recvEl) &&
                (receiverPoolish(recvEl, binds) ||
                  binds.paramNames.has(recvEl.text))) ||
              ((ts.isPropertyAccessExpression(recvEl) ||
                ts.isElementAccessExpression(recvEl)) &&
                (() => {
                  const p = accessPath(recvEl, binds)
                  return (
                    p !== undefined &&
                    (binds.propAliases.has(p) || binds.ownerPropPaths.has(p))
                  )
                })()) ||
              (ts.isCallExpression(recvEl) &&
                receiverPoolish(recvEl, binds))
            const keyLit =
              u.argumentExpression !== undefined
                ? literalize(u.argumentExpression, binds)
                : undefined
            if (
              keyLit === 'baseStats' ||
              spellsToken(u.argumentExpression, 'baseStats', binds)
            ) {
              return recvBound
            }
            // An opaque BARE-IDENT key on a poolish/param receiver can
            // index 'baseStats' at runtime: `player[k]` in a key loop
            // (R15 S4). Member-position keys (`dict[field]`,
            // `RESOURCE_FIELD[x]`) and call keys are the opaque-data
            // bound - no spelled binding to resolve, same family as
            // `p[k]` with a computed k.
            if (
              keyLit === undefined &&
              recvBound &&
              u.argumentExpression !== undefined &&
              ts.isIdentifier(unwrapExpr(u.argumentExpression))
            ) {
              return true
            }
            // `[pool][0].qi = 9` - an element of an inline carrier
            // whose value IS the pool resolves to the pool element.
            const recv = unwrapExpr(u.expression)
            if (ts.isArrayLiteralExpression(recv)) {
              const idx =
                u.argumentExpression !== undefined
                  ? literalizeNumber(u.argumentExpression, binds)
                  : undefined
              if (idx !== undefined) {
                const el = recv.elements[idx]
                if (
                  el !== undefined &&
                  !ts.isSpreadElement(el) &&
                  elemIsPool(el as ts.Expression)
                ) {
                  return true
                }
              } else {
                // Opaque index on an inline pool carrier - conservative.
                if (
                  recv.elements.some(
                    (el) =>
                      !ts.isSpreadElement(el) &&
                      elemIsPool(el as ts.Expression),
                  )
                ) {
                  return true
                }
              }
            }
            cur = u.expression
            continue
          }
          if (ts.isAwaitExpression(u)) {
            cur = u.expression
            continue
          }
          if (ts.isConditionalExpression(u)) {
            return (
              receiverChainPoolish(u.whenTrue) ||
              receiverChainPoolish(u.whenFalse)
            )
          }
          if (
            ts.isBinaryExpression(u) &&
            (u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
              u.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              u.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
          ) {
            return (
              receiverChainPoolish(u.left) || receiverChainPoolish(u.right)
            )
          }
          if (ts.isCallExpression(u) || ts.isNewExpression(u)) {
            // `f().qi` where f yields the pool (poolThunks inside
            // receiverPoolish) is a pool write; an opaque call target
            // is the documented bound.
            return receiverPoolish(u, binds) && !ownerSource(u)
          }
          if (ts.isObjectLiteralExpression(u)) {
            // `{s: pool}.s.qi` - a named prop whose literal value IS
            // the pool (a `{...pool}` spread clone is NOT a source).
            return u.properties.some(
              (p) =>
                ts.isPropertyAssignment(p) && elemIsPool(p.initializer),
            )
          }
          return false
        }
      }
      // Write-TARGET poolishness: unlike `pool()` (any pool access in
      // the subtree), this follows only the receiver chain of the
      // assigned target.
      const writeTargetPoolish = (t: ts.Expression): boolean => {
        if (isStateSlot(t)) return true
        const u = unwrapExpr(t)
        if (ts.isIdentifier(u)) {
          return binds.aliases.has(u.text)
        }
        return receiverChainPoolish(t)
      }

      // Destructure-pattern interiors: `({a: pool.qi} = src)` and
      // `[t.baseStats] = ...` WRITE through the pattern's value
      // positions - the object/array literal on the left is not a
      // receiver chain, so walk its members as targets (R16 F1).
      const destructureTargetPoolish = (t: ts.Expression): boolean => {
        const u = unwrapExpr(t)
        if (ts.isObjectLiteralExpression(u)) {
          return u.properties.some((p) => {
            if (ts.isPropertyAssignment(p)) {
              return destructureTargetPoolish(p.initializer)
            }
            if (ts.isShorthandPropertyAssignment(p)) {
              return writeTargetPoolish(p.name)
            }
            if (ts.isSpreadAssignment(p)) {
              return writeTargetPoolish(p.expression)
            }
            return false
          })
        }
        if (ts.isArrayLiteralExpression(u)) {
          return u.elements.some((el) => {
            if (ts.isOmittedExpression(el)) return false
            const tgt = ts.isBinaryExpression(el)
              ? el.left // `[x = dflt]` default - target is x
              : el
            return destructureTargetPoolish(tgt)
          })
        }
        // `{a: x = dflt}` - the destructure default wraps the target.
        if (
          ts.isBinaryExpression(u) &&
          u.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
          return destructureTargetPoolish(u.left)
        }
        return writeTargetPoolish(t)
      }

      // A WRITE through a pool target inside a subtree - distinct from
      // containsPoolAccess (reads too): used to keep read-shaped
      // callees (`arr.map(cb)`) callable only when the closure does
      // not WRITE the pool.
      const containsPoolWrite = (node: ts.Node): boolean => {
        let hit = false
        walkAll(node, (x) => {
          if (hit) return true
          if (
            ts.isBinaryExpression(x) &&
            COMPOUND_ASSIGN.has(x.operatorToken.kind) &&
            (writeTargetPoolish(x.left) || isStateSlot(x.left))
          ) {
            hit = true
            return true
          }
          if (
            (ts.isPrefixUnaryExpression(x) || ts.isPostfixUnaryExpression(x)) &&
            (x.operator === ts.SyntaxKind.PlusPlusToken ||
              x.operator === ts.SyntaxKind.MinusMinusToken) &&
            writeTargetPoolish(x.operand)
          ) {
            hit = true
            return true
          }
          if (
            ts.isDeleteExpression(x) &&
            (writeTargetPoolish(x.expression) || isStateSlot(x.expression))
          ) {
            hit = true
            return true
          }
          return
        })
        return hit
      }

      // `row.baseStats.qi = 9` inside a .vue template where `row` is a
      // v-for alias: the loop variable is bound nowhere in script, so
      // only the spelled leaf + v-for membership prove the lane.
      const vForSpelledWrite = (t: ts.Expression): boolean => {
        if (binds.vForNames.size === 0 && binds.vForPoolNames.size === 0) {
          return false
        }
        let cur: ts.Expression = t
        let spelled = false
        let rootIdent: string | undefined
        for (;;) {
          const u = unwrapExpr(cur)
          if (ts.isPropertyAccessExpression(u)) {
            if (u.name.text === 'baseStats' || u.name.text === '$state') {
              spelled = true
            }
            cur = u.expression
            continue
          }
          if (ts.isElementAccessExpression(u)) {
            const lit = literalize(u.argumentExpression, binds)
            if (lit === 'baseStats' || lit === '$state') spelled = true
            cur = u.expression
            continue
          }
          if (ts.isIdentifier(u)) {
            rootIdent = u.text
          }
          break
        }
        if (rootIdent === undefined) return false
        // A loop var bound to a pool-carrying iterable IS the pool
        // element - `bs.strength` writes it with no spelled leaf.
        if (binds.vForPoolNames.has(rootIdent)) return true
        return spelled && binds.vForNames.has(rootIdent)
      }

      // Anywhere a spelled token for `name` appears: literal, const-key
      // identifier, or a concat of spelled pieces.
      const hasTokenNamed = (n: ts.Node, name: string): boolean => {
        let hit = false
        walkAll(n, (x) => {
          if (hit) return true
          if (
            (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
            x.text === name
          ) {
            hit = true
            return true
          }
          if (ts.isIdentifier(x) && binds.constKeys.get(x.text) === name) {
            hit = true
            return true
          }
          if (
            ts.isBinaryExpression(x) &&
            x.operatorToken.kind === ts.SyntaxKind.PlusToken &&
            literalize(x, binds) === name
          ) {
            hit = true
            return true
          }
          return
        })
        return hit
      }
      const hasBaseStatsToken = (n: ts.Node): boolean => hasTokenNamed(n, 'baseStats')
      const hasStateToken = (n: ts.Node): boolean => hasTokenNamed(n, '$state')


      // Does the subtree name a pinned structural/$patch member in any
      // spelling (dot, literal bracket, concat, const-key)?
      const touchesName = (n: ts.Node, names: ReadonlySet<string>): boolean => {
        let hit = false
        walkAll(n, (x) => {
          if (hit) return true
          if (ts.isPropertyAccessExpression(x) && names.has(x.name.text)) {
            hit = true
            return true
          }
          if (ts.isElementAccessExpression(x)) {
            const lit = literalize(x.argumentExpression, binds)
            if (lit !== undefined && names.has(lit)) {
              hit = true
              return true
            }
          }
          if (ts.isIdentifier(x) && binds.memberAliases.has(x.text)) {
            const bound = binds.memberAliases.get(x.text)
            if (bound !== undefined && names.has(bound.member)) {
              hit = true
              return true
            }
          }
          return
        })
        return hit
      }
      const STRUCTURAL_OR_PATCH = new Set([...STRUCTURAL_WRITE_NAMES, '$patch'])
      const touchesStructuralName = (n: ts.Node): boolean =>
        touchesName(n, STRUCTURAL_OR_PATCH)
      const PATCH_ONLY = new Set(['$patch'])
      const touchesPatch = (n: ts.Node): boolean => touchesName(n, PATCH_ONLY)

      // Any of the pool-name tokens spelled in the subtree (guard
      // conditions, loop pools, case clauses).
      const PINNED_TOKENS = ['baseStats', '$state', '$patch']
      const hasAnyToken = (n: ts.Node): boolean =>
        PINNED_TOKENS.some((t) => hasTokenNamed(n, t))


      // Read-shaped callees: spelled member names or bare identifiers that
      // only consume the pool. Everything else receiving the pool object
      // itself is an unverifiable write funnel.
      const READ_MEMBERS = new Set([
        'entries', 'keys', 'values', 'stringify', 'parse',
        'isFrozen', 'getOwnPropertyNames', 'includes', 'indexOf',
        'some', 'every', 'map', 'filter', 'reduce', 'find', 'forEach',
        'findLast', 'findLastIndex', 'findIndex', 'reduceRight',
        'concat', 'slice', 'flat', 'flatMap', 'join',
        'toSorted', 'toReversed', 'toSpliced', 'with',
        'min', 'max', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
        'pow', 'sqrt', 'log', 'random', 'hypot', 'clamp',
        'has', 'get', 'delete', 'size', 'at', 'fromEntries', 'from',
        // console.* diagnostics - not write lanes.
        'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table',
        // Immutability operations - they LOCK the pool, never write it.
        'freeze', 'seal', 'preventExtensions',
      ])
      // Members whose callback params are ELEMENTS of the receiver:
      // on a pool-carrying receiver the param binds the pool element
      // (R15 S1). `sort` compares two elements; `reduce` carries the
      // element at param index 1.
      const ITER_CB_MEMBERS = new Set([
        'forEach', 'map', 'filter', 'find', 'findLast', 'findIndex',
        'some', 'every', 'flatMap', 'reduce', 'reduceRight', 'sort',
      ])
      const READ_IDENTIFIERS = new Set([
        'isObject', 'isPlainObject', 'isRecord', 'structuredClone',
        'cloneDeep', 'deepClone', 'clone', 'asBaseStats', 'calculateStats',
        'calculateEffectiveStats', 'recomputeEffectiveStats',
        'runPipeline', 'computeStats', 'getStats', 'formatStat', 'snapshot',
        'isFinite', 'Number', 'Boolean', 'Array',
        // Vue readers register a tracking closure that READS the pool;
        // deferred executors (nextTick/queueMicrotask) stay excluded -
        // they are opaque deferred channels, not readers.
        'computed', 'watch', 'watchEffect', 'watchPostEffect',
        'watchSyncEffect',
      ])

      // String/search members whose spelled argument is a key fragment
      // (prefix enumeration: `k.startsWith('baseS')`).
      const FRAGMENT_CALLS = new Set([
        'startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf',
        'slice', 'substring', 'substr', 'charAt', 'charCodeAt', 'padStart',
        'padEnd', 'repeat', 'match', 'search', 'split', 'replace',
      ])
      const fragmentOfPinned = (lit: string | undefined): boolean =>
        lit !== undefined &&
        lit.length >= 5 &&
        PINNED_TOKENS.some((t) => t.includes(lit) && lit !== t)

      const memberNameOfLocal = (
        e: ts.Expression,
      ): { member: string; root: string } | undefined => {
        const u = unwrapExpr(e)
        if (ts.isPropertyAccessExpression(u)) {
          return { member: u.name.text, root: resolveRoot(u.expression, binds) }
        }
        if (ts.isElementAccessExpression(u) && u.argumentExpression !== undefined) {
          const lit = literalize(u.argumentExpression, binds)
          return lit === undefined
            ? undefined
            : { member: lit, root: resolveRoot(u.expression, binds) }
        }
        return undefined
      }
      const invokedInfo = (n: ts.CallExpression): { member: string; root: string } | undefined => {
        const callee = unwrapExpr(n.expression)
        if (
          !ts.isPropertyAccessExpression(callee) &&
          !ts.isElementAccessExpression(callee)
        ) {
          return undefined
        }
        const member = memberNameOfLocal(callee)?.member
        if (member === undefined || !INDIRECT_NAMES.has(member)) return undefined
        const recv = callee.expression
        const recvMember = memberNameOfLocal(recv)?.member
        if (
          (member === 'call' || member === 'apply') &&
          recvMember !== undefined &&
          INDIRECT_NAMES.has(recvMember)
        ) {
          const arg0 = n.arguments[0]
          if (arg0 === undefined) return undefined
          return memberNameOfLocal(arg0) ?? (ts.isIdentifier(unwrapExpr(arg0))
            ? { member: (unwrapExpr(arg0) as ts.Identifier).text, root: '' }
            : undefined)
        }
        return memberNameOfLocal(recv) ?? (ts.isIdentifier(unwrapExpr(recv))
          ? { member: (unwrapExpr(recv) as ts.Identifier).text, root: '' }
          : undefined)
      }

      // Drop `names` from every binding collection for the duration of
      // `body`, then restore - parameter/catch-variable shadowing:
      // `const s = pool; [9].map((s) => { s.strength = 1 })` - inside
      // the callback `s` is the param, not the alias.
      const withShadow = (names: ReadonlySet<string>, body: () => void): void => {
        const removed: [Set<string> | Map<string, unknown>, string, unknown][] =
          []
        const dropFrom = (set: Set<string>, name: string): void => {
          if (set.has(name)) {
            set.delete(name)
            removed.push([set, name, undefined])
          }
        }
        const dropFromMap = (map: Map<string, unknown>, name: string): void => {
          if (map.has(name)) {
            removed.push([map, name, map.get(name)])
            map.delete(name)
          }
        }
        for (const nm of names) {
          dropFrom(binds.aliases, nm)
          dropFrom(binds.ownerAliases, nm)
          dropFrom(binds.payloadAliases, nm)
          dropFrom(binds.poolContainers, nm)
          dropFrom(binds.enumArrays, nm)
          dropFrom(binds.enumElems, nm)
          dropFrom(binds.poolThunks, nm)
          dropFrom(binds.ownerThunks, nm)
          dropFromMap(binds.fnPoolParams as Map<string, unknown>, nm)
          dropFrom(binds.vForNames, nm)
          dropFrom(binds.vForPoolNames, nm)
          dropFrom(binds.shadowed, nm)
          dropFromMap(binds.constKeys as Map<string, unknown>, nm)
          dropFromMap(binds.rootAliases as Map<string, unknown>, nm)
          dropFromMap(binds.memberAliases as Map<string, unknown>, nm)
          dropFromMap(binds.arrayConsts as Map<string, unknown>, nm)
          dropFromMap(binds.constPropKeys as Map<string, unknown>, nm)
          dropFrom(binds.refAliases, nm)
          dropFrom(binds.ownerFactories, nm)
          dropFrom(binds.nsNamespaces, nm)
        }
        try {
          body()
        } finally {
          for (const [holder, name, val] of removed) {
            if (holder instanceof Set) {
              holder.add(name)
            } else {
              holder.set(name, val)
            }
          }
        }
      }
      const collectBindingNames = (pat: ts.BindingName, into: Set<string>): void => {
        if (ts.isIdentifier(pat)) {
          into.add(pat.text)
          return
        }
        for (const el of pat.elements) {
          if (ts.isBindingElement(el)) collectBindingNames(el.name, into)
        }
      }
      // Evaluate a callback-arg lane with the callback's own params
      // shadowed: `(sA) => sA.strength = 1` reads the param, never the
      // file-level `sA` alias - matching how the callback body is
      // visited under inspect().
      const laneWithShadow = (
        a: ts.Expression,
        pred: (x: ts.Expression) => boolean,
      ): boolean => {
        if (!ts.isArrowFunction(a) && !ts.isFunctionExpression(a)) {
          return pred(a)
        }
        const names = new Set<string>()
        for (const p of a.parameters) collectBindingNames(p.name, names)
        let hit = false
        withShadow(names, () => {
          hit = pred(a)
        })
        return hit
      }
      // A call whose callee resolves to an owner factory returns the
      // store: `usePlayerStore()`, `registry()` (renamed import),
      // `ns.usePlayerStore()` (namespace) - feeding THAT to an opaque
      // callee hands the owner to an unverifiable channel (R15 S6).
      const ownerFactoryCallResult = (x: ts.Expression): boolean => {
        const u = unwrapExpr(x)
        if (!ts.isCallExpression(u)) return false
        const info = resolveCallee(u.expression, binds)
        if (info === undefined) return false
        if (
          info.root === '' &&
          (isOwnerFactoryName(info.member) || binds.ownerFactories.has(info.member))
        ) {
          return true
        }
        return binds.nsNamespaces.has(info.root) && isOwnerFactoryName(info.member)
      }

      const inspect = (
        n: ts.Node,
        guarded: boolean,
        noShadow = false,
      ): void => {
        // Function-likes shadow collected bindings. A param WITH a
        // pool-bound default (`function f(s = player.baseStats)`) keeps
        // its binding - writing `s.x` still reaches the default value.
        if (
          !noShadow &&
          (ts.isArrowFunction(n) ||
            ts.isFunctionExpression(n) ||
            ts.isFunctionDeclaration(n) ||
            ts.isMethodDeclaration(n) ||
            ts.isGetAccessorDeclaration(n) ||
            ts.isSetAccessorDeclaration(n) ||
            ts.isConstructorDeclaration(n))
        ) {
          const shadowNames = new Set<string>()
          for (const p of n.parameters) {
            const initsPool =
              p.initializer !== undefined &&
              poolishBindingSource(unwrapExpr(p.initializer))
            if (ts.isIdentifier(p.name) && initsPool) continue
            const tmp = new Set<string>()
            collectBindingNames(p.name, tmp)
            // An `onActionBound` name was bound to the store by a
            // `store.$onAction(({store: s}) => ...)` destructure - it
            // is an owner binding, not a local param shadow.
            for (const nm of tmp) {
              if (!binds.onActionBound.has(nm)) shadowNames.add(nm)
            }
          }
          // Params of this function enter paramNames for its subtree:
          // `f(p) { p.baseStats.qi = 9 }` writes whatever the caller
          // feeds - the definition site is the static handle on the
          // helper lane (R15 S6/S7).
          const addedParams: string[] = []
          for (const p of n.parameters) {
            const ptmp = new Set<string>()
            collectBindingNames(p.name, ptmp)
            for (const nm of ptmp) {
              if (!binds.paramNames.has(nm)) addedParams.push(nm)
              binds.paramNames.add(nm)
            }
          }
          try {
            withShadow(shadowNames, () => {
              // The accessor/method arm below applies to this node too -
              // run it before descending so `get pool() { return ... }`
              // still flags.
              if (
                (ts.isGetAccessorDeclaration(n) || ts.isMethodDeclaration(n)) &&
                n.body !== undefined
              ) {
                let returnsPool = false
                walkAll(n.body, (x) => {
                  if (returnsPool) return true
                  if (
                    ts.isReturnStatement(x) &&
                    x.expression !== undefined &&
                    poolishBindingSource(x.expression)
                  ) {
                    returnsPool = true
                    return true
                  }
                  return
                })
                if (returnsPool) flag(`member returns pool: ${n.getText(sf)}`)
              }
              n.forEachChild((c) => inspect(c, guarded))
            })
          } finally {
            for (const nm of addedParams) binds.paramNames.delete(nm)
          }
          return
        }
        // `catch (s) { s.strength = 1 }` - the catch variable shadows
        // binding names for its block the same way params do.
        if (
          !noShadow &&
          ts.isCatchClause(n) &&
          n.variableDeclaration !== undefined
        ) {
          const shadowNames = new Set<string>()
          collectBindingNames(n.variableDeclaration.name, shadowNames)
          withShadow(shadowNames, () => {
            n.forEachChild((c) => inspect(c, guarded))
          })
          return
        }
        // Callback params on a pool-carrying channel bind the pool
        // element (R15 S1/S2/S3): `[pool].forEach(b => {b.qi = 9})`,
        // `enumArr.map(([k,v]) => ...)`, `Object.values(player)
        // .forEach(cb)`, `arr.entries()` on a bound carrier,
        // `Array.prototype.forEach.call(arr, cb)`,
        // `watch(() => pool, b => ...)`, `(async()=>pool)().then(b =>
        // ...)`. Bound names land in enumElems for the callback
        // subtree only; each fn arg is visited with noShadow so its
        // own parameter list keeps the names it just bound.
        if (ts.isCallExpression(n) && n.arguments.length > 0) {
          const cal = unwrapExpr(n.expression)
          const enumKindOf = (
            call: ts.CallExpression,
          ): 'entries' | 'scalar' | 'keys' | undefined => {
            const info = resolveCallee(call.expression, binds)
            if (info === undefined) return undefined
            if (
              info.member !== 'entries' &&
              info.member !== 'values' &&
              info.member !== 'keys'
            ) {
              return undefined
            }
            const objArgPoolish =
              (info.root === 'Object' || info.root === '') &&
              call.arguments[0] !== undefined &&
              (ownerSource(call.arguments[0]) ||
                isPoolRootAccess(call.arguments[0]) ||
                isStateSlot(call.arguments[0]))
            const recvCarrier =
              binds.enumArrays.has(info.root) ||
              binds.poolContainers.has(info.root)
            if (!objArgPoolish && !recvCarrier) return undefined
            if (info.member === 'keys') return 'keys'
            return info.member === 'entries' ? 'entries' : 'scalar'
          }
          const carrierOf = (
            recv: ts.Expression,
          ): 'entries' | 'scalar' | 'keys' | undefined => {
            const r = unwrapExpr(recv)
            if (ts.isIdentifier(r)) {
              if (binds.enumArrays.has(r.text)) return 'entries'
              if (binds.poolContainers.has(r.text)) return 'scalar'
              return undefined
            }
            if (ts.isArrayLiteralExpression(r)) {
              return r.elements.some(
                (el) =>
                  !ts.isSpreadElement(el) &&
                  (isPoolRootAccess(el as ts.Expression) ||
                    (ts.isIdentifier(unwrapExpr(el)) &&
                      (binds.aliases.has(
                        (unwrapExpr(el) as ts.Identifier).text,
                      ) ||
                        binds.poolContainers.has(
                          (unwrapExpr(el) as ts.Identifier).text,
                        ) ||
                        binds.enumElems.has(
                          (unwrapExpr(el) as ts.Identifier).text,
                        )))),
              )
                ? 'scalar'
                : undefined
            }
            if (ts.isCallExpression(r)) return enumKindOf(r)
            return undefined
          }
          let cbs: (ts.ArrowFunction | ts.FunctionExpression)[] = []
          let entries = false
          let reduce = false
          let matched = false
          const fnArgAt = (i: number) => {
            const a = n.arguments[i]
            return a !== undefined &&
              (ts.isArrowFunction(a) || ts.isFunctionExpression(a))
              ? (a as ts.ArrowFunction | ts.FunctionExpression)
              : undefined
          }
          if (
            ts.isPropertyAccessExpression(cal) ||
            ts.isElementAccessExpression(cal)
          ) {
            const member =
              ts.isPropertyAccessExpression(cal)
                ? cal.name.text
                : literalize(cal.argumentExpression, binds)
            const recvU = unwrapExpr(cal.expression)
            if (member === 'call' || member === 'apply') {
              // `Array.prototype.forEach.call(arr, cb)` - the carrier
              // is arg0, the callback arg1.
              const inner = memberNameOfLocal(recvU)?.member
              const arg0 = n.arguments[0]
              if (
                inner !== undefined &&
                ITER_CB_MEMBERS.has(inner) &&
                arg0 !== undefined
              ) {
                const kind = carrierOf(arg0)
                if (kind === 'entries' || kind === 'scalar') {
                  matched = true
                  entries = kind === 'entries'
                  reduce = inner === 'reduce' || inner === 'reduceRight'
                  const cb = fnArgAt(1)
                  if (cb !== undefined) cbs.push(cb)
                }
              }
            } else if (member !== undefined && ITER_CB_MEMBERS.has(member)) {
              const kind = carrierOf(recvU)
              if (kind === 'entries' || kind === 'scalar') {
                matched = true
                entries = kind === 'entries'
                reduce = member === 'reduce' || member === 'reduceRight'
                const cb = fnArgAt(0)
                if (cb !== undefined) cbs.push(cb)
              }
            } else if (
              member === 'then' ||
              member === 'catch' ||
              member === 'finally'
            ) {
              // `(async()=>pool)().then(b => {b.qi = 9})` - a deferred
              // param lane: the settled value is the pool.
              if (containsPoolAccess(recvU, binds)) {
                matched = true
                for (const a of n.arguments) {
                  if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
                    cbs.push(a)
                  }
                }
              }
            }
          } else if (ts.isIdentifier(cal)) {
            // `watch(() => pool, b => {...})` - the watched source
            // feeds the pool into the handler's params.
            if (
              (cal.text === 'watch' || cal.text === 'watchEffect' ||
                cal.text === 'watchPostEffect' ||
                cal.text === 'watchSyncEffect') &&
              n.arguments[0] !== undefined &&
              containsPoolAccess(n.arguments[0], binds)
            ) {
              matched = true
              for (const a of n.arguments.slice(1)) {
                if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
                  cbs.push(a)
                }
              }
            }
          }
          if (matched && cbs.length > 0) {
            const added: string[] = []
            for (const cb of cbs) {
              const param0 = cb.parameters[0]
              if (param0 !== undefined) {
                if (ts.isArrayBindingPattern(param0.name)) {
                  // entries pair -> position 1 is the value; a plain
                  // array destructure (`([b]) => ...`) binds all.
                  const idxs = entries
                    ? [1]
                    : param0.name.elements.map((_, i) => i)
                  for (const i of idxs) {
                    const el = param0.name.elements[i]
                    if (
                      el !== undefined &&
                      ts.isBindingElement(el) &&
                      ts.isIdentifier(el.name)
                    ) {
                      added.push(el.name.text)
                    }
                  }
                } else if (ts.isIdentifier(param0.name)) {
                  added.push(param0.name.text)
                } else if (ts.isObjectBindingPattern(param0.name)) {
                  for (const el of param0.name.elements) {
                    if (
                      ts.isBindingElement(el) &&
                      ts.isIdentifier(el.name)
                    ) {
                      added.push(el.name.text)
                    }
                  }
                }
              }
              if (reduce) {
                const p1 = cb.parameters[1]
                if (p1 !== undefined && ts.isIdentifier(p1.name)) {
                  added.push(p1.name.text)
                }
              }
            }
            try {
              for (const a of added) binds.enumElems.add(a)
              n.forEachChild((c) =>
                inspect(c, guarded, cbs.some((cb) => cb === c)),
              )
            } finally {
              for (const a of added) binds.enumElems.delete(a)
            }
            return
          }
        }
        // Inside a block whose test spells 'baseStats' (enumeration +
        // key-narrowing pattern: `if (k === 'baseStats') v.x = 9`),
        // every member write is suspect even when the root is opaque.
        let inner = guarded
        let testExpr: ts.Expression | undefined
        if (ts.isIfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
          testExpr = n.expression
        } else if (ts.isConditionalExpression(n)) {
          testExpr = n.condition
        } else if (ts.isForOfStatement(n) || ts.isForInStatement(n)) {
          // `for (const k of ['baseStats']) x[k].y = 9` - the loop pool
          // spells the key domain.
          testExpr = n.expression
        } else if (ts.isCaseClause(n)) {
          testExpr = n.expression
        }
        if (
          testExpr !== undefined &&
          (hasAnyToken(testExpr) || containsPoolAccess(testExpr, binds))
        ) {
          inner = true
        }
        // A spelled `*.test*` specifier literal ANYWHERE in production
        // text: import.meta.glob, `new Worker(new URL('./x.test', ...))`,
        // an aliased `r('./x.test')` - all smuggle an unscanned module.
        // Specifiers always carry a path separator; fixture ids like
        // `root.test.1` do not.
        if (
          (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
          (n.text.includes('/') || n.text.includes('*') ||
            n.text.includes('{') || n.text.includes('?')) &&
          isTestSpecifier(n.text)
        ) {
          flag(`test-module specifier: ${n.getText(sf)}`)
        }
        const isMemberWrite =
          (ts.isBinaryExpression(n) && COMPOUND_ASSIGN.has(n.operatorToken.kind)) ||
          ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
            (n.operator === ts.SyntaxKind.PlusPlusToken ||
              n.operator === ts.SyntaxKind.MinusMinusToken)) ||
          ts.isDeleteExpression(n)
        if (inner && isMemberWrite) {
          let target: ts.Expression | undefined
          if (ts.isBinaryExpression(n)) {
            target = n.left
          } else if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) {
            target = n.operand
          } else if (ts.isDeleteExpression(n)) {
            target = n.expression
          }
          // Inside a spelled-key block the enumeration smuggle is
          // `for (k of keys) if (k==='baseStats') v[k].x = 9` - an
          // element write ANYWHERE in the target chain whose key is
          // dynamic (unresolved literalize) or pinned; plus pinned-leaf
          // writes and writes on poolish receivers. A plain
          // `box.mode = 1` beside the narrowing test is the FP shape.
          if (target !== undefined) {
            const t = unwrapExpr(target)
            let elSuspect = false
            walkAll(t, (x) => {
              if (elSuspect) return true
              if (ts.isElementAccessExpression(x)) {
                const lit =
                  x.argumentExpression !== undefined
                    ? literalize(x.argumentExpression, binds)
                    : undefined
                if (lit === undefined || PINNED_TOKENS.includes(lit)) {
                  elSuspect = true
                  return true
                }
              }
              return
            })
            if (elSuspect) {
              flag(n.getText(sf))
            } else if (ts.isPropertyAccessExpression(t)) {
              // `v.might = 9` inside `if (k === 'baseStats')` where v
              // is the VALUE element of Object.entries(player) - the
              // narrow spelled the key, v carries the pool.
              const enumRoot =
                ts.isIdentifier(unwrapExpr(t.expression)) &&
                binds.enumElems.has((unwrapExpr(t.expression) as ts.Identifier).text)
              if (
                PINNED_TOKENS.includes(t.name.text) ||
                receiverPoolish(t.expression, binds) ||
                enumRoot
              ) {
                flag(n.getText(sf))
              }
            }
          }
        }
        // assignment / compound assignment target (incl. ??=/&&=/||=
        // on the $state slot). The target's RECEIVER CHAIN decides -
        // pool reads inside element keys, call args, or literal
        // interiors of the target expression are not write lanes.
        if (
          ts.isBinaryExpression(n) &&
          COMPOUND_ASSIGN.has(n.operatorToken.kind) &&
          (destructureTargetPoolish(n.left) ||
            isStateSlot(n.left) ||
            vForSpelledWrite(n.left))
        ) {
          flag(n.getText(sf))
        }
        // ++/-- operand
        if (
          (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
          (n.operator === ts.SyntaxKind.PlusPlusToken ||
            n.operator === ts.SyntaxKind.MinusMinusToken) &&
          (writeTargetPoolish(n.operand) || vForSpelledWrite(n.operand))
        ) {
          flag(n.getText(sf))
        }
        // delete expr (pool member OR the $state slot itself)
        if (
          ts.isDeleteExpression(n) &&
          (writeTargetPoolish(n.expression) ||
            isStateSlot(n.expression) ||
            vForSpelledWrite(n.expression))
        ) {
          flag(n.getText(sf))
        }
        // `f`${pool}`` - a tagged template hands the pool expression
        // to an opaque tag function (R17).
        if (
          ts.isTaggedTemplateExpression(n) &&
          containsPoolAccess(n.template, binds)
        ) {
          flag(`pool handle to tagged template: ${n.getText(sf)}`)
        }
        // `try {} catch (e) { e.baseStats.qi = 9 }` - a catch-bound
        // identifier is an opaque handle; a pool-shaped write through
        // it is unprovable (R17).
        if (
          ts.isCatchClause(n) &&
          n.variableDeclaration !== undefined &&
          ts.isIdentifier(n.variableDeclaration.name)
        ) {
          const cname = n.variableDeclaration.name.text
          let caught = false
          walkAll(n.block, (x) => {
            if (caught) return true
            if (
              ts.isPropertyAccessExpression(x) &&
              ts.isIdentifier(x.expression) &&
              x.expression.text === cname &&
              (x.name.text === 'baseStats' || x.name.text === '$state')
            ) {
              caught = true
              return true
            }
            return
          })
          if (caught) {
            flag(`catch-bound opaque pool write: ${n.getText(sf)}`)
          }
        }
        // `x.innerHTML = markup` / `x.outerHTML = ...` - DOM code
        // injection write lanes (script-capable markup sinks).
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
          const l = unwrapExpr(n.left)
          const leaf = ts.isPropertyAccessExpression(l)
            ? l.name.text
            : ts.isElementAccessExpression(l)
              ? literalize(l.argumentExpression, binds)
              : undefined
          if (
            leaf !== undefined &&
            (leaf === 'innerHTML' || leaf === 'outerHTML' || leaf === 'srcdoc')
          ) {
            flag(`DOM code-injection write: ${n.getText(sf)}`)
          }
          // `x.textContent/src/href = payload` - script-capable sinks
          // only when the payload itself spells a write through the
          // pool (`'player.baseStats.qi = 9'`, a $state replace or a
          // pinned pill call). A fragment inside a concat still hits.
          if (
            leaf !== undefined &&
            (leaf === 'textContent' || leaf === 'innerText' ||
              leaf === 'src' || leaf === 'href')
          ) {
            const WRITE_PAYLOAD_RE =
              /baseStats\s*\.\s*[\w$]+\s*=[^=]|\$state\s*=[^=]|useProfessionPill\s*\(/
            let payloadHit = false
            walkAll(n.right, (x) => {
              if (payloadHit) return true
              if (
                (ts.isStringLiteral(x) ||
                  ts.isNoSubstitutionTemplateLiteral(x)) &&
                WRITE_PAYLOAD_RE.test(x.text)
              ) {
                payloadHit = true
                return true
              }
              return
            })
            if (payloadHit) {
              flag(`spelled write payload to DOM sink: ${n.getText(sf)}`)
            }
          }
        }
        // `get pool() { return player.baseStats }` / a class method
        // returning the pool root - the accessor body spells the
        // write channel (the `this.<name>` alias is collected in pass 1).
        if (
          (ts.isGetAccessorDeclaration(n) || ts.isMethodDeclaration(n)) &&
          n.body !== undefined
        ) {
          let returnsPool = false
          walkAll(n.body, (x) => {
            if (returnsPool) return true
            if (
              ts.isReturnStatement(x) &&
              x.expression !== undefined &&
              poolishBindingSource(x.expression)
            ) {
              returnsPool = true
              return true
            }
            return
          })
          if (returnsPool) flag(`member returns pool: ${n.getText(sf)}`)
        }
        // `with (x) { ... }` - bare identifiers inside resolve through
        // x's members, which no static binding lane can prove. The
        // corpus is strict-mode anyway; any `with` is suspect.
        if (ts.isWithStatement(n)) {
          flag(`with(...) opaque member scope`)
        }
        // `new Function('code')` / `new F(...)` with F bound to Function,
        // `new Worker('data:...')` - runtime code generation loads
        // unscanned code; a Worker/Map carrying the pool is an
        // unverifiable channel.
        if (ts.isNewExpression(n)) {
          const ci = resolveCallee(n.expression, binds)
          const ctor =
            ci !== undefined ? (binds.rootAliases.get(ci.member) ?? ci.member) : undefined
          if (ci !== undefined && ci.root === '' && ctor === 'Function') {
            flag(`new Function() opaque code: ${n.getText(sf)}`)
          }
          if (
            ci !== undefined &&
            (ctor === 'Worker' || ctor === 'SharedWorker')
          ) {
            flag(`new ${ctor}() unscanned code: ${n.getText(sf)}`)
          }
          if (
            n.arguments !== undefined &&
            n.arguments.some(
              (a) =>
                isPoolRootAccess(a) ||
                hasPoolCarrier(a) ||
                laneWithShadow(a, hasPoolClosure),
            )
          ) {
            flag(`new(...) carries pool: ${n.getText(sf)}`)
          }
        }
        // class { pool = player.baseStats } - field store-site (the
        // member-position alias is collected in pass 1; the write
        // itself is the lane).
        if (
          ts.isPropertyDeclaration(n) &&
          n.initializer !== undefined &&
          isPoolRootAccess(n.initializer)
        ) {
          flag(n.getText(sf))
        }
        // for-of / for-in TARGET writes: `for (pool.x of arr)`. The
        // iterable being a pool read (`Object.entries(pool)`) is NOT
        // a lane - only a write-position target flags.
        if (
          (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
          !ts.isVariableDeclarationList(n.initializer) &&
          (writeTargetPoolish(n.initializer) ||
            destructureTargetPoolish(n.initializer))
        ) {
          flag(n.getText(sf))
        }
        if (ts.isCallExpression(n)) {
          // `tuneBag(player)` where tuneBag's body writes
          // `s.baseStats` - a same-file callee whose param slot is
          // used as a pool root; the owner flows in at the call site.
          const directCallee = unwrapExpr(n.expression)
          if (ts.isIdentifier(directCallee)) {
            const poolIdx = binds.fnPoolParams.get(directCallee.text)
            if (poolIdx !== undefined) {
              for (const i of poolIdx) {
                const arg = n.arguments[i]
                if (
                  arg !== undefined &&
                  (ownerSource(unwrapExpr(arg)) ||
                    isPoolRootAccess(unwrapExpr(arg)))
                ) {
                  flag(`owner fed to pool-param callee: ${n.getText(sf)}`)
                  break
                }
              }
            }
          }
          const info = resolveCallee(n.expression, binds)
          if (info !== undefined) {
            const calleeName = info.member
            const calleeRoot = info.root
            const calleeViaPatch = calleeName === '$patch'
            // thisArg/seed carriers on read-shaped members:
            // `[1].map(fn, pool)` / `arr.reduce(cb, pool)` / a
            // `_each`/`transform` helper - the pool rides the
            // this-context or accumulator argument into an opaque
            // callback.
            const CB_THISARG = new Set([
              'forEach', 'map', 'filter', 'some', 'every', 'find',
              'findIndex', 'findLast', 'findLastIndex', 'flatMap',
              'reduce', 'reduceRight', 'each', 'collect', 'transform',
              'mapValues', 'mapKeys', 'groupBy', 'tap',
            ])
            if (
              CB_THISARG.has(calleeName) &&
              n.arguments.slice(1).some(
                (a) => isPoolishArg(a) || hasPoolCarrier(a) || pool(a),
              )
            ) {
              flag(`pool carried via thisArg/seed: ${n.getText(sf)}`)
            }
            // eval / Function('...') - opaque code can write anything;
            // `const F = Function` resolves through rootAliases.
            const resolvedCallee = binds.rootAliases.get(calleeName) ?? calleeName
            if (
              resolvedCallee === 'eval' ||
              resolvedCallee === 'Function'
            ) {
              flag(`opaque code: ${n.getText(sf)}`)
            }
            // `x.eval(...)`, `x.constructor(...)`, `ctor.constructor
            // ('code')(...)` - dynamic code through ANY member root.
            if (calleeName === 'eval' || calleeName === 'constructor') {
              flag(`opaque code member: ${n.getText(sf)}`)
            }
            // `o.e(code)` where `o.e` was bound to an opaque-code
            // global (`const o = {e: eval}`, `o.e = eval`) - a member
            // path the GLOBAL_NAMES callee scan cannot see (R16 F5).
            {
              const calleePath = accessPath(n.expression, binds)
              if (
                calleePath !== undefined &&
                binds.opaqueCodePaths.has(calleePath)
              ) {
                flag(`opaque code member: ${n.getText(sf)}`)
              }
            }
            // `eval.call(t, 'code')` / `eval.apply` / `eval.bind` -
            // an indirect call on an eval-shaped receiver. And
            // `Reflect.apply(fn, ...)`/`Reflect.construct` invoke an
            // opaque callee outright.
            if (
              INDIRECT_NAMES.has(calleeName) &&
              (ts.isPropertyAccessExpression(unwrapExpr(n.expression)) ||
                ts.isElementAccessExpression(unwrapExpr(n.expression)))
            ) {
              const recv = unwrapExpr(
                (
                  unwrapExpr(n.expression) as
                    | ts.PropertyAccessExpression
                    | ts.ElementAccessExpression
                ).expression,
              )
              const recvName = ts.isIdentifier(recv)
                ? (binds.rootAliases.get(recv.text) ?? recv.text)
                : undefined
              if (recvName === 'eval' || recvName === 'Function') {
                flag(`opaque code indirect: ${n.getText(sf)}`)
              } else if (
                ts.isPropertyAccessExpression(recv) ||
                ts.isElementAccessExpression(recv)
              ) {
                // `globalThis.eval.call(null, code)` - the opaque-code
                // member rooted on a global object (R16 F6).
                const rp = accessPath(recv, binds)
                const seg = rp !== undefined ? rp.split('.') : []
                const leaf = seg.length > 0 ? seg[seg.length - 1] : undefined
                const root = seg.length > 1 ? seg[0] : undefined
                if (
                  (leaf === 'eval' || leaf === 'Function') &&
                  root !== undefined &&
                  GLOBAL_ROOTS.has(root)
                ) {
                  flag(`opaque code indirect: ${n.getText(sf)}`)
                }
              }
            }
            if (
              calleeRoot === 'Reflect' &&
              (calleeName === 'apply' || calleeName === 'construct')
            ) {
              flag(`Reflect.${calleeName} opaque invocation: ${n.getText(sf)}`)
            }
            // DOM code-injection sinks: innerHTML/outerHTML writes and
            // insertAdjacentHTML/document.write calls spell arbitrary
            // markup - script-capable.
            const DOM_WRITE_CALLS = new Set([
              'insertAdjacentHTML',
              'write',
              'writeln',
              'execCommand',
            ])
            if (DOM_WRITE_CALLS.has(calleeName)) {
              flag(`DOM code-injection sink: ${n.getText(sf)}`)
            }
            // setTimeout('code')/setInterval('code') - a spelled string
            // arg is evaluated as code. An ALIAS bind (`const s =
            // setTimeout; s(code)`) is itself the suspicious shape and
            // flags on any arg; a global-rooted member
            // (`window.setTimeout(code)`) is common legit code and
            // keeps the literal-arg requirement - an opaque arg there
            // is ambiguous with a callback ref (R16 F6: bound -
            // function-vs-string undecidable).
            if (
              (resolvedCallee === 'setTimeout' ||
                resolvedCallee === 'setInterval') &&
              n.arguments[0] !== undefined &&
              (literalize(n.arguments[0], binds) !== undefined ||
                (calleeName !== resolvedCallee &&
                  (ts.isIdentifier(unwrapExpr(n.expression)) ||
                    GLOBAL_ROOTS.has(calleeRoot))))
            ) {
              flag(`string-eval scheduler: ${n.getText(sf)}`)
            }
            // Write-shaped members on ANY root: userland `P.set(t, k, v)`,
            // lodash-style merge/patch/setIn - a spelled key or a pool
            // arg makes the lane unverifiable.
            const WRITEISH_MEMBERS = new Set([
              'set', 'assign', 'assignIn', 'defaults', 'extend', 'merge',
              'patch', 'update', 'setProperty', 'setIn', 'put', 'assoc',
              'defineProperty', 'defineProperties', 'deleteProperty',
            ])
            const spelledPayload = (a: ts.Expression): boolean =>
              hasBaseStatsProp(a) || hasStateProp(a) || hasPayloadAlias(a)
            const suspiciousArg = (a: ts.Expression): boolean =>
              pool(a) ||
              isPoolishArg(a) ||
              hasBaseStatsToken(a) ||
              hasStateToken(a)
            // `assign({...fresh}, pool)` clones the pool onto a NEW
            // literal target - spelled tokens still flag, the bare
            // poolish arg does not.
            const assignFreshTarget =
              calleeName === 'assign' &&
              n.arguments[0] !== undefined &&
              ts.isObjectLiteralExpression(unwrapExpr(n.arguments[0]))
            const argIsSuspicious = (a: ts.Expression): boolean =>
              assignFreshTarget
                ? hasBaseStatsToken(a) || hasStateToken(a)
                : suspiciousArg(a)
            // Spelled `key` args ('baseStats'/'$state'/'$patch' tokens)
            // flag unconditionally; spelled PAYLOAD props and opaque
            // spreads require a poolish arg nearby (an object literal
            // naming baseStats on its own is just a shape, e.g. a
            // serializer's `{...cfg, baseStats: x}` merge into a local).
            if (
              WRITEISH_MEMBERS.has(calleeName) &&
              n.arguments.some(
                (a) =>
                  argIsSuspicious(a) ||
                  // `assign({...fresh}, pool)` is a clone - the spread
                  // on the literal target is not a write (R16 FP9).
                  (!assignFreshTarget &&
                    (spelledPayload(a) || hasSpread(a)) &&
                    n.arguments.some((b) => isPoolishArg(b))),
              )
            ) {
              flag(n.getText(sf))
            }
            const isStructuralCall =
              STRUCTURAL_WRITE_NAMES.has(calleeName) &&
              (calleeRoot === 'Object' ||
                calleeRoot === 'Reflect' ||
                calleeRoot === '')
            // Object.assign / Reflect.set|defineProperty|deleteProperty /
            // Object.defineProperty|defineProperties with pool, a
            // baseStats/$state token, or a poolish arg + spelled payload
            // prop / spread. A bare `{baseStats: x}` literal targeting a
            // non-pool object (e.g. `assign(cfg.mods, {baseStats: x})`)
            // is a shape, not a write lane - only spelled tokens and the
            // pool itself flag unconditionally.
            if (isStructuralCall) {
              if (
                n.arguments.some(
                  (a) =>
                    // `assign({...fresh}, ...)` is a clone - the bare
                    // pool arg and the spread on the literal target
                    // are not writes (R16 FP9); spelled tokens and
                    // payloads still flag.
                    ((!assignFreshTarget && pool(a)) ||
                    hasBaseStatsToken(a) ||
                    hasStateToken(a) ||
                    (!assignFreshTarget &&
                      (spelledPayload(a) || hasSpread(a)) &&
                      n.arguments.some((b) => isPoolishArg(b)))),
                )
              ) {
                flag(n.getText(sf))
              }
            }
            // The pool object handed to an opaque callee is an
            // unverifiable write funnel: `bump(player.baseStats)` can
            // write `pool.qi` inside `bump` with no spelled token here.
            // Also flagged: a pool-carrier arg (`[pool]`, `{ref: pool}`),
            // a closure touching the pool, a pool-carrying receiver
            // (`[pool].forEach(cb)`), and indirect calls (`fn.call(t,
            // pool)`). Read-shaped callees (Object.entries, isObject,
            // clone, calculateStats, Math.*, console.*, ...) are the
            // enumerated exceptions; for .call/.apply/.bind the invoked
            // member is resolved and read-checked the same way.
            {
              const READ_ROOTS = new Set(['Object', 'JSON', 'Math', 'Reflect', 'console', 'Promise'])
              const invoked = invokedInfo(n)
              const effectiveMember = invoked?.member ?? calleeName
              const effectiveRoot = invoked?.root ?? calleeRoot
              // A member whose name IS the read operation is
              // read-shaped on any root (`MAIN_STAT_KEYS.filter`,
              // `arr.map`, `m.has`) - the member name pins semantics.
              const readShaped =
                READ_MEMBERS.has(effectiveMember) ||
                ((READ_ROOTS.has(effectiveRoot) || READ_ROOTS.has(calleeRoot)) &&
                  READ_MEMBERS.has(effectiveMember))
              const readIdentifier =
                effectiveRoot === '' && READ_IDENTIFIERS.has(effectiveMember)
              // `Object.assign({...fresh}, pool)` clones the pool onto
              // a NEW literal target - a read, not a write lane.
              const freshClone =
                effectiveMember === 'assign' &&
                n.arguments[0] !== undefined &&
                ts.isObjectLiteralExpression(unwrapExpr(n.arguments[0]))
              const carried =
                n.arguments.some(
                  (a) =>
                    isPoolRootAccess(a) ||
                    hasPoolCarrier(a) ||
                    laneWithShadow(a, hasPoolClosure) ||
                    ownerFactoryCallResult(a),
                ) || hasPoolCarrier(n.expression)
              // A function arg that WRITES the pool flags even through
              // a read-shaped callee: `arr.map(function(){ pool.qi=9 })`
              // is a deferred write, not a read.
              const closureWrite = n.arguments.some((a) =>
                laneWithShadow(a, containsPoolWrite),
              )
              if (
                (!readShaped &&
                  !readIdentifier &&
                  !freshClone &&
                  carried) ||
                closureWrite
              ) {
                flag(`pool passed to opaque callee: ${n.getText(sf)}`)
              }
            }
            // Prefix/substring enumeration helpers: `k.startsWith('baseS')`,
            // `name.includes('$st')` - a spelled fragment feeding key
            // enumeration is suspect (>= 5 chars, shorter fragments are
            // too generic to distinguish).
            if (
              FRAGMENT_CALLS.has(calleeName) &&
              n.arguments.some((a) => fragmentOfPinned(literalize(a, binds)))
            ) {
              flag(`key-fragment arg: ${n.getText(sf)}`)
            }
            // Spelled path-key args: `f(player, 'baseStats.qi', 9)` /
            // `f(player, ['baseStats','qi'], 9)` - a lodash.set-style
            // write funnel. The spelled path alone is a shape (route
            // tables, config keys) - it flags only beside a poolish
            // arg (R16 F4).
            {
              const PATH_KEY_RE = /(^|\.|\[)baseStats(\.|\[|$)/
              const spelledPathArg = (a: ts.Expression): boolean => {
                const lit = literalize(a, binds)
                if (lit !== undefined && PATH_KEY_RE.test(lit)) {
                  return true
                }
                const au = unwrapExpr(a)
                if (ts.isArrayLiteralExpression(au)) {
                  return au.elements.some(
                    (el) =>
                      !ts.isOmittedExpression(el) &&
                      spellsToken(el, 'baseStats', binds),
                  )
                }
                return false
              }
              if (
                n.arguments.some(spelledPathArg) &&
                n.arguments.some(
                  (a) =>
                    ownerSource(a) ||
                    isPoolishArg(a) ||
                    pool(a),
                )
              ) {
                flag(`spelled path-key arg: ${n.getText(sf)}`)
              }
            }
            // Object.assign(<store-ish target>, payload) - indirect write
            if (calleeName === 'assign' && (calleeRoot === 'Object' || calleeRoot === '')) {
              const first = n.arguments[0]
              if (first !== undefined) {
                const unwrapped = unwrapExpr(first)
                if (
                  isStateSlot(unwrapped) ||
                  (ts.isPropertyAccessExpression(unwrapped) &&
                    ts.isIdentifier(unwrapped.expression) &&
                    /Store$/.test(unwrapped.expression.text))
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // store.$patch(literal|spread|indirect) in any spelling -
            // literal must be a plain object with no spread and no
            // baseStats prop; every other form is unprovable.
            if (calleeViaPatch) {
              const arg = n.arguments[0]
              if (arg !== undefined) {
                if (
                  !ts.isObjectLiteralExpression(arg) ||
                  hasBaseStatsProp(arg) ||
                  hasStateProp(arg) ||
                  hasPayloadAlias(arg) ||
                  hasSpread(arg)
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // fn.call/fn.apply where fn touches a structural write name
            // or $patch. A $patch receiver is as opaque as $patch
            // itself - flag every such form.
            if (calleeName === 'call' || calleeName === 'apply') {
              const callee0 = unwrapExpr(n.expression)
              const receiver =
                ts.isPropertyAccessExpression(callee0) ||
                ts.isElementAccessExpression(callee0)
                  ? callee0.expression
                  : callee0
              if (touchesPatch(receiver)) {
                flag(n.getText(sf))
              } else if (
                touchesStructuralName(receiver) &&
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsProp(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateProp(a) ||
                    hasStateToken(a) ||
                    hasPayloadAlias(a),
                )
              ) {
                flag(n.getText(sf))
              }
              // Nested indirection: `X.call.call(fn, thisArg, ...)` /
              // `X.call.apply(fn, ...)` / `X.bind.call(...)` - the
              // receiver is itself an indirect-call member, so
              // arguments[0] is the invoked function and the rest are
              // (thisArg, real args). A pool argument reaching an
              // opaque function is an unprovable write lane.
              const recv0 = unwrapExpr(receiver)
              const recvMember =
                ts.isPropertyAccessExpression(recv0)
                  ? recv0.name.text
                  : ts.isElementAccessExpression(recv0)
                    ? literalize(recv0.argumentExpression, binds)
                    : undefined
              if (recvMember !== undefined && INDIRECT_NAMES.has(recvMember)) {
                const fnArg = n.arguments[0]
                const rest = n.arguments.slice(1)
                if (
                  (fnArg !== undefined &&
                    (touchesPatch(fnArg) || touchesStructuralName(fnArg)) &&
                    rest.some(
                      (a) =>
                        pool(a) ||
                        hasBaseStatsProp(a) ||
                        hasBaseStatsToken(a) ||
                        hasStateProp(a) ||
                        hasStateToken(a) ||
                        hasPayloadAlias(a),
                    )) ||
                  rest.some((a) => pool(a))
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // Reflect.apply(fn, thisArg, argsArray) with fn touching a
            // structural name, a $patch member or a member alias.
            if (
              calleeName === 'apply' &&
              calleeRoot === 'Reflect' &&
              n.arguments[0] !== undefined &&
              (touchesStructuralName(n.arguments[0]) ||
                touchesPatch(n.arguments[0]) ||
                (ts.isIdentifier(n.arguments[0]) &&
                  binds.memberAliases.has(n.arguments[0].text)))
            ) {
              flag(n.getText(sf))
            }
            // `f.call(player)` / `f.apply(player, a)` / `f.bind(player)`
            // where f is a this-writer (pass 0): the owner arrives as
            // `this` and `this.baseStats = x` inside f writes the pool.
            if (
              (calleeName === 'call' ||
                calleeName === 'apply' ||
                calleeName === 'bind') &&
              calleeRoot !== undefined &&
              binds.thisWriters.has(calleeRoot) &&
              n.arguments[0] !== undefined &&
              (ownerSource(unwrapExpr(n.arguments[0])) ||
                isPoolRootAccess(unwrapExpr(n.arguments[0])) ||
                pool(n.arguments[0]))
            ) {
              flag(`this-carried pool write dispatch: ${n.getText(sf)}`)
            }
            // `player.m()` where `player.m = fn` bound a this-writer:
            // the member call's implicit `this` is the owner itself.
            const recvPath = accessPath(unwrapExpr(n.expression), binds)
            if (
              recvPath !== undefined &&
              (binds.thisWriterPaths.has(recvPath) ||
                binds.thisWriterPaths.has(
                  recvPath.replace(/\.(call|apply|bind)$/, ''),
                ))
            ) {
              flag(`this-carried pool write dispatch: ${n.getText(sf)}`)
            }
            // Object.assign(t, {nested: player}) - a grafted source
            // prop carrying the owner reaches t.nested.baseStats. Only
            // the graft is new here: assign's other lanes are covered
            // above and poolish-source flags keep their old shape.
            if (calleeName === 'assign' && (calleeRoot === 'Object' || calleeRoot === '')) {
              for (const src of n.arguments.slice(1)) {
                const s = unwrapExpr(src)
                if (ts.isObjectLiteralExpression(s)) {
                  const grafted = s.properties.some(
                    (p) =>
                      ts.isPropertyAssignment(p) &&
                      (ownerSource(unwrapExpr(p.initializer)) ||
                        isPoolRootAccess(unwrapExpr(p.initializer)) ||
                        pool(p.initializer)),
                  )
                  if (grafted) {
                    flag(`pool graft via assign literal: ${n.getText(sf)}`)
                    break
                  }
                }
              }
            }
            // Object.setPrototypeOf(t, pool) / Reflect.setPrototypeOf -
            // a grafted prototype chain makes pool members writable
            // through t.
            if (
              calleeName === 'setPrototypeOf' &&
              (calleeRoot === 'Object' ||
                calleeRoot === 'Reflect' ||
                calleeRoot === '') &&
              n.arguments[1] !== undefined &&
              (ownerSource(unwrapExpr(n.arguments[1])) ||
                isPoolRootAccess(unwrapExpr(n.arguments[1])) ||
                pool(n.arguments[1]) ||
                receiverPoolish(n.arguments[1], binds))
            ) {
              flag(`pool graft via setPrototypeOf: ${n.getText(sf)}`)
            }
          } else {
            // Unresolvable callee: `(0, fn)(pool)`, `(getFn())(pool)`,
            // `x[K](pool)` with opaque K - an IIFE-invoked opaque fn
            // receiving the pool is an unverifiable channel.
            if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
              const spec = n.arguments[0]
              const lit = spec !== undefined ? literalize(spec, binds) : undefined
              if (
                lit === undefined ||
                lit.startsWith('data:') ||
                lit.startsWith('blob:') ||
                isTestSpecifier(lit)
              ) {
                flag(`opaque import(): ${n.getText(sf)}`)
              }
            } else if (
              n.arguments.some(
                (a) =>
                  isPoolRootAccess(a) ||
                  hasPoolCarrier(a) ||
                  laneWithShadow(a, hasPoolClosure) ||
                  // `grant(usePlayerStore())` - the owner itself rides
                  // an arg into an opaque callee (R15 S6).
                  ownerFactoryCallResult(a) ||
                  // A spelled pool-shaped payload to an opaque callee
                  // (`store[k]({baseStats: {qi:9}})`) - the callee may
                  // resolve to $patch; the prop name is the target.
                  hasBaseStatsProp(a) ||
                  hasStateProp(a) ||
                  hasPayloadAlias(a),
              )
            ) {
              flag(`pool passed to unresolvable callee: ${n.getText(sf)}`)
            }
          }
        }
        // x.$state = <literal-with-baseStats | spread | opaque> in any
        // spelling - `x.$state=`, `x['$state']=`, `x[S]=`, `x['$'+'state']=`.
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          isStateSlot(n.left) &&
          (!ts.isObjectLiteralExpression(n.right) ||
            hasBaseStatsProp(n.right) ||
            hasStateProp(n.right) ||
            hasPayloadAlias(n.right) ||
            hasSpread(n.right))
        ) {
          flag(n.getText(sf))
        }
        // for-of/for-in loop-var shadowing at inspect time:
        // `const s = pool; for (const s of rows) { s.qi = 9 }` -
        // inside the body `s` is the row, not the file-level alias.
        // Pass 1 marked non-pool loop names `shadowed`; reapply that
        // scoping so only the row binding resolves inside the loop.
        if (
          (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
          ts.isVariableDeclarationList(n.initializer)
        ) {
          const shadowNames = new Set<string>()
          for (const d of n.initializer.declarations) {
            const tmp = new Set<string>()
            collectBindingNames(d.name, tmp)
            for (const nm of tmp) {
              if (binds.shadowed.has(nm)) shadowNames.add(nm)
            }
          }
          if (shadowNames.size > 0) {
            withShadow(shadowNames, () => {
              n.forEachChild((c) => inspect(c, inner))
            })
            return
          }
        }
        n.forEachChild((c) => inspect(c, inner))
      }

      ts.forEachChild(sf, (c) => inspect(c, false))
    }

    // Script blocks: pass 1 aliases + pass 2 scan. A pathological
    // AST depth (a generated 20k-member chain) is fail-closed: the
    // file is flagged instead of letting recursive passes overflow.
    const blocks = scriptText(rel, text)
    const parsed = blocks.map((block) => ({
      block,
      sf: ts.createSourceFile(
        block.jsx ? 'probe.tsx' : 'probe.ts',
        block.body,
        ts.ScriptTarget.ESNext,
        true,
        block.jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    }))
    for (const { sf } of parsed) {
      if (maxNodeDepth(sf) > MAX_NODE_DEPTH) {
        flag('pathological expression depth - unverifiable')
        break
      }
      // pass 0: HOISTED function facts - a decl below its call site
      // still feeds call-site resolution (R17: `mk()` used before
      // decl, `f.call(player)` on a decl-level this-writer).
      const fnFacts = (
        body: ts.ConciseBody | undefined,
      ): { thisWrites: boolean; returnsPool: boolean } => {
        const out = { thisWrites: false, returnsPool: false }
        if (body === undefined) return out
        walkAll(body, (x) => {
          if (out.thisWrites && out.returnsPool) return true
          // `this.baseStats.qi = 9` / `this.$state = ...` - a write
          // target rooted at `this`.
          if (
            (ts.isPropertyAccessExpression(x) ||
              ts.isElementAccessExpression(x)) &&
            x.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            const leaf = ts.isPropertyAccessExpression(x)
              ? x.name.text
              : literalize(x.argumentExpression, binds)
            if (leaf === 'baseStats' || leaf === '$state') {
              out.thisWrites = true
              return true
            }
          }
          if (
            ts.isReturnStatement(x) &&
            x.expression !== undefined &&
            (isPoolRootAccess(x.expression) || hasPoolCarrier(x.expression))
          ) {
            out.returnsPool = true
            return true
          }
          if (
            !ts.isBlock(body) &&
            (isPoolRootAccess(body) || hasPoolCarrier(body))
          ) {
            out.returnsPool = true
            return true
          }
          return
        })
        return out
      }
      walkAll(sf, (n) => {
        if (
          ts.isFunctionDeclaration(n) &&
          n.name !== undefined &&
          n.body !== undefined
        ) {
          const f = fnFacts(n.body)
          if (f.thisWrites) binds.thisWriters.add(n.name.text)
          if (f.returnsPool) binds.poolThunks.add(n.name.text)
          recordPoolParams(n.name.text, n)
        }
        if (
          ts.isVariableDeclaration(n) &&
          ts.isIdentifier(n.name) &&
          n.initializer !== undefined
        ) {
          const init = unwrapExpr(n.initializer)
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            const f = fnFacts(init.body)
            if (f.thisWrites) binds.thisWriters.add(n.name.text)
            if (f.returnsPool) binds.poolThunks.add(n.name.text)
            recordPoolParams(n.name.text, init)
          }
        }
        return
      })
      walkAll(sf, collect)
    }
    for (const { block } of parsed) scanBody(block.body, block.jsx)

    // .vue template lane: directive attributes, interpolations and
    // v-model share the script's collected aliases.
    if (rel.endsWith('.vue')) {
      // `v-pre` subtrees are never evaluated - blank them (keeping
      // newlines for offsets) so phantom expressions inside cannot
      // produce lanes.
      const maskedText = maskVPreRegions(text)
      const tplText = stripVueInert(maskedText)
      // Collect v-for loop-variable names BEFORE scanning any template
      // expression or directive: `v-for="row in poolRows"` binds `row`
      // only inside the template, and every child expression
      // (`@click`, `{{ }}`, `:attr`) must see that binding. A loop var
      // whose iterable CARRIES the pool binds the element itself:
      // `bs.<any>` writes it even without a spelled leaf.
      const vfRe = /\bv-for\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      let vfM: RegExpExecArray | null
      while ((vfM = vfRe.exec(tplText)) !== null) {
        const src = vfM[1] ?? vfM[2] ?? ''
        const parts = src.split(/\b(?:in|of)\b/)
        const namesSrc = parts[0] ?? ''
        const iterSrc = (parts[1] ?? '').trim()
        let poolIterable = false
        if (iterSrc !== '') {
          if (/^[A-Za-z_$][\w$]*$/.test(iterSrc)) {
            poolIterable =
              binds.poolContainers.has(iterSrc) ||
              binds.aliases.has(iterSrc)
          }
          if (!poolIterable) {
            const isf = ts.createSourceFile(
              'i.ts',
              `x = ${iterSrc};`,
              ts.ScriptTarget.ESNext,
              true,
            )
            let hit = false
            const iv = (q: ts.Node): void => {
              if (hit) return
              if (containsPoolAccess(q, binds)) {
                hit = true
                return
              }
              // `v-for="v in Object.values(player)"` / `v-for="v in
              // player"` - a poolish-named ident anywhere inside the
              // iterable expression feeds owner values into the loop
              // variable (R15 S12). Same name conservatism as the
              // receiver arm: an unbound `playerRows` counts too.
              if (
                ts.isIdentifier(q) &&
                !isDeclarationName(q) &&
                (poolishName(q.text) ||
                  binds.aliases.has(q.text) ||
                  binds.ownerAliases.has(q.text) ||
                  binds.enumElems.has(q.text) ||
                  binds.poolContainers.has(q.text))
              ) {
                hit = true
                return
              }
              ts.forEachChild(q, iv)
            }
            ts.forEachChild(isf, iv)
            poolIterable = hit
          }
        }
        // `v-for="{ bs } in carriers"` destructures an element's
        // props - strip braces and prop-key colons so each bound
        // name registers (prop keys like `bs` in `{bs: x}` may join
        // the set harmlessly: an unbound name flags nothing).
        for (const nm of namesSrc.replace(/[{()}]/g, ' ').split(/[\s,:]+/)) {
          if (/^[A-Za-z_$][\w$]*$/.test(nm)) {
            if (poolIterable) {
              binds.vForPoolNames.add(nm)
            } else {
              binds.vForNames.add(nm)
            }
          }
        }
      }
      for (const expr of templateExpressions(maskedText)) {
        scanBody(expr)
      }
      // v-model with a non-literal/unquoted member target is a write
      // lane even when the expression does not name the pool
      // (`v-model="rec[key]"`, `v-model=pool.defense`).
      const vmRe = /v-model(?::[\w.-]+)?(?:\.[\w.-]+)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      // `href="javascript:..."` (or any attr) is a code sink the
      // expression scan cannot see - the URL is a static literal.
      if (/javascript\s*:/i.test(tplText)) {
        flag('template attr contains a javascript: URL')
      }
      // `v-html="x"` - markup injection sink: a pool-carrying or
      // pinned-name expression behind it is a write/xss lane.
      const vhRe = /\bv-html\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      while ((vfM = vhRe.exec(tplText)) !== null) {
        const expr = vfM[1] ?? vfM[2] ?? ''
        if (expr === '') continue
        const sf = ts.createSourceFile('v.ts', `x = ${expr};`, ts.ScriptTarget.ESNext, true)
        let hit = false
        walkAll(sf, (n) => {
          if (hit) return true
          if (containsPoolAccess(n, binds)) {
            hit = true
            return true
          }
          return
        })
        if (hit) flag(`v-html="${expr}"`)
      }
      let m: RegExpExecArray | null
      while ((m = vmRe.exec(tplText)) !== null) {
        const v = m[1] ?? m[2] ?? m[3]
        if (v === undefined) continue
        const sf = ts.createSourceFile('p.ts', `x = ${v};`, ts.ScriptTarget.ESNext, true)
        let flagged = false
        walkAll(sf, (n) => {
          if (flagged) return true
          if (containsPoolAccess(n, binds)) {
            flagged = true
            return true
          }
          // A spelled pinned member on an unbound root is a write
          // lane (`v-model="row.baseStats.qi"` binds the field).
          if (
            ts.isPropertyAccessExpression(n) &&
            (n.name.text === 'baseStats' ||
              n.name.text === '$state' ||
              n.name.text === '$patch')
          ) {
            flagged = true
            return true
          }
          if (ts.isElementAccessExpression(n) && n.argumentExpression !== undefined) {
            if (
              spellsToken(n.argumentExpression, 'baseStats', binds) ||
              spellsToken(n.argumentExpression, '$state', binds)
            ) {
              flagged = true
              return true
            }
            if (
              !ts.isStringLiteral(n.argumentExpression) &&
              !ts.isNoSubstitutionTemplateLiteral(n.argumentExpression) &&
              receiverPoolish(n.expression, binds)
            ) {
              // `v-model="player[k]"` - opaque key on a poolish
              // receiver is a write lane; `rec[key]` on an unbound
              // root is a shape, not a lane (R14 FP2).
              flagged = true
              return true
            }
          }
          return
        })
        if (flagged) flag(`v-model="${v}"`)
      }
    }
  }

  return { violations, unclassified }
}

describe('baseStats write authority - only level-up + pills', () => {
  it(
    'no production file outside the two enumerated channels writes baseStats',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { unclassified } = collectOffenders()
      expect(
        unclassified,
        'New baseStats writer outside level-up/pills. The hidden predicate ' +
          'reads baseStats only - a third channel either silently funds it ' +
          '(economy lie) or bypasses getEffectiveMainStatCap. Route through ' +
          'an enumerated channel or extend the allowlist with its contract.',
      ).toEqual([])
    },
  )

  it(
    'allowlisted files stay the only writers (allowlist drift check)',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { violations } = collectOffenders()
      // Per-file pin, not a global count: each enumerated channel must
      // still exist AND still exercise its write - a deleted or gutted
      // authority file is drift even when the others remain.
      for (const allowed of ALLOWED) {
        const hits = violations.filter((v) => v.file === allowed.path)
        expect(
          existsSync(join(GAME_ROOT, allowed.path)) && hits.length > 0,
          `Allowlisted authority file ${allowed.path} lost its baseStats ` +
            'write or vanished - the channel moved; update the contract, ' +
            'do not leave a stale entry.',
        ).toBe(true)
      }
    },
  )
})
