import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const sharp=(await import(process.env.TIEN_HIEP_SHARP_PACKAGE ? pathToFileURL(process.env.TIEN_HIEP_SHARP_PACKAGE).href : 'sharp')).default;
const root=process.cwd(),out=path.join(root,'public/assets/ui/tien-hiep-2026-10/runtime');
const pack=JSON.parse(await fs.readFile(path.join(root,'public/assets/ui/tien-hiep-2026-10/pack.json'),'utf8'));
const manifestFile=path.join(root,'src/ui/huyen-kim-chrome.json');
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
const assets=Object.fromEntries(pack.assets.map(a=>[a.id,a]));
if(!manifest.assets.some(a=>a.id==='button-danger'))manifest.assets.push({...manifest.assets.find(a=>a.id==='button-standard'),id:'button-danger',role:'destructive action'});
await fs.mkdir(out,{recursive:true});
const cropped=async(id,w,h)=>{const a=assets[id],r=a.sourceRect;return sharp(path.join(root,'public',a.url)).extract({left:r.x,top:r.y,width:r.width,height:r.height}).resize(w,h,{fit:'fill'}).png().toBuffer()};
for(const a of manifest.assets){
 const id=a.id==='button-danger'?'ceremony-ribbon-red':pack.legacyMapping[a.id];
 if(!id){
 if(pack.suppressed.includes(a.id)){
 for(const density of [1,2])await fs.writeFile(path.join(out,a.id+'@'+density+'x.png'),await sharp({create:{width:8*density,height:8*density,channels:4,background:'#0000'}}).png().toBuffer());
 Object.assign(a,{url1x:'/assets/ui/tien-hiep-2026-10/runtime/'+a.id+'@1x.png',url2x:'/assets/ui/tien-hiep-2026-10/runtime/'+a.id+'@2x.png',sourceWidth:8,sourceHeight:8,slices:{left:1,right:1,top:1,bottom:1},tintable:false,center:'transparent'});
 }
 continue;
 }
 const art=assets[id],w=a.sourceWidth,h=a.sourceHeight;
 for(const density of [1,2])await fs.writeFile(path.join(out,a.id+'@'+density+'x.png'),await cropped(id,w*density,h*density));
 a.url1x='/assets/ui/tien-hiep-2026-10/runtime/'+a.id+'@1x.png';
 a.url2x='/assets/ui/tien-hiep-2026-10/runtime/'+a.id+'@2x.png';
 a.status='ready';a.tintable=false;a.edgeMode='stretch';
 if(art.render==='nine-slice-source-rect'){
 a.slices={left:Math.round(art.slices.left/art.sourceRect.width*w),right:Math.round(art.slices.right/art.sourceRect.width*w),top:Math.round(art.slices.top/art.sourceRect.height*h),bottom:Math.round(art.slices.bottom/art.sourceRect.height*h)};
 a.center=art.center;
 }else if(art.render==='three-slice-source-rect'){
 a.slices={left:Math.round(w*art.capFraction),right:Math.round(w*art.capFraction),top:0,bottom:0};a.center='fill';
 }else{a.slices={left:Math.round(w*.25),right:Math.round(w*.25),top:Math.round(h*.25),bottom:Math.round(h*.25)};a.center=art.center==='transparent'?'transparent':'fill';}
}
manifest.note='Tien Hiep UI skin, derived reproducibly from preserved source/pack.json by scripts/build-tien-hiep-ui.mjs. Source dimensions describe @1x; @2x exactly doubles them.';
await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
for(const id of pack.suppressed){const a=manifest.assets.find(a=>a.id===id);if(a)await fs.writeFile(path.join(out,id+'.png'),await sharp({create:{width:8,height:8,channels:4,background:'#0000'}}).png().toBuffer());}
for(const id of ['panel-frame-v2','orb-frame','navigation-rail','title-plaque','section-header','power-ribbon','slot-frame','building-plaque','button-primary','button-secondary','ceremony-ribbon','ceremony-ribbon-red']){
 const a=assets[id];await fs.writeFile(path.join(out,id+'.png'),await cropped(id,a.sourceRect.width,a.sourceRect.height));
}
await fs.writeFile(path.join(out,'paper-surface.png'),await cropped('paper-surface',512,384));
// Filled exports preserve the authored silhouette and exterior alpha.
// Never composite a rectangular surface behind a transparent frame.
const source=path.join(root,'public/assets/ui/tien-hiep-2026-10/source');
for(const id of ['page-paper','paper-panel'])await sharp(path.join(source,'paper-panel-cutout-v3.png')).resize(1200,900,{fit:'fill'}).png().toFile(path.join(out,id+'.png'));
await sharp(path.join(source,'ink-panel-cutout-v3.png')).resize(1200,900,{fit:'fill'}).png().toFile(path.join(out,'ink-panel.png'));
console.log('Built runtime chrome densities and shared scene art; source pixels preserved.');
