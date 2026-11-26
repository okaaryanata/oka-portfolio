// Static frontend development server with a same-origin API proxy.
import http from 'node:http';
import net from 'node:net';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root=resolve(new URL('../dist/',import.meta.url).pathname);
const backend=new URL(process.env.API_PROXY_TARGET || 'http://127.0.0.1:8081');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.gif':'image/gif','.pdf':'application/pdf'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) {
    const proxy=http.request({hostname:backend.hostname,port:backend.port||80,path:req.url,method:req.method,headers:{...req.headers,host:backend.host}}, upstream=>{
      res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);
      upstream.on('error',()=>res.destroy());
    });
    proxy.setTimeout(20000,()=>proxy.destroy(new Error('API timeout')));
    proxy.on('error',()=>{if(res.headersSent){res.destroy();return;}res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'API unavailable. Run the Go backend on port 8081.'}}));});
    req.on('aborted',()=>proxy.destroy());req.pipe(proxy);return;
  }
  try {
    const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.on('upgrade',(req,client,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/api/v1/chat/ws'){client.destroy();return;}
  const upstream=net.connect(Number(backend.port||80),backend.hostname,()=>{
    const headers={...req.headers,host:backend.host};
    const lines=[`${req.method} ${req.url} HTTP/1.1`,...Object.entries(headers).map(([key,value])=>`${key}: ${value}`),'',''];
    upstream.write(lines.join('\r\n'));if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);
  });
  upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy());
});
server.on('error',error=>{console.error(`Cannot start portfolio server: ${error.message}`);process.exitCode=1;});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Portfolio: http://127.0.0.1:${process.env.PORT||4173} (API proxy: ${backend.origin})`));
