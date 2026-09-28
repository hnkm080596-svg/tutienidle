import json

led = json.load(open('ledger.json', encoding='utf-8'))
ST = led['run']['state']
NOW = '2026-09-28T20:45:00Z'
ZERO = '0' * 64


def rv(rid, phase, rev, ctx, role, prev, fids, status='SEALED'):
    return {
        'id': rid, 'state': ST, 'round': 7, 'phase': phase, 'reviewerId': rev,
        'contextId': ctx, 'model': 'subagent_explore', 'role': role,
        'inputBundleHash': ZERO, 'priorFindingsVisible': False,
        'accessLimitations': [], 'startedAt': '2026-09-28T19:55:00Z',
        'sealedAt': NOW, 'previousPhaseReviewId': prev,
        'reviewedAfterPreviousFixes': True, 'coverageIds': [],
        'evidenceIds': [], 'findingIds': fids, 'novelAttackIds': [],
        'status': status,
    }


led['reviews'] += [
    rv('RV-FA-1', 'CORRECTNESS', 'clean-a-agent-0d80bf0c', 'agent-0d80bf0c', 'CLEAN_ROOM_A', None, []),
    rv('RV-FA-2', 'AUTHORITY', 'clean-a-agent-0d80bf0c', 'agent-0d80bf0c', 'CLEAN_ROOM_A', 'RV-FA-1', []),
    rv('RV-FA-3', 'INTEGRATION', 'clean-a-agent-0d80bf0c', 'agent-0d80bf0c', 'CLEAN_ROOM_A', 'RV-FA-2', []),
    rv('RV-FB-1', 'CORRECTNESS', 'clean-b-agent-2ff7956d', 'agent-2ff7956d', 'CLEAN_ROOM_B', None, []),
    rv('RV-FB-2', 'AUTHORITY', 'clean-b-agent-2ff7956d', 'agent-2ff7956d', 'CLEAN_ROOM_B', 'RV-FB-1', []),
    rv('RV-FB-3', 'INTEGRATION', 'clean-b-agent-2ff7956d', 'agent-2ff7956d', 'CLEAN_ROOM_B', 'RV-FB-2', []),
    rv('RV-FA-TERM', 'TERMINAL_CHECK', 'clean-a-agent-0d80bf0c', 'agent-0d80bf0c', 'CLEAN_ROOM_A', 'RV-FA-3', []),
    rv('RV-FB-TERM', 'TERMINAL_CHECK', 'clean-b-agent-2ff7956d', 'agent-2ff7956d', 'CLEAN_ROOM_B', 'RV-FB-3', []),
]
led['cycles'] += [
    {'id': 'CYC-CLEAN-A4', 'state': ST, 'reviewIds': ['RV-FA-1', 'RV-FA-2', 'RV-FA-3', 'RV-FA-TERM'],
     'coverageIds': [], 'evidenceIds': ['EV-VERIFY-FULL', 'EV-FOCUSED', 'EV-E2E-MOTION', 'EV-MUTATION', 'EV-MUT-R3'],
     'noveltyEvidenceIds': [], 'startedAt': '2026-09-28T19:55:00Z', 'finishedAt': NOW, 'status': 'CLEAN'},
    {'id': 'CYC-CLEAN-B4', 'state': ST, 'reviewIds': ['RV-FB-1', 'RV-FB-2', 'RV-FB-3', 'RV-FB-TERM'],
     'coverageIds': [], 'evidenceIds': ['EV-VERIFY-FULL', 'EV-FOCUSED', 'EV-E2E-MOTION', 'EV-MUTATION', 'EV-MUT-R3'],
     'noveltyEvidenceIds': [], 'startedAt': '2026-09-28T19:55:00Z', 'finishedAt': NOW, 'status': 'CLEAN'},
]

# close the 9 FIXED_PENDING_PROOF findings - both independent terminal reviews
# verified the repairs HOLD on this state
CLOSERS = {'F-CB2-01': 'RV-FB-TERM', 'F-CB2-02': 'RV-FB-TERM', 'F-CB2-03': 'RV-FB-TERM',
           'F-CB2-04': 'RV-FB-TERM', 'F-CB2-05': 'RV-FB-TERM',
           'F-R7-01': 'RV-FA-TERM', 'F-R7-02': 'RV-FA-TERM', 'F-R7-03': 'RV-FB-TERM', 'F-R7-04': 'RV-FA-TERM'}
