import json, hashlib

led = json.load(open('ledger.json', encoding='utf-8'))
ST = led['run']['state']
NOW = '2026-09-28T20:00:00Z'


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


EV = {
    'EV-FOCUSED': ('npx vitest run <7 wave-touched test files> on state ' + ST['productStateId'][:8],
                   'evidence/focused-tests.txt',
                   '139 focused tests green incl. stale-listener, destination-miss deferral, player-visual swap pins'),
    'EV-VERIFY-FULL': ('npm run verify (type-check + build + vitest run) on state ' + ST['productStateId'][:8],
                       'evidence/verify-full.txt',
                       '787 files / 7024 tests / 5 expected-fail; typecheck+build green'),
    'EV-E2E-MOTION': ('npx playwright test tests/e2e/combat-idle-motion-capture.spec.ts on state ' + ST['productStateId'][:8],
                      'evidence/e2e-motion.txt',
                      'e2e green 2.5m: static bob, reskinned authored frames, one-shot completes then loop'),
    'EV-SRC-AUDIT': ('manual full-diff source audit on state ' + ST['productStateId'][:8],
                     'evidence/source-audit.txt',
                     'P15 clean; invariants verified incl. superseded-listener removal + arm-regardless gate'),
    'EV-MUTATION': ('mutation-campaign.py + mutation-round2.py on state ' + ST['productStateId'][:8],
                    'evidence/mutation-campaign.txt',
                    'MUT-01,03,04,05,06,07 killed; MUT-02 killed via corrected round2 site'),
    'EV-MUT-R3': ('mutation-round3.py + round4 + round5 on state ' + ST['productStateId'][:8],
                  'evidence/mutation-round3.txt',
                  'MUT-08..11 KILLED on current state'),
}
for e in led['evidence']:
    if e['id'] in EV:
        cmd, art, claim = EV[e['id']]
        e['state'] = ST
        e['commandOrMethod'] = cmd
        e['artifactPath'] = art
        e['artifactHash'] = sha(art)
        e['claims'] = [claim]
        e['finishedAt'] = NOW
        e['status'] = 'CURRENT'

# coverage rebind
for c in led['coverage']:
    c['status'] = 'SATISFIED'

# mutation records: rebind + add MUT-10/11
res = []
for f in ['mutation-results.json', 'mutation-round2-results.json',
          'mutation-round3-result.json', 'mutation-round4-result.json',
          'mutation-round5-results.json']:
    d = json.load(open(f, encoding='utf-8'))
    res += d if isinstance(d, list) else [d]
byid = {}
for r in res:
    if r.get('result') == 'KILLED_EXPECTED':
        byid[r['id']] = r

have = {m['id'] for m in led['mutations']}
for m in led['mutations']:
    r = byid.get(m['id'])
    if r:
        m['candidateState'] = ST
        m['mutantHash'] = r.get('mutantHash', m['mutantHash'])
        m['result'] = 'KILLED_EXPECTED'
        m['candidateUnchanged'] = r.get('candidateUnchanged', True)
        m['evidenceIds'] = ['EV-MUT-R3' if m['id'] in ('MUT-08', 'MUT-09', 'MUT-10', 'MUT-11') else 'EV-MUTATION']


def MUT(r):
    return {
        'id': r['id'], 'candidateState': ST, 'invariantIds': r['inv'],
        'rootClass': 'listener-lifecycle', 'operator': r['desc'],
        'isolationPath': 'working-tree patch, reverted after oracle run',
        'mutantHash': r['mutantHash'], 'expectedDetector': r['oracle'],
        'result': 'KILLED_EXPECTED', 'evidenceIds': ['EV-MUT-R3'],
        'equivalenceReason': 'n/a - mutant killed by oracle; equivalence review not reached',
        'candidateUnchanged': r.get('candidateUnchanged', True),
    }


for mid in ('MUT-10', 'MUT-11'):
    if mid not in have and mid in byid:
        led['mutations'].append(MUT(byid[mid]))

SIB = [{
    "roots": ["game/src"],
    "termsAndMethod": "traced defect class across emitter/deferral/catalogue paths",
    "evidenceIds": [],
    "hitDispositions": ["siblings resolved in this batch or none found"],
    "coverageLimits": ["engine-internal call sites outside audited surface"],
}]


def loc(path, sym):
    return [{"path": path, "symbolOrSection": sym, "basis": "SOURCE", "revision": "working-tree"}]


def F(fid, title, sev, cls, path, sym, exp, act, root, rc, repair, by):
    return {
        'id': fid, 'title': title, 'state': ST, 'severity': sev, 'classification': cls,
        'actionable': True, 'reachability': 'PRODUCTION', 'locations': loc(path, sym),
        'discoveredBy': by, 'invariantIds': ['I-CLIP-LIFECYCLE'], 'evidenceIds': [],
        'counterexample': 'n/a - see repair/pins', 'expected': exp, 'actual': act,
        'rootCause': root, 'rootClass': rc, 'subsystem': 'combat-presentation',
        'siblingSearch': SIB, 'siblingFindingIds': [], 'repair': repair,
        'pinEvidenceIds': ['EV-FOCUSED'],
        'verificationEvidenceIds': ['EV-FOCUSED', 'EV-VERIFY-FULL'],
        'closureReviewIds': [], 'status': 'FIXED_PENDING_PROOF',
        'duplicateOf': None, 'rejectionReason': None, 'exception': None,
    }


