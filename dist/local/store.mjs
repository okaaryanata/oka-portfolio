export class BrowserStore {
 constructor(room,actor){this.key=`${room}:${actor}`;this.worker=new Worker(new URL('./sqlite-worker.mjs',import.meta.url),{type:'module'});this.requests=new Map();this.id=0;this.channel=new BroadcastChannel('oka-local-db:'+this.key);this.listeners=new Set();
  this.worker.onmessage=({data})=>{const request=this.requests.get(data.id);if(!request)return;this.requests.delete(data.id);data.error?request.reject(new Error(data.error)):request.resolve(data.value);};
  this.worker.onerror=()=>{for(const request of this.requests.values())request.reject(new Error('Local SQLite worker failed. Your message was not sent.'));this.requests.clear();};
  this.channel.onmessage=()=>this.notify();
 }
 async open(room,actor){return this.call('init',room,actor);}
 async call(method,...args){const value=await new Promise((resolve,reject)=>{const id=++this.id;this.requests.set(id,{resolve,reject});this.worker.postMessage({id,method,args});});if(!['read','init','close','prepare'].includes(method)){this.channel.postMessage('changed');this.notify();}return value;}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 notify(){for(const listener of this.listeners)listener();}
 async close(){try{await this.call('close');}finally{this.worker.terminate();this.channel.close();for(const request of this.requests.values())request.reject(new Error('Local database closed.'));this.requests.clear();}}
}
export async function openBrowserStore(room,actor){const store=new BrowserStore(room,actor);try{await store.open(room,actor);return store;}catch(error){store.worker.terminate();store.channel.close();throw error;}}
