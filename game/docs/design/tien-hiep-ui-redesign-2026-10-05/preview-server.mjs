import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const pub=path.resolve(dir,'../../../public');
const mime={'.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.html':'text/html; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const pathname=decodeURIComponent(url.pathname);
  let target;
  if(pathname==='/'||pathname==='/preview.html')target=path.join(dir,'preview.html');
  else if(pathname.startsWith('/assets/')&&['.png','.svg','.json'].includes(path.extname(pathname))) {
   target=path.resolve(pub,'.'+pathname);
   if(!target.startsWith(pub+path.sep))throw Error('path');
  } else {res.writeHead(404);res.end();return;}
  const bytes=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)],'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log('UI art preview: http://127.0.0.1:'+server.address().port));
