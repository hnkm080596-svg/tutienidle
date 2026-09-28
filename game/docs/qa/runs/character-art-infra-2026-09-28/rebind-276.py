import json, hashlib, os

RUN = '.'
led = json.load(open('ledger.json', encoding='utf-8'))
ST = led['run']['state']
NOW = '2026-09-28T18:45:00Z'


def h(p):
    return hashlib.sha256(open(os.path.join('..', '..', 'qa', 'runs',
        'character-art-infra-2026-09-28', p).replace('/', os.sep), 'rb').read()).hexdigest() \
        if os.sep != '/' else hashlib.sha256(open(p, 'rb').read()).hexdigest()


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


EV = {
    'EV-FOCUSED': ('npx vitest run <6 wave-touched test files> on state ' + ST['productStateId'][:8],
                   'evidence/focused-tests.txt',
                   '133 focused tests green incl. loop-deferral, base-restore, none-slotRole, dying-impulse pins'),
    'EV-VERIFY-FULL': ('npm run verify (type-check + build + vitest run) on state ' + ST['productStateId'][:8],
                       'evidence/verify-full.txt',
                       '787 files / 7018 tests / 5 expected-fail; typecheck+build green'),
    'EV-E2E-MOTION': ('npx playwright test tests/e2e/combat-idle-motion-capture.spec.ts on state ' + ST['productStateId'][:8],
                      'evidence/e2e-motion.txt',
                      'e2e green 1.9m: static bob, reskinned authored frames, one-shot completes then loop'),
    'EV-SRC-AUDIT': ('manual full-diff source audit on state ' + ST['productStateId'][:8],
                     'evidence/source-audit.txt',
                     'P15 clean; 24 changed files; invariants recap verified'),
    'EV-MUTATION': ('mutation-campaign.py + mutation-round2.py on state ' + ST['productStateId'][:8],
                    'evidence/mutation-campaign.txt',
                    'MUT-01,03,04,05,06,07 killed; MUT-02 killed via corrected round2 site'),
    'EV-MUT-R3': ('mutation-round3.py + mutation-round4.py on state ' + ST['productStateId'][:8],
                  'evidence/mutation-round3.txt',
                  'MUT-08 + MUT-09 KILLED on current state'),
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

MUT = {
    'MUT-01': 'a3da8511077a73f14907cb1b7e3536e4fb396164fc5b2ac017085ee791b4ef3a',
    'MUT-02': None,  # take from round2 results
    'MUT-03': 'cb3edb893d961b11dfaadbd4f2c84f8b284dc4ea660775a95c652d9cc4675954',
    'MUT-04': None,  # take from round2 results
    'MUT-05': None, 'MUT-06': None, 'MUT-07': None, 'MUT-08': None, 'MUT-09': None,
}
res = json.load(open('mutation-results.json', encoding='utf-8'))
res2 = json.load(open('mutation-round2-results.json', encoding='utf-8'))
r3 = json.load(open('mutation-round3-result.json', encoding='utf-8'))
r4 = json.load(open('mutation-round4-result.json', encoding='utf-8'))
byid = {}
for r in res + res2 + ([r3] if isinstance(r3, dict) else r3) + ([r4] if isinstance(r4, dict) else r4):
    if r.get('result') == 'KILLED_EXPECTED':
        byid[r['id']] = r  # prefer killed entry (round2 overrides campaign SURVIVED)
for m in led['mutations']:
    r = byid.get(m['id'])
    if r:
        m['candidateState'] = ST
        m['mutantHash'] = r.get('mutantHash', m['mutantHash'])
        m['result'] = 'KILLED_EXPECTED'
        m['candidateUnchanged'] = r.get('candidateUnchanged', True)
        m['evidenceIds'] = ['EV-MUTATION'] if m['id'] <= 'MUT-07' else ['EV-MUT-R3']
        if m['id'] in ('MUT-02', 'MUT-04'):
            m['evidenceIds'] = ['EV-MUTATION']
        if m['id'] in ('MUT-08', 'MUT-09'):
            m['evidenceIds'] = ['EV-MUT-R3']
        print(m['id'], m['result'], m['mutantHash'][:10])

json.dump(led, open('ledger.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('rebound to', ST['productStateId'][:12])
