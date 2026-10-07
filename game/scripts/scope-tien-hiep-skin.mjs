// Refuse before any stylesheet write. Historical implementation stays below.
throw new Error('Archived one-time selector migration; current scoped styles must not be rewritten by this script.');
import fs from 'node:fs/promises';
import postcss from 'postcss';
const file='src/assets/tien-hiep-ui.css';
const root=postcss.parse(await fs.readFile(file,'utf8'));
root.walkRules(rule=>{
if(rule.selector===':root')return;
rule.selectors=rule.selectors.map(s=>s.startsWith('#app ')?s:'#app '+s);
});
await fs.writeFile(file,root.toString());
throw new Error('Archived one-time selector migration; current scoped styles must not be rewritten by this script.');
