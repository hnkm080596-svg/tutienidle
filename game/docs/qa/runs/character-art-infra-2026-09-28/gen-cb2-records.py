import json

p = 'ledger.json'
led = json.load(open(p, encoding='utf-8'))
ST = led['run']['state']
OLD = json.loads(
    '{"productStateId":"e0cf96b39874d7b5f343c34d06f9600856f7c6107108f97df0519ba937bed124",'
    '"contractId":"cf9466eb0fb911d2039732d61be60befff0917077575e9bab9a67a6dc3949644",'
    '"attackModelId":"a4ec1e669112c29f48c6fb9439c9b82710aebc43a811ccd6dce62048d9f2349f",'
    '"environmentId":"ac0d008c3b8a3777351f95ce89d43e2847708c5d7cb52bbe749bc4db6d757019"}'
)
NOW = '2026-09-28T18:30:00Z'
SIB = [{
    "roots": ["game/src"],
    "termsAndMethod": "traced defect class across emit/playback/draw/preview paths",
    "evidenceIds": [],
    "hitDispositions": ["siblings resolved in this batch or none found"],
    "coverageLimits": ["engine-internal call sites outside audited surface"],
}]


def loc(path, sym):
    return [{
        "path": path, "symbolOrSection": sym,
        "basis": "source inspection + call-path trace", "revision": "working-tree",
    }]


def F(fid, title, sev, path, sym, exp, act, root, rc, repair):
    return {
        'id': fid, 'title': title, 'state': ST, 'severity': sev,
        'classification': 'CODE_DEFECT', 'actionable': True, 'reachability': 'PRODUCTION',
        'locations': loc(path, sym), 'discoveredBy': 'agent-clean-b-f0c42b3b',
        'invariantIds': ['I-CLIP-LIFECYCLE'], 'evidenceIds': [],
        'counterexample': 'n/a - see repair/pins', 'expected': exp, 'actual': act,
        'rootCause': root, 'rootClass': rc, 'subsystem': 'combat-presentation',
        'siblingSearch': SIB, 'siblingFindingIds': [], 'repair': repair,
        'pinEvidenceIds': ['EV-FOCUSED'],
        'verificationEvidenceIds': ['EV-FOCUSED', 'EV-VERIFY-FULL'],
        'closureReviewIds': [], 'status': 'CLOSED',
        'closeReason': 'fixed on ' + ST['productStateId'][:8] + '; regression pin added',
        'closedAt': NOW, 'duplicateOf': None, 'rejectionReason': None, 'exception': None,
    }


led['findings'] += [
    F('F-CB2-01', 'standby_to_idle interrupts in-flight one-shot clip on every routine cast', 'Medium',
      'src/game/scenes/combat/combat-action-feedback.ts', 'onTurnStandbyComplete',
      'play-once attack/ult clip runs to completion, then its destination loop plays',
      'standby_to_idle resolved to the idle loop and played at ~0.4-0.9s, truncating the 2.25s attack / 1.4s ult clip before the strike frames rendered',
      'loop requests did not defer behind an armed one-shot transition', 'missing-state',
      'deferredLoopRequest: loop requests arriving while pendingTransitionListener is armed store the resolved loop and return without interrupting; the armed listener consumes it in place of the clip default destination'),
    F('F-CB2-02', 'charge-continuation turns emit slotRole basic and replay the attack tell', 'Low',
      'src/core/battle/turn/CombatAnimationRuntime.ts', 'castSlotRole',
      'a mid-channel declared turn is not a slot cast: no lunge, no attack clip',
      'declared.action==null && chargedSkill==null fell through to basic -> lunge + attack clip every channeling turn',
      'castSlotRole could not distinguish a non-cast declared turn', 'wrong-value',
      "castSlotRole returns 'none' when action==null and chargedSkill==null; onAttack skips impulse+clip for 'none' while keeping the impact ack"),
    F('F-CB2-03', 'partial multi-sheet loss froze the sprite on the last one-shot frame', 'Low',
      'src/game/scenes/combat/combat-animation-playback.ts', 'playCombatAnimation',
      'when every destination/loop registration is empty the sprite returns to its pre-clip still art',
      'resolved===undefined returned leaving the clip last frame displayed',
      'no base-texture restore on total chain failure', 'missing-state',
      'pendingBaseTextureKey captured before the one-shot swaps texture; the resolved===undefined path restores it via setTexture'),
    F('F-CB2-04', 'resume-path attack replayed the horizontal impulse on a dying actor', 'Nit',
      'src/game/scenes/combat/combat-action-feedback.ts', 'onAttack',
      'dying check precedes the impulse so a corpse does not drift',
      'playHorizontalImpulse ran before the dying guard inside playCombatAnimation',
      'guard ordering', 'missing-guard',
      'onAttack computes dying before the impulse; both impulse and clip skip when dying'),
    F('F-CB2-05', 'MainScene dormant animated mode resolved the legacy atlas, not resolvePlayerEntityKey', 'Nit',
      'src/game/scenes/MainScene.ts', 'animatedArtFormFor consumers',
      'dormant animated mode uses the same reskin-aware player-key resolution as combat',
      'animatedArtFormFor(profile.combatTextureKey) resolved the mortal atlas - divergence only reachable in disabled mode',
      'dormant path bypassed the reskin resolver', 'stale-reference',
      'all three animatedArtFormFor/combatAnimationKey sites now resolve resolvePlayerEntityKey(profile.id, combatTextureKey) first'),
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
    L('L-CB2-01', ['F-CB2-01'], 'one-shot-truncation-by-loop-request',
      'loop requests were applied immediately even while a one-shot transition was armed; no test simulated a mid-clip turn-end',
      ['animation-playback', 'turn-pacing'],
      ['defer loop requests behind armed one-shot transitions; pin with a mid-clip standby_to_idle test']),
    L('L-CB2-02', ['F-CB2-02'], 'non-cast-turn-misclassified-as-cast',
      'slotRole could not express a declared turn that is not a cast; channeling turns replayed the attack tell',
      ['presentation-events', 'charge-lifecycle'],
      ["distinguish non-cast declared turns via a 'none' role; pin at emit and at the feedback consumer"]),
    L('L-CB2-03', ['F-CB2-03'], 'total-chain-failure-freeze',
      'partial multi-sheet loss left the sprite on the last clip frame; no restore path existed',
      ['animation-playback', 'asset-degradation'],
      ['capture pre-clip base texture and restore it when the whole destination chain is unplayable']),
    L('L-CB2-04', ['F-CB2-04', 'F-CB2-05'], 'guard-order-and-resolver-bypass',
      'impulse ran before the dying guard; dormant-mode consumers bypassed the reskin resolver',
      ['combat-feedback', 'presentation-resolution'],
      ['order dying guards before visual side-effects; route every player-key resolution through resolvePlayerEntityKey']),
]


