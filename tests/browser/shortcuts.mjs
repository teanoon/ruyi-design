import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import Fastify from 'fastify';import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const browser=await chromium.launch();
const html=`<!doctype html><html lang="zh-CN"><head><title>Keyboard fixture</title></head><body><h1 tabindex="0">Canvas</h1><button id="target" data-review-id="target">Comment target</button><label>Field<input id="field"/></label><textarea id="notes"></textarea><select id="native"><option>A</option><option>B</option></select><div id="editable" contenteditable="true"><span>Edit</span></div><div id="slider" role="slider" tabindex="0">Slider</div></body></html>`;
async function exercise(opaque){
 const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-keyboard-')),design=path.join(root,'design');await mkdir(design);
 const entry={path:'index.html'};const manifest={schemaVersion:1,id:'keyboard',name:'External project identity',devices:[{id:'desktop',name:'Desktop',width:1280,height:900},{id:'tablet',name:'Tablet',width:768,height:1024},{id:'mobile',name:'Mobile',width:390,height:844}],pages:[{id:'home',name:'Home',states:[{id:'default',name:'Default',entries:{desktop:entry,tablet:entry,mobile:entry}},{id:'empty',name:'Empty',entries:{desktop:entry}},{id:'reading',name:'Reading',entries:{mobile:entry}}]},{id:'other',name:'Other',states:[{id:'default',name:'Default',entries:{desktop:entry}}]}],components:[{id:'sample',name:'Sample',implementation:['index.html'],examples:[{id:'default',name:'Default',entries:{desktop:entry,mobile:entry}},{id:'busy',name:'Busy',entries:{mobile:entry}}]}],tokens:[{id:'primary',name:'Primary',group:'Colors',type:'color',value:'#2f6b58',description:'Primary color'}]};
 await writeFile(path.join(design,'manifest.json'),JSON.stringify(manifest));await writeFile(path.join(design,'index.html'),html);
 let app;const gateway=opaque?Fastify({logger:false}):undefined;let gatewayBase;
 if(gateway){
  gateway.all('/*',async(req,reply)=>{
   const u=new URL(req.url,'http://gateway');if(u.searchParams.has('port'))reply.header('set-cookie','design_target_port=4173; Path=/; HttpOnly; SameSite=Lax');
   if((u.searchParams.get('port')??req.headers.cookie?.match(/design_target_port=(\d+)/)?.[1])!=='4173')return reply.code(400).send('Missing port');
   u.searchParams.delete('port');const headers={...req.headers,host:new URL(app.internalBase).host};delete headers['content-length'];if(headers.origin===new URL(gatewayBase).origin)headers.origin=new URL(app.internalBase).origin;
   const r=await app.control.inject({method:req.method,url:u.pathname+u.search,headers,payload:req.body?JSON.stringify(req.body):undefined});
   for(const h of ['content-type','access-control-allow-origin','access-control-allow-credentials','cross-origin-resource-policy'])if(r.headers[h])reply.header(h,r.headers[h]);return reply.code(r.statusCode).send(r.rawPayload);
  });gatewayBase=await gateway.listen({host:'127.0.0.1',port:0});
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  app=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:design,...(gateway?{publicBaseUrl:gatewayBase+'/?port=4173'}:{})}));
  await page.goto(app.info().reviewUrl);const frame=()=>page.frameLocator('iframe').first();await frame().locator('#target').waitFor();
  const selected=()=>page.locator('#device').inputValue();const state=()=>page.locator('#state').inputValue();
  const shell=async key=>{await page.locator('#main').focus();await page.keyboard.press(key)};
  const canvas=async key=>{await frame().locator('h1').focus();await page.keyboard.press(key)};
  const settle=()=>frame().locator('#target').waitFor();
  assert.equal(await page.locator('header,#project,.nav-footer,.review-next-step').count(),0);
  assert.equal(await page.locator('#preview-toggle #revision').count(),1);assert.equal(await page.locator('.sidebar-footer #activity').count(),1);
  await shell('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'true');await shell('Shift+C');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  await shell('ArrowRight');assert.equal(await selected(),'tablet');await settle();await canvas('ArrowRight');await page.waitForFunction(()=>document.getElementById('device').value==='mobile');await settle();
  await canvas('ArrowRight');assert.equal(await selected(),'mobile');
  await shell('ArrowDown');assert.equal(await state(),'empty');assert.equal(await selected(),'desktop');await settle();assert.equal(new URL(page.url()).searchParams.get('device'),'desktop');
  await shell('ArrowDown');assert.equal(await state(),'reading');assert.equal(await selected(),'mobile');await settle();await shell('ArrowDown');assert.equal(await state(),'reading');
  await page.getByLabel('状态',{exact:true}).selectOption('default');await settle();assert.equal(await selected(),'mobile');
  await frame().locator('#target').click();await page.getByLabel('评论内容',{exact:true}).fill('Persistent draft c');
  await page.getByLabel('评论内容',{exact:true}).press('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  const draft=await page.getByLabel('评论内容',{exact:true}).inputValue();await shell('c');assert(await page.locator('#composer').isHidden());await canvas('c');await page.locator('#composer').waitFor();assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),draft);
  await shell('ArrowLeft');await settle();assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),draft);await page.getByLabel('评论内容',{exact:true}).press('Control+Enter');await page.getByText(draft,{exact:true}).waitFor();
  assert.equal(app.session.context().comments[0].target.deviceId,'mobile');
  for(const selector of ['#field','#notes','#native','#editable','#slider']){
   await frame().locator(selector).focus();await page.keyboard.press('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false',selector);
   await page.keyboard.press('ArrowRight');assert.equal(await selected(),'tablet');
  }
  await frame().locator('#editable span').dispatchEvent('keydown',{key:'c',bubbles:true,cancelable:true});assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  for(const flags of [{isComposing:true},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true}]){
   await page.locator('#main').dispatchEvent('keydown',{key:'c',bubbles:true,cancelable:true,...flags});assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
   await frame().locator('h1').dispatchEvent('keydown',{key:'c',bubbles:true,cancelable:true,...flags});assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  }
  await page.locator('#main').dispatchEvent('compositionstart');await shell('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');await page.locator('#main').dispatchEvent('compositionend');
  await frame().locator('h1').evaluate(n=>n.addEventListener('keydown',e=>e.preventDefault(),{once:true}));await canvas('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  await canvas('c');await page.waitForFunction(()=>document.getElementById('preview-toggle').getAttribute('aria-pressed')==='true');
  await canvas('ArrowRight');await canvas('ArrowDown');assert.equal(await selected(),'tablet');assert.equal(await state(),'default');
  await frame().locator('#field').fill('native input');await frame().locator('#field').press('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'true');await canvas('c');await page.waitForFunction(()=>document.getElementById('preview-toggle').getAttribute('aria-pressed')==='false');
  await page.getByRole('button',{name:'Sample',exact:true}).click();await settle();assert.equal(await selected(),'desktop');assert.equal(await page.locator('#state-control').isVisible(),false);assert.equal(new URL(page.url()).searchParams.get('device'),'desktop');
  await shell('ArrowDown');assert.equal(new URL(page.url()).searchParams.get('kind'),'component');await shell('ArrowRight');assert.equal(await selected(),'mobile');await page.waitForFunction(()=>document.querySelectorAll('iframe').length===2);
  await page.getByRole('button',{name:'设计令牌',exact:true}).click();assert(await page.locator('#device').isDisabled());assert(await page.locator('#device-key').isHidden());const tokenUrl=page.url();await shell('ArrowLeft');await shell('ArrowUp');assert.equal(page.url(),tokenUrl);
  await page.getByRole('button',{name:'Home',exact:true}).click();await settle();
  // Invalid source, action, id and frame identity cannot drive navigation. Duplicate ids are consumed once.
  const make=await page.locator('iframe').evaluate(f=>({version:1,channel:'ruyi-design',frameId:f.name,type:'shortcut',payload:{action:'preview',id:'same-physical-key'}}));
  await page.evaluate(m=>window.postMessage(m,location.origin),make);assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');
  const send=async m=>frame().locator('body').evaluate((_node,message)=>parent.postMessage(message,'*'),m);
  const originalDevice=await selected();
  await send({...make,frameId:'wrong'});await send({...make,payload:{action:'arbitrary-url',id:'bad'}});await send({...make,payload:{action:'preview'}});assert.equal(await selected(),originalDevice);
  await send(make);await page.waitForFunction(()=>document.getElementById('preview-toggle').getAttribute('aria-pressed')==='true');await send(make);assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'true');await shell('c');
  await shell('c');
  await page.locator('.comment-card').filter({hasText:draft}).getByRole('button',{name:'查看原版本',exact:true}).click();await page.locator('#history-banner').waitFor();assert(await page.locator('#preview-toggle').isDisabled());assert(await page.locator('#preview-key').isHidden());await shell('c');await settle();await canvas('c');assert.equal(await page.locator('#preview-toggle').getAttribute('aria-pressed'),'false');await page.locator('#return-latest').click();await settle();
  await page.locator('.comment-card').filter({hasText:draft}).getByRole('button',{name:'归档',exact:true}).click();await page.locator('#active-tab[aria-pressed="true"]').waitFor();await page.locator('#archive-tab').click();await page.locator('#archive-tab[aria-pressed="true"]').waitFor();await page.locator('#archived-comments').getByRole('button',{name:'重新打开',exact:true}).click();await page.locator('#active-tab[aria-pressed="true"]').waitFor();
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await shell('c');assert(await page.locator('#preview-toggle').evaluate(n=>n.scrollWidth<=n.clientWidth));await shell('c');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const nav=await page.locator('.navigation').boundingBox(),brand=await page.locator('.workspace-brand').boundingBox(),activity=await page.locator('#activity').boundingBox();assert(activity.x>brand.x);assert(activity.y>brand.y);assert(activity.x+activity.width<=brand.x+brand.width+1);assert.equal(await page.locator('.workspace-brand small').count(),0);assert(brand.x>=nav.x&&brand.x+brand.width<=nav.x+nav.width+1);
   await mkdir('test-results/shortcuts',{recursive:true});await page.screenshot({path:`test-results/shortcuts/${opaque?'gateway':'direct'}-${width}.png`,fullPage:true});
  }
  if(!opaque){
   const before=app.session.context().comments;await writeFile(path.join(design,'index.html'),html.replace('Canvas','Published canvas'));
   await app.publish({sessionId:app.session.id,source:'conversation',request:'Verify approved runtime publication',idempotencyKey:'keyboard-publication',expectedBaseRevision:app.session.active().id});
   await frame().getByRole('heading',{name:'Published canvas',exact:true}).waitFor();assert.deepEqual(app.session.context().comments,before);
  }
  assert.deepEqual(errors,[]);console.log(`Runtime keyboard ${opaque?'opaque gateway':'direct cross-origin'} passed: focus/IME/native protection, valid combinations, draft preservation, frame identity/deduplication, history, archives, responsive layout${opaque?'':', publication'}.`);
 }finally{await page.close();await app?.close();await gateway?.close();await rm(root,{recursive:true,force:true})}
}
try{await exercise(false);await exercise(true)}finally{await browser.close()}
