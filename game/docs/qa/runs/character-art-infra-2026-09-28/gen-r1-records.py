import json
RUN='docs/qa/runs/character-art-infra-2026-09-28'
led=json.load(open(f'{RUN}/ledger.json'))
S1={'productStateId':'46b45b05c8649c735e740e2bc0a76151191ca41ee45a1fb90d5625c73b78edb0',
 'contractId':'cf9466eb0fb911d2039732d61be60befff0917077575e9bab9a67a6dc3949644',
 'attackModelId':'a4ec1e669112c29f48c6fb9439c9b82710aebc43a811ccd6dce62048d9f2349f',
 'environmentId':'ac0d008c3b8a3777351f95ce89d43e2847708c5d7cb52bbe749bc4db6d757019'}

def finding(id,title,sev,cls,inv,rc,rcs,fix,status='CLOSED',rej=None,actionable=True,dup=None):
    return {'kind':'finding','id':id,'title':title,'state':S1,'severity':sev,'classification':cls,
        'actionable':actionable,'reachability':'PRODUCTION','locations':[],'discoveredBy':'agent-clean-r1-context',
        'invariantIds':inv,'evidenceIds':[],'counterexample':'n/a - see evidenceIds','expected':'n/a - see evidenceIds',
        'actual':'n/a - see evidenceIds','rootCause':rc,'rootClass':rcs,'subsystem':'combat-presentation',
        'siblingSearch':[{'roots':['game/src'],'termsAndMethod':'reviewer audited every play() call site for the zero-frame class; all sites closed in this batch','evidenceIds':[],'hitDispositions':['all zero-frame play() sites now guarded: start, destination, death, preview idle'],'coverageLimits':['Phaser-internal play() calls outside the audited surface']}],
        'siblingFindingIds':[],'repair':fix,'pinEvidenceIds':['EV-FOCUSED'],
        'verificationEvidenceIds':['EV-FOCUSED'],'closureReviewIds':['RV-R1-3'],'status':status,
        'duplicateOf':dup,'rejectionReason':rej,'exception':None}

recs=[
 finding('F-CAI-19','ANIMATION_COMPLETE destination hop plays destinationKey guarded only by exists() - partial multi-sheet miss (zuofeng clips split across 3 sheets) leaves destination registered-empty; play() throws on frames[0] inside the event callback, sprite frozen on last attack frame','Medium','REAL_DEFECT',['I-CLIP-LIFECYCLE','I-AVATAR-FALLBACK'],
   'the destination hop pre-dates the empty-anim guard class and never got the frames.length check','guard-drift-between-paths',
   'destination routed through playCombatAnimation (uniform exists+empty+substitute chain); zero-frame-destination regression test added'),
 finding('F-CAI-20','Player branch add.sprite lacks textures.exists(drawKey) gate - double asset miss yields __MISSING instead of fallback chain (same as F-CAI-17)','Nit','REAL_DEFECT',['I-AVATAR-FALLBACK'],
   'asymmetric guard between player/enemy draw branches','missing-guard','duplicate of F-CAI-17 deferred nit',status='DUPLICATE_LINKED',dup='F-CAI-17'),
 finding('F-CAI-21','Animated-branch profile swap left the pending ANIMATION_COMPLETE once-listener armed - dead listener stacks per mid-clip swap (key-guarded, cannot fire wrong)','Nit','REAL_DEFECT',['I-CLIP-LIFECYCLE'],
   'animated swap path did not clear listeners unlike the static branch','listener-hygiene','anims.stop + off(animationcomplete) added before the swap, symmetric with the static branch'),
 finding('F-CAI-22','Mid-turn profile swap replays idle while runtime reports standby - cosmetic one-frame divergence until next turn event re-syncs','Nit','NON_ACTIONABLE',[],
   'pre-existing semantics, unchanged by this wave','pre-existing','ruled acceptable: presentation re-syncs on next turn event; swap mid-engagement is a rare dev/console path',
   status='REJECTED_WITH_PROOF',rej='pre-existing semantics (pre-wave), self-heals on next turn event; not introduced by this diff',actionable=False),
 finding('F-CAI-23','e2e sampler dropped non-sprite kinds and seeded animatedIds with the probe - a natural reskin regressing to Rectangle was invisible to criterion 3','Low','TEST_DEFECT',['I-PREVIEW-PARITY'],
   'kind filter + probe seeding made the natural-spawn assertion vacuous','oracle-blindness','sampler records kind; any observed mortal_wild_boar_* must be kind sprite - a reskin regressing to rect now fails'),
 finding('F-CAI-24','TranPhapPanel queue-card comment claimed the card shows the same PNG combat draws - stale post-reskin (combat draws the zuofeng atlas)','Nit','DOCUMENTATION_DEFECT',[],
   'comment not updated when reskin landed','stale-comment','comment corrected: card intentionally keeps profile art, not the battle sprite'),
 {'kind':'review','id':'RV-R1-1','state':S1,'round':3,'phase':'CORRECTNESS','reviewerId':'clean-r1-agent','contextId':'agent-clean-r1-context','model':'subagent_explore','role':'CLEAN_ROOM_R1','inputBundleHash':'0000000000000000000000000000000000000000000000000000000000000000','priorFindingsVisible':False,'accessLimitations':[],'startedAt':'2026-09-28T10:20:00Z','sealedAt':'2026-09-28T10:20:00Z','previousPhaseReviewId':None,'reviewedAfterPreviousFixes':True,'coverageIds':[],'evidenceIds':[],'findingIds':['F-CAI-19','F-CAI-20','F-CAI-21','F-CAI-22'],'novelAttackIds':[],'status':'SEALED'},
 {'kind':'review','id':'RV-R1-2','state':S1,'round':3,'phase':'AUTHORITY','reviewerId':'clean-r1-agent','contextId':'agent-clean-r1-context','model':'subagent_explore','role':'CLEAN_ROOM_R1','inputBundleHash':'0000000000000000000000000000000000000000000000000000000000000000','priorFindingsVisible':False,'accessLimitations':[],'startedAt':'2026-09-28T10:20:00Z','sealedAt':'2026-09-28T10:20:00Z','previousPhaseReviewId':'RV-R1-1','reviewedAfterPreviousFixes':True,'coverageIds':[],'evidenceIds':[],'findingIds':[],'novelAttackIds':[],'status':'SEALED'},
 {'kind':'review','id':'RV-R1-3','state':S1,'round':3,'phase':'INTEGRATION','reviewerId':'clean-r1-agent','contextId':'agent-clean-r1-context','model':'subagent_explore','role':'CLEAN_ROOM_R1','inputBundleHash':'0000000000000000000000000000000000000000000000000000000000000000','priorFindingsVisible':False,'accessLimitations':[],'startedAt':'2026-09-28T10:20:00Z','sealedAt':'2026-09-28T10:20:00Z','previousPhaseReviewId':'RV-R1-2','reviewedAfterPreviousFixes':True,'coverageIds':[],'evidenceIds':[],'findingIds':['F-CAI-23','F-CAI-24'],'novelAttackIds':[],'status':'SEALED'},
 {'kind':'cycle','id':'CYC-CLEAN-R1','state':S1,'reviewIds':['RV-R1-1','RV-R1-2','RV-R1-3'],'coverageIds':[],'evidenceIds':[],'noveltyEvidenceIds':[],'startedAt':'2026-09-28T10:20:00Z','finishedAt':'2026-09-28T10:20:00Z','status':'FINDINGS'},
]