def rv(rid, round_, phase, rev, ctx, role, prev, fids):
    return {
        'id': rid, 'state': OLD, 'round': round_, 'phase': phase, 'reviewerId': rev,
        'contextId': ctx, 'model': 'subagent_explore', 'role': role,
        'inputBundleHash': '0000000000000000000000000000000000000000000000000000000000000000',
        'priorFindingsVisible': False, 'accessLimitations': [],
        'startedAt': '2026-09-28T16:00:00Z', 'sealedAt': '2026-09-28T17:30:00Z',
        'previousPhaseReviewId': prev, 'reviewedAfterPreviousFixes': True,
        'coverageIds': [], 'evidenceIds': [], 'findingIds': fids, 'novelAttackIds': [],
        'status': 'STALE',
    }


led['reviews'] += [
    rv('RV-CA-1', 6, 'CORRECTNESS', 'clean-a-agent-044d46cf', 'agent-clean-a-044d46cf', 'CLEAN_ROOM_A', None, []),
    rv('RV-CA-2', 6, 'AUTHORITY', 'clean-a-agent-044d46cf', 'agent-clean-a-044d46cf', 'CLEAN_ROOM_A', 'RV-CA-1', []),
    rv('RV-CA-3', 6, 'INTEGRATION', 'clean-a-agent-044d46cf', 'agent-clean-a-044d46cf', 'CLEAN_ROOM_A', 'RV-CA-2', []),
    rv('RV-CB-1', 6, 'CORRECTNESS', 'clean-b-agent-f0c42b3b', 'agent-clean-b-f0c42b3b', 'CLEAN_ROOM_B', None,
       ['F-CB2-01', 'F-CB2-02', 'F-CB2-03', 'F-CB2-04', 'F-CB2-05']),
    rv('RV-CB-2', 6, 'AUTHORITY', 'clean-b-agent-f0c42b3b', 'agent-clean-b-f0c42b3b', 'CLEAN_ROOM_B', 'RV-CB-1', []),
    rv('RV-CB-3', 6, 'INTEGRATION', 'clean-b-agent-f0c42b3b', 'agent-clean-b-f0c42b3b', 'CLEAN_ROOM_B', 'RV-CB-2', []),
]
led['cycles'] += [
    {'id': 'CYC-CLEAN-A3', 'state': OLD, 'reviewIds': ['RV-CA-1', 'RV-CA-2', 'RV-CA-3'],
     'coverageIds': [], 'evidenceIds': [], 'noveltyEvidenceIds': [],
     'startedAt': '2026-09-28T16:00:00Z', 'finishedAt': '2026-09-28T17:30:00Z', 'status': 'STALE'},
    {'id': 'CYC-CLEAN-B3', 'state': OLD, 'reviewIds': ['RV-CB-1', 'RV-CB-2', 'RV-CB-3'],
     'coverageIds': [], 'evidenceIds': [], 'noveltyEvidenceIds': [],
     'startedAt': '2026-09-28T16:00:00Z', 'finishedAt': '2026-09-28T17:30:00Z', 'status': 'STALE'},
]

json.dump(led, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('findings:', len(led['findings']), 'lessons:', len(led['lessons']),
      'reviews:', len(led['reviews']), 'cycles:', len(led['cycles']))
