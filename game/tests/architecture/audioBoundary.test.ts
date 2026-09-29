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
  scriptlessTemplateText,
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
  /\bimport\s*\.\s*meta\s*(?:(?:\?\s*)?(?:\.|!)\s*(?:glob|resolve)\s*!?\s*(?:\?\s*\.\s*)?|\[\s*['"`](?:glob|resolve)['"`]\s*\]\s*(?:\?\s*\.\s*)?)\(\s*['"`]([^'"`]+)['"`]/g
// The same lanes with a computed specifier (`import.meta.glob(dir)`)
// carry no literal to screen - flag the call shape itself. A computed
// MEMBER (`import.meta[k](dir)`) is likewise unverifiable: the
// `[(?!['"`])` alternative covers bracket members whose content is not
// a quoted `glob`/`resolve` lane name.
const NONLITERAL_META_RE =
  /\bimport\s*\.\s*meta\s*(?:(?:\?\s*)?(?:\.|!)\s*(?:glob|resolve)\s*!?\s*(?:\?\s*\.\s*)?|\[\s*['"`](?:glob|resolve)['"`]\s*\]\s*(?:\?\s*\.\s*)?|\[\s*(?!['"`])[^\]]*\]\s*(?:\?\s*\.\s*)?)\(\s*(?!['"`])[^)]*\)/g
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

// .vue template markup is real code territory too: `@click="import(
// 'tone')"` compiles into a function body, so the dynamic/concat call
// tripwires must sweep it. uncommented() sees only the <script>, so the
// markup text (script pairs and HTML comments removed) is scanned
// separately - attribute EXPRESSIONS are scanned wholesale (literal
// attr text with a cue-ish string flags nothing here since only call
// shapes are checked).
function templateTextOf(text: string): string {
  // The shared helper owns the script-span + comment-range blanking - an
  // unclosed/dead `<script>` or an `<!--` inside a quoted attribute must
  // not desync a local copy of the same masking logic.
  return scriptlessTemplateText(text)
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
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:\?\s*)?(?:\.|!)?\s*\[\s*([^\]]*)\]/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const segs = [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) =>
              (sm[1] ?? sm[2] ?? sm[3]!)
                .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
                .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
                .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
          )
          if (segs.length === 0) continue
          if (/^(?:glob|resolve)$/.test(segs.join(''))) {
            offenders.push(`${file.fromSrc} -> import.meta bracket ${m[0].slice(0, 60)}`)
          }
        }
        // `import.meta[K]` - the quoted-seg arm above skips bare
        // identifiers, so resolve the key through an in-file const
        // literal the way the shake arm's identLit does.
        const metaIdentLit = new Map<string, string>()
        const metaDeclKind = new Map<string, string>()
        for (const m of clean.matchAll(
          /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g,
        )) {
          const lit = m[3] ?? m[4] ?? m[5]!
          if (lit === 'glob' || lit === 'resolve') metaIdentLit.set(m[2]!, lit)
          metaDeclKind.set(m[2]!, m[1]!)
        }
        // A rebound non-const name's literal is stale evidence (`let K =
        // 'glob'; K = 'x'` then `import.meta[K]` is not a lane).
        for (const [name, kind] of metaDeclKind) {
          if (kind === 'const') continue
          const reAssign = new RegExp(
            `\\b${name}\\s*(?:=(?!=)|\\+\\+|--|<<=|>>>=|>>=|\\+=|-=|\\*=|/=|%=|&=|\\|=|\\^=|\\?\\?=|&&=|\\|\\|=)`,
            'g',
          )
          if ([...clean.matchAll(reAssign)].length > 1) metaIdentLit.delete(name)
        }
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:\?\s*)?(?:\.|!)?\s*\[\s*([A-Za-z_$][\w$]*)\s*\]/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          if (metaIdentLit.has(m[1]!)) {
            offenders.push(`${file.fromSrc} -> import.meta ident-key ${m[0].slice(0, 60)}`)
          } else {
            // `import.meta[k]` on a key this scan cannot resolve is an
            // unverifiable lane - flag the shape instead of assuming it
            // is benign.
            offenders.push(`${file.fromSrc} -> import.meta unresolved-key ${m[0].slice(0, 60)}`)
          }
        }
        // `const {glob|resolve} = import.meta` extracts the lane into a
        // local name - flag the destructure itself (every later use of
        // the name is the same bundling channel).
        for (const m of clean.matchAll(
          /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*import\s*\.\s*meta\b/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          if (/\b(?:glob|resolve)\b/.test(m[1]!)) {
            offenders.push(`${file.fromSrc} -> import.meta destructure ${m[0].slice(0, 60)}`)
          }
        }
        // `const ns = import.meta` mints a receiver alias - flag every
        // `ns.glob`/`ns.resolve` member on it.
        for (const m of clean.matchAll(
          /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*import\s*\.\s*meta\b/g,
        )) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const reMember = new RegExp(
            // `?.`/`!.`/bracket members on the alias reach the same lane:
            // `ns?.glob`, `ns!.resolve`, `ns['glob']`, `ns?.['resolve']`.
            `\\b${m[1]!}\\s*(?:[?!]?\\s*\\.\\s*(?:glob|resolve)\\b|[?!]?\\s*\\.?\\s*\\[\\s*(?:'glob'|"glob"|\\x60glob\\x60|'resolve'|"resolve"|\\x60resolve\\x60)\\s*\\])`,
            'g',
          )
          for (const mm of clean.matchAll(reMember)) {
            if (inLit(mm.index ?? 0)) continue
            offenders.push(`${file.fromSrc} -> import.meta alias ${mm[0].slice(0, 60)}`)
          }
        }
        // `const g = import.meta.glob` hands the bundling lane around as
        // a VALUE - no `(` means nothing to screen, so flag the shape.
        // `typeof import.meta.glob` is a type query, not a lane use.
        for (const m of clean.matchAll(
          /\bimport\s*\.\s*meta\s*(?:\?\s*)?(?:\.|!)\s*(?:glob|resolve)\b(?!\s*\()/g,
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
          !(file.fromSrc.endsWith('.vue') && TRIGGER.test(templateTextOf(file.text)))
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