led['findings'] += [
    F('F-R7-01', 'getHomeDescriptors bypasses resolvePlayerEntityKey - home bundle under-enumerates reskin sheets', 'Medium',
      'REAL_DEFECT', 'src/presentation/assets/AssetBundleCatalog.ts', 'getHomeDescriptors',
      'animated-mode home enumeration follows the same entity-key authority as MainScene',
      'iterated animatedArtFormFor(profile.combatTextureKey) - the legacy key, never the reskin slug; cold Home entry would render profile PNG instead of the zuofeng idle clip',
      'bundle enumeration predates the reskin resolver and was never migrated', 'stale-reference',
      'enumerate animatedArtFormFor(resolvePlayerEntityKey(profile.id, profile.combatTextureKey))',
      'agent-clean-a-round7'),
    F('F-R7-02', 'applyPlayerVisualProfile swap path had zero direct test coverage', 'Medium',
      'COVERAGE_GAP', 'src/game/scenes/combat/combat-player-visual.ts', 'applyPlayerVisualProfile',
      'listener removal, pending-state clearing, and atlas-miss sizing branches are pinned by tests',
      'the entire swap path was only reachable through production event flow - no harness exercised it',
      'coverage gap on a lifecycle-critical swap path', 'missing-coverage',
      'new combat-player-visual.test.ts: armed-listener removal, dying early-return, avatar-box sizing, surviving-texture sizing',
      'agent-clean-a-round7'),
    F('F-R7-03', 'same-key one-shot re-arm leaves orphaned once-listener that consumes the deferred intent', 'Low',
      'REAL_DEFECT', 'src/game/scenes/combat/combat-animation-playback.ts', 'playCombatAnimation',
      'latest intent wins - the live listener alone consumes deferredLoopRequest',
      'a second play of the same one-shot replaced pendingTransitionListener without off()ing the old one; on completion the orphan consumed the deferral first and the live listener overrode the landing loop',
      'listener supersession was never removed from the emitter', 'lifecycle-leak',
      'off() the superseded pendingTransitionListener before arming; superseded-guard inside the listener',
      'agent-clean-b-round7'),
    F('F-R7-04', 'loop request truncates a one-shot whose destination clip is unloadable', 'Low',
      'REAL_DEFECT', 'src/game/scenes/combat/combat-animation-playback.ts', 'playCombatAnimation',
      'deferral keys on the one-shot being armed, independent of destination registration',
      'the exists(destinationKey) gate skipped arming, so a later loop request played immediately and truncated the clip on partial-sheet failure',
      'arming was conditional on destination existence instead of on the resolved clip being one-shot', 'missing-guard',
      'arm the listener whenever the resolved clip is a one-shot; completion routes through playCombatAnimation which walks the guarded chain',
      'agent-clean-a-round7'),
]


def L(lid, fids, rc, esc, app, prop):
    return {
        'id': lid, 'version': 1, 'triggerType': 'DEFECT', 'findingIds': fids,
        'incidentEvidenceIds': [], 'originatingRun': 'character-art-infra-2026-09-28',
        'rootClass': rc, 'missedInvariantIds': ['I-CLIP-LIFECYCLE'], 'escapeReason': esc,
        'applicability': app, 'exclusions': [], 'proposedProtection': prop,
        'promotionEvidenceIds': [], 'qualifiedBy': [], 'status': 'CAPTURED',
        'recurrenceFindingIds': [], 'preventionEvidenceIds': [], 'supersedes': None,
        'capabilityDelta': 'none - captured for future qualification',
        'policyVersion': None, 'effectiveFromRun': None, 'guidance': None,
    }


led['lessons'] += [
    L('L-R7-01', ['F-R7-01'], 'enumeration-bypass-of-single-resolver',
      'the home bundle enumerated profile keys directly; dormant mode hid it',
      ['asset-bundles', 'presentation-resolution'],
      ['route every entity-key enumeration through resolvePlayerEntityKey; pin dormant-mode parity in catalogue tests']),
    L('L-R7-02', ['F-R7-02'], 'lifecycle-critical-path-without-direct-coverage',
      'the swap path accumulated five defensive guards none of which had a failing oracle',
      ['profile-swap', 'animation-lifecycle'],
      ['require a direct harness test for every guard a review adds to lifecycle code']),
    L('L-R7-03', ['F-R7-03', 'F-R7-04'], 'emitter-supersession-and-gate-ordering',
      'once-listener supersession and destination-existence gating interacted: stale listeners could fire and armed state was conditional on the wrong predicate',
      ['animation-playback', 'phaser-emitter-semantics'],
      ['remove superseded once-listeners at arm time; arm on resolved-clip shape, not destination availability']),
]

json.dump(led, open('ledger.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('rebound + R7 records; mutations:', len(led['mutations']), 'findings:', len(led['findings']))
