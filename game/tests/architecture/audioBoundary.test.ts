/**
 * Audio seam guards (sound-system W9) - the sound system's load-bearing
 * ownership rules, pinned as code:
 *
 *   1. Core never imports audio. `src/core/**` outside `src/core/audio/`
 *      must not import AudioManager/AudioCueManifest or `tone`: core emits
 *      presentation-observation events only; bindings live in
 *      `src/presentation/audio/`.
 *   2. AudioCueManifest stays data-only. The manifest is the asset-drop
 *      contract - a Tone/Vue/Phaser import would drag synthesis or the UI
 *      stack into a file that must stay loadable by anything.
 *   3. No .vue file imports `tone` directly. Components reach audio through
 *      AudioManager / the audio store; synthesis primitives are an
 *      AudioManager-internal detail.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import {
  templateExprText,
  uncommented,
  literalRanges,
  usesJsxBlocks,
} from './helpers/commentStrip'

const SRC_DIR = join(process.cwd(), 'src')

const IMPORT_RE = /(?:import|export)\b\s*(?:type\b\s*)?(?:[\w*{}\s,]*?\s*from\s*)?['"]([^'"]+)['"]/g
// Dynamic/lazy import lanes - `await import('tone')` and `require('tone')`
// bypass the static regex, and a lazy audio stack is the realistic smuggle.
// Comment spans between `(` and the specifier, and backtick specifiers,
// must not slip past the literal-quote extractor either.
const DYNAMIC_IMPORT_RE =
  /(?:^|[^\w.])(?:import|require)\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*['"`]([^'"`]+)['"`]/g
// A dynamic specifier that is NOT a plain literal (`import('to' + 'ne')`,
// `import(spec)`) can spell any module at runtime - flag the call shape
// itself so the literal extractor cannot be bypassed.
// Word/`.` prefix excluded so `skills.require(id)` and `a.import(` are not
// module calls.
const NONLITERAL_IMPORT_RE = /(?:^|[^\w.])(?:import|require)\s*\(\s*(?!['"`])[^)]*\)/g
// `import.meta.glob('...')` / `import.meta.resolve('...')` are bundling
// lanes with no `import(`/`require(` token - screen their specifiers too.
// Bracket member access (`import.meta['glob'](x)`) carries the same
// bundling lanes - dot and bracket spellings both count.
const IMPORT_META_SPEC_RE =
  /\bimport\s*\.\s*meta\s*(?:(?:[?!]\s*)?(?:\.|!)\s*(?:glob|resolve)\s*!?\s*(?:\?\s*\.\s*)?|\[\s*['"`](?:glob|resolve)['"`]\s*\]\s*(?:\?\s*\.\s*)?)\(\s*['"`]([^'"`]+)['"`]/g
// The same lanes with a computed specifier (`import.meta.glob(dir)`)
// carry no literal to screen - flag the call shape itself. A computed
// MEMBER (`import.meta[k](dir)`) is likewise unverifiable: the
// `[(?!['"`])` alternative covers bracket members whose content is not
// a quoted `glob`/`resolve` lane name.
const NONLITERAL_META_RE =
  /\bimport\s*\.\s*meta\s*(?:(?:[?!]\s*)?(?:\.|!)\s*(?:glob|resolve)\s*!?\s*(?:\?\s*\.\s*)?|\[\s*['"`](?:glob|resolve)['"`]\s*\]\s*(?:\?\s*\.\s*)?|\[\s*(?!['"`])(?![A-Za-z_$][\w$]*\s*\])[^\]]*\]\s*(?:\?\s*\.\s*)?)\(\s*(?!['"`])[^)]*\)/g
// `import('to' + 'ne')` is a literal-shaped call whose specifier is a
// concat - the extractor reads only 'to' and misses the spell. The same
// holds for every operator/wrapper that follows the literal (`||`, `??`,
// `-`, `.concat(...)`) - after the closing quote only `)` or `,` (a
// second options arg) is legitimate.
const COMPOSED_IMPORT_RE =
  /(?:^|[^\w.])(?:import|require)\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*['"`][^'"`]*['"`]\s*[^\s),]/g
// A specifier built inside a template literal (`import(`tone${''}`)`)
// lands in the literal extractor as text containing `${` - the banned
// checks can't resolve it, so the substring itself is the violation.
const SUSPECT_SPEC_RE = /\\|\$\{/
// `require(id: Type)`/`import(spec: Type)` declare the seam; the `: ` skip
// must apply ONLY to that parameter-annotation shape - a `:` inside the
// arg list (ternary, object literal, options arg) is real call text.
const DECL_ARG_RE = /^\s*[A-Za-z_$][\w$]*\s*:\s*[^:\s]/
// Parameter-list shape for the method-shorthand exemption: every
// comma-split part is a bare ident (`x`) or a typed ident (`x: T`). A `.`
// outside a type annotation (`import(a.b) {}`) is a member expression -
// never a parameter. Residual FP lane: a generic type containing a
// top-level comma (`x: Map<K,V>`) inside a `require()`/`import()`
// method shorthand is flagged.
function paramsShaped(argText: string): boolean {
  return (
    argText.trim() === '' ||
    argText
      .split(',')
      .every(
        (p) =>
          /^\s*[\w$]+\s*$/.test(p) ||
          /^\s*[\w$]+\??\s*:\s*[\s\S]+$/.test(p) ||
          // `x = default`, `...rest`, object/array destructure - all
          // legal parameter shapes, never call arguments. `=` must not
          // read `==`/`=>`/`>=` (`a == b` and `a => b` are call args);
          // a single-element `[x]`/`{x}` needs a real pattern mark
          // (`,`/`:`/`=`/`...`) or it is just an array/object arg.
          /^\s*[\w$]+(?:\s*:\s*[\s\S]+)?\s*=(?![=>])\s*[\s\S]+$/.test(p) ||
          /^\s*\.\.\.[\w$]+(?:\s*:\s*[\s\S]+)?\s*$/.test(p) ||
          /^\s*[[{](?=[\s\S]*(?:[,:]|\.\.\.|=(?![=>])))[\s\S]*[\]}](?:\s*:\s*[\s\S]+)?\s*$/.test(p),
      )
  )
}

function isNonliteralImportCall(m: RegExpMatchArray, clean: string): boolean {
  const argText = m[0].slice(m[0].indexOf('(') + 1, m[0].lastIndexOf(')'))
  if (DECL_ARG_RE.test(argText)) return false
  const after = clean.slice((m.index ?? 0) + m[0].length)
  // `:`/`{` after `)` is a declaration tail only when it sits on the
  // SAME line - `\s*` crossing newlines let `import(spec)\n{...}` (a
  // statement call plus a block) masquerade as a declaration.
  const tail = /^[ \t]*([:{])/.exec(after)
  if (!tail) return true
  const lineStart = clean.lastIndexOf('\n', m.index ?? 0) + 1
  const beforeOnLine = clean.slice(lineStart, m.index ?? 0)
  if (tail[1] === '{') {
    // `{` opens a declaration body when a declaration keyword run heads
    // the line (`export function require(x) {`) OR when the match is a
    // method shorthand - `require(x) {}` / `{ import(y){} }` carry no
    // keyword. Shorthand detection: the callee sits in declaration
    // position (line start, or directly after `{`/`;`/`,`) and the arg
    // text is parameter-shaped. Residual lane: `import(dyn) {}` as a
    // statement call plus block is genuinely ambiguous and exempted.
    if (
      /\b(?:function|export|declare|async|get|set|static|public|private|protected|override|abstract)\b[^()\n]*$/.test(
        beforeOnLine,
      )
    ) {
      return false
    }
    if (
      (/^\s*$/.test(beforeOnLine) || /[{;,]\s*$/.test(beforeOnLine)) &&
      paramsShaped(argText)
    ) {
      return false
    }
    return true
  }
  // `:` is a declaration tail only when the match is a declaration: it
  // must sit at line start (a `cond ? import(dyn) : x` ternary arm is a
  // real call even though `:` follows) and the args must look like a
  // parameter list (idents, commas, annotations).
  if (!/^\s*$/.test(beforeOnLine)) return true
  if (!paramsShaped(argText)) return true
  return false
}


function importSpecifiers(text: string, fileName: string): string[] {
  const clean = uncommented(text, fileName)
  const out: string[] = []
  for (const match of clean.matchAll(IMPORT_RE)) {
    out.push(match[1]!)
  }
  for (const match of clean.matchAll(DYNAMIC_IMPORT_RE)) {
    out.push(match[1]!)
  }
  for (const match of clean.matchAll(IMPORT_META_SPEC_RE)) {
    out.push(match[1]!)
  }
  return out
}

// A specifier belongs to the audio subsystem when its path walks through an
// `audio/` directory - matching on the directory (not on an 'Audio' filename
// prefix) keeps a future core/audio/util.ts inside the ban. The `($)` tail
// also catches a directory import (`@/core/audio` resolving to index.ts).
const AUDIO_SPEC_RE = /(^|\/)audio([/?#.]|$)/

describe('audio boundary', () => {
  it(
    'core outside core/audio never imports audio modules or tone',
    () => {
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (!file.fromSrc.startsWith('core/')) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        // Tests may spy on AudioManager to prove a domain event reaches
        // the real consumer - the ban is on production coupling.
        if (isTestFile(file.fromSrc)) continue
        for (const spec of importSpecifiers(file.text, file.fromSrc)) {
          // Specifiers containing escapes ('cor\u0065/audio', 't\x6fne')
          // or `${}` interpolation (`tone${''}`) resolve to banned paths
          // at evaluation time while evading the literal match - no
          // legitimate static specifier needs either.
          if (
            SUSPECT_SPEC_RE.test(spec) ||
            /^tone([/?#.]|$)/.test(spec) ||
            AUDIO_SPEC_RE.test(spec)
          ) {
            offenders.push(`${file.fromSrc} -> ${spec}`)
          }
        }
        // The nonliteral/concat tripwires apply to the core boundary too -
        // coverage must be owned here, not inherited from the tone guard.
        const cleanCore = uncommented(file.text, file.fromSrc)
        for (const m of cleanCore.matchAll(NONLITERAL_IMPORT_RE)) {
          if (isNonliteralImportCall(m, cleanCore)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
        }
        for (const m of cleanCore.matchAll(NONLITERAL_META_RE)) {
          offenders.push(`${file.fromSrc} -> ${m[0]}`)
        }
        for (const m of cleanCore.matchAll(COMPOSED_IMPORT_RE)) {
          offenders.push(`${file.fromSrc} -> ${m[0]}`)
        }
        if (file.fromSrc.endsWith('.vue')) {
          const tpl = templateExprText(file.text)
          for (const m of tpl.matchAll(NONLITERAL_IMPORT_RE)) {
            if (isNonliteralImportCall(m, tpl)) {
              offenders.push(`${file.fromSrc} -> ${m[0]}`)
            }
          }
          for (const m of tpl.matchAll(NONLITERAL_META_RE)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
          // `import.meta.glob('tone/x')` inside a template attribute
          // expression is build-time evaluated by Vite exactly like a
          // script call - the literal-spec collection must sweep tpl too.
          for (const m of tpl.matchAll(IMPORT_META_SPEC_RE)) {
            const spec = m[1]!
            if (
              SUSPECT_SPEC_RE.test(spec) ||
              /^tone([/?#.]|$)/.test(spec) ||
              AUDIO_SPEC_RE.test(spec)
            ) {
              offenders.push(`${file.fromSrc} -> ${spec}`)
            }
          }
          for (const m of tpl.matchAll(COMPOSED_IMPORT_RE)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it('AudioCueManifest is data-only (no tone/vue/phaser imports)', () => {
    const text = readTs(join(SRC_DIR, 'core/audio/AudioCueManifest.ts'))
    // `=== x || startsWith(x + '/')` - a `phaser/subpath` or
    // `tone/build/...` import must not slip past an equality check.
    for (const spec of importSpecifiers(text, 'core/audio/AudioCueManifest.ts')) {
      for (const banned of ['tone', 'vue', 'phaser']) {
        // Same tail grammar as the other arms - `tone?url`, `vue#x`,
        // `phaser.esm` resolve through Vite but break the data-only
        // contract for non-Vite consumers. `\\` rejects unicode-escape
        // specifiers like 'to\\u006ee' that spell a banned module.
        expect(SUSPECT_SPEC_RE.test(spec)).toBe(false)
        expect(new RegExp(`^${banned}([/?#.]|$)`).test(spec)).toBe(false)
      }
    }
  })

  it(
    'no file outside core/audio imports tone directly',
    () => {
      // .ts reaches synthesis just as well as .vue - the ban is on the
      // whole non-core/audio tree, not only SFCs.
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (isTestFile(file.fromSrc)) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        for (const spec of importSpecifiers(file.text, file.fromSrc)) {
          // `\\` in a specifier spells a banned module through a unicode
          // escape ('to\\u006ee') - the tail grammar alone misses it.
          if (spec.includes('\\') || /^tone([/?#.]|$)/.test(spec)) {
            offenders.push(`${file.fromSrc} -> ${spec}`)
          }
        }
        // Dynamic calls with a non-literal specifier cannot be screened
        // at all - flag the shape. Skip declarations: `require(id: T)`
        // annotates a method, and a decl tail `: Ret`/`{` follows `)`.
        const clean = uncommented(file.text, file.fromSrc)
        for (const m of clean.matchAll(NONLITERAL_IMPORT_RE)) {
          if (isNonliteralImportCall(m, clean)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
        }
        for (const m of clean.matchAll(NONLITERAL_META_RE)) {
          offenders.push(`${file.fromSrc} -> ${m[0]}`)
        }
        for (const m of clean.matchAll(COMPOSED_IMPORT_RE)) {
          offenders.push(`${file.fromSrc} -> ${m[0]}`)
        }
        // `re\u0071uire('tone')` lexes as the `require` identifier (plain
        // ident escapes are legal ES) but no `\brequire\b` regex sees it.
        // Flag escapes embedded in identifier text when the decoded ident
        // spells the import seams; literal interiors are data, not code.
        const lits = literalRanges(clean, file.fromSrc, usesJsxBlocks(file.text, file.fromSrc))
        const inLit = (i: number) => lits.some((r) => i >= r.pos && i < r.end)
        for (const m of clean.matchAll(/\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\})|\\x[0-9a-fA-F]{2}/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const before = /[\w$]*$/.exec(clean.slice(0, i))![0]
          const after = /^(?:[\w$]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}|\\x[0-9a-fA-F]{2})*/.exec(
            clean.slice(i + m[0].length),
          )![0]
          const decoded = `${before}${m[0]}${after}`
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
          // `import\x2emeta` decodes to `import.meta` - a dot escape
          // inside the decoded span splits the ident into members, so
          // compare the tail and let the decoded context supply the
          // `import.`/`meta.` gate.
          const parts = decoded.split('.')
          const tail = parts[parts.length - 1]!
          if (/^(?:require|import)$/.test(decoded) || (parts.length > 1 && /^(?:require|import)$/.test(tail))) {
            offenders.push(`${file.fromSrc} -> ident escape ${m[0]}`)
          } else if (
            /^(?:meta|glob|resolve)$/.test(tail) &&
            // `import.m\u0065ta` / `import.meta.gl\u006fb` - the member
            // escapes only count in `import.`/`meta.` context (a plain
            // `foo.meta` member is unrelated). A dot escape supplies the
            // context internally (`import\x2emeta` -> ctx `import`).
            (parts.length > 1
              ? /(?:^|\.)(?:import|meta)$/.test(parts.slice(0, -1).join('.'))
              : /(?:import|meta)\s*\.\s*$/.test(clean.slice(0, i - before.length)))
          ) {
            offenders.push(`${file.fromSrc} -> import.meta ident escape ${m[0]}`)
          }
        }
        // `import.meta['gl'+'ob']` spells the bundling lane through a
        // concat bracket the single-quote arm can't see - decode+join
        // the quoted segments like the shake/cue bracket arms.
        // `import.meta[K]` - the quoted-seg arm above skips bare
        // identifiers, so resolve the key through in-file literal decls
        // the way the shake arm's identLit does. Decl arms require the
        // literal to run to statement end - `const K = 'gl'
        // + 'ob'` binds the concat, not the 'gl' prefix, and stays
        // unresolved.
        // Literal evidence is POSITIONAL: a name resolves to the nearest
        // literal assign before the use site, not the file's last write
        // (`const K='x'` in one function must not shadow `const K='glob'`
        // used in another). A non-literal reassign (`K = expr`) kills
        // earlier evidence for uses after it; `let`/`var` decls behave
        // the same. Literal and ident-RHS assigns are decl entries
        // themselves (a `B = A` hop resolves A at B's own position).
        const metaLitDecls = new Map<string, Array<{ pos: number; lit: string; kind: string }>>()
        const metaKills = new Map<string, number[]>()
        const metaPushDecl = (name: string, pos: number, lit: string, kind: string) => {
          const arr = metaLitDecls.get(name) ?? []
          arr.push({ pos, lit, kind })
          metaLitDecls.set(name, arr)
        }
        for (const m of clean.matchAll(
          /\b(?:(const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=(?!=)\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)(?=\s*[;\n,)\]}]|$)/g,
        )) {
          metaPushDecl(m[2]!, m.index!, m[3] ?? m[4] ?? m[5]!, m[1] ?? 'let')
        }
        for (const km of clean.matchAll(
          /\b(?:const\s+|let\s+|var\s+)?([A-Za-z_$][\w$]*)\s*(=(?!=)|\+\+|--|<<=|>>>=|>>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\?\?=|&&=|\|\|=)/g,
        )) {
          if (km[2] === '=') {
            const rhs = clean.slice(km.index! + km[0].length)
            // Literal and ident-RHS assigns mint decl entries above -
            // they rebind evidence forward, not kill it.
            if (/^\s*['"`]/.test(rhs)) continue
            if (/^\s*[A-Za-z_$][\w$]*\s*(?=[;,\n)]|$)/.test(rhs)) continue
          }
          const arr = metaKills.get(km[1]!) ?? []
          arr.push(km.index!)
          metaKills.set(km[1]!, arr)
        }
        for (const rm of clean.matchAll(
          /\b(?:(const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=(?!=)\s*([A-Za-z_$][\w$]*)\s*(?=[;,\n)]|$)/g,
        )) {
          // Position-resolved single pass: the hop's value is whatever
          // the source name resolves to AT the hop's own position. Runs
          // after literals + kills so the source's evidence is settled.
          const src = metaResolveAt(rm[3]!, rm.index!)
          if (src !== undefined) metaPushDecl(rm[2]!, rm.index!, src, rm[1] ?? 'let')
        }
        function metaResolveAt(name: string, usePos: number): string | undefined {
          const decls = metaLitDecls.get(name)
          if (!decls) return undefined
          let best: { pos: number; lit: string; kind: string } | undefined
          for (const d of decls) {
            if (d.pos < usePos && (!best || d.pos > best.pos)) best = d
          }
          if (!best) return undefined
          if (best.kind !== 'const') {
            const kills = metaKills.get(name) ?? []
            if (kills.some((k) => k > best!.pos && k <= usePos)) return undefined
          }
          return best.lit
        }
        // Rebuilds a bracket key expression: quoted segs decode to their
        // content, bare idents resolve through metaResolveAt; `+`/spaces
        // flatten away. Returns { flat, unres } - `unres` marks an
        // unverifiable dynamic remainder (an unresolved ident or a
        // `${` interpolation inside a backtick segment).
        const rebuildBracketKey = (keyText: string, at: number): { flat: string; unres: boolean; segs: string[] } => {
          const segMatches = [...keyText.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
          const segs = segMatches.map(
            (sm) =>
              (sm[1] ?? sm[2] ?? sm[3]!)
                .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
                .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
                .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
          )
          let si = 0
          let unres = segMatches.some((sm) => sm[3] !== undefined && sm[3].includes('${'))
          const tmp = keyText.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, () => `\x01${si++}\x01`)
          const resolvedTmp = tmp.replace(/[A-Za-z_$][\w$]*/g, (id) => {
            const v = metaResolveAt(id, at)
            if (v === undefined) unres = true
            return v ?? '\0'
          })
          // Strip structural `+`/whitespace BEFORE restoring segment
          // contents - spaces inside a quoted segment ('g l') are
          // literal text, not concat glue.
          const flat = resolvedTmp
            .replace(/[\s+]/g, '')
            .replace(/\x01(\d+)\x01/g, (_p, n: string) => segs[+n]!)
          return { flat, unres, segs }
        }
        // `import.meta['gl'+'ob']` spells the bundling lane through a
        // concat bracket - rebuild the key; a lane join or an
        // unresolvable dynamic (`['g'+x]`, `['gl'+KX]`) flags alike.
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:(?:[?!]\s*\.?\s*|\.|!)\s*)?\[\s*([^\]]*)\]/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const { flat, unres, segs } = rebuildBracketKey(m[1]!, m.index!)
          if (segs.length === 0) continue
          if (unres || /^(?:glob|resolve)$/.test(flat)) {
            offenders.push(`${file.fromSrc} -> import.meta bracket ${m[0].slice(0, 60)}`)
          }
        }
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:(?:[?!]\s*\.?\s*|\.|!)\s*)?\[\s*([A-Za-z_$][\w$]*)\s*\]/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const resolved = metaResolveAt(m[1]!, i)
          if (resolved === 'glob' || resolved === 'resolve') {
            offenders.push(`${file.fromSrc} -> import.meta ident-key ${m[0].slice(0, 60)}`)
          } else if (resolved === undefined) {
            // `import.meta[k]` on a key this scan cannot resolve is an
            // unverifiable lane - flag the shape instead of assuming it
            // is benign. A resolved benign literal stays silent.
            offenders.push(`${file.fromSrc} -> import.meta unresolved-key ${m[0].slice(0, 60)}`)
          }
        }
        // `const ns = import.meta` mints a receiver alias - flag every
        // `ns.glob`/`ns.resolve` member on it. `ns = import.meta`
        // without a decl keyword, comma-seq wraps of ANY head
        // (`(0, import.meta)`, `(x, import.meta)`, `(0,(0,..))`), cast
        // wraps (`(import.meta as T)`), and `const ns2 = ns` rebinds
        // mint the same alias (bounded ident hops).
        const metaAliases = new Set<string>()
        for (const m of clean.matchAll(
          // Segment content inside the paren wraps is bounded - an
          // unbounded lazy scan over huge files walks O(n^2).
          /(?<![\w$.])(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:\(\s*(?:[^()\n]{0,400}?,\s*)?)*import\s*\.\s*meta\b(?:\s+as\s+[^()\n]{0,400})?\s*\)*/g,
        )) {
          if (!inLit(m.index ?? 0)) metaAliases.add(m[1]!)
        }
        for (let hop = 0; hop < 8; hop++) {
          let added = false
          for (const a of [...metaAliases]) {
            for (const rm of clean.matchAll(
              new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${a}\\s*(?=[;,\n)]|$)`, 'g'),
            )) {
              if (!inLit(rm.index ?? 0) && !metaAliases.has(rm[1]!)) {
                metaAliases.add(rm[1]!)
                added = true
              }
            }
          }
          if (!added) break
        }
        // `const {glob|resolve} = import.meta` extracts the lane into a
        // local name - flag the destructure itself (every later use of
        // the name is the same bundling channel). The source may be a
        // minted alias (`const {glob} = ns`), a for-of/in head
        // (`for ({resolve} of [import.meta])`), or a wrapped receiver
        // (`= (import.meta)`) - `[\s(\[]*` peels them all.
        for (const m of clean.matchAll(
          new RegExp(
            `(?<![\\w$.])(?:\\b(?:const|let|var)\\s+)?\\{([^}]*)\\}\\s*(?:=|of|in)\\s*[\\s(\\[]*\\s*(?:import\\s*\\.\\s*meta${metaAliases.size ? '|' + [...metaAliases].join('|') : ''})\\b`,
            'g',
          ),
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          if (/\b(?:glob|resolve)\b/.test(m[1]!)) {
            offenders.push(`${file.fromSrc} -> import.meta destructure ${m[0].slice(0, 60)}`)
          }
        }
        // `(0, import.meta).glob(...)` / `((import.meta)).resolve` /
        // `(import.meta as T).glob` - a wrapped receiver calling the
        // lane directly never mints an alias (no `name =` head), so the
        // member arms need their own wrapped-receiver spelling. The
        // regex form of this arm backtracks catastrophically on large
        // files (nested lazy segments inside `(?:\(...)*`), so the wrap
        // is detected positionally: each `import.meta` checks its
        // enclosing `(` opener (non-ident preceding char = a wrap paren,
        // ident = call argument like `f(import.meta)`) and its forward
        // tail for a `glob`/`resolve` member.
        for (const m of clean.matchAll(/\bimport\s*\.\s*meta\b/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const fwd = /^\s*(?:as\s+[A-Za-z_$][\w$<>]*)?\s*\)*\s*[?!]?\s*\.\s*(?:glob|resolve)\b/.exec(
            clean.slice(i + m[0].length, i + m[0].length + 200),
          )
          if (!fwd) continue
          let k = i - 1
          let depth = 0
          let wrapped = false
          while (k >= 0 && i - k < 400) {
            const c = clean[k]!
            if (c === ')') { depth++; k--; continue }
            if (c === '(') {
              if (depth > 0) { depth--; k--; continue }
              let p = k - 1
              while (p >= 0 && /\s/.test(clean[p]!)) p--
              wrapped = p < 0 || !/[\w$]/.test(clean[p]!)
              break
            }
            if (c === ',' || c === '+' || /\s/.test(c)) { k--; continue }
            const id = /[\w$]+$/.exec(clean.slice(Math.max(0, k - 200), k + 1))
            if (id) { k -= id[0].length; continue }
            const lit = /(?:'[^']*'|"[^"]*"|`[^`]*`)$/.exec(clean.slice(Math.max(0, k - 300), k + 1))
            if (lit) { k -= lit[0].length; continue }
            break
          }
          if (wrapped) {
            offenders.push(`${file.fromSrc} -> import.meta wrapped-member ${m[0].slice(0, 60)}`)
          }
        }
        for (const alias of metaAliases) {
          const reMember = new RegExp(
            // `?.`/`!.`/bracket members on the alias reach the same lane:
            // `ns?.glob`, `ns!.resolve`, `ns['glob']`, `ns?.['resolve']`.
            `\\b${alias}\\s*(?:[?!]?\\s*\\.\\s*(?:glob|resolve)\\b|[?!]?\\s*\\.?\\s*\\[\\s*(?:'glob'|"glob"|\\x60glob\\x60|'resolve'|"resolve"|\\x60resolve\\x60)\\s*\\])`,
            'g',
          )
          for (const mm of clean.matchAll(reMember)) {
            if (inLit(mm.index ?? 0)) continue
            offenders.push(`${file.fromSrc} -> import.meta alias ${mm[0].slice(0, 60)}`)
          }
          // Concat/ident keys on the alias (`ns['glo'+'b']`, `ns[K3]`,
          // `ns['g'+x]`) rebuild through the same key-expression arm as
          // the direct `import.meta[...]` scan.
          const reAliasBracket = new RegExp(
            `\\b${alias}\\s*(?:[?!]\\s*\\.?\\s*|\\.\\s*)?\\[\\s*([^\\]]*)\\]`,
            'g',
          )
          for (const bm of clean.matchAll(reAliasBracket)) {
            if (inLit(bm.index ?? 0)) continue
            const { flat, unres, segs } = rebuildBracketKey(bm[1]!, bm.index!)
            if (segs.length > 0) {
              // A single literal `'glob'` is already flagged by reMember
              // - here flag joined multi-segment spellings and mixed
              // literal+dynamic keys that stay unverifiable.
              if (unres || /^(?:glob|resolve)$/.test(flat)) {
                if (segs.length > 1 || unres || !/^(?:glob|resolve)$/.test(bm[1]!.trim().slice(1, -1))) {
                  offenders.push(`${file.fromSrc} -> import.meta alias bracket ${bm[0].slice(0, 60)}`)
                }
              }
              continue
            }
            const keyIdent = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(bm[1]!)?.[1]
            if (!keyIdent) continue
            const resolved = metaResolveAt(keyIdent, bm.index!)
            if (resolved === 'glob' || resolved === 'resolve') {
              offenders.push(`${file.fromSrc} -> import.meta alias ident-key ${bm[0].slice(0, 60)}`)
            } else if (resolved === undefined) {
              offenders.push(`${file.fromSrc} -> import.meta alias unresolved-key ${bm[0].slice(0, 60)}`)
            }
          }
        }
        // `const g = import.meta.glob` hands the bundling lane around as
        // a VALUE - no `(` means nothing to screen, so flag the shape.
        // `typeof import.meta.glob` is a type query, not a lane use.
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:[?!]\s*)?(?:\.|!)\s*(?:glob|resolve)\b(?!\s*\()/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          if (
            /\btypeof\s*[\w$]*(?:\s*\.\s*[\w$]+)*\s*$/.test(
              clean.slice(Math.max(0, i - 64), i),
            )
          )
            continue
          offenders.push(`${file.fromSrc} -> import.meta value-ref ${m[0].slice(0, 60)}`)
        }
        if (file.fromSrc.endsWith('.vue')) {
          const tpl = templateExprText(file.text)
          for (const m of tpl.matchAll(NONLITERAL_IMPORT_RE)) {
            if (isNonliteralImportCall(m, tpl)) {
              offenders.push(`${file.fromSrc} -> ${m[0]}`)
            }
          }
          for (const m of tpl.matchAll(NONLITERAL_META_RE)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
          for (const m of tpl.matchAll(COMPOSED_IMPORT_RE)) {
            offenders.push(`${file.fromSrc} -> ${m[0]}`)
          }
          for (const m of tpl.matchAll(DYNAMIC_IMPORT_RE)) {
            if (/^tone([/?#.]|$)/.test(m[1]!)) {
              offenders.push(`${file.fromSrc} -> ${m[1]}`)
            }
          }
          for (const m of tpl.matchAll(IMPORT_META_SPEC_RE)) {
            if (/^tone([/?#.]|$)/.test(m[1]!)) {
              offenders.push(`${file.fromSrc} -> ${m[1]}`)
            }
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'direct AudioManager consumers stay inside the documented pinia-free allowlist',
    () => {
      // Spec W7 routes audio through useAudioStore().cue. The only files
      // allowed to touch AudioManager directly are the audio internals, the
      // dom-audio bundle lane, the pinia-free primitives (GameButton and
      // Chip must mount without an active pinia - see InkWashPrimitives.test),
      // and App.vue as the composition root for the unlock-gesture listener
      // (onReady disarm must observe the manager, not the store).
      const ALLOWLIST = new Set([
        'presentation/assets/AssetBundleManager.ts',
        'components/common/GameButton.vue',
        'components/common/primitives/Chip.vue',
        'App.vue',
      ])
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (isTestFile(file.fromSrc)) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        // Exact-file exemption - a startsWith('stores/audio') anchor would
        // silently exempt a future sibling like stores/audioSneak.ts.
        if (file.fromSrc === 'stores/audio.ts') continue
        if (file.fromSrc.startsWith('presentation/audio/')) continue
        // Trigger on ANY AudioManager reach: a direct call (dotted,
        // optional-chained, or bracket member), a playCue (dotted or
        // bracketed), or importing the module at all. The specifier arm
        // tolerates `.ts`/query suffixes on the module path.
        const TRIGGER =
          /\bAudioManager\s*(?:\?\s*)?\.\s*getInstance\s*\(|\bAudioManager\s*\[\s*['"`]|\.\s*playCue\s*\(|\[\s*['"`](?:getInstance|playCue)['"`]\s*\]\s*\(|['"`][^'"`]*audio\/AudioManager[^'"`]*['"`]/
        // Bracket access requires a following `(` - `T['getInstance']`
        // indexed type access is not a call and must not flag.
        // .vue template markup is live code territory too - `uncommented`
        // returns script only, so `@click="AudioManager.getInstance()"`
        // would otherwise escape the reach check.
        if (
          !TRIGGER.test(uncommented(file.text, file.fromSrc)) &&
          !(file.fromSrc.endsWith('.vue') && TRIGGER.test(templateExprText(file.text)))
        ) {
          continue
        }
        if (!ALLOWLIST.has(file.fromSrc)) offenders.push(file.fromSrc)
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

})
