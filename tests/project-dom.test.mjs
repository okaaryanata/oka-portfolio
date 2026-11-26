import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as tick} from 'node:timers/promises';
import {JSDOM} from 'jsdom';
import {mountChat} from '../dist/chat.mjs';
import {mountSudoku} from '../dist/sudoku.mjs';
import {mountCats} from '../dist/cats.mjs';
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
class FakeSocket {
 static OPEN=1; static sockets=[];
 constructor(){this.readyState=0;this.events=new Map();this.sent=[];FakeSocket.sockets.push(this);queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});}
 addEventListener(name,handler){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(handler);}
 emit(name,event){for(const handler of this.events.get(name)||[])handler(event);}
 send(payload){const command=JSON.parse(payload);this.sent.push(command);if(command.type==='auth'){this.actor=command.token.at(-1);queueMicrotask(()=>this.snapshot([],0));}}
 snapshot(messages,revision){this.emit('message',{data:JSON.stringify({type:'snapshot',messages,revision})});}
 close(){this.readyState=3;this.emit('close',{code:1000});}
}
async function settle(){for(let i=0;i<5;i++)await tick();}
const message=(overrides={})=>({id:'message-1',sender_id:'a',client_message_id:'client-1',text:'hello',created_at:Date.now(),revoked:false,read:false,delivered:false,starred:false,pinned:false,...overrides});
test('both chat panes auto-login independently, render safely, send and retry after reconnect',async t=>{
 const win=environment(t);FakeSocket.sockets=[];globalThis.WebSocket=FakeSocket;
 globalThis.fetch=async(url,options)=>({ok:true,json:async()=>url.endsWith('/demos')?{room_id:'room',recovery_token:'test-secret'}:{token:'token-'+JSON.parse(options.body).account_id}});
 mountChat(document.querySelector('#chat-app'));await settle();
 assert.equal(FakeSocket.sockets.length,2);const a=FakeSocket.sockets.find(socket=>socket.actor==='a'),b=FakeSocket.sockets.find(socket=>socket.actor==='b');
 assert.ok(a&&b);assert.equal([...document.querySelectorAll('.chat-connection')].filter(node=>node.textContent==='Connected').length,2);
 const paneA=document.querySelector('[data-account="a"]'),paneB=document.querySelector('[data-account="b"]');
 paneA.querySelector('textarea').value='hello from A';paneA.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));
 const sent=a.sent.find(command=>command.action==='send');assert.equal(sent.text,'hello from A');assert.ok(sent.client_message_id);
 const incoming=message({text:'<img src=x onerror=alert(1)>',client_message_id:sent.client_message_id});a.snapshot([incoming],1);b.snapshot([incoming],1);
 assert.equal(paneB.querySelector('.chat-text').textContent,incoming.text);assert.equal(paneB.querySelector('.chat-history img'),null);assert.ok(b.sent.some(command=>command.action==='delivered'));
 paneA.querySelector('.chat-reconnect').click();await settle();const reconnected=FakeSocket.sockets.at(-1);assert.equal(reconnected.actor,'a');assert.ok(reconnected.sent.some(command=>command.client_message_id===sent.client_message_id));
 // Exactly one replacement connection; the old close must not schedule a second retry.
 assert.equal(FakeSocket.sockets.length,3);
 reconnected.emit('message',{data:JSON.stringify({type:'ack',id:sent.id,message_id:'message-1'})});
});
test('chat reply/edit/star/delete controls emit correctly scoped commands',async t=>{
 const win=environment(t);FakeSocket.sockets=[];globalThis.WebSocket=FakeSocket;globalThis.fetch=async(url,options)=>({ok:true,json:async()=>url.endsWith('/demos')?{room_id:'room',recovery_token:'test-secret'}:{token:'token-'+JSON.parse(options.body).account_id}});
 mountChat(document.querySelector('#chat-app'));await settle();const a=FakeSocket.sockets.find(socket=>socket.actor==='a');const pane=document.querySelector('[data-account="a"]');a.snapshot([message()],1);
 const button=text=>[...pane.querySelectorAll('button')].find(node=>node.textContent===text);
 button('Star').click();assert.ok(a.sent.some(command=>command.action==='star'&&command.enabled&&command.message_id==='message-1'));
 button('Edit').click();assert.equal(pane.querySelector('textarea').value,'hello');assert.equal(pane.querySelector('[type="submit"]').textContent,'Save edit');
 pane.querySelector('textarea').value='updated';pane.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));assert.ok(a.sent.some(command=>command.action==='edit'&&command.text==='updated'));
 button('Reply').click();pane.querySelector('textarea').value='reply';pane.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));assert.ok(a.sent.some(command=>command.action==='send'&&command.reply_to==='message-1'));
 button('Delete for me').click();assert.ok(a.sent.some(command=>command.action==='delete'&&command.message_id==='message-1'));
 a.snapshot([message({revoked:true,text:''})],2);assert.equal(pane.querySelector('.chat-text').textContent,'Message revoked');assert.equal(button('Edit'),undefined);
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
