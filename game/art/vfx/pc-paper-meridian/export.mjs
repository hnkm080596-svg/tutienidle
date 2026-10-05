import fs from 'node:fs';
import { chromium } from '@playwright/test';
const dir='art/vfx/pc-paper-meridian';
const source=JSON.parse(fs.readFileSync(dir+'/Pc Paper Acupoint Aura.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5179/');
await page.waitForFunction(()=>window.AFX?.Atlas?.build && window.AFX?.Model?.loadEffectFile);
const result=await page.evaluate(async source=>{
 const doc=await new Promise(resolve=>AFX.Model.loadEffectFile(source,resolve));
 const built=AFX.Atlas.build(doc); const ctx=built.canvas.getContext('2d');
 const pixels=ctx.getImageData(0,0,built.canvas.width,built.canvas.height).data;
 let min=255,max=0,nonzero=0,edge=0;
 for(let y=0;y<built.canvas.height;y++)for(let x=0;x<built.canvas.width;x++){
 const a=pixels[(y*built.canvas.width+x)*4+3];min=Math.min(min,a);max=Math.max(max,a);if(a)nonzero++;
 if(a&&(x%128===0||x%128===127||y%128===0||y%128===127))edge++;
 }
 const poster=document.createElement('canvas');poster.width=128;poster.height=128;
 poster.getContext('2d').drawImage(built.canvas,3*128,0,128,128,0,0,128,128);
 return {sheet:built.canvas.toDataURL('image/png'),poster:poster.toDataURL('image/png'),meta:AFX.Atlas.metaJSON(doc,built.info),proof:{alphaMin:min,alphaMax:max,nonzeroPixels:nonzero,edgePixels:edge,width:built.canvas.width,height:built.canvas.height,frames:built.info.frames,fps:built.info.fps}};
},source);
for(const name of ['sheet','poster'])fs.writeFileSync(dir+'/acupoint-aura-'+name+'.png',Buffer.from(result[name].split(',')[1],'base64'));
fs.writeFileSync(dir+'/acupoint-aura-sheet.json',result.meta+'\n');
fs.writeFileSync(dir+'/export-proof.json',JSON.stringify({...result.proof,pageErrors:errors},null,2)+'\n');
console.log(result.proof,errors);await browser.close();
