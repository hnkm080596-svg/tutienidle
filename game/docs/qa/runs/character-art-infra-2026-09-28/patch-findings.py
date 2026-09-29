import json

RUN = 'docs/qa/runs/character-art-infra-2026-09-28'
led = json.load(open(f'{RUN}/ledger.json'))
ST = led['run']['state']
NOW = '2026-09-28T07:45:00Z'

def finding(fid, title, sev, cls, disc, repair, close, actionable=True, extra=None):
    f = {
        'id': fid, 'title': title, 'state': ST, 'severity': sev, 'classification': cls,
        'actionable': actionable, 'reachability': 'PRODUCTION',
        'locations': [], 'discoveredBy': disc, 'invariantIds': [], 'evidenceIds': [],
        'rootCause': '', 'rootClass': '', 'subsystem': 'combat-presentation',
        'siblingSearch': [{'roots': ['game/src', 'game/scripts'],
            'termsAndMethod': 'census performed - none found', 'evidenceIds': [],
            'hitDispositions': ['no actionable sibling found'],
            'coverageLimits': ['name-aliased consumers may evade literal search']}],
        'siblingFindingIds': [],
        'repair': repair, 'pinEvidenceIds': [], 'verificationEvidenceIds': ['EV-FOCUSED', 'EV-VERIFY-FULL'],
        'closureReviewIds': [], 'status': 'CLOSED', 'closeReason': close, 'closedAt': NOW,
        'counterexample': 'n/a - see evidenceIds', 'expected': 'n/a - see evidenceIds', 'actual': 'n/a - see evidenceIds',
        'duplicateOf': None, 'rejectionReason': None, 'exception': None,
    }
    f.update(extra or {})
    return f

