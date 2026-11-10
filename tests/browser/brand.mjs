import assert from 'node:assert/strict';
import {mkdtemp, cp, rm, readFile, writeFile, mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-brand-'));
await cp('examples/starter/design',path.join(root,'design'),{recursive:true});
// A genuinely immutable snapshot authored with the old restoration API.
const file=path.join(root,'design/pages/login.html');
const legacy=(await readFile(file,'utf8')).replace('</body>',`<script>
window.calls={oldExport:0,oldRestore:0,newExport:0,newRestore:0};
window.uxaiReviewState={exportState(){calls.oldExport++;return {source:'legacy'}},restoreState(s){calls.oldRestore++;window.restored=s}};
</script></body>`);
await writeFile(file,legacy);
const app=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:path.join(root,'design')}));
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(app.info().reviewUrl);
 await page.frameLocator('iframe').first().locator('#email').waitFor();
 assert.equal(await page.title(),'如意设计 · Ruyi Design');
 for(const asset of ['ruyi-mark.svg','ruyi-mark-mono.svg','ruyi-wordmark.svg']){
  const response=await page.request.get(new URL(asset,app.internalBase).href);assert.equal(response.status(),200);
 }
 await page.locator('.workspace-brand strong').waitFor();
 const frame=page.frames().find(f=>f.parentFrame());
 // Disable the new starter API to exercise the immutable legacy contract.
 await frame.evaluate(()=>{delete window.ruyiDesignReviewState;});
 async function exchange(type,payload,reply){
  return page.evaluate(({type,payload,reply})=>new Promise((resolve,reject)=>{
   const element=document.querySelector('iframe');
   const timer=setTimeout(()=>{removeEventListener('message',on);reject(new Error('bridge timeout '+type))},5000);
   function on(e){if(e.source===element.contentWindow&&e.data?.type===reply){clearTimeout(timer);removeEventListener('message',on);resolve(e.data.payload)}}
   addEventListener('message',on);
   element.contentWindow.postMessage({channel:'ruyi-design',version:1,frameId:element.name,type,payload},new URL(element.src).origin);
  }),{type,payload,reply});
 }
 const old=await exchange('capture',undefined,'captured');assert.deepEqual(old.custom,{source:'legacy'});
 assert.equal((await exchange('restore',old,'restored')).ok,true);
 assert.deepEqual(await frame.evaluate(()=>window.calls),{oldExport:1,oldRestore:1,newExport:0,newRestore:0});
 await frame.evaluate(()=>{window.ruyiDesignReviewState={exportState(){calls.newExport++;return {source:'new'}},restoreState(s){calls.newRestore++;window.restored=s}}});
 const current=await exchange('capture',undefined,'captured');assert.deepEqual(current.custom,{source:'new'});
 assert.equal((await exchange('restore',current,'restored')).ok,true);
 assert.deepEqual(await frame.evaluate(()=>window.calls),{oldExport:1,oldRestore:1,newExport:1,newRestore:1});
 await frame.evaluate(()=>{delete window.uxaiReviewState});
 await exchange('capture',undefined,'captured');await exchange('restore',current,'restored');
 assert.deepEqual(await frame.evaluate(()=>window.calls),{oldExport:1,oldRestore:1,newExport:2,newRestore:2});
 assert.equal(await readFile(file,'utf8'),legacy);
 // The intermediate candidate API has priority over the original API.
 await frame.evaluate(()=>{delete window.ruyiDesignReviewState;window.calls.previousExport=0;window.calls.previousRestore=0;
   window.ruyiUxaiReviewState={exportState(){calls.previousExport++;return {source:'previous'}},restoreState(){calls.previousRestore++}};
   window.uxaiReviewState={exportState(){calls.oldExport++;return {source:'original'}},restoreState(){calls.oldRestore++}};
 });
 const previous=await exchange('capture',undefined,'captured');assert.deepEqual(previous.custom,{source:'previous'});
 assert.equal((await exchange('restore',previous,'restored')).ok,true);
 assert.deepEqual(await frame.evaluate(()=>window.calls),{oldExport:1,oldRestore:1,newExport:2,newRestore:2,previousExport:1,previousRestore:1});
 await frame.evaluate(()=>{window.ruyiDesignReviewState={exportState(){calls.newExport++;return {source:'new'}},restoreState(){calls.newRestore++}}});
 await exchange('capture',undefined,'captured');await exchange('restore',current,'restored');
 assert.deepEqual(await frame.evaluate(()=>window.calls),{oldExport:1,oldRestore:1,newExport:3,newRestore:3,previousExport:1,previousRestore:1});
 // A stale branding key with an otherwise valid token remains usable on reload.
 for(const prefix of ['ruyi-uxai','uxai-review']){
  await page.evaluate(({sid,prefix})=>{const token=sessionStorage.getItem(`ruyi-design:${sid}:token`);for(const key of ['ruyi-design','ruyi-uxai','uxai-review'])sessionStorage.removeItem(`${key}:${sid}:token`);sessionStorage.setItem(`${prefix}:${sid}:token`,token)}, {sid:app.session.id,prefix});
  await page.reload();await page.frameLocator('iframe').first().locator('#email').waitFor();
  assert(await page.evaluate(sid=>!!sessionStorage.getItem(`ruyi-design:${sid}:token`),app.session.id));
 }
 function ratio(a,b){const lum=s=>{const c=s.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
 const colors=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);const resolve=name=>{const e=document.createElement('div');e.style.color=`var(${name})`;document.body.append(e);const v=getComputedStyle(e).color;e.remove();return v};return Object.fromEntries(['--color-text','--color-muted','--color-surface','--color-canvas','--color-primary','--control-border','--color-history-text','--color-history-bg','--color-wood'].map(k=>[k,resolve(k)]))});
 for(const text of ['--color-text','--color-muted','--color-wood'])for(const bg of ['--color-surface','--color-canvas'])assert(ratio(colors[text],colors[bg])>=4.5,`${text} contrast`);
 for(const bg of ['--color-surface','--color-canvas'])assert(ratio(colors['--control-border'],colors[bg])>=3,'control contrast');
 assert(ratio(colors['--color-primary'],colors['--color-surface'])>=4.5);
 assert(ratio(colors['--color-history-text'],colors['--color-history-bg'])>=4.5);
 await page.keyboard.press('Tab');assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Tab');assert.equal(await page.locator('#preview-toggle').evaluate(e=>e===document.activeElement),true);
 assert.equal(await page.locator('#preview-toggle').evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
 assert.equal(await page.locator('#preview-toggle').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 await mkdir('test-results/brand',{recursive:true});
 await page.screenshot({path:'test-results/brand/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.getByAltText('如意设计',{exact:true}).isVisible());
 assert.equal(await page.locator('iframe').getAttribute('width'),'1280');
 await page.getByLabel('设备',{exact:true}).selectOption('mobile');
 assert.equal(await page.locator('iframe').getAttribute('width'),'390');
 await page.screenshot({path:'test-results/brand/narrow.png',fullPage:true});
 const symbols=await browser.newPage({viewport:{width:720,height:240}});
 const mark=await readFile("src/browser/assets/ruyi-mark.svg","utf8"), mono=await readFile("src/browser/assets/ruyi-mark-mono.svg","utf8");
 await symbols.setContent(`<body style="margin:32px;font:14px system-ui;color:#263c32;background:#f7f5ef"><p>如意设计 · 符号 / 单色 / 小尺寸</p><div style="display:flex;gap:36px;align-items:center">${[16,24,40,64].map(size=>`<div style="width:${size}px">${mark}<p>${size}px</p></div>`).join("")}<div style="width:40px;color:#000">${mono}<p>Mono</p></div></div></body>`);
 await symbols.screenshot({path:"test-results/brand/marks.png"});await symbols.close();
 assert.deepEqual(errors,[]);
 console.log('Brand browser passed: SVG, legacy/new/priority restoration exactly once, immutable source, token fallback, contrast, keyboard, reduced motion, desktop/narrow, logical device isolation.');
}finally{await browser.close();await app.close();await rm(root,{recursive:true,force:true})}