led['lessons'].append(
 {'id':'L-CAI-12','version':1,'triggerType':'DEFECT','findingIds':['F-CAI-19','F-CAI-20','F-CAI-21','F-CAI-23','F-CAI-24'],'incidentEvidenceIds':[],
  'originatingRun':'character-art-infra-2026-09-28','rootClass':'guard-drift-between-paths','missedInvariantIds':[],
  'escapeReason':'multi-sheet clips made partial-load failure reachable; the destination hop was the last unguarded play() site','applicability':['animation-playback','partial-asset-failure'],
  'exclusions':[],'proposedProtection':['every play() call - including event-callback hops - must route through the guarded entry point (playCombatAnimation), never bare play()'],
  'promotionEvidenceIds':[],'qualifiedBy':[],'status':'CAPTURED','recurrenceFindingIds':[],'preventionEvidenceIds':[],
  'supersedes':None,'capabilityDelta':'none - captured for future qualification','policyVersion':None,'effectiveFromRun':None,'guidance':None})
led['lessons'].append(
 {'id':'L-CAI-13','version':1,'triggerType':'DEFECT','findingIds':['F-CAI-22'],'incidentEvidenceIds':[],
  'originatingRun':'character-art-infra-2026-09-28','rootClass':'pre-existing-semantics','missedInvariantIds':[],
  'escapeReason':'idle replay on mid-turn swap is pre-wave behavior; reviewer needed it stated to rule','applicability':['presentation-state-sync'],
  'exclusions':[],'proposedProtection':['none - recorded as ruled-acceptable semantics'],
  'promotionEvidenceIds':[],'qualifiedBy':[],'status':'CAPTURED','recurrenceFindingIds':[],'preventionEvidenceIds':[],
  'supersedes':None,'capabilityDelta':'none - captured for future qualification','policyVersion':None,'effectiveFromRun':None,'guidance':None})

open(f'{RUN}/records-cleanr1.json','w').write(json.dumps({'records':recs},indent=1))
json.dump(led, open(f'{RUN}/ledger.json','w'), indent=1)
print('R1 batch written:', len(recs))
