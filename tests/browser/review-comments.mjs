import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-comments-')),design=path.join(root,'design');await mkdir(design);
await writeFile(path.join(design,'manifest.json'),JSON.stringify({schemaVersion:1,id:'comments',name:'Comments',devices:[{id:'desktop',name:'Desktop',width:1000,height:800}],pages:[{id:'home',name:'Home',states:[{id:'default',name:'Default',entries:{desktop:{path:'index.html'}}}]}]}));
await writeFile(path.join(design,'index.html'),'<html><head><title>Comments</title></head><body><section id="parent" style="padding:40px;background:#eee"><div id="middle" style="padding:40px;background:#ddd"><button id="child">Child</button></div></section></body></html>');
const server=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:design}));const browser=await chromium.launch();
try {
 const page=await browser.newPage();page.setDefaultTimeout(10000);await page.goto(server.info().reviewUrl);
 const frame=page.frameLocator('iframe').first(),editor=page.getByLabel('评论内容',{exact:true});
 const commentPath=url=>/\/comments(?:\/[^/]+(?:\/review)?)?$/.test(url.pathname);
 const isWrite=(response,method)=>commentPath(new URL(response.url()))&&response.request().method()===method;
 const saveButton=()=>page.getByRole('button',{name:'保存评论',exact:true});
 const save=async text=>{
  await editor.fill(text);
  const persisted=page.waitForResponse(response=>isWrite(response,'POST'));
  await saveButton().click();
  await page.getByText(text,{exact:true}).waitFor();
  assert((await persisted).ok());
 };
 async function deliverOldList(){
  const refresh=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/context'));
  server.session.store.event('test.comment_context', {});
  await (await refresh).finished();
  await page.evaluate(()=>new Promise(requestAnimationFrame));
 }
 async function withDelayedWrite(method,act,verify,{fail=false}={}){
  let writes=0;
  let release,started;
  const gate=new Promise(resolve=>{release=resolve});
  const arrived=new Promise(resolve=>{started=resolve});
  const handler=async route=>{
   if(route.request().method()!==method)return route.fallback();
   writes++;
   started();
   await gate;
   if(fail)await route.fulfill({status:503,json:{error:{message:'模拟后台拒绝'}}});
   else await route.continue();
  };
  await page.route(commentPath,handler);
  try{
   const response=page.waitForResponse(result=>isWrite(result,method)).catch(error=>error);
   await act();
   await arrived;
   assert.equal(await page.getByRole('button',{name:'正在保存…',exact:true}).count(),0);
   await deliverOldList();
   await verify();
   release();
   const result=await response;
   if(result instanceof Error)throw result;
   assert.equal(result.ok(),!fail);
   assert.equal(writes,1);
  }finally{
   release();
   await page.unroute(commentPath,handler);
  }
 }
 await frame.locator('#parent').click({position:{x:5,y:5}});
 await withDelayedWrite('POST',async()=>{
  await editor.fill('Parent comment');
  await saveButton().click();
 },async()=>{
  await page.getByText('Parent comment',{exact:true}).waitFor();
  assert.equal(server.session.context().comments.length,0);
  assert(await page.locator('#composer').isHidden());
  assert.equal(await page.locator('#count').textContent(),'1');
  assert.equal(await page.locator('#pending-count').textContent(),'没有待处理评论');
  assert.equal(await page.locator('.comment-card').getAttribute('data-status'),'pending-submission');
 });
 await page.locator('.comment-card[data-status="draft"]').waitFor();
 await frame.locator('#child').click();await page.locator('#composer').waitFor({state:'visible'});assert.equal(await editor.inputValue(),'');await save('Child comment');
 await frame.locator('#middle').click({position:{x:5,y:5}});await page.locator('#composer').waitFor({state:'visible'});assert.equal(await editor.inputValue(),'');await save('Middle comment');
 assert.equal(server.session.context().comments.length,3);
 await frame.locator('#child').click();await page.locator('#composer').waitFor({state:'visible'});assert.equal(await editor.inputValue(),'Child comment');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 const child=page.locator('.comment-card').filter({has:page.getByText('Child comment',{exact:true})});
 const childId=await child.getAttribute('data-comment-id');
 assert(await child.locator('p').isVisible());assert.equal(await child.locator('p').textContent(),'Child comment');
 await child.getByRole('button',{name:'编辑',exact:true}).click();await editor.fill('Unsaved edits');await page.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(await child.locator('p').textContent(),'Child comment');assert(await child.locator('p').isVisible());
 await page.setViewportSize({width:390,height:900});
 const parent=page.locator('.comment-card').filter({has:page.getByText('Parent comment',{exact:true})});
 await parent.getByRole('button',{name:'编辑',exact:true}).click();
 await withDelayedWrite('PATCH',async()=>{
  await editor.fill('Edited parent comment');
  await editor.press('Control+Enter');
 },async()=>{
  await page.getByText('Edited parent comment',{exact:true}).waitFor();
  assert(server.session.context().comments.some(c=>c.text==='Parent comment'));
  assert.equal(await page.locator('.comment-card').filter({hasText:'Edited parent comment'}).getAttribute('data-status'),'pending-submission');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });
 await page.setViewportSize({width:1280,height:900});
 const commentRoute=url=>/\/comments\/[^/]+$/.test(url.pathname);
 const contextRoute=url=>url.pathname.endsWith('/context');
 let writes=0;
 let failReads=false;
 const writeResult=async route=>{
  if(route.request().method()!=='PATCH')return route.fallback();
  if(++writes===1)return route.fulfill({status:503,json:{error:{message:'暂时无法写入'}}});
  failReads=true;
  await route.continue();
 };
 const readResult=route=>failReads?route.fulfill({status:503,json:{error:{message:'暂时无法读取'}}}):route.fallback();
 await page.route(commentRoute,writeResult);
 await page.route(contextRoute,readResult);
 await child.getByRole('button',{name:'编辑',exact:true}).click();
 await editor.fill('Retry child change');
 await editor.press('Control+Enter');
 await page.getByText('评论提交失败。 暂时无法写入',{exact:true}).waitFor();
 const rejected=page.locator('.comment-card').filter({hasText:'Retry child change'});
 assert.equal(await rejected.getAttribute('data-status'),'pending-submission');
 assert.deepEqual(await rejected.locator('.comment-actions button').allTextContents(),['定位','编辑','重新提交']);
 assert(await rejected.getByRole('button',{name:'重新提交',exact:true}).evaluate(node=>node.classList.contains('danger')));
 assert.equal(server.session.context().comments.find(c=>c.id===childId).text,'Child comment');
 await rejected.getByRole('button',{name:'编辑',exact:true}).click();
 assert.equal(await editor.inputValue(),'Retry child change');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await rejected.getByRole('button',{name:'重新提交',exact:true}).click();
 await page.getByText('评论已提交，列表同步失败。',{exact:true}).waitFor();
 assert.equal(await rejected.getAttribute('data-status'),'draft');
 assert.equal(server.session.context().comments.find(c=>c.text==='Retry child change').status,'draft');
 failReads=false;
 await page.getByRole('button',{name:'重试刷新',exact:true}).click();
 await page.getByRole('button',{name:'重试刷新',exact:true}).waitFor({state:'hidden'});
 assert.equal(writes,2);
 await page.unroute(commentRoute,writeResult);
 await page.unroute(contextRoute,readResult);

 const middle=page.locator('.comment-card').filter({has:page.getByText('Middle comment',{exact:true})});
 const middleId=await middle.getAttribute('data-comment-id');
 for(const fail of [true,false]){
  await withDelayedWrite('DELETE',async()=>middle.getByRole('button',{name:'删除',exact:true}).click(),async()=>{
   assert(await middle.getByRole('button',{name:'删除中',exact:true}).isDisabled());
   assert.equal(await page.locator('#count').textContent(),'3');
   assert.equal(server.session.feedback.comment(middleId).text,'Middle comment');
  },{fail});
  if(fail){
   await middle.getByRole('button',{name:'删除',exact:true}).waitFor();
   assert.equal(await middle.getAttribute('data-status'),'draft');
  }
 }
 await middle.waitFor({state:'detached'});
 await frame.locator('#middle').click({position:{x:5,y:5}});
 await editor.waitFor();
 assert.equal(await editor.inputValue(),'');
 await withDelayedWrite('POST',async()=>{
  await editor.fill('  Replacement middle comment  ');
  await editor.press('Meta+Enter');
 },async()=>{
  const card=page.locator('.comment-card').filter({hasText:'Replacement middle comment'});
  assert.equal(await card.getAttribute('data-status'),'pending-submission');
  assert.equal(await server.session.context().comments.length,2);
 },{fail:true});

 const replacement=page.locator('.comment-card').filter({hasText:'Replacement middle comment'});
 const replacementId=await replacement.getAttribute('data-comment-id');
 await replacement.getByRole('button',{name:'编辑',exact:true}).click();
 assert.equal(await editor.inputValue(),'  Replacement middle comment  ');
 await editor.fill('Replacement middle comment');
 const submittedAgain=page.waitForResponse(response=>isWrite(response,'POST'));
 await editor.press('Control+Enter');
 assert((await submittedAgain).ok());
 await replacement.getByRole('button',{name:'存档',exact:true}).waitFor();
 assert.equal(server.session.feedback.comment(replacementId).text,'Replacement middle comment');
 for(const fail of [true,false]){
  await withDelayedWrite('POST',async()=>replacement.getByRole('button',{name:'存档',exact:true}).click(),async()=>{
   assert(await replacement.getByRole('button',{name:'存档中',exact:true}).isDisabled());
   assert(await page.locator('#active-comments').getByText('Replacement middle comment',{exact:true}).isVisible());
  },{fail});
  if(fail)await replacement.getByRole('button',{name:'存档',exact:true}).waitFor();
 }
 await page.locator('#archived-comments').getByText('Replacement middle comment',{exact:true}).waitFor({state:'attached'});
 await page.locator('#archive-tab').click();
 for(const fail of [true,false]){
  await withDelayedWrite('POST',async()=>replacement.getByRole('button',{name:'重新打开',exact:true}).click(),async()=>{
   assert(await replacement.getByRole('button',{name:'打开中',exact:true}).isDisabled());
   assert(await page.locator('#archived-comments').getByText('Replacement middle comment',{exact:true}).isVisible());
  },{fail});
  if(fail)await replacement.getByRole('button',{name:'重新打开',exact:true}).waitFor();
 }
 await page.locator('#active-comments').getByText('Replacement middle comment',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'新增评论',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'归档',exact:true}).count(),0);
 const childRecord=server.session.context().comments.find(c=>c.text==='Retry child change');
 server.session.feedback.review(childRecord.id,'archive');await page.reload();
 await page.locator('#archive-tab').click();
 await frame.locator('#child').click();
 await page.locator('#composer').waitFor();
 assert.equal(await page.locator('#active-tab').getAttribute('aria-pressed'),'true');
 assert.equal(await editor.inputValue(),'');
 assert(await editor.evaluate(n=>document.activeElement===n));
 await save('New child comment');
 assert.equal(server.session.feedback.comment(childRecord.id).status,'resolved');
 assert.equal(server.session.context().comments.length,4);
 const feedback=server.session.feedback,batch=feedback.prepare('publish-comments'),claim=feedback.claim(batch.id,'test','claim');
 for(const item of batch.items)feedback.update(batch.id,claim.leaseToken,'modified',item.id,'Changed','instance');
 server.session.store.transaction(()=>feedback.published(batch.id,server.info().revisionId));await page.reload();
 await page.getByRole('button',{name:'确认解决',exact:true}).first().click();await page.getByText('已归档（2）',{exact:true}).waitFor();assert.equal(await page.locator('#active-tab').getAttribute('aria-pressed'),'true');
 await page.locator('#archive-tab').click();
 const archived=page.locator('#archived-comments .comment-card').first();
 const reopenedId=await archived.getAttribute('data-comment-id');
 const beforeReply=structuredClone(server.session.feedback.comment(reopenedId));
 await archived.getByRole('button',{name:'回复',exact:true}).click();
 await withDelayedWrite('POST',async()=>{
  await editor.fill('追加反馈自动重新打开');
  await saveButton().click();
 },async()=>{
  await page.getByText('你：追加反馈自动重新打开',{exact:true}).waitFor();
  assert.equal(server.session.feedback.comment(reopenedId).status,'resolved');
 });
 assert.equal(await page.locator('#active-tab').getAttribute('aria-pressed'),'true');
 const afterReply=server.session.feedback.comment(reopenedId);assert.equal(afterReply.status,'draft');
 assert.equal(afterReply.text,beforeReply.text);assert.deepEqual(afterReply.results,beforeReply.results);
 assert.equal(afterReply.thread.at(-1).text,'追加反馈自动重新打开');
 console.log('Comment editing passed: pending body and inline retry, delayed delete/archive/reopen and rollback, stale-list reconciliation, precise identity and reply.');
}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true})}
await import('./comment-policy.mjs');
