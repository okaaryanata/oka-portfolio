import sqlite3InitModule from '../vendor/sqlite/index.mjs';
import {Repository} from './repository.mjs';
let repository,db,lockName,queue=Promise.resolve();
async function execute(method,args){
 if(method==='init') {
  const [room,actor]=args;
  if(!/^[a-f0-9]{64}$/.test(room)||!['a','b'].includes(actor))throw new Error('Invalid local account identity.');
  if(!self.crossOriginIsolated||!navigator.storage?.getDirectory||!navigator.locks)throw new Error('Persistent SQLite requires a supported browser and cross-origin isolation.');
  lockName=`oka-local-db:${room}:${actor}`;
  return navigator.locks.request(lockName,async()=>{
   const sqlite3=await sqlite3InitModule({locateFile:file=>new URL('../vendor/sqlite/'+file,import.meta.url).href});
   if(!sqlite3.oo1.OpfsDb)throw new Error('Persistent SQLite OPFS is unavailable in this browser.');
   db=new sqlite3.oo1.OpfsDb(`/oka-chat-${room}-${actor}.sqlite3`);
   const adapter={exec:(sql,bind=[])=>db.exec({sql,bind}),query:(sql,bind=[])=>db.exec({sql,bind,rowMode:'object',returnValue:'resultRows'})};
   repository=new Repository(adapter,room,actor);return repository.read();
  });
 }
 if(!repository)throw new Error('Local SQLite has not opened.');
 return navigator.locks.request(lockName,()=>{
  if(method==='close'){db.close();return null;}
  if(!['read','enqueue','snapshot','acknowledge','reject','prepare','update','discard','retry'].includes(method))throw new Error('Invalid database method.');
  return repository[method](...args);
 });
}
self.onmessage=({data})=>{queue=queue.then(async()=>{try{const value=await execute(data.method,data.args||[]);self.postMessage({id:data.id,value});}catch(error){self.postMessage({id:data.id,error:error.message});}});};
