import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {setImmediate as tick} from 'node:timers/promises';
import {readFileSync} from 'node:fs';
import {queenSteps} from '../dist/algorithms.mjs';
const source=readFileSync(new URL('../dist/projects.mjs',import.meta.url),'utf8');
function setup(){
 const elements=new Map();
 const create=()=>({style:{},attributes:{},children:[],textContent:'',disabled:false,value:'8',setAttribute(key,value){this.attributes[key]=value;},replaceChildren(...children){this.children=children;this.replacements=(this.replacements||0)+1;},addEventListener(event,fn){this[event]=fn;}});
 const byId=id=>{if(!elements.has(id))elements.set(id,create());return elements.get(id);};
 const pending=[];
 const context=vm.createContext({byId,document:{createElement:create},queenSteps,reduced:{matches:false},delay:()=>new Promise(resolve=>pending.push(resolve))});
 vm.runInContext(source.slice(source.indexOf('let queensRun'),source.indexOf('let bookingRun')),context);
 return {byId,pending};
}
test('8-Queens animation preserves 64 squares and equal fixed tracks through completion',async()=>{
 const {byId,pending}=setup();const board=byId('queens'),squares=[...board.children];
 const solving=byId('solve-queens').click();
 assert.equal(byId('solve-queens').disabled,true);
 let frames=0;
 while(pending.length){pending.shift()();await tick();frames++;assert.equal(board.children.length,64);assert.deepEqual(board.children,squares);assert.equal(board.style.gridTemplateRows,'repeat(8, minmax(0, 1fr))');}
 await solving;
 assert.ok(frames>100);assert.equal(board.replacements,1);assert.equal(board.children.filter(cell=>cell.textContent==='♛').length,8);
 assert.match(byId('queens-result').textContent,/Solution found/);assert.equal(byId('solve-queens').disabled,false);assert.equal(board.attributes['aria-busy'],'false');
});
test('changing size cancels a running 8-Queens solve without stale writes',async()=>{
 const {byId,pending}=setup();const solving=byId('solve-queens').click();byId('size').value='4';byId('size').change();
 while(pending.length){pending.shift()();await tick();}await solving;
 assert.equal(byId('queens').children.length,16);assert.equal(byId('solve-queens').disabled,false);assert.match(byId('queens-result').textContent,/Choose a board/);
});
test('reset cancels animation and leaves an empty board',async()=>{
 const {byId,pending}=setup();const solving=byId('solve-queens').click();byId('reset-queens').click();
 while(pending.length){pending.shift()();await tick();}await solving;
 assert.ok(byId('queens').children.every(cell=>!cell.textContent));assert.equal(byId('solve-queens').disabled,false);
});
