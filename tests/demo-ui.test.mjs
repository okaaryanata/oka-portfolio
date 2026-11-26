import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {findPath,queenSteps,createSlot} from '../dist/algorithms.mjs';
const text=readFileSync(new URL('../dist/projects.mjs',import.meta.url),'utf8');
function setup(){
 const nodes=new Map(),pending=[];
 const create=()=>({style:{},children:[],attributes:{},value:'',valueAsNumber:0,textContent:'',disabled:false,append(child){this.children.push(child);},replaceChildren(...children){this.children=children;},setAttribute(k,v){this.attributes[k]=v;},addEventListener(event,handler){this[event]=handler;}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);};
 get('size').value='8';get('tool').value='wall';get('delay-a').valueAsNumber=300;get('delay-b').valueAsNumber=100;
 vm.runInNewContext(text.slice(text.indexOf('const byId'),text.indexOf('// Match anchor offsets')),{document:{getElementById:get,createElement:create},matchMedia:()=>({matches:false}),findPath,queenSteps,createSlot,setTimeout:resolve=>pending.push(resolve)});
 return {get,pending};
}
test('editing a maze cancels an in-progress search without stale completion',async()=>{
 const {get,pending}=setup();const searching=get('compare').click();assert.equal(get('compare').disabled,true);
 get('clear').click();while(pending.length){pending.shift()();await new Promise(setImmediate);}await searching;
 assert.equal(get('compare').disabled,false);assert.equal(get('maze-result').textContent,'Walls cleared.');
});
test('booking reset cancels both outstanding claims',async()=>{
 const {get,pending}=setup();const race=get('booking-form').submit({preventDefault(){}});get('reset-race').click();
 while(pending.length){pending.shift()();await new Promise(setImmediate);}await race;
 assert.equal(get('booking-results').children.length,0);assert.equal(get('slot-state').textContent,'Available');assert.equal(get('race').disabled,false);
});
test('booking confirms the first arriving customer and rejects the other',async()=>{
 const {get,pending}=setup();const race=get('booking-form').submit({preventDefault(){}});
 // Customer B's timer fires first.
 pending.pop()();await new Promise(setImmediate);pending.shift()();await race;
 const results=get('booking-results').children.map(item=>item.textContent);
 assert.match(results[0],/Customer B: confirmed/);assert.match(results[1],/Customer A: conflict/);assert.equal(get('race').disabled,false);
});
