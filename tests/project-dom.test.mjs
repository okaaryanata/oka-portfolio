import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as tick} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import {mountChat} from '../dist/chat.mjs';
import {mountSudoku} from '../dist/sudoku.mjs';
import {mountCats} from '../dist/cats.mjs';
import {localStores} from './helpers/node-local.mjs';
const html=readFileSync(new URL('../dist/projects.html',import.meta.url),'utf8');
function environment(t){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:4173/projects.html',pretendToBeVisual:true});
 const saved=new Map();
 for(const [name,value] of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,innerHeight:1000,IntersectionObserver:class{observe(){} disconnect(){}}})){
  saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
 }
 const fetchDescriptor=Object.getOwnPropertyDescriptor(globalThis,'fetch'),wsDescriptor=Object.getOwnPropertyDescriptor(globalThis,'WebSocket');
 t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}Object.defineProperty(globalThis,'fetch',fetchDescriptor);Object.defineProperty(globalThis,'WebSocket',wsDescriptor);});
 return dom.window;
}
async function settle(){for(let i=0;i<8;i++)await tick();}
async function chat(t){
 const win=environment(t),stores=localStores();globalThis.fetch=async()=>({ok:true,json:async()=>({room_id:'room',recovery_token:'secret'})});
 const createSync=(room,actor,store,callbacks)=>{let unsubscribe;let status;const notify=async()=>{const local=await store.call('read');const next=local.expired?'Expired — local archive':local.online?'Connected':'Offline';if(next!==status){status=next;callbacks.onState({status,presence:next==='Connected'?{a:true,b:true}:null,typing:false});}};return {async start(){unsubscribe=store.subscribe(notify);await notify();},typing(){},reconnect:notify,async close(){unsubscribe?.();}};};
 const controller=mountChat(document.querySelector('#chat-app'),{openStore:stores.open,createSync});await controller.ready;await settle();t.after(()=>controller.close());return {win,stores,controller,a:document.querySelector('[data-account="a"]'),b:document.querySelector('[data-account="b"]')};
}
const message=(values={})=>({id:'server-1',client_message_id:'client-1',sender_id:'a',text:'hello',version:1,created_at:1,revoked:false,delivered:false,read:false,starred:false,pinned:false,...values});
test('chat initially renders persisted conversation lists and queues offline sends before clearing text',async t=>{
 const {a,stores,win}=await chat(t);assert.equal(a.querySelector('.chat-detail').hidden,true);a.querySelector('.chat-online-toggle').click();await settle();a.querySelector('.chat-open-conversation').click();assert.equal(a.querySelector('textarea').disabled,false);a.querySelector('textarea').value='offline message';a.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));await settle();const state=await stores.opened.find(s=>s.actor==='a').call('read');assert.equal(state.messages[0].text,'offline message');assert.equal(state.operations[0].payload.text,'offline message');assert.equal(a.querySelector('textarea').value,'');assert.match(a.querySelector('.chat-meta').textContent,/Queued/);
});
test('list does not mark received messages read until detail is visible',async t=>{
 const {b,stores}=await chat(t),store=stores.opened.find(s=>s.actor==='b');b.querySelector('.chat-history').getBoundingClientRect=()=>({top:100,bottom:400});await store.call('snapshot',{revision:1,messages:[message()]});await settle();assert.equal(b.querySelector('.chat-unread-dot').hidden,false);assert.equal((await store.call('read')).operations.length,0);b.querySelector('.chat-open-conversation').click();await settle();assert.equal((await store.call('read')).operations[0].payload.action,'read');assert.equal(b.querySelector('.chat-unread-dot').hidden,true);
});
test('SQLite snapshots update edited/revoked previews while personal delete stays local',async t=>{
 const {b,stores}=await chat(t),store=stores.opened.find(s=>s.actor==='b');await store.call('snapshot',{revision:1,messages:[message()]});await settle();assert.equal(b.querySelector('.chat-conversation-preview').textContent,'hello');await store.call('snapshot',{revision:2,messages:[message({text:'edited',version:2})]});await settle();assert.equal(b.querySelector('.chat-conversation-preview').textContent,'edited');await store.call('snapshot',{revision:3,messages:[message({text:'',revoked:true,version:3})]});await settle();assert.equal(b.querySelector('.chat-conversation-preview').textContent,'Message revoked');await store.call('enqueue','delete',{message_id:'server-1'},'delete');await settle();assert.equal(b.querySelector('.chat-conversation-preview').textContent,'No messages yet');
});
test('failed edits retain attempted text and expose explicit review actions',async t=>{
 const {a,stores}=await chat(t),store=stores.opened.find(s=>s.actor==='a');await store.call('snapshot',{revision:1,messages:[message()]});await store.call('enqueue','edit',{message_id:'local:client-1',text:'my edit'},'edit');await store.call('snapshot',{revision:2,messages:[message({text:'other edit',version:2})]});await store.call('reject',{id:'edit',code:'version_conflict',message:'message changed'});await settle();assert.match(a.querySelector('.chat-failures').textContent,/my edit/);assert.match(a.querySelector('.chat-failures').textContent,/Retry with current version/);assert.equal(a.querySelector('.chat-text').textContent,'other edit');
});
test('Sudoku DOM rejects duplicate clues, recovers after an API failure, and clears',async t=>{
 const win=environment(t);let requests=0;globalThis.fetch=async()=>{requests++;return {ok:false,status:422,json:async()=>({error:{message:'no solution'}})}};
 const root=document.querySelector('#sudoku-app');mountSudoku(root);const cells=[...root.querySelectorAll('input')];assert.equal(cells.length,81);cells[2].value='5';root.querySelector('[data-action="solve"]').click();assert.match(root.querySelector('[role="status"]').textContent,/duplicate/);assert.equal(requests,0);
 root.querySelector('[data-action="sample"]').click();root.querySelector('[data-action="solve"]').click();await settle();assert.equal(requests,1);assert.equal(root.querySelector('[data-action="solve"]').disabled,false);assert.match(root.querySelector('[role="status"]').textContent,/no solution/);
 root.querySelector('[data-action="clear"]').click();assert.ok(cells.every(cell=>cell.value===''));assert.equal(cells[0].getAttribute('aria-label'),'Row 1, column 1');
});
test('Cat viewer stop cancels an in-flight request and restores controls',async t=>{
 environment(t);globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError'))));const root=document.querySelector('#cats-app');mountCats(root);root.querySelector('[data-action="load"]').click();assert.equal(root.querySelector('[data-action="load"]').disabled,true);root.querySelector('[data-action="stop"]').click();await settle();assert.equal(root.querySelector('[data-action="load"]').disabled,false);assert.equal(root.querySelector('[role="status"]').textContent,'Animation stopped.');
});
test('navigation warns while a send is waiting for its local commit',async t=>{
 const {a,stores,win}=await chat(t),store=stores.opened.find(s=>s.actor==='a');a.querySelector('.chat-open-conversation').click();const original=store.call.bind(store);let finish;store.call=(method,...args)=>method==='enqueue'?new Promise(resolve=>finish=async()=>resolve(await original(method,...args))):original(method,...args);
 a.querySelector('textarea').value='do not lose this';a.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));const unloading=new win.Event('beforeunload',{cancelable:true});win.dispatchEvent(unloading);assert.equal(unloading.defaultPrevented,true);await finish();await settle();const safe=new win.Event('beforeunload',{cancelable:true});win.dispatchEvent(safe);assert.equal(safe.defaultPrevented,false);assert.equal((await original('read')).messages[0].text,'do not lose this');
});
