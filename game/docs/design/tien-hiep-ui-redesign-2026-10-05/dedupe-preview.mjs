import fs from 'node:fs';
const p=new URL('./preview.html',import.meta.url);
const seen=new Set();
const s=fs.readFileSync(p,'utf8').split('\n').filter(line=>{
if(!line.startsWith('const settingsControl='))return true;
if(seen.has('settingsControl'))return false;
seen.add('settingsControl');return true;
}).join('\n');
fs.writeFileSync(p,s);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction(s.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
