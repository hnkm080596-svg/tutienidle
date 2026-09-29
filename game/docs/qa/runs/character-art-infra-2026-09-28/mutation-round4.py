"""MUT-09: remove the CR1-F1 dying gate in onTurnStandbyComplete - the standby
tail kills the corpse's fall tween again. Oracle: the two new dying tests in
CombatScene.combatAnimations.test.ts must fail."""
import hashlib, json, subprocess
ROOT = 'E:/tutienidle/.agent-worktrees/character-art-infra/game'
path = f"{ROOT}/src/game/scenes/combat/combat-action-feedback.ts"
before = hashlib.sha256(open(path,'rb').read()).hexdigest()
src = open(path, encoding='utf-8', newline='').read()
old = "      const dying =\r\n        event.actorId === PLAYER_ID\r\n          ? scene.playerDying\r\n          : scene.dyingIds.has(event.actorId)\r\n\r\n      if (!dying) {"
new = "      const dying = false // MUTANT: dying gate removed - standby tail kills corpse tweens again\r\n\r\n      if (!dying) {"
assert src.count(old) == 1, 'site not unique'
open(path,'w',encoding='utf-8',newline='').write(src.replace(old,new))
mh = hashlib.sha256(open(path,'rb').read()).hexdigest()
run = subprocess.run(['npx','vitest','run','src/game/scenes/CombatScene.combatAnimations.test.ts'],
    cwd=ROOT, capture_output=True, text=True, timeout=300, shell=True,
    encoding='utf-8', errors='replace')
killed = run.returncode != 0
src2 = open(path,encoding='utf-8',newline='').read()
open(path,'w',encoding='utf-8',newline='').write(src2.replace(new,old))
unchanged = hashlib.sha256(open(path,'rb').read()).hexdigest() == before
out = (run.stdout or '') + (run.stderr or '')
print(f"MUT-09: {'KILLED' if killed else 'SURVIVED'} (exit {run.returncode}) unchanged={unchanged}")
print(out[-1200:])
json.dump({'id':'MUT-09','inv':['I-CLIP-LIFECYCLE'],'file':'src/game/scenes/combat/combat-action-feedback.ts',
 'result':'KILLED_EXPECTED' if killed else 'SURVIVED','mutantHash':mh,'candidateUnchanged':unchanged},
 open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/mutation-round4-result.json','w'), indent=1)
