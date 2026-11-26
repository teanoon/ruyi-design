import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-comment-actions-')),design=path.join(root,'design');
await mkdir(design);
const ids=['new','reopened','released','queued','processing','clarification','review','resolved','archived','legacy','race'];
const html=title=>`<html><head><title>${title}</title></head><body><h1>${title}</h1><input id="historical-input" value="Original field"/>${ids.map(id=>`<button id="${id}" data-review-id="${id}" style="display:block;margin:12px">${id}</button>`).join('')}</body></html>`;
await writeFile(path.join(design,'index.html'),html('Original'));
await writeFile(path.join(design,'manifest.json'),JSON.stringify({schemaVersion:1,id:'comment-actions',name:'Comment actions',devices:[{id:'desktop',name:'Desktop',width:1000,height:800},{id:'mobile',name:'Mobile',width:390,height:844}],pages:[{id:'home',name:'Home',states:[{id:'default',name:'Default',entries:{desktop:{path:'index.html'},mobile:{path:'index.html'}}}]}]}));
let server=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:design}));const v1=server.info().revisionId;
await writeFile(path.join(design,'index.html'),html('Latest'));
await server.publish({source:'conversation',request:'New design',idempotencyKey:'new-design',expectedBaseRevision:v1});
const f=server.session.feedback,store=server.session.store,cases={};
const target=id=>({kind:'page',objectId:'home',stateId:'default',deviceId:'desktop',revisionId:v1,context:{anchor:{selector:`#${id}`,reviewId:id}}});
for(const id of ids.filter(id=>id!=='race')){
 const c=f.add(`Feedback ${id}`,target(id));c.status=({queued:'needs_clarification',processing:'submitted',clarification:'needs_clarification',review:'awaiting_review',resolved:'resolved',archived:'resolved'})[id]||'draft';
 if(['resolved','archived'].includes(id))c.resolution=id==='resolved'?'confirmed':'archived';
 if(id==='reopened')c.previousDraft={text:c.text,status:'resolved'};
 if(['reopened','review','resolved','archived'].includes(id))c.results=[{batchId:'old',action:'modified',revisionId:server.info().revisionId,message:'Changed',scope:'instance'}];
 store.put('comment',c);cases[id]=c;
 if(['released','queued','processing'].includes(id))store.put('batch',{id:`batch-${id}`,status:id==='released'?'awaiting_review':id==='queued'?'queued':'processing',items:[structuredClone(c)],created:Date.now(),...(id==='processing'?{leaseUntil:Date.now()+300000,leaseToken:'fixture'}:{})});
}
store.put('comment',{...structuredClone(cases.legacy),id:'legacy-second',status:'resolved',resolution:'archived',text:'Legacy second record'});
const browser=await chromium.launch();
try{
 await mkdir('test-results/comment-runtime',{recursive:true});
 const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const go=async()=>{await page.goto(server.info().reviewUrl,{waitUntil:'load'});await page.locator('[data-comment-id]').first().waitFor()};await go();
 const card=id=>page.locator(`[data-comment-id="${cases[id]?.id||id}"]`);
 const expected={new:['定位','查看原版本','编辑','删除','存档'],reopened:['定位','查看原版本','回复','编辑','撤销重新打开','存档'],released:['定位','查看原版本','回复','编辑','存档'],queued:['定位','查看原版本','回复'],processing:['定位','查看原版本','回复'],clarification:['定位','查看原版本','回复','存档'],review:['定位','查看原版本','回复','确认解决','重新打开','存档'],resolved:['定位','查看原版本','回复','重新打开'],archived:['定位','查看原版本','回复','重新打开']};
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  for(const[id,actions]of Object.entries(expected)){
   await page.locator(id==='resolved'||id==='archived'?'#archive-tab':'#active-tab').click();
   assert.deepEqual(await card(id).locator('.comment-actions button').allTextContents(),actions,`${id}/${width}`);
   for(const button of await card(id).locator('.comment-actions button').all())assert(await button.isVisible());
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#active-tab').click();await card('review').screenshot({path:`test-results/comment-runtime/review-${width}.png`});
 }
 assert.equal(await page.getByRole('button',{name:/^(新增评论|归档|无需处理|更多)$/}).count(),0);
 await page.setViewportSize({width:1280,height:900});
 const editor=page.getByLabel('评论内容',{exact:true});
 const nextWrite=client=>client.waitForResponse(response=>response.request().method()==='POST'&&/\/comments(?:\/[^/]+\/review)?$/.test(new URL(response.url()).pathname));
 for(const id of ['resolved','archived']){
  const old=f.comment(cases[id].id);
  await page.locator('#archive-tab').click();
  await page.frameLocator('iframe').first().locator(`#${id}`).click();
  await editor.waitFor();
  assert.equal(await page.locator('#active-tab').getAttribute('aria-pressed'),'true');
  assert.equal(await editor.inputValue(),'');
  await editor.fill(`New ${id} discussion`);
  const persisted=nextWrite(page);
  await editor.press('Control+Enter');
  assert((await persisted).ok());
  await page.getByText(`New ${id} discussion`,{exact:true}).waitFor();
  assert.deepEqual(f.comment(old.id),old);
 }
 const activeArchive=f.store.all('comment').find(c=>c.text==='New archived discussion');
 await page.locator('#archive-tab').click();
 await card('archived').getByRole('button',{name:'重新打开',exact:true}).click();
 await page.getByRole('button',{name:'打开进行中的讨论',exact:true}).click();
 await card(activeArchive.id).waitFor();
 await page.locator('#archive-tab').click();
 const old=f.comment(cases.archived.id);
 await card('archived').getByRole('button',{name:'回复',exact:true}).click();
 await editor.fill('Carry this historical reply');
 await editor.press('Control+Enter');
 await page.getByRole('button',{name:'在已有讨论中补充',exact:true}).waitFor();
 assert.deepEqual(f.comment(old.id),old);
 await page.getByRole('button',{name:'在已有讨论中补充',exact:true}).click();
 await card(activeArchive.id).locator('textarea').waitFor();
 assert.equal(await editor.inputValue(),'Carry this historical reply');
 assert.equal(f.comment(activeArchive.id).thread.length,0);
 const savedReply=nextWrite(page);
 await editor.press('Control+Enter');
 await page.getByText('你：Carry this historical reply',{exact:true}).waitFor();
 assert((await savedReply).ok());
 assert.deepEqual(f.comment(old.id),old);
 await page.frameLocator('iframe').first().locator('#legacy').click();await page.waitForFunction(()=>document.getElementById('comment-text').value==='Feedback legacy'&&!document.getElementById('composer').hidden);assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),'Feedback legacy');await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.locator('#active-tab').click();await card('queued').getByRole('button',{name:'回复',exact:true}).click();await page.getByLabel('评论内容',{exact:true}).fill('Follow-up while queued');const queuedReply=nextWrite(page);await page.getByRole('button',{name:'保存评论',exact:true}).click();await page.getByText('你：Follow-up while queued',{exact:true}).waitFor();assert((await queuedReply).ok());assert.equal(f.comment(cases.queued.id).status,'needs_clarification');assert.equal(store.get('batch','batch-queued').items[0].thread.length,0);
 // Two browsers start independent drafts for one element; the loser retains all text.
 const second=await browser.newPage();await second.goto(server.info().reviewUrl,{waitUntil:'load'});
 await page.frameLocator('iframe').first().locator('#race').click();await second.frameLocator('iframe').first().locator('#race').click();
 await page.getByLabel('评论内容',{exact:true}).fill('First race requirement');await second.getByLabel('评论内容',{exact:true}).fill('Second race requirement');
 const firstRace=nextWrite(page);
 await page.getByRole('button',{name:'保存评论',exact:true}).click();await page.getByText('First race requirement',{exact:true}).waitFor();
 assert((await firstRace).ok());
 await second.getByRole('button',{name:'保存评论',exact:true}).click();await second.getByRole('button',{name:'在已有讨论中补充',exact:true}).waitFor();assert(await second.locator('#composer').isHidden());
 await second.getByRole('button',{name:'在已有讨论中补充',exact:true}).click();assert.equal(await second.getByLabel('评论内容',{exact:true}).inputValue(),'Second race requirement');const secondReply=nextWrite(second);await second.getByRole('button',{name:'保存评论',exact:true}).click();await second.getByText('你：Second race requirement',{exact:true}).waitFor();assert((await secondReply).ok());
 const races=server.session.context().comments.filter(c=>c.target.context.anchor?.reviewId==='race');assert.equal(races.length,1);assert.equal(races[0].text,'First race requirement');await second.close();
 // An archived discussion and a new write compete through the public HTTP API.
 const raceOld=f.comment(races[0].id);
 f.review(raceOld.id,'archive');
 const reviewUrl=new URL(server.info().reviewUrl);
 const httpTarget=path=>new URL(`api/sessions/${server.info().sessionId}/${path}`,reviewUrl);
 const headers={Authorization:`Bearer ${new URLSearchParams(reviewUrl.hash.slice(1)).get('token')}`,'Content-Type':'application/json'};
 const [create,reopen]=await Promise.all([
  fetch(httpTarget('comments'),{method:'POST',headers,body:JSON.stringify({text:'New concurrent discussion',target:{...target('race'),revisionId:server.info().revisionId}})}),
  fetch(httpTarget(`comments/${raceOld.id}/review`),{method:'POST',headers,body:JSON.stringify({action:'reopen'})}),
 ]);
 assert.deepEqual([create.status,reopen.status].sort(),[200,409]);
 const winner=await (create.ok?create:reopen).json();
 const loser=await (create.ok?reopen:create).json();
 assert.equal(loser.error.details.existingCommentId,winner.id);
 assert.deepEqual(f.store.all('comment').filter(c=>c.target.context.anchor?.reviewId==='race'&&c.status!=='resolved').map(c=>c.id),[winner.id]);
 // Release test-only queued fixtures so a direct design publication can proceed.
 for(const id of ['queued','processing']){const batch=store.get('batch',`batch-${id}`);batch.status='awaiting_review';delete batch.leaseToken;store.put('batch',batch);}
 await page.reload();await card('review').getByRole('button',{name:'回复',exact:true}).click();await page.getByLabel('评论内容',{exact:true}).fill('Unsaved historical comparison');
 await card('review').getByRole('button',{name:'查看原版本',exact:true}).click();await page.locator('#history-banner').waitFor();assert((await page.locator('#history-banner').textContent()).includes('正在查看评论原版本 · 只读'));await page.frameLocator('iframe').first().getByRole('heading',{name:'Original',exact:true}).waitFor();
 await page.frameLocator('iframe').first().locator('#historical-input').focus();await page.keyboard.type('must not change');assert.equal(await page.frameLocator('iframe').first().locator('#historical-input').inputValue(),'Original field');
 await writeFile(path.join(design,'index.html'),html('Newest during history'));await server.publish({source:'conversation',request:'Publish while comparing',idempotencyKey:'history-newest',expectedBaseRevision:server.info().revisionId});
 assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),'Unsaved historical comparison');await page.locator('#return-latest').click();await page.frameLocator('iframe').first().getByRole('heading',{name:'Newest during history',exact:true}).waitFor();assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),'Unsaved historical comparison');assert.equal(f.comment(cases.review.id).status,'awaiting_review');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 // Return gracefully when the original object's combination is removed from latest.
 await card('review').getByRole('button',{name:'查看原版本',exact:true}).click();await page.locator('#history-banner').waitFor();
 const missing={schemaVersion:1,id:'comment-actions',name:'Removed entry',devices:[{id:'desktop',name:'Desktop',width:1000,height:800}],pages:[{id:'other',name:'Other',states:[{id:'default',name:'Default',entries:{desktop:{path:'index.html'}}}]}]};
 await writeFile(path.join(design,'manifest.json'),JSON.stringify(missing));await server.publish({source:'conversation',request:'Remove old combination',idempotencyKey:'remove-combination',expectedBaseRevision:server.info().revisionId});
 await page.locator('#return-latest').click();await page.locator('#history-banner').waitFor({state:'hidden'});await page.getByText('评论对应的页面、状态或设备已不存在，原版本上下文仍保留。',{exact:true}).waitFor();
 const before=structuredClone(server.session.context().comments),session=server.info().sessionId;
 await server.close();server=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:design}));await go();assert.equal(server.info().sessionId,session);assert.deepEqual(server.session.context().comments,before);assert.equal(before.filter(c=>c.target.context.anchor?.reviewId==='legacy').length,2);
 assert.deepEqual(errors,[]);console.log('Comment policy browser passed: desktop/mobile actions, archived history, reopen conflicts, frozen queue, concurrent writes, history and restart persistence.');
}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
