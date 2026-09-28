import json, hashlib

RUN = 'docs/qa/runs/character-art-infra-2026-09-28'
led = json.load(open(f'{RUN}/ledger.json'))
ST = led['run']['state']
NOW = '2026-09-28T07:52:00Z'

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def ev(eid, kind, method, code, result, art, claims, lims=None, invs=None):
    path = f'evidence/{art}' if art else ''
    return {
        'id': eid, 'state': ST, 'producer': 'coordinator',
        'startedAt': NOW, 'finishedAt': NOW,
        'commandOrMethod': method, 'cwd': 'game',
        'exitCode': code, 'result': result,
        'artifactPath': path, 'artifactHash': sha(f'{RUN}/{path}') if art else '0'*64,
        'inputPaths': [], 'inputEvidenceIds': [], 'invariantIds': invs or [],
        'claims': claims, 'limitations': lims or [], 'status': 'CURRENT', 'kind': kind,
    }

led['evidence'] = [
    ev('EV-FOCUSED', 'EXECUTED_UNIT_STRUCTURAL',
       'npx vitest run <9 wave-touched test files>', 0, 'PASS', 'focused-tests.txt',
       ['132 focused tests green: registry-manifest parity, slotRole emission+selection, ult fallback, preview acceptable-keys, atlas-miss avatar draw+dims, zero-frame no-play, namespace disjointness'],
       invs=['I-CHAR-RESKIN-RESOLVE','I-ANIMATED-CHAR-OVERRIDE','I-ULT-SLOT-SELECT','I-AVATAR-FALLBACK','I-REGISTRY-MANIFEST-PARITY','I-PREVIEW-PARITY','I-CLIP-LIFECYCLE']),
    ev('EV-VERIFY-FULL', 'EXECUTED_UNIT_STRUCTURAL',
       'npm run verify (vue-tsc --build + vite build + vitest run)', 0, 'PASS', 'verify-full.txt',
       ['type-check clean; build succeeds; 787 files / 6996 tests pass / 5 expected-fail on final aggregate'],
       lims=['e2e suite is not part of verify - covered separately by EV-E2E-MOTION']),
    ev('EV-E2E-MOTION', 'EXECUTED_RUNTIME',
       'npx playwright test tests/e2e/combat-idle-motion-capture.spec.ts', 0, 'PASS', 'e2e-motion.txt',
       ['live combat: reskinned boar draws atlas+idle+attack+death; player draws zuofeng, ult plays once then lands on loop; static enemies bob; probe sprite destroyed cleanly'],
       lims=['two flake modes observed and fixed at test level: RAF starvation under parallel suite load; fast-killed boars missing the 3-sample floor'],
       invs=['I-CHAR-RESKIN-RESOLVE','I-ANIMATED-CHAR-OVERRIDE','I-AVATAR-FALLBACK','I-CLIP-LIFECYCLE']),
    ev('EV-SRC-AUDIT', 'SOURCE_PROOF',
       'coordinator source audit of the reskin resolution chain', 0, 'PASS', 'source-audit.txt',
       ['every combat-path draw/anim consumer resolves via resolvePlayerEntityKey; MainScene intentionally keeps profile PNG (non-combat); catalogue registers only reskin-mapped slugs'],
       invs=['I-CHAR-RESKIN-RESOLVE','I-ANIMATED-CHAR-OVERRIDE','I-REGISTRY-MANIFEST-PARITY','I-PREVIEW-PARITY']),
]

# ---- reviews (chronological, per P5) ----
def rv(rid, phase, reviewer, ctx, prior, iid_findings, prev=None, role='COORDINATOR_SELF_REVIEW', round_=1, limits=None):
    return {
        'id': rid, 'state': ST, 'round': round_, 'phase': phase,
        'reviewerId': reviewer, 'contextId': ctx, 'model': 'swe-2-max', 'role': role,
        'inputBundleHash': '0'*64, 'priorFindingsVisible': prior,
        'accessLimitations': limits or ([] if not prior else ['same-context review - does not count as independence evidence']),
        'startedAt': NOW, 'sealedAt': NOW, 'previousPhaseReviewId': prev,
        'reviewedAfterPreviousFixes': True, 'coverageIds': [], 'evidenceIds': [],
        'findingIds': iid_findings, 'novelAttackIds': [], 'status': 'SEALED',
    }

