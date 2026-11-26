import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('const siteHeader =')[0];
function setup(fetch){
 const nodes=new Map();
 const create=()=>({textContent:'',disabled:false,attributes:{},children:[],replaceChildren(...children){this.children=children;},addEventListener(event,handler){this[event]=handler;},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);};
 vm.runInNewContext(source,{document:{querySelector:node,createElement:create},window:{},fetch,AbortSignal,URL,Image:class{decode(){return Promise.resolve();}}});
 return node;
}
test('cat provider errors preserve the still image and re-enable retry controls',async()=>{
 const node=setup(async()=>{throw new Error('offline');});
 await node('#cat-next').click();assert.equal(node('#cat-play').disabled,false);assert.equal(node('#cat-next').disabled,false);assert.match(node('#cat-status').textContent,/Could not load/);
});
