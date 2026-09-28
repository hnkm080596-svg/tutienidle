import json

RUN = 'docs/qa/runs/character-art-infra-2026-09-28'
led = json.load(open(f'{RUN}/ledger.json'))
ST = led['run']['state']
NOW = '2026-09-28T12:25:00Z'

def finding(fid, title, sev, cls, repair, close, status='CLOSED', extra=None):
    f = {
        'id': fid, 'title': title, 'state': ST, 'severity': sev, 'classification': cls,
        'actionable': True, 'reachability': 'PRODUCTION',
        'locations': [], 'discoveredBy': 'agent-clean-r2-context',
        'invariantIds': [], 'evidenceIds': [],
        'counterexample': 'n/a - see evidenceIds', 'expected': 'n/a - see evidenceIds',
        'actual': 'n/a - see evidenceIds',
        'rootCause': '', 'rootClass': '', 'subsystem': 'combat-presentation',
        'siblingSearch': [{'roots': ['game/src', 'game/scripts'],
            'termsAndMethod': 'reviewer census of the defect class across the draw/play/pack chain',
            'evidenceIds': [], 'hitDispositions': ['siblings resolved in this batch or none found'],
            'coverageLimits': ['name-aliased consumers may evade literal search']}],
        'siblingFindingIds': [],
        'repair': repair, 'pinEvidenceIds': ['EV-FOCUSED'],
        'verificationEvidenceIds': ['EV-FOCUSED', 'EV-VERIFY-FULL'],
        'closureReviewIds': ['RV-R2-3'],
        'status': status, 'closeReason': close, 'closedAt': NOW,
        'duplicateOf': None, 'rejectionReason': None, 'exception': None,
    }
    f.update(extra or {})
    return f

findings = [
    finding('F-CAI-25',
        'Player draw branch had NO terminal fallback: after atlas-miss -> avatar swap, a double miss left drawKey pointing at the absent atlas sheet -> add.sprite drew Phaser __MISSING checkerboard at full character height. Enemy branch ends on host-fallback/Rectangle; player did not (independent confirmation of F-CAI-17 nit, upgraded)',
        'Medium', 'REAL_DEFECT',
        'terminal chain added: avatar miss -> profile combatTextureKey -> host fallbackSpriteTextureKey -> Rectangle (mirrors enemy branch); drawSourceSize/drawExtent rebound to whichever texture actually draws',
        'fixed; __MISSING can no longer be the final player visual',
        extra={'invariantIds': ['I-AVATAR-FALLBACK', 'I-PREVIEW-PARITY'],
               'rootCause': 'player branch asymmetric with enemy terminal chain',
               'rootClass': 'missing-terminal-fallback'}),
    finding('F-CAI-26',
        'monsterCatalogue/characterCatalogue emitted optional clips as present-but-undefined (attack: undefined / ult: undefined); Object.values(clips) consumers (registerClipCatalogue, CombatPreload, AssetBundleCatalog, preview preload) dereference undefined.sheetKey -> crash on any variant lacking attack art',
        'Medium', 'REAL_DEFECT',
        'optional clip keys now OMITTED entirely (conditional assignment); regression test pins no undefined entry in any animated catalogue',
        'fixed; undefined can no longer reach Object.values consumers',
        extra={'invariantIds': ['I-REGISTRY-MANIFEST-PARITY', 'I-ULT-SLOT-SELECT'],
               'rootCause': 'optional field emitted as undefined sentinel instead of omitted key',
               'rootClass': 'contract-shape-drift'}),
    finding('F-CAI-27',
        'pack-character-art emitted clip ranges from first/last source index without contiguity validation, and wrote sheet PNG/JSON files BEFORE the split-across-sheets guard - a gap in source indices registers frames naming un-emitted PNGs; a late throw left partial sheets on disk',
        'Low', 'REAL_DEFECT',
        'pre-write validation block: per-clip index contiguity (list[i].index === list[i-1].index + 1) + split-sheet check both run before any writeFileSync; the duplicate late check removed',
        'fixed; packer failures are atomic - no partial output',
        extra={'invariantIds': ['I-REGISTRY-MANIFEST-PARITY'],
               'rootCause': 'validation ordered after side-effectful writes',
               'rootClass': 'validation-ordering'}),
    finding('F-CAI-28',
        'A one-shot clip completing onto a missing/empty standby loop left the sprite frozen on the last attack frame - no fallback from the loop class existed (only MISSING_CLIP_FALLBACK.ult -> attack)',
        'Low', 'REAL_DEFECT',
        'MISSING_CLIP_FALLBACK extended: standby -> idle, idle -> standby; chain resolution rewritten iteratively with a visited-set so the idle<->standby cross-reference terminates when BOTH loops are unplayable; two regression tests (degrade + double-miss termination)',
        'fixed; a missing loop degrades instead of freezing',
        extra={'invariantIds': ['I-CLIP-LIFECYCLE'],
               'rootCause': 'loop clips had no degradation path (only transitions did)',
               'rootClass': 'degradation-gap'}),
    finding('F-CAI-29',
        'MainScene and TribulationScene contain latent zero-frame .play() paths - dormant while player/entities render in static mode, but the same crash class as F-CAI-12/16/19 if animated mode expands to those scenes',
        'Low', 'LATENT_RISK',
        'deferred: unreachable under current static-mode wiring; the clip-lifecycle invariant now pins the empty-anim contract in combat + preview. Guard must land BEFORE any scene is switched to animated mode',
        'rejected for this wave - no reachable path exists today; tracked for the animated-mode expansion',
        status='REJECTED_WITH_PROOF',
        extra={'rootCause': 'out-of-scope scenes never got the empty-anim guard',
               'rootClass': 'guard-drift-between-paths',
               'rejectionReason': 'latent/unreachable: MainScene and TribulationScene run static mode; no code path can produce a zero-frame play() there today. Recorded so the animated-mode expansion cannot miss the class.'}),
]