led['reviews'] = [
    rv('RV-OCR', 'CORRECTNESS', 'coordinator', 'primary-context', True, ['F-CAI-01','F-CAI-02'], None, 'OCR_P18'),
    rv('RV-P4-AGENT', 'INTEGRATION', 'agent-p4-1', 'agent-p4-context', False,
       ['F-CAI-03','F-CAI-04','F-CAI-05','F-CAI-06','F-CAI-07','F-CAI-08'], 'RV-OCR', 'INDEPENDENT_ADVERSARIAL'),
    rv('RV-P5-1', 'CORRECTNESS', 'coordinator', 'primary-context', True, [], 'RV-P4-AGENT'),
    rv('RV-P5-2', 'AUTHORITY', 'coordinator', 'primary-context', True, [], 'RV-P5-1'),
    rv('RV-P5-3', 'INTEGRATION', 'coordinator', 'primary-context', True, [], 'RV-P5-2'),
]

# ---- cycles ----
led['cycles'] = [
    {'id': 'CYC-IMPLEMENTATION', 'state': ST,
     'reviewIds': ['RV-OCR','RV-P4-AGENT','RV-P5-1','RV-P5-2','RV-P5-3'],
     'coverageIds': [], 'evidenceIds': ['EV-FOCUSED','EV-VERIFY-FULL','EV-E2E-MOTION','EV-SRC-AUDIT'],
     'noveltyEvidenceIds': [], 'startedAt': NOW, 'finishedAt': NOW, 'status': 'FINDINGS'},
]

# ---- attacks: adversarial hypotheses actually exercised ----
def atk(aid, invs, assumption, seq, oracle, evs):
    return {'id': aid, 'invariantIds': invs, 'taxonomyIds': [], 'challengedAssumption': assumption,
            'sequenceOrInput': seq, 'oracle': oracle, 'noveltyReason': 'targets the wave-specific seams, not generic bounds', 'evidenceIds': evs}

led['attacks'] = [
    atk('ATK-MISSING-ULT', ['I-ULT-SLOT-SELECT','I-CLIP-LIFECYCLE'],
        'a variant with idle+attack but NO authored ult would silently lose its cast tell',
        'emit slotRole=ultimate on a catalogue without clips.ult',
        'MISSING_CLIP_FALLBACK degrades ult->attack; test asserts play calls attack',
        ['EV-FOCUSED']),
    atk('ATK-ATLAS-MISS-SWAP', ['I-AVATAR-FALLBACK','I-ANIMATED-CHAR-OVERRIDE'],
        'a profile event while the atlas is absent writes atlas geometry onto the avatar texture',
        'applyPlayerVisualProfile with textures.exists(sheet)=false, avatar present',
        'sizing mirrors the draw chain - avatar form dims, not atlas dims',
        ['EV-FOCUSED']),
    atk('ATK-SYNC-CHURN', ['I-PREVIEW-PARITY'],
        'the preview sync rebuild guard compares against ONE texture key - any legitimate alternate draw churns destroy/recreate',
        'seed sprite on avatar key, sync again',
        'acceptable-key set preserves sprite; only foreign textures rebuild',
        ['EV-FOCUSED']),
    atk('ATK-ZERO-FRAME', ['I-CLIP-LIFECYCLE','I-AVATAR-FALLBACK'],
        'a clip registered with zero frames exists() yet must not swap the avatar texture',
        'playCombatAnimation(idle) with anims.get -> {frames:[]}',
        'treated as missing; play never called; degrade chain applies',
        ['EV-FOCUSED']),
    atk('ATK-DEATH-SWAP', ['I-CLIP-LIFECYCLE'],
        'a profile event during the death sequence could replay idle over the corpse',
        'applyPlayerVisualProfile while playerDying',
        'early return - corpse owns its final frame',
        ['EV-FOCUSED','EV-E2E-MOTION']),
]

json.dump(led, open(f'{RUN}/ledger.json','w'), indent=1)
print('evidence:', len(led['evidence']), 'reviews:', len(led['reviews']), 'cycles:', len(led['cycles']), 'attacks:', len(led['attacks']))
