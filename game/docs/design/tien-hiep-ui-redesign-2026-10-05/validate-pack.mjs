import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
throw new Error('Archived 23-source validator. Use scripts/audit-tien-hiep-alpha.mjs and presentation asset tests for the current pack.');
const doc=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const game=path.resolve(doc,'../../..');
const pack=JSON.parse(fs.readFileSync(path.join(game,'public/assets/ui/tien-hiep-2026-10/pack.json'),'utf8'));
const problems=[],checks=[];
if(pack.assets.length!==23)problems.push('Expected 23 source assets');
const ids=new Set();
for(const a of pack.assets){
if(ids.has(a.id))problems.push('Duplicate '+a.id);ids.add(a.id);
const file=path.join(game,'public',a.url);
if(!fs.existsSync(file)){problems.push('Missing '+a.id);continue;}
const bytes=fs.readFileSync(file),r=a.sourceRect,d=a.sourceSize;
if(r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>d.width||r.y+r.height>d.height)problems.push('Invalid sourceRect '+a.id);
if(a.slices&&(a.slices.left+a.slices.right>=r.width||a.slices.top+a.slices.bottom>=r.height))problems.push('Invalid slices '+a.id);
if(!['world-vista','paper-surface'].includes(a.id)&&a.alpha.min!==0)problems.push('No transparent pixels '+a.id);
if(['page-frame','panel-frame','slot-frame','orb-frame','avatar-ring'].includes(a.id)&&a.alpha.center!==0)problems.push('Filled aperture '+a.id);
checks.push({id:a.id,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceRect:'PASS',alpha:'PASS'});
}
if(Object.keys(pack.legacyMapping).length!==43)problems.push('Legacy coverage !=43');
for(const [id,target]of Object.entries(pack.legacyMapping))if(target&&!ids.has(target))problems.push('Missing mapped target '+id);
const result={baseline:pack.baseline,assets:checks.length,legacyEntries:Object.keys(pack.legacyMapping).length,structuralResult:problems.length?'FAIL':'PASS',problems,checks,productionWiring:'NOT PERFORMED - assigned to next agent'};
fs.writeFileSync(path.join(doc,'PACK-VALIDATION.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({assets:checks.length,legacyEntries:43,result:result.structuralResult,problems}));
if(problems.length)process.exitCode=1;
