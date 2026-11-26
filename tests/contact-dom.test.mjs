import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),script=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const source=script.slice(script.indexOf('const copyEmail ='),script.indexOf('// Keep off-screen cards'));
for(const theme of ['light','dark'])test(`email icon copies the address and announces feedback in ${theme} theme`,async()=>{
 const dom=new JSDOM(html);dom.window.document.documentElement.dataset.theme=theme;let copied;vm.runInNewContext(source,{document:dom.window.document,navigator:{clipboard:{async writeText(value){copied=value;}}}});const button=dom.window.document.querySelector('#copy-email');assert.equal(button.getAttribute('aria-label'),'Copy email address');button.click();await new Promise(setImmediate);assert.equal(copied,'okaaryanata@gmail.com');assert.equal(button.dataset.copied,'true');assert.equal(dom.window.document.querySelector('#copy-status').textContent,'Email address copied.');dom.window.close();
});
test('email copy failure keeps the address available and gives a manual fallback',async()=>{
 const dom=new JSDOM(html);vm.runInNewContext(source,{document:dom.window.document,navigator:{clipboard:{async writeText(){throw new Error('denied');}}}});dom.window.document.querySelector('#copy-email').click();await new Promise(setImmediate);assert.match(dom.window.document.querySelector('#copy-status').textContent,/Select and copy/);assert.equal(dom.window.document.querySelector('#copy-email').dataset.copied,'false');dom.window.close();
});
