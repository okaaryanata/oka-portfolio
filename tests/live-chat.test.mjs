import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const base=process.env.API_SMOKE_URL;
test('actual chat UI controllers exchange messages, edit, revoke, and recover through the frontend proxy',{skip:!base,timeout:20000},async t=>{
  const dom=new JSDOM(readFileSync(new URL('../dist/projects.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:4173/projects.html',pretendToBeVisual:true});
  const originals=new Map();
  const globals={window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,innerHeight:1000,WebSocket:dom.window.WebSocket,PORTFOLIO_API_BASE:base+'/api/v1',IntersectionObserver:class{observe(){}}};
  for(const [name,value]of Object.entries(globals)){originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
  t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();for(const[name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  const {mountChat}=await import('../dist/chat.mjs');
  const a=document.querySelector('[data-account="a"]'),b=document.querySelector('[data-account="b"]');
  for(const pane of [a,b])pane.querySelector('.chat-history').getBoundingClientRect=()=>({top:100,bottom:450});
  const until=async(predicate)=>{const deadline=Date.now()+5000;while(!predicate()){if(Date.now()>deadline)throw new Error('UI condition timed out: '+document.querySelector('#chat-status').textContent);await new Promise(resolve=>setTimeout(resolve,10));}};
  const send=(pane,text)=>{pane.querySelector('textarea').value=text;pane.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));};
  const action=(pane,text)=>{const button=[...pane.querySelectorAll('button')].find(node=>node.textContent===text);assert.ok(button,`missing action ${text}`);button.click();};
  mountChat(document.querySelector('#chat-app'));
  await until(()=>[...document.querySelectorAll('.chat-connection')].every(node=>node.textContent==='Connected'));
  send(a,'Hello from the real UI');await until(()=>b.querySelector('.chat-text')?.textContent==='Hello from the real UI');
  await until(()=>a.querySelector('.chat-meta')?.textContent.includes('Read'));
  send(b,'Reply from the real UI');await until(()=>a.querySelectorAll('.chat-text').length===2);
  action(a,'Edit');send(a,'Edited via the real UI');await until(()=>b.querySelector('.chat-text')?.textContent==='Edited via the real UI');
  action(a,'Star');await until(()=>a.querySelector('.chat-meta')?.textContent.includes('Starred'));assert.ok(!b.querySelector('.chat-meta').textContent.includes('Starred'));
  action(a,'Pin');await until(()=>b.querySelector('.chat-meta')?.textContent.includes('Pinned'));
  action(a,'Reconnect');await until(()=>a.querySelector('.chat-connection').textContent==='Connected');assert.equal(a.querySelectorAll('.chat-text').length,2);
  globalThis.confirm=()=>true;t.after(()=>delete globalThis.confirm);action(a,'Revoke for both');await until(()=>b.querySelector('.chat-text')?.textContent==='Message revoked');
  action(b,'Delete for me');await until(()=>b.querySelectorAll('.chat-text').length===1);assert.equal(a.querySelectorAll('.chat-text').length,2);
});
