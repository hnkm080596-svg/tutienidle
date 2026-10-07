import fs from 'node:fs';
const p=new URL('./preview.html',import.meta.url);let s=fs.readFileSync(p,'utf8');
s=s.replace('0,0,d,h);c.drawImage(im,r.x+cap,r.y,r.width-2*cap,r.height,d,0,w-2*d,h);c.drawImage(im,r.x+r.width-cap,r.y,cap,r.height,w-d,0,d,h)', '0,0,d+.5,h);c.drawImage(im,r.x+cap,r.y,r.width-2*cap,r.height,d-.5,0,w-2*d+1,h);c.drawImage(im,r.x+r.width-cap,r.y,cap,r.height,w-d-.5,0,d+.5,h)');
s=s.replace('.goldbutton{border:', '.goldbutton{flex-shrink:0;border:');
s=s.replace('PNG alpha · chữ/icon ghép riêng', 'PNG · chữ/icon ghép riêng');
fs.writeFileSync(p,s);
const audit=new URL('./AUDIT-AND-HANDOFF-PLAN.md',import.meta.url);
let a=fs.readFileSync(audit,'utf8');
if(!a.startsWith('> HISTORICAL'))fs.writeFileSync(audit,'> HISTORICAL AUDIT: draft/HOLD status superseded by README.md, WIRING-PLAN.md and PACK-VALIDATION.json. Preserved for provenance.\n\n'+a);
