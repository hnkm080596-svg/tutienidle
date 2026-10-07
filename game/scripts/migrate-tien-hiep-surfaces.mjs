// Refuse before any source or manifest write. Historical implementation stays below.
throw new Error('Archived one-time surface migration; current scene compositions must not be rewritten by this script.');
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),source=path.join(root,'src/components');
const runtime='/assets/ui/tien-hiep-2026-10/runtime/';
const replacements={
 '/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png':runtime+'page-paper.png',
 '/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png':runtime+'ink-panel.png',
 '/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png':runtime+'orb-frame.png',
 '/assets/ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png':runtime+'orb-frame.png',
 '/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png':runtime+'ceremony-ribbon.png',
 '/assets/ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png':runtime+'ceremony-ribbon-red.png'
};
const changed=[];
async function visit(dir){for(const ent of await fs.readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,ent.name);if(ent.isDirectory()){await visit(file);continue;}
 if(!/\.(vue|ts)$/.test(file)||/\.test\.ts$/.test(file))continue;
 const before=await fs.readFile(file,'utf8');let after=before;
 for(const [old,newPath]of Object.entries(replacements))after=after.replaceAll(old,newPath);
 if(file.endsWith('characterUi.ts'))after=after.replace('resolveAssetUrl(`${root}paper-nine-slice.png`)','resolveAssetUrl("'+runtime+'page-paper.png")');
 if(before!==after){await fs.writeFile(file,after);changed.push(path.relative(root,file));}
}}
await visit(source);
await fs.writeFile(path.join(root,'docs/design/tien-hiep-ui-redesign-2026-10-05/MIGRATED-DIRECT-CONSUMERS.json'),JSON.stringify(changed,null,2));
console.log('Migrated '+changed.length+' direct chrome consumers.');
throw new Error('Archived one-time surface migration; current scene compositions must not be rewritten by this script.');
