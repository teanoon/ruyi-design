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
  await page.setViewportSize({width,height:900});await page.goto(url());
  assert.equal(await page.locator('.sidebar-bottom,.next-step,.avatar').count(),0);
  assert.equal(await page.getByRole('link',{name:'全部评论',exact:true}).count(),0);
  const nav=await page.locator('.sidebar').boundingBox(),status=await page.locator('.connection-status .live').boundingBox();
  assert(Math.abs(nav.y+nav.height-status.y-status.height-25)<6);
  await page.getByRole('button',{name:'预览',exact:true}).click();await page.getByRole('button',{name:'慢慢探索',exact:true}).click();
  await page.getByText('走近山野，',{exact:false}).waitFor();await page.getByRole('button',{name:'退出预览',exact:true}).click();
  await page.locator('[data-review-id="sample-headline"]').click();
  const card=page.locator('[data-review-id="comment-headline"]');
  await card.getByLabel('编辑评论',{exact:true}).fill('为如意设计自身留下的体验意见');
  await card.getByLabel('编辑评论',{exact:true}).press('Control+Enter');
  await card.getByText('为如意设计自身留下的体验意见',{exact:true}).waitFor();
  assert.equal(await page.locator('.comment-card').count(),2);
  assert((await page.locator('.comment-card').first().textContent()).includes('主按钮与正文'));
  const saved=await page.evaluate(()=>window.ruyiDesignReviewState.exportState());await page.reload();await page.evaluate(s=>window.ruyiDesignReviewState.restoreState(s),saved);
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
 assert.deepEqual(errors,[]);
 console.log(`Ruyi product prototypes passed: ${rev.manifest.pages.length} page, ${combinations(rev.manifest).length} state/device entries; compact workspace, newest-first inline editing, Ctrl+Enter, archive, inline original version, one final contribution seal with no candidate selection on desktop/mobile.`);
}finally{await browser.close();await server.close();await rm(data,{recursive:true,force:true})}
