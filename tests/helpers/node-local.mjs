// Test-only adapter: real file-backed SQLite, never a browser fallback.
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Repository} from '../../dist/local/repository.mjs';
export function localStores(){
 const directory=mkdtempSync(join(tmpdir(),'oka-client-tests-')),listeners=new Map(),opened=[];
 const open=async(room,actor)=>{const key=room+':'+actor,path=join(directory,room+'-'+actor+'.db'),db=new DatabaseSync(path);const repository=new Repository({exec(sql,bind=[]){if(bind.length)db.prepare(sql).run(...bind);else db.exec(sql);},query(sql,bind=[]){return db.prepare(sql).all(...bind);}},room,actor);let closed=false;const own=new Set();if(!listeners.has(key))listeners.set(key,new Set());
 const store={actor,room,path,repository,async call(method,...args){if(closed)throw new Error('closed');const result=repository[method](...args);if(!['read','prepare'].includes(method))for(const listener of listeners.get(key))queueMicrotask(listener);return result;},subscribe(listener){own.add(listener);listeners.get(key).add(listener);return()=>{own.delete(listener);listeners.get(key).delete(listener);};},async close(){if(closed)return;closed=true;for(const listener of own)listeners.get(key).delete(listener);db.close();}};opened.push(store);return store;};
 return {open,opened,directory};
}
export function lockManager(){
 const queues=new Map();
 const drain=name=>{const q=queues.get(name);if(q?.running||!q?.items.length)return;const item=q.items.shift();if(item.signal?.aborted){item.reject(new DOMException('aborted','AbortError'));drain(name);return;}q.running=true;queueMicrotask(async()=>{try{item.resolve(await item.callback());}catch(error){item.reject(error);}finally{q.running=false;drain(name);}});};
 return {request(name,options,callback){if(typeof options==='function'){callback=options;options={};}return new Promise((resolve,reject)=>{if(!queues.has(name))queues.set(name,{items:[],running:false});const item={resolve,reject,callback,signal:options?.signal};queues.get(name).items.push(item);options?.signal?.addEventListener('abort',()=>{const q=queues.get(name);const index=q.items.indexOf(item);if(index>=0){q.items.splice(index,1);reject(new DOMException('aborted','AbortError'));}},{once:true});drain(name);});}};
}
