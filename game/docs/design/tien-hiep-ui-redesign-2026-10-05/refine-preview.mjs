import fs from 'node:fs';
const p = new URL('./preview.html', import.meta.url);
let s = fs.readFileSync(p, 'utf8');
s = s.replace('.identity h2{', '.identity [data-art="slot-frame"]{width:80px;height:80px;margin:12px 0}.identity h2{');
s = s.replace("'Đồng Hành','Túi'", "'Cảnh Giới','Túi'");
s = s.replace("const section=t=>", `const settingsControl=n=>n==='Ngôn Ngữ'?'<select aria-label="Ngôn Ngữ"><option>Tiếng Việt</option><option>English</option></select>':n==='Tỷ Lệ UI'?'<select aria-label="Tỷ Lệ UI"><option>100%</option><option>125%</option><option>150%</option></select>':'<input type="range" aria-label="'+n+'" min="0" max="100" value="60">';\nconst section=t=>`);
s = s.replace(`<input type="range" aria-label="'+n+'" min="0" max="100" value="60"></span>')).join`, `'+settingsControl(n)+'</span>')).join`);
s = s.replace('.wheel img{width:', '.wheel img{filter:brightness(0) saturate(100%) invert(83%) sepia(30%) saturate(600%) hue-rotate(352deg);width:');
fs.writeFileSync(p, s);
