import assert from 'node:assert/strict';
import {mkdtemp,cp,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-review-focus-'));
await cp('design',path.join(root,'design'),{recursive:true});
const app=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:path.join(root,'design')}));
const browser=await chromium.launch();
try {
 const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mkdir('test-results/review-focus',{recursive:true});
 for(const width of [1280,390]) {
  await page.setViewportSize({width,height:900});await page.goto(app.info().reviewUrl);
  const frame=page.frameLocator('iframe').first();await frame.locator('#device').waitFor();
  await frame.locator('#device').evaluate(node=>{window.prototypePointerDown=0;node.addEventListener('pointerdown',()=>{window.prototypePointerDown++;node.focus();});});
  for(const id of ['device','scene']) {
   await frame.locator(`#${id}`).click();
   await page.waitForFunction(()=>document.activeElement===document.getElementById('comment-text'));
   const editor=page.getByLabel('评论内容',{exact:true});await editor.fill('保持评论焦点');
   // A native popup or late focus restore must not consume subsequent typing.
   await page.waitForTimeout(250);await page.keyboard.type(' focus');
   assert.equal(await editor.inputValue(),'保持评论焦点 focus');
   assert(await frame.locator(`#${id}`).evaluate(node=>document.activeElement!==node));
   await page.getByRole('button',{name:'取消',exact:true}).click();
  }
  assert.equal(await frame.locator('#device').evaluate(()=>window.prototypePointerDown),0);
  // Preview retains native focus and real form interactions.
  await page.getByRole('button',{name:'预览',exact:true}).click();await frame.locator('#device').focus();
  assert(await frame.locator('#device').evaluate(node=>document.activeElement===node));
  await frame.locator('#device').selectOption('desktop');
  await frame.locator('#scene').selectOption('navigation-expanded');
  assert.equal(await frame.locator('.sidebar [data-nav-focus="toggle:home-nav"]').getAttribute('aria-expanded'),'true');
  assert.equal(await frame.locator('.sidebar [data-page-id="story"]').isVisible(),true);
  const arrow=await frame.locator('.sidebar [data-nav-focus="toggle:home-nav"] svg').boundingBox();
  const title=await frame.locator('.sidebar [data-page-id="home"] .page-tree-title').boundingBox();
  assert(Math.abs(arrow.y+arrow.height/2-title.y-title.height/2)<1.5,'Chevron and title centers align');
  await page.screenshot({path:`test-results/review-focus/expanded-${width}.png`,fullPage:true});
  // This review state must reproduce its expansion despite a saved collapse.
  const rev=app.session.active();await page.goto(`${app.internalPreviewBase}/r/${rev.id}/pages/workbench.html?state=navigation-expanded`);
  await page.locator('.sidebar [data-page-id="story"]').waitFor();
  await page.getByRole('button',{name:'收起首页',exact:true}).click();await page.reload();
  await page.locator('.sidebar [data-page-id="story"]').waitFor();
  assert.equal(await page.locator('#scene').inputValue(),'navigation-expanded');
  await page.screenshot({path:`test-results/review-focus/navigation-icons-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('Review focus passed: native select clicks keep focus/typing in the host composer, prototype pointer handlers suppressed only in comment mode, preview/native forms work, expanded state is reproducible, SVG/title centers align on desktop/mobile.');
} finally {await browser.close();await app.close();await rm(root,{recursive:true,force:true});}