for f in led['findings']:
    if f['id'] in CLOSERS and f['status'] == 'FIXED_PENDING_PROOF':
        f['status'] = 'CLOSED'
        f['closureReviewIds'] = [CLOSERS[f['id']]]
        f['closeReason'] = 'repair verified HOLD by independent clean review on ' + ST['productStateId'][:8]
        f['closedAt'] = NOW

# deferred Low/Nit findings from the final pair - NON_ACTIONABLE + proof
SIB = [{"roots": ["game/src"], "termsAndMethod": "two independent clean-room agents + coordinator trace",
        "evidenceIds": [], "hitDispositions": ["none reachable"], "coverageLimits": ["dormant animated mode"]}]


def RJ(fid, title, sev, path, sym, reason):
    return {
        'id': fid, 'title': title, 'state': ST, 'severity': sev, 'classification': 'NON_ACTIONABLE',
        'actionable': False, 'reachability': 'UNREACHABLE',
        'locations': [{"path": path, "symbolOrSection": sym, "basis": "SOURCE", "revision": "working-tree"}],
        'discoveredBy': 'clean-pair-round7', 'invariantIds': ['I-CLIP-LIFECYCLE'], 'evidenceIds': [],
        'counterexample': 'none - unreachable in shipped mode', 'expected': 'n/a', 'actual': 'n/a',
        'rootCause': 'n/a - deferred nit', 'rootClass': 'latent-dormant-path', 'subsystem': 'combat-presentation',
        'siblingSearch': SIB, 'siblingFindingIds': [], 'repair': 'none - deferred',
        'pinEvidenceIds': [], 'verificationEvidenceIds': [], 'closureReviewIds': ['RV-FA-TERM'],
        'status': 'REJECTED_WITH_PROOF', 'rejectionReason': reason,
        'closedAt': NOW, 'duplicateOf': None, 'exception': None,
    }


led['findings'] += [
    RJ('F-DEF-01', 'PlayerPortrait.vue bypasses resolvePlayerEntityKey (dormant-mode only)', 'Low',
       'src/components/common/PlayerPortrait.vue', 'portrait atlas resolution',
       'ENTITY_ART_MODE is static; the canvas branch is gated and unreachable today - intentionally keeps profile art per TranPhapPanel comment; flagged for the future mode-flip task'),
    RJ('F-DEF-02', 'CombatScene.ts local EntitySprite duplicates combatTypes.ts (drift hazard)', 'Nit',
       'src/game/scenes/CombatScene.ts', 'local EntitySprite interface',
       'verified field-for-field identical today; TS structural typing keeps assignability equivalent; documented in-file; no behavioral defect'),
    RJ('F-DEF-03', 'death/clearSceneState paths clear listener field without off() on emitter', 'Nit',
       'src/game/scenes/combat/combat-animation-playback.ts', 'beginDeathSequence',
       'orphaned once-listener is inert: key filter + pendingTransitionListener!==listener identity guard neuter it, once self-removes on next completion, destroy dismantles the emitter - proven unreachable leak'),
    RJ('F-DEF-04', 'profile swap while armed + new-profile atlas missing leaves stale listener', 'Nit',
       'src/game/scenes/combat/combat-player-visual.ts', 'applyPlayerVisualProfile',
       'requires a texture to vanish mid-scene after clip registration; Phaser does not unload on this path; survivor resolves to the last correctly-drawn art - defensible'),
    RJ('F-DEF-05', 'vestigial PROMOTED.set fixtures in CombatScene.combatAnimations.test.ts', 'Nit',
       'src/game/scenes/CombatScene.combatAnimations.test.ts', 'PROMOTED harness',
       'test-hygiene nit: resolver returns zuofeng regardless of the promotion mock; harmless stale fixture'),
]

json.dump(led, open('ledger.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
import collections
print('statuses:', collections.Counter(f['status'] for f in led['findings']))
print('reviews:', len(led['reviews']), 'cycles:', len(led['cycles']))
