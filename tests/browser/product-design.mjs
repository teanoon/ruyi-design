import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
import {combinations} from '../../dist/contracts/catalog.js';
const data=await mkdtemp(path.join(os.tmpdir(),'ruyi-product-design-'));
const server=await ReviewServer.start(startSchema.parse({projectRoot:process.cwd(),designRoot:path.resolve('design'),dataRoot:data}));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
 const rev=server.session.active();
 const url=(state='default')=>`${server.internalPreviewBase}/r/${rev.id}/pages/workbench.html?state=${state}`;
 assert.deepEqual(rev.manifest.pages.map(p=>p.id),['workbench']);
 await mkdir('test-results/product-design',{recursive:true});
 for(const combo of combinations(rev.manifest)){
  const device=rev.manifest.devices.find(d=>d.id===combo.deviceId);await page.setViewportSize({width:device.width,height:device.height});
  const entry=new URL(`/r/${rev.id}/${combo.entry.path}`,server.internalPreviewBase);for(const [key,value] of Object.entries(combo.entry.query))entry.searchParams.set(key,value);
  await page.goto(entry.href,{waitUntil:'networkidle'});assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${combo.objectId}/${combo.stateId||combo.exampleId}/${combo.deviceId}`);
  assert(await page.locator('h1').count(),`Empty entry ${entry}`);
 }
 for(const [width,id] of [[1280,'desktop'],[390,'mobile']]){
  await page.setViewportSize({width,height:900});await page.goto(url(),{waitUntil:'networkidle'});
  assert.equal(await page.locator('.sidebar-bottom,.next-step,.avatar').count(),0);
  assert.equal(await page.getByRole('link',{name:'全部评论',exact:true}).count(),0);
  const nav=await page.locator('.sidebar').boundingBox(),brand=await page.locator('.workspace-brand').boundingBox();
  assert(Math.abs(nav.y+nav.height-brand.y-brand.height-(width<760?20:25))<6);
  assert.equal(await page.locator('.topbar,.project-name,.project-label').count(),0);
  assert.equal(await page.locator('.sidebar .workspace-brand').count(),1);
  const connection=await page.locator('.sidebar-footer .connection-status').boundingBox();
  assert.equal(await page.locator('.sidebar-footer .badge').count(),0);
  assert.equal(await page.locator('[data-review-id="preview-toggle"] .preview-version').textContent(),'03');
  assert(Math.abs(connection.x-brand.x)<2,'Connection and brand have the same left edge');
  assert(Math.abs(connection.x+connection.width-brand.x-brand.width)<2,'Footer rows have the same right edge');
  assert(connection.x>=nav.x && connection.x+connection.width<=nav.x+nav.width);
  const mark=await page.locator('.workspace-brand img').boundingBox(),name=await page.locator('.workspace-brand-name').boundingBox();
  assert(name.x>mark.x+mark.width);assert(name.y<mark.y+mark.height);
  assert.equal(await page.locator('.keyboard-help,details').count(),0);assert(await page.locator('#shortcut-help').getAttribute('class').then(c=>c.includes('sr-only')));
  assert.equal(await page.locator('.sidebar').getByText('山野拾光',{exact:false}).count(),0);
  await page.getByRole('button',{name:'预览',exact:true}).click();assert(await page.locator('[data-review-id="preview-toggle"]').evaluate(n=>n.scrollWidth<=n.clientWidth));await page.getByRole('button',{name:'慢慢探索',exact:true}).click();
  await page.getByText('走近山野，',{exact:false}).waitFor();await page.getByRole('button',{name:'退出预览',exact:true}).click();
  await page.locator('[data-review-id="sample-headline"]').click();
  const card=page.locator('[data-review-id="comment-headline"]');
  await card.getByLabel('编辑评论',{exact:true}).fill('为如意设计自身留下的体验意见');
  await card.getByLabel('编辑评论',{exact:true}).press('Control+Enter');
  await card.getByText('为如意设计自身留下的体验意见',{exact:true}).waitFor();
  assert.equal(await page.locator('.comment-card').count(),2);
  assert((await page.locator('.comment-card').first().textContent()).includes('主按钮与正文'));
  const saved=await page.evaluate(()=>window.ruyiDesignReviewState.exportState());await page.reload();await page.waitForFunction(()=>!!window.ruyiDesignReviewState);await page.evaluate(s=>window.ruyiDesignReviewState.restoreState(s),saved);
  await page.getByText('为如意设计自身留下的体验意见',{exact:true}).waitFor();
  await page.locator('[data-review-id="comment-button"]').getByRole('button',{name:'删除',exact:true}).click();
  await page.getByRole('button',{name:'回到日常',exact:true}).click();
  await page.getByLabel('添加元素评论',{exact:true}).fill('新评论应排在最上方');await page.getByLabel('添加元素评论',{exact:true}).press('Control+Enter');
  assert((await page.locator('.comment-card').first().textContent()).includes('新评论应排在最上方'));
  await page.screenshot({path:`test-results/product-design/workbench-${id}.png`,fullPage:true});
  await page.goto(url('updated'));await page.getByRole('button',{name:'确认解决',exact:true}).first().click();await page.getByRole('button',{name:'已归档 2',exact:true}).waitFor();
  await page.getByRole('button',{name:'重新打开',exact:true}).first().click();
  await page.getByRole('button',{name:'查看原版本',exact:true}).first().click();await page.getByRole('button',{name:'返回最新版本',exact:true}).waitFor();
  await page.getByRole('button',{name:'返回最新版本',exact:true}).click();
  await page.goto(`${server.internalPreviewBase}/r/${rev.id}/showcases/index.html?component=brand&state=default`);
  await page.getByRole('heading',{name:'如意方印 · 最终版',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/选择方案/}).count(),0);
  await page.screenshot({path:`test-results/product-design/logo-final-${id}.png`,fullPage:true});
  await page.goto(`${server.internalPreviewBase}/r/${rev.id}/showcases/index.html?component=brand&state=compact`);
  assert.equal(await page.locator('img').count(),5);

 }
 // Review-gated shortcut prototype: exercise the inner design, not the runtime shell.
 await page.setViewportSize({width:1280,height:900});await page.goto(url(),{waitUntil:'networkidle'});
 const snapshot=()=>page.evaluate(()=>window.ruyiDesignReviewState.exportState());
 const press=async key=>{await page.locator('#main').focus();await page.keyboard.press(key)};
 assert.equal(await page.locator('[data-review-id="preview-toggle"]').getAttribute('aria-keyshortcuts'),'C');
 await press('c');assert.equal((await snapshot()).preview,true);await press('Shift+C');assert.equal((await snapshot()).preview,false);
 await press('ArrowRight');assert.equal((await snapshot()).device,'mobile');
 await press('ArrowRight');assert.equal((await snapshot()).device,'mobile');
 await press('ArrowDown');assert.equal((await snapshot()).sampleState,'empty');assert.equal((await snapshot()).device,'desktop');
 assert.equal(await page.locator('#scene').inputValue(),'empty');assert.equal(await page.locator('#device option').count(),1);
 await press('ArrowDown');assert.equal((await snapshot()).sampleState,'empty');await press('ArrowLeft');assert.equal((await snapshot()).device,'desktop');
 assert.equal(new URL(page.url()).searchParams.get('sampleState'),'empty');await page.reload();await page.waitForFunction(()=>!!window.ruyiDesignReviewState);assert.equal((await snapshot()).sampleState,'empty');
 await page.locator('#scene').selectOption('default');await page.locator('#device').selectOption('mobile');
 await page.getByRole('button',{name:'品牌故事',exact:true}).click();await press('ArrowLeft');assert.equal((await snapshot()).device,'desktop');
 await press('ArrowDown');assert.equal((await snapshot()).sampleState,'reading');assert.equal((await snapshot()).device,'mobile');
 await page.getByRole('button',{name:'首页',exact:true}).click();await page.locator('#device').selectOption('desktop');
 // Editing survives mode and combination changes, keeping the original comment context.
 await page.locator('[data-review-id="sample-headline"]').click();await page.getByLabel('编辑评论',{exact:true}).fill('保留输入 c 与切换前的草稿');
 await page.getByLabel('编辑评论',{exact:true}).press('c');assert.equal((await snapshot()).preview,false);
 const draft=await page.getByLabel('编辑评论',{exact:true}).inputValue();
 await press('c');await press('c');assert.equal(await page.getByLabel('编辑评论',{exact:true}).inputValue(),draft);
 await press('ArrowRight');assert.equal(await page.getByLabel('编辑评论',{exact:true}).inputValue(),draft);
 await page.getByLabel('编辑评论',{exact:true}).press('Control+Enter');assert.equal((await snapshot()).comments.filter(c=>c.id==='headline').length,1);
 await page.locator('[data-review-id="comment-headline"]').getByText(draft,{exact:true}).waitFor();
 // Native focus, composition, repeated keys and modifier chords are not workspace actions.
 await page.getByRole('button',{name:'联系与到访',exact:true}).click();
 await page.locator('input[name="visitor"]').fill('c');await page.locator('input[name="visitor"]').press('c');assert.equal((await snapshot()).preview,false);
 for(const target of ['input[name="visitor"]','select[name="visit"]','#device','#scene']){
  const before=await snapshot();const result=await page.locator(target).evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'c',bubbles:true,cancelable:true})));
  assert.equal(result,true);assert.deepEqual(await snapshot(),before);
 }
 for(const attributes of [{contenteditable:'true'},{role:'slider'},{role:'combobox'},{role:'tab'},{role:'gridcell'}]){
  await page.evaluate(attrs=>{const node=document.createElement('div');node.id='native-protection';for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);node.innerHTML='<span id="native-child">交互区域</span>';document.getElementById('main').append(node)},attributes);
  const before=await snapshot();await page.locator('#native-child').dispatchEvent('keydown',{key:'c',bubbles:true,cancelable:true});assert.deepEqual(await snapshot(),before);await page.locator('#native-protection').evaluate(n=>n.remove());
 }
 for(const flags of [{isComposing:true},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true}]){
  const before=await snapshot();await page.locator('#main').dispatchEvent('keydown',{key:'c',bubbles:true,cancelable:true,...flags});assert.deepEqual(await snapshot(),before);
 }
 await page.locator('#main').dispatchEvent('compositionstart');await press('c');assert.equal((await snapshot()).preview,false);await page.locator('#main').dispatchEvent('compositionend');
 await page.evaluate(()=>{document.addEventListener('keydown',e=>e.preventDefault(),{capture:true,once:true})});await press('c');assert.equal((await snapshot()).preview,false);
 await page.locator('.sample-site').focus();await page.keyboard.press('c');assert.equal((await snapshot()).preview,true);
 const inPreview=await snapshot();await page.locator('.sample-site').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');assert.equal((await snapshot()).device,inPreview.device);assert.equal((await snapshot()).sampleState,inPreview.sampleState);
 await page.keyboard.press('c');assert.equal((await snapshot()).preview,false);
 await page.getByRole('button',{name:'按钮',exact:true}).click();assert.equal(await page.locator('#scene').count(),0);assert.equal(await page.locator('.component-example').count(),4);
 const componentState=(await snapshot()).sampleState;await press('ArrowDown');assert.equal((await snapshot()).sampleState,componentState);await press('ArrowLeft');assert.equal((await snapshot()).device,'desktop');await press('ArrowRight');assert.equal((await snapshot()).device,'mobile');
 await page.getByRole('button',{name:'设计令牌',exact:true}).click();assert.equal(await page.locator('.prototype-tokens article').count(),13);assert(await page.locator('#device').isDisabled());const tokens=await snapshot();await press('ArrowLeft');await press('ArrowUp');assert.deepEqual(await snapshot(),tokens);
 await page.getByRole('button',{name:'首页',exact:true}).click();await page.getByRole('button',{name:'查看原版本',exact:true}).first().click();await press('c');assert.equal((await snapshot()).preview,false);assert(await page.locator('[data-review-id="preview-toggle"]').isDisabled());await page.getByRole('button',{name:'返回最新版本',exact:true}).click();
 await page.locator('[data-review-id="comment-headline"]').getByRole('button',{name:'归档',exact:true}).click();assert.equal((await snapshot()).comments.find(c=>c.id==='headline').resolution,'archived');
 await page.locator('[data-review-id="comment-headline"]').getByRole('button',{name:'重新打开',exact:true}).click();await page.locator('[data-review-id="comment-headline"]').getByRole('button',{name:'归档',exact:true}).click();assert.equal((await snapshot()).comments.find(c=>c.id==='headline').resolution,'archived');
 await page.getByRole('button',{name:/进行中/}).click();await page.getByRole('button',{name:'首页',exact:true}).click();
 for(const [width,device]of [[1280,'desktop'],[390,'mobile']]){
  await page.setViewportSize({width,height:900});await page.goto(url(),{waitUntil:'networkidle'});assert.equal(await page.locator('.keyboard-help').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-results/product-design/shortcuts-${device}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log(`Ruyi product prototypes passed: ${rev.manifest.pages.length} page, ${combinations(rev.manifest).length} state/device entries; compact workspace, newest-first inline editing, Ctrl+Enter, archive, inline original version, one final contribution seal; keyboard modes, sparse valid combinations, deep links, draft protection, native/IME/modifier guards, component/token scope and independent archive on desktop/mobile.`);
}finally{await browser.close();await server.close();await rm(data,{recursive:true,force:true})}
