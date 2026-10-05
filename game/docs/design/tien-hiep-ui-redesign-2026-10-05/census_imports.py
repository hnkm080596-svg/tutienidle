from pathlib import Path
import csv,re
doc=Path(__file__).resolve().parent
game=doc.parents[2]
src=game/'src'
files={p.resolve() for p in src.rglob('*') if p.suffix in {'.vue','.ts','.js','.tsx'}}
pattern=re.compile(r'(?:from\s*|import\s*\(\s*|import\s*)[\'\"]([^\'\"]+)[\'\"]')
def resolve(parent,spec):
    if spec.startswith('@/'): base=src/spec[2:]
    elif spec.startswith('.'): base=parent/spec
    else: return None
    for p in [base,*[Path(str(base)+ext) for ext in ['.vue','.ts','.js','.tsx']],base/'index.ts',base/'index.js']:
        if p.resolve() in files:return p.resolve()
    return None
graph={p:[q for spec in pattern.findall(p.read_text(encoding='utf-8-sig')) if (q:=resolve(p.parent,spec))] for p in files}
seen=set();todo=[(src/'main.ts').resolve()]
while todo:
    p=todo.pop()
    if p in seen:continue
    seen.add(p);todo.extend(graph.get(p,[]))
path=doc/'component-census.csv'
with path.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
for row in rows:
    relative=row['component'].removeprefix('game/')
    row['module_import_reachability']='reachable-from-main' if (game/relative).resolve() in seen else 'not-found-by-literal-import-scan'
    row['reachability_limit']='module graph only; not proof of mounted route; dynamic nonliteral imports not resolved'
    row['art_decision']='use final shared pack; preserve content/character/world assets per handoff; consumer-specific placement in scene specs'
with path.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print(f'{len(rows)} Vue files; {sum(r["module_import_reachability"]=="reachable-from-main" for r in rows)} literal-import reachable')
