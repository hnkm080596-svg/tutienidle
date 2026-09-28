"""Novel attack between clean rounds A and B (C6 inter-round novelty).
MUT-08: resume-cast slotRole passthrough -> hardcoded 'basic' (F-CAI-13 repair
surface). Oracle: resumed-cast-carries-ultimate test."""
import hashlib, json, subprocess
ROOT = 'E:/tutienidle/.agent-worktrees/character-art-infra/game'
path = f"{ROOT}/src/core/battle/turn/CombatAnimationRuntime.ts"
before = hashlib.sha256(open(path,'rb').read()).hexdigest()
src = open(path, encoding='utf-8', newline='').read()
old = "        slotRole: castSlotRole(actor, declared),"
new = "        slotRole: 'basic', // MUTANT: resume always reports basic"
assert src.count(old) == 1, 'site not unique'
open(path,'w',encoding='utf-8',newline='').write(src.replace(old,new))
mh = hashlib.sha256(open(path,'rb').read()).hexdigest()
run = subprocess.run(['npx','vitest','run','src/core/battle/turn/CombatAnimationRuntime.test.ts'],
    cwd=ROOT, capture_output=True, text=True, timeout=300, shell=True,
    encoding='utf-8', errors='replace')
killed = run.returncode != 0
src2 = open(path,encoding='utf-8',newline='').read()
open(path,'w',encoding='utf-8',newline='').write(src2.replace(new,old))
unchanged = hashlib.sha256(open(path,'rb').read()).hexdigest() == before
out = (run.stdout or '') + (run.stderr or '')
print(f"MUT-08: {'KILLED' if killed else 'SURVIVED'} (exit {run.returncode}) unchanged={unchanged}")
print(out[-1200:])
json.dump({'id':'MUT-08','inv':['I-ULT-SLOT-SELECT'],'file':'src/core/battle/turn/CombatAnimationRuntime.ts',
 'result':'KILLED_EXPECTED' if killed else 'SURVIVED','mutantHash':mh,'candidateUnchanged':unchanged},
 open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/mutation-round3-result.json','w'), indent=1)
