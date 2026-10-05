from pathlib import Path
import zipfile, json, hashlib

raise SystemExit('Archived art-only delivery. Current implementation and runtime evidence are in REBUILD-EXECUTION.md and REBUILD-ACCEPTANCE.md.')
doc=Path(__file__).resolve().parent
worktree=doc.parents[3]
game=worktree/'game'
pack=game/'public/assets/ui/tien-hiep-2026-10'
names=['README.md','WIRING-PLAN.md','SCENE-SPECS.md','character-layout-reference.csv',
       'component-census.csv','existing-chrome-census.csv','ui-art-consumer-search.txt',
       'source-metrics.json','PACK-VALIDATION.json','IMAGEGEN-PROMPTS.md',
       'GENERATED-PROMPTS.json','WORLD-VISTA-PROMPT.md','preview.html','preview-server.mjs',
       'validate-pack.mjs','inspect_sources.py','build_manifest.py','census_imports.py']
files=[doc/n for n in names]+[pack/'pack.json']+sorted((pack/'source').glob('*.png'))
target=doc/'tien-hiep-ui-art-and-plan.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:
        z.write(p,p.relative_to(worktree).as_posix())
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if '/source/' in n and n.endswith('.png')])==23
report={'archive':target.name,'entries':len(files),'pngSources':23,
        'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'crc':'PASS','usage':'Overlay in matching repo/worktree. Preview reuses existing character and SVG assets from the repo.'}
(doc/'DELIVERY.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
