import assert from 'node:assert/strict';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-editing-'));await cp('design',path.join(root,'design'),{recursive:true});
const app=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:path.join(root,'design')}));const browser=await chromium.launch();
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(app.info().reviewUrl);
 const frame=page.frameLocator('iframe').first();await frame.locator('[data-review-id="design-canvas"]').waitFor();
 await frame.locator('[data-review-id="sample-headline"]').click();await page.getByLabel('评论内容',{exact:true}).fill('First saved');await page.getByLabel('评论内容',{exact:true}).press('Control+Enter');
 await page.getByText('First saved',{exact:true}).waitFor();
 await frame.locator('[data-review-id="sample-cta"]').click();await page.getByLabel('评论内容',{exact:true}).fill('Second saved');await page.getByLabel('评论内容',{exact:true}).press('Control+Enter');
 await page.getByText('Second saved',{exact:true}).waitFor();assert((await page.locator('#active-comments .comment-card').first().textContent()).includes('Second saved'));
 await frame.locator('[data-review-id="sample-headline"]').click();
 await page.waitForFunction(()=>document.getElementById('comment-text')?.value==='First saved'&&!document.getElementById('composer').hidden);
 assert.equal(await page.getByLabel('评论内容',{exact:true}).inputValue(),'First saved');
 const card=page.locator('#active-comments .comment-card').filter({hasText:'First saved'});
 assert.equal(await card.locator('#composer').count(),1);await page.getByLabel('评论内容',{exact:true}).fill('First edited');await page.getByLabel('评论内容',{exact:true}).press('Control+Enter');
 await page.getByText('First edited',{exact:true}).waitFor();assert.equal(app.session.context().comments.length,2);
 await page.getByRole('button',{name:'品牌标志',exact:true}).click();await frame.getByRole('heading',{name:'品牌标志',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].length===3&&[...document.querySelectorAll('iframe')].every(f=>Number(f.height)<700));
 assert.deepEqual(await page.locator('iframe').evaluateAll(frames=>frames.map(f=>f.width)),Array(3).fill('1280'));
 // Invalid or unrelated messages cannot change a page's logical device viewport.
 await page.getByRole('button',{name:'设计工作区',exact:true}).click();await frame.locator('[data-review-id="design-canvas"]').waitFor();assert.equal(await page.locator('iframe').getAttribute('height'),'900');
 assert.deepEqual(errors,[]);console.log('Live review editing passed: newest-first, Ctrl+Enter, existing selection edits in place without duplicate comments, component heights fit content, page device heights unchanged.');
}finally{await browser.close();await app.close();await rm(root,{recursive:true,force:true})}
