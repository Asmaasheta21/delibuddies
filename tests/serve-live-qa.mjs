// Serves the exact dist assets. Only /__qa adds a Three.js devtools observer
// and an input driver; / remains the unmodified production entry point.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__qa-driver.js') {res.setHeader('Content-Type','text/javascript');res.end(await readFile('tests/live-driver.js'));return;}
    let file=path.resolve(root,'.'+(url.pathname==='/__qa'||url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    let data=await readFile(file);
    if(url.pathname==='/__qa')data=data.toString().replace('<head>','<head><script src="/__qa-driver.js"></script>');
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);
  }catch{res.writeHead(404).end();}
}).listen(4190,'127.0.0.1',()=>console.log('Production + QA: http://127.0.0.1:4190/__qa'));
