import assert from 'node:assert/strict';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {ReviewServer,startSchema} from '../../dist/server/index.js';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-archive-'));
await cp('examples/starter/design',path.join(root,'design'),{recursive:true});
const server=await ReviewServer.start(startSchema.parse({projectRoot:root,designRoot:path.join(root,'design')}));
const f=server.session.feedback;
const target={kind:'token',objectId:'primary',revisionId:server.info().revisionId};
const unaddressed=f.add('Keep the existing implementation',target);
const batch=f.prepare('unaddressed');const claim=f.claim(batch.id,'test','claim');
f.update(batch.id,claim.leaseToken,'unaddressed',unaddressed.id,'User requested no changes','instance');
server.session.store.transaction(()=>f.published(batch.id,server.info().revisionId));
const reopened=f.add('Reopened comment can be archived',target);f.review(reopened.id,'archive');f.review(reopened.id,'reopen');
const browser=await chromium.launch();
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.info().reviewUrl);
 const first=page.locator(`[data-comment-id="${unaddressed.id}"]`),second=page.locator(`[data-comment-id="${reopened.id}"]`);
 await first.getByRole('button',{name:'归档',exact:true}).click();await page.getByText('已归档（1）',{exact:true}).waitFor();
 assert.equal(f.comment(unaddressed.id).resolution,'archived');assert.equal(f.comment(unaddressed.id).results[0].action,'unaddressed');
 await second.getByRole('button',{name:'归档',exact:true}).click();await page.getByText('已归档（2）',{exact:true}).waitFor();
 await page.locator('#archived-comments summary').click();await first.getByRole('button',{name:'重新打开',exact:true}).click();
 await page.locator('#active-comments').locator(`[data-comment-id="${unaddressed.id}"]`).getByRole('button',{name:'归档',exact:true}).click();
 await page.getByText('已归档（2）',{exact:true}).waitFor();
 await page.reload();await page.getByText('已归档（2）',{exact:true}).waitFor();
 assert.equal(f.comment(unaddressed.id).status,'resolved');assert.equal(f.comment(reopened.id).status,'resolved');assert.deepEqual(errors,[]);
 console.log('Archive browser passed: unaddressed result, reopened draft, archive/reopen/archive, persistence; original unaddressed result retained without claiming a fix.');
}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true})}