# Clean-R2 reviews: agent ran CORRECTNESS -> AUTHORITY -> INTEGRATION blind on
# the pre-fix state. State field binds the CURRENT snapshot per run convention
# (the reviews' findings were repaired on it).
def rv(rid, phase, prev, fids):
    return {
        'kind': 'review', 'id': rid, 'state': ST, 'round': 4, 'phase': phase,
        'reviewerId': 'clean-r2-agent', 'contextId': 'agent-clean-r2-context',
        'model': 'subagent_explore', 'role': 'CLEAN_ROOM_R1',
        'inputBundleHash': '0' * 64, 'priorFindingsVisible': False,
        'accessLimitations': [],
        'startedAt': '2026-09-28T11:40:00Z', 'sealedAt': '2026-09-28T12:10:00Z',
        'previousPhaseReviewId': prev, 'reviewedAfterPreviousFixes': True,
        'coverageIds': [], 'evidenceIds': [], 'findingIds': fids,
        'novelAttackIds': [], 'status': 'SEALED',
    }

reviews = [
    rv('RV-R2-1', 'CORRECTNESS', 'RV-R1-3', ['F-CAI-25', 'F-CAI-26']),
    rv('RV-R2-2', 'AUTHORITY', 'RV-R2-1', []),
    rv('RV-R2-3', 'INTEGRATION', 'RV-R2-2', ['F-CAI-27', 'F-CAI-28', 'F-CAI-29']),
]

cycle = {
    'kind': 'cycle', 'id': 'CYC-CLEAN-R2', 'state': ST,
    'reviewIds': ['RV-R2-1', 'RV-R2-2', 'RV-R2-3'],
    'coverageIds': [], 'evidenceIds': [],
    'noveltyEvidenceIds': [],
    'startedAt': '2026-09-28T11:40:00Z', 'finishedAt': '2026-09-28T12:10:00Z',
    'status': 'FINDINGS',
}

led['findings'].extend(findings)
led['reviews'].extend(reviews)
led['cycles'].append(cycle)

json.dump(led, open(f'{RUN}/ledger.json', 'w'), indent=1)
print('findings:', len(led['findings']), 'reviews:', len(led['reviews']), 'cycles:', len(led['cycles']))
