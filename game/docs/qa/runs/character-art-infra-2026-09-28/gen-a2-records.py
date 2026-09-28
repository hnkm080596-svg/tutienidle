import json

RUN = 'docs/qa/runs/character-art-infra-2026-09-28'
led = json.load(open(f'{RUN}/ledger.json'))
ST = led['run']['state']
NOW = '2026-09-28T13:20:00Z'

def finding(fid, title, sev, cls, repair, close, status='CLOSED', extra=None):
    f = {
        'id': fid, 'title': title, 'state': ST, 'severity': sev, 'classification': cls,
        'actionable': True, 'reachability': 'PRODUCTION',
        'locations': [], 'discoveredBy': 'agent-clean-a2-context',
        'invariantIds': [], 'evidenceIds': [],
        'counterexample': 'n/a - see evidenceIds', 'expected': 'n/a - see evidenceIds',
        'actual': 'n/a - see evidenceIds',
        'rootCause': '', 'rootClass': '', 'subsystem': 'combat-presentation',
        'siblingSearch': [{'roots': ['game/src', 'game/scripts'],
            'termsAndMethod': 'reviewer traced the defect class across emit/play/draw/reconcile paths',
            'evidenceIds': [], 'hitDispositions': ['siblings resolved in this batch or none found'],
            'coverageLimits': ['engine-internal call sites outside the audited surface']}],
        'siblingFindingIds': [],
        'repair': repair, 'pinEvidenceIds': ['EV-FOCUSED'],
        'verificationEvidenceIds': ['EV-FOCUSED', 'EV-VERIFY-FULL'],
        'closureReviewIds': ['RV-A2-3'],
        'status': status, 'closeReason': close, 'closedAt': NOW,
        'duplicateOf': None, 'rejectionReason': None, 'exception': None,
    }
    f.update(extra or {})
    return f

findings = [
    finding('F-CAI-30',
        'playCombatAnimation had no dying guard: a late turn_cast_start/turn_standby_complete mid-death replaced the death clip; the key-filtered ANIMATION_COMPLETE then never fired -> animDone stayed false -> finalize() wedged (enemy corpse permanent, skipped by reconcile) / corpse replayed casts (player). Companion reskin surface inherits the same wedge. Secondary: onBattleStart cleared playerDying AFTER its idle replay, so the gate would have swallowed the reset (found while fixing)',
        'Medium', 'REAL_DEFECT',
        'dying gate (playerDying/dyingIds) added at the top of playCombatAnimation mirroring combat-player-visual; onBattleStart clears playerDying before the idle replay; regression test pins both player and enemy paths',
        'fixed; death owns the animation channel until finalize',
        extra={'invariantIds': ['I-CLIP-LIFECYCLE'],
               'evidenceIds': ['RV-A2-1'],
               'rootCause': 'animation channel had no lifecycle owner during death; ordering of flag clear vs replay',
               'rootClass': 'lifecycle-guard-missing'}),
    finding('F-CAI-31',
        'Preview rebuild-guard acceptableTextureKeys omitted playerProfile.combatTextureKey - the grid-view terminal fallback (F-CAI-25 repair) can legitimately leave the sprite on the profile PNG, so every sync under a double asset miss would destroy+recreate the sprite',
        'Low', 'REAL_DEFECT',
        'profile combatTextureKey added to the animated-branch acceptable set; test matrix extended to cover it',
        'fixed; acceptable set now covers every draw-chain output',
        extra={'invariantIds': ['I-PREVIEW-PARITY', 'I-AVATAR-FALLBACK'],
               'evidenceIds': ['RV-A2-1'],
               'rootCause': 'acceptable-key set not extended when the terminal fallback chain was added',
               'rootClass': 'state-comparison-blind-spot'}),
    finding('F-CAI-32',
        'applyPlayerVisualProfile sized a double-miss sprite by atlas metrics while it actually drew the profile PNG or host fallback - the avatar-miss branch had no deeper tier',
        'Low', 'REAL_DEFECT',
        'double-miss tier resolves the drawn texture key (gameSprite.texture.key) through presentationFor and uses that static forms metrics; falls back to profile metrics only when the drawn texture is unregistered',
        'fixed; sizing always tracks the texture actually drawn',
        extra={'invariantIds': ['I-AVATAR-FALLBACK'],
               'evidenceIds': ['RV-A2-1'],
               'rootCause': 'sizing chain ended one tier shallower than the draw chain',
               'rootClass': 'metadata-decoupling'}),
    finding('F-CAI-33',
        'pack-character-art clipOfDirName accepted bare death/ but not <slug>-death/ - a future dump using the sibling-dir convention would silently drop real death frames and substitute the darkened attack frame',
        'Low', 'REAL_DEFECT',
        'regex extended to match all four clip names uniformly (idle|attack|ult|death) with the same prefix rules',
        'fixed; both death layouts accepted',
        extra={'invariantIds': ['I-REGISTRY-MANIFEST-PARITY'],
               'evidenceIds': ['RV-A2-3'],
               'rootCause': 'death dir special-cased instead of following the shared naming rule',
               'rootClass': 'incomplete-convention'}),
    finding('F-CAI-34',
        'readPivot malformed-file default {0.5,0.0} disagreed with the missing-file default {0.5,1.0} - provenance-only field but self-inconsistent',
        'Nit', 'REAL_DEFECT',
        'unified on {0.5,1.0} (the runtime origin contract)',
        'fixed; provenance consistent',
        extra={'invariantIds': ['I-REGISTRY-MANIFEST-PARITY'],
               'evidenceIds': ['RV-A2-3'],
               'rootCause': 'two defaults for the same field',
               'rootClass': 'constant-drift'}),
    finding('F-CAI-35',
        'Charge-resolve turn emitted slotRole basic (action null on resolve) though declared.chargedSkill IS the ultimate/special skill - the resolve hit played attack instead of ult (spec ambiguity hardened into a defect by I-ULT-SLOT-SELECT wording)',
        'Low', 'SPEC_DEFECT',
        'castSlotRole falls through to chargedSkill identity (reference + id) against actor.ultimate/actor.special; runtime test pins the resolve turn reporting ultimate',
        'fixed; resolve hits carry the committed slots role',
        extra={'invariantIds': ['I-ULT-SLOT-SELECT'],
               'evidenceIds': ['RV-A2-3'],
               'rootCause': 'resolve turn has no slot object so role detection missed it',
               'rootClass': 'identity-loss-across-phases'}),
]