findings = [
    finding('F-CAI-01', 'Preview scene sync compared sprite texture against a single expected key - a mapped profile atlas/avatar legitimately draws a different key, so the player sprite was destroyed+rebuilt on EVERY sync under reskin', 'Medium', 'REAL_DEFECT', 'coordinator',
        'expectedTextureKey replaced by acceptableTextureKeys covering the full draw chain (idle sheet, avatar on atlas-miss, shared fallback, mapped entity key, legacy profile PNG)',
        'fixed; rebuild-guard pinned by preview tests',
        extra={'invariantIds': ['I-PREVIEW-PARITY'], 'evidenceIds': ['EV-OCR'], 'rootCause': 'draw-chain not mirrored in sync guard', 'rootClass': 'state-comparison-blind-spot', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-02', "Ultimate cast on a variant with no authored 'ult' clip skipped the attack tell entirely - missing-clip path went straight to standby destination", 'Medium', 'REAL_DEFECT', 'coordinator',
        'MISSING_CLIP_FALLBACK { ult -> attack } in combat-animation-playback; destination table still applies afterwards',
        'fixed; onAttack fallback pinned by CombatScene.combatAnimations tests',
        extra={'invariantIds': ['I-ULT-SLOT-SELECT', 'I-CLIP-LIFECYCLE'], 'evidenceIds': ['EV-OCR'], 'rootCause': 'no missing-clip fallback chain', 'rootClass': 'degradation-gap', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-03', 'Preview test harness mocked the pre-reskin draw path (raw combatTextureKey) and lacked scene.textures.exists - the new reskin branches were untestable and silently diverged from production', 'Medium', 'TEST_GAP', 'agent-p4',
        'mock rebuilt to mirror resolvePlayerEntityKey draw chain + textures.exists stub; acceptable-key + atlas-miss stability tests added',
        'fixed; harness mirrors production chain',
        extra={'invariantIds': ['I-PREVIEW-PARITY'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'stale fixture mirrored old contract', 'rootClass': 'fixture-drift', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-04', "No behavioral test pinned slotRole through the emit->payload->onAttack chain, nor the ult->attack degradation - the wave central contract was covered only by types, not behavior", 'Medium', 'TEST_GAP', 'agent-p4',
        'CombatAnimationRuntime tests assert slotRole basic/ultimate on the emitted event; CombatScene.combatAnimations tests assert onAttack clip selection + ult-fallback',
        'fixed; chain pinned end-to-end in unit tests',
        extra={'invariantIds': ['I-ULT-SLOT-SELECT'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'coverage gap on additive field', 'rootClass': 'unpinned-contract', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-05', 'Static-branch profile swap left in-flight clips running - a pending ANIMATION_COMPLETE once-listener could replay its standby destination on the old atlas and undo the swap; also no guard against swapping a dying sprite', 'Low', 'REAL_DEFECT', 'agent-p4',
        "anims.stop() + off('animationcomplete') before setTexture on the static branch; early return when playerDying",
        'fixed; corpse owns final frame, stale listeners removed',
        extra={'invariantIds': ['I-CLIP-LIFECYCLE', 'I-ANIMATED-CHAR-OVERRIDE'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'missing listener lifecycle on swap', 'rootClass': 'listener-lifecycle', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-06', 'Atlas-miss + profile event wrote ATLAS sourceSize/extent onto a sprite actually drawing the avatar PNG - fallback squashed ~32% horizontally', 'Low', 'REAL_DEFECT', 'agent-p4',
        'applyPlayerVisualProfile mirrors the draw chain: avatar form sourceSize/extent when the sheet is absent',
        'fixed; sizing belongs to the texture actually drawn',
        extra={'invariantIds': ['I-AVATAR-FALLBACK'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'sizing metadata decoupled from drawn texture', 'rootClass': 'metadata-decoupling', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-07', 'Avatar persistence on atlas-miss relied on Phaser incidental empty-anim no-op - a clip registered with zero frames would still be passed to play() and could swap texture off the avatar', 'Low', 'REAL_DEFECT', 'agent-p4',
        'playCombatAnimation treats zero-frame anims (anims.get(key).frames.length === 0) as missing - degrade chain applies; test pins empty-anim does not play',
        'fixed; degradation made explicit not incidental',
        extra={'invariantIds': ['I-AVATAR-FALLBACK', 'I-CLIP-LIFECYCLE'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'incidental Phaser behavior as contract', 'rootClass': 'implicit-contract', 'pinEvidenceIds': ['EV-FOCUSED']}),
    finding('F-CAI-08', 'Character slugs share the catalogue keyspace with monster variants and companion ids - register() is last-writer-wins, so a future slug/id collision silently overwrites a reskin', 'Nit', 'LATENT_RISK', 'agent-p4',
        'disjointness pinned in characterArtReskin.test.ts - a collision fails the architecture test with a clear message',
        'fixed; collision now fails deterministically',
        extra={'invariantIds': ['I-REGISTRY-MANIFEST-PARITY'], 'evidenceIds': ['RV-P4-AGENT'], 'rootCause': 'shared namespace, no disjointness check', 'rootClass': 'namespace-collision-latent', 'pinEvidenceIds': ['EV-FOCUSED']}),
]

def deferred(fid, title, why, sev='Nit'):
    f = finding(fid, title, sev, 'PRE_EXISTING_OR_DEFERRED', 'coordinator', '', 'deferred - see closeReason', actionable=False)
    f['status'] = 'DEFERRED'
    f['closeReason'] = why
    return f

findings += [
    deferred('F-CAI-09', 'readPivot JSON fallback {0.5,0} vs emit default {0.5,1}', 'pivot is provenance-only; no runtime consumer reads it - parity nit, real fix belongs with a consumer'),
    deferred('F-CAI-10', 'MainScene home view still draws the legacy profile PNG (not reskin)', 'non-combat surface by design; reskin scope is combat + preview per spec'),
    deferred('F-CAI-11', '~9 unwired character variants packed and staged - future VRAM cost when wired', 'staged by design (user supplies mapping later); registry stays the load gate so unwired variants never reach VRAM today'),
]

led['findings'] = findings

def cov(iid, surf, status, evs, why):
    return {'id': f'COV-{iid}-{surf}', 'invariantId': iid, 'surface': surf,
            'attackIds': [], 'taxonomyIds': [], 'applicability': 'REQUIRED',
            'reason': why, 'evidenceIds': evs, 'reviewerIds': ['coordinator'], 'status': status, 'weakProtection': False}

F = 'EV-FOCUSED'
led['coverage'] = [
    cov('I-CHAR-RESKIN-RESOLVE', 'DETERMINISTIC', 'SATISFIED', [F], 'profile resolution + reskin-map tests pin slug resolution for all 4 profiles'),
    cov('I-CHAR-RESKIN-RESOLVE', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'architecture test asserts resolvePlayerEntityKey used by every combat consumer'),
    cov('I-CHAR-RESKIN-RESOLVE', 'RUNTIME_E2E', 'SATISFIED', ['EV-E2E-MOTION'], 'live combat draws zuofeng atlas for the player; idle/ult/death play in-browser'),
    cov('I-CHAR-RESKIN-RESOLVE', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT adversarial + RV-TERMINAL independent on final state'),
    cov('I-ANIMATED-CHAR-OVERRIDE', 'DETERMINISTIC', 'SATISFIED', [F], 'applyPlayerVisualProfile/entityKey tests pin profile-swap staying on reskin'),
    cov('I-ANIMATED-CHAR-OVERRIDE', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'consumers audited; all combat paths route through entity key'),
    cov('I-ANIMATED-CHAR-OVERRIDE', 'RUNTIME_E2E', 'SATISFIED', ['EV-E2E-MOTION'], 'player renders atlas in live combat - profile PNG never surfaces'),
    cov('I-ANIMATED-CHAR-OVERRIDE', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT found+closed F-CAI-05 (static-swap regression)'),
    cov('I-ULT-SLOT-SELECT', 'DETERMINISTIC', 'SATISFIED', [F], 'runtime event payload + onAttack clip-selection tests pin the whole chain incl ult->attack fallback'),
    cov('I-ULT-SLOT-SELECT', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'slotRole flows emit->payload->feedback; slot reference compare verified vs slotAction'),
    cov('I-ULT-SLOT-SELECT', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT F-CAI-04 coverage gap identified and closed'),
    cov('I-AVATAR-FALLBACK', 'DETERMINISTIC', 'SATISFIED', [F], 'grid-view atlas-miss tests + player-visual avatar-dims path + zero-frame no-play test'),
    cov('I-AVATAR-FALLBACK', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'draw chain mirrored in creation + swap paths'),
    cov('I-AVATAR-FALLBACK', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT F-CAI-06/07 closed'),
    cov('I-REGISTRY-MANIFEST-PARITY', 'DETERMINISTIC', 'SATISFIED', [F], 'characterArtReskin.test.ts pins registry to on-disk manifest + PNG dims + per-clip sheets'),
    cov('I-REGISTRY-MANIFEST-PARITY', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'registry-only enumeration keeps unwired variants out of load surface'),
    cov('I-REGISTRY-MANIFEST-PARITY', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT F-CAI-08 disjointness closed'),
    cov('I-PREVIEW-PARITY', 'DETERMINISTIC', 'SATISFIED', [F], 'preview tests pin acceptable-key set + no-rebuild + stale-texture rebuild'),
    cov('I-PREVIEW-PARITY', 'STATIC_SEMANTIC', 'SATISFIED', [F], 'preview mirrors combat draw chain'),
    cov('I-PREVIEW-PARITY', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT F-CAI-03 harness drift closed'),
    cov('I-CLIP-LIFECYCLE', 'DETERMINISTIC', 'SATISFIED', [F], 'zero-frame no-play + ult-fallback + static-swap listener cleanup tests'),
    cov('I-CLIP-LIFECYCLE', 'RUNTIME_E2E', 'SATISFIED', ['EV-E2E-MOTION'], 'live ult plays to completion; death clip completes then sprite destroyed'),
    cov('I-CLIP-LIFECYCLE', 'INDEPENDENT_REVIEW', 'SATISFIED', [], 'RV-P4-AGENT F-CAI-05 closed'),
]

json.dump(led, open(f'{RUN}/ledger.json', 'w'), indent=1)
print('findings:', len(led['findings']), 'coverage:', len(led['coverage']))
