import test from 'node:test';
import assert from 'node:assert/strict';
import {localStores,lockManager} from './helpers/node-local.mjs';
import {SyncEngine} from '../dist/local/sync.mjs';
const message={id:'server-1',client_message_id:'client-1',sender_id:'a',text:'hello',created_at:1,version:1,read:false,delivered:false,revoked:false};
const until=async check=>{const limit=Date.now()+2500;while(!check()){if(Date.now()>limit)throw new Error('sync condition timed out');await new Promise(resolve=>setTimeout(resolve,5));}};
class Socket {
 static sockets=[];
 constructor(){this.readyState=0;this.handlers=new Map();this.sent=[];Socket.sockets.push(this);queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});}
 addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
 emit(name,event){for(const fn of this.handlers.get(name)||[])fn(event);}
 event(value){this.emit('message',{data:JSON.stringify(value)});}
 send(json){const value=JSON.parse(json);this.sent.push(value);if(value.type==='auth')queueMicrotask(()=>this.event({type:'snapshot',revision:0,messages:[]}));}
 close(){this.readyState=3;this.emit('close',{});}
}
function environment(t){const old=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{value:{href:'http://localhost:4173/'},configurable:true});t.after(()=>old?Object.defineProperty(globalThis,'location',old):delete globalThis.location);}
test('receiver commits SQLite history before queuing its delivery acknowledgment',async t=>{environment(t);const stores=localStores(),store=await stores.open('room','b'),observer=await stores.open('room','b');t.after(async()=>{await store.close();await observer.close();});const calls=[];const original=store.call.bind(store);store.call=async(method,...args)=>{if(method==='enqueue'){const persisted=await observer.call('read');assert.equal(persisted.messages[0].text,'hello');calls.push(args[0]);}const result=await original(method,...args);calls.push(method);return result;};const engine=new SyncEngine({room_id:'room'},'b',store,{locks:lockManager(),Socket});t.after(()=>engine.close());await engine.receive({type:'snapshot',revision:1,messages:[message]});assert.ok(calls.indexOf('snapshot')<calls.indexOf('delivered'));assert.equal((await observer.call('read')).operations[0].payload.action,'delivered');});
test('one sync owner per account hands over and resends the exact durable operation after lost ack',async t=>{
 environment(t);Socket.sockets=[];const stores=localStores(),a=await stores.open('room','a'),b=await stores.open('room','a'),locks=lockManager();const options={locks,Socket,request:async()=>({token:'token'})};const room={room_id:'room',recovery_token:'secret'};const first=new SyncEngine(room,'a',a,options),second=new SyncEngine(room,'a',b,options);
 t.after(async()=>{await first.close();await second.close();await a.close();await b.close();});await first.start();await second.start();await until(()=>first.state.status==='Connected');assert.equal(Socket.sockets.length,1);
 await a.call('enqueue','send',{client_message_id:'client-1',text:'hello'},'operation');await until(()=>Socket.sockets[0].sent.some(c=>c.action==='send'));const wire=Socket.sockets[0].sent.find(c=>c.action==='send');const durable=(await b.call('read')).operations[0];assert.deepEqual(durable.wire,wire);
 await first.close();await until(()=>Socket.sockets.length===2&&Socket.sockets[1].sent.some(c=>c.action==='send'));assert.deepEqual(Socket.sockets[1].sent.find(c=>c.action==='send'),wire);
 Socket.sockets[1].event({type:'snapshot',revision:1,messages:[message]});Socket.sockets[1].event({type:'ack',id:'operation',message_id:'server-1',revision:1});await until(()=>b.repository.read().operations.length===0);assert.equal(b.repository.read().messages.length,1);
});
test('recipient storage failure never emits a delivery command',async t=>{environment(t);let receipts=0;const store={async call(method){if(method==='snapshot')throw new Error('quota exceeded');if(method==='enqueue')receipts++;},subscribe(){return()=>{};}};const engine=new SyncEngine({room_id:'room'},'b',store,{locks:lockManager(),Socket});t.after(()=>engine.close());await assert.rejects(engine.receive({type:'snapshot',revision:1,messages:[message]}),/quota/);assert.equal(receipts,0);});
test('expired server session preserves SQLite work as a local archive',async t=>{environment(t);const stores=localStores(),store=await stores.open('room','a');await store.call('enqueue','send',{text:'offline retained'},'one');const engine=new SyncEngine({room_id:'room'},'a',store,{locks:lockManager(),Socket,request:async()=>{const error=new Error('expired');error.status=401;throw error;}});t.after(async()=>{await engine.close();await store.close();});await engine.start();await until(()=>store.repository.read().expired);assert.equal(store.repository.read().messages[0].text,'offline retained');assert.equal(store.repository.read().operations.length,1);});

test('stalled WebSocket handshake retries with an explanation and keeps the local outbox',async t=>{
 environment(t);class SilentSocket extends Socket{send(json){this.sent.push(JSON.parse(json));}}
 const stores=localStores(),store=await stores.open('room','a');await store.call('enqueue','send',{text:'saved offline'},'queued');
 const engine=new SyncEngine({room_id:'room'},'a',store,{locks:lockManager(),Socket:SilentSocket,request:async()=>({token:'token'}),connectTimeout:20});
 t.after(async()=>{await engine.close();await store.close();});await engine.start();await until(()=>engine.state.status==='Waiting for connection');assert.match(engine.state.reason,/did not finish connecting/);assert.match(engine.state.reason,/saved on this device/);assert.equal(store.repository.read().operations.length,1);assert.ok(engine.retryTimer);
});
test('local snapshot failure pauses sync instead of repeatedly reconnecting',async t=>{
 environment(t);Socket.sockets=[];let signIns=0;const store={async call(method){if(method==='read')return {online:true};if(method==='snapshot')throw new Error('disk full');},subscribe(){return()=>{};}};
 const errors=[];const engine=new SyncEngine({room_id:'room'},'a',store,{locks:lockManager(),Socket,request:async()=>{signIns++;return {token:'token'};},onError:error=>errors.push(error)});
 t.after(()=>engine.close());await engine.start();await until(()=>engine.state.status==='Sync paused');assert.equal(engine.retryTimer,null);assert.equal(signIns,1);assert.deepEqual(errors,['disk full']);assert.match(engine.state.reason,/saved messages are retained/);
});