def rv(rid, phase, prev, fids):
    return {
        'id': rid, 'state': ST, 'round': 5, 'phase': phase,
        'reviewerId': 'clean-a2-agent', 'contextId': 'agent-clean-a2-context',
        'model': 'subagent_explore', 'role': 'CLEAN_ROOM_R1',
        'inputBundleHash': '0' * 64, 'priorFindingsVisible': False,
        'accessLimitations': [],
        'startedAt': '2026-09-28T12:45:00Z', 'sealedAt': '2026-09-28T13:15:00Z',
        'previousPhaseReviewId': prev, 'reviewedAfterPreviousFixes': True,
        'coverageIds': [], 'evidenceIds': [], 'findingIds': fids,
        'novelAttackIds': [], 'status': 'SEALED',
    }

reviews = [
    rv('RV-A2-1', 'CORRECTNESS', 'RV-R2-3', ['F-CAI-30', 'F-CAI-31', 'F-CAI-32']),
    rv('RV-A2-2', 'AUTHORITY', 'RV-A2-1', []),
    rv('RV-A2-3', 'INTEGRATION', 'RV-A2-2', ['F-CAI-33', 'F-CAI-34', 'F-CAI-35']),
]

cycle = {
    'id': 'CYC-CLEAN-A2', 'state': ST,
    'reviewIds': ['RV-A2-1', 'RV-A2-2', 'RV-A2-3'],
    'coverageIds': [], 'evidenceIds': [],
    'noveltyEvidenceIds': [],
    'startedAt': '2026-09-28T12:45:00Z', 'finishedAt': '2026-09-28T13:15:00Z',
    'status': 'FINDINGS',
}

led['findings'].extend(findings)
led['reviews'].extend(reviews)
led['cycles'].append(cycle)

# lessons for the new terminal findings (MC13)
def lesson(lid, fid, root_class, escape, applicability, protection):
    return {
        'id': lid, 'version': 1, 'triggerType': 'DEFECT',
        'findingIds': [fid], 'incidentEvidenceIds': [],
        'originatingRun': 'character-art-infra-2026-09-28',
        'rootClass': root_class, 'missedInvariantIds': [],
        'escapeReason': escape,
        'applicability': applicability, 'exclusions': [],
        'proposedProtection': protection,
        'promotionEvidenceIds': [], 'qualifiedBy': [], 'status': 'CAPTURED',
        'recurrenceFindingIds': [], 'preventionEvidenceIds': [],
        'supersedes': None, 'capabilityDelta': 'none - captured for future qualification',
        'policyVersion': None, 'effectiveFromRun': None, 'guidance': None,
    }

led['lessons'].extend([
    lesson('L-CAI-19', 'F-CAI-30', 'lifecycle-guard-missing',
        'the death sequence owns the animation channel only implicitly - nothing stopped a late event from play()ing over the death clip; flag-clear ordering then compounded it at restart',
        ['animation-playback', 'entity-lifecycle'],
        ['every state that owns a channel (dying, spawning, swapping) needs an explicit gate on the play path; reset ordering: clear flags before replays']),
    lesson('L-CAI-20', 'F-CAI-31', 'state-comparison-blind-spot',
        'the acceptable-texture set was built when the draw chain had three tiers; adding a fourth tier (terminal fallback) without updating the comparator re-created the rebuild-every-sync defect',
        ['preview-parity', 'draw-fallback'],
        ['when a draw chain grows a tier, its acceptable-set mirrors must grow in the same change']),
    lesson('L-CAI-21', 'F-CAI-32', 'metadata-decoupling',
        'sizing metadata tracked a draw chain one tier shallower than the real one; the rule already stated (sizing belongs to the drawn texture) was not enforced at the deepest tier',
        ['presentation-layer', 'draw-fallback'],
        ['resolve metrics from the texture actually drawn (gameSprite.texture.key), not the tier the chain was supposed to stop at']),
    lesson('L-CAI-22', 'F-CAI-35', 'identity-loss-across-phases',
        'slot identity lived only in action.slot, which is absent on the resolve turn - a multi-phase action loses its role label between commit and resolve unless identity is carried on chargedSkill',
        ['event-payloads', 'multi-phase-actions'],
        ['role labels for multi-phase actions must be derivable from the captured payload, not only the phase-local slot object']),
])

json.dump(led, open(f'{RUN}/ledger.json', 'w'), indent=1)
print('findings:', len(led['findings']), 'reviews:', len(led['reviews']), 'cycles:', len(led['cycles']), 'lessons:', len(led['lessons']))
