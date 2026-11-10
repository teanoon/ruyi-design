import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {chromium} from 'playwright';
const root=await mkdtemp(path.join(os.tmpdir(),'ruyi-conversation-sdk-')),design=path.join(root,'design');await mkdir(design);
await writeFile(path.join(design,'manifest.json'),JSON.stringify({schemaVersion:1,id:'conversation',name:'Conversation review',devices:[{id:'desktop',name:'Desktop',width:1000,height:700}],pages:[{id:'home',name:'Home',states:[{id:'default',name:'Default',entries:{desktop:{path:'index.html'}}}]}]}));
const html=title=>`<!doctype html><html><head><title>Design</title></head><body><h1>${title}</h1><button data-review-id="sample">Comment target</button></body></html>`;
const file=path.join(design,'index.html');await writeFile(file,html('Before'));
const client=new Client({name:'conversation-sdk-test',version:'1'});let browser;
const raw=(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:120000});
async function call(name,args){const r=await raw(name,args),v=r.structuredContent??JSON.parse(r.content[0].text);assert(!r.isError,JSON.stringify(v));return v}
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/cli/index.js'),'mcp'],stderr:'pipe',env:process.env}));
 const tools=(await client.listTools()).tools;assert.equal(tools.length,9);assert(tools.find(t=>t.name==='ruyi_design_publish_revision').inputSchema.properties.source);
 const info=await call('ruyi_design_start_review',{projectRoot:root,designRoot:design}),sid={sessionId:info.sessionId};
 browser=await chromium.launch();const page=await browser.newPage();await page.goto(info.reviewUrl);const frame=()=>page.frameLocator('iframe').first();
 await frame().getByRole('button',{name:'Comment target',exact:true}).click();await page.getByLabel('评论内容',{exact:true}).fill('Saved for a later feedback round');await page.getByRole('button',{name:'保存评论',exact:true}).click();await page.getByText('Saved for a later feedback round',{exact:true}).waitFor();
 const before=await call('ruyi_design_get_review_context',sid),location=page.url();
 const publish={...sid,source:'conversation',request:'Refine both logo concepts from the user conversation',idempotencyKey:'conversation-1',expectedBaseRevision:info.revisionId};
 assert((await raw('ruyi_design_publish_revision',{...publish,request:undefined})).isError);
 await writeFile(file,html('After'));
 const revision=await call('ruyi_design_publish_revision',publish);assert.equal(revision.source,'conversation');assert.equal(revision.batchId,undefined);assert.equal(revision.baseRevision,info.revisionId);
 await frame().getByRole('heading',{name:'After',exact:true}).waitFor();assert.equal(page.url(),location);
 const after=await call('ruyi_design_get_review_context',sid);assert.equal(after.sessionId,info.sessionId);assert.deepEqual(after.comments,before.comments);assert.deepEqual(after.batches,before.batches);
 assert.equal((await call('ruyi_design_publish_revision',publish)).id,revision.id);
 assert((await raw('ruyi_design_publish_revision',{...publish,request:'Different request'})).isError);
 await writeFile(file,html('Broken')+'<script>throw new Error("invalid direct candidate")</script>');
 const retry={...publish,idempotencyKey:'recover-candidate',expectedBaseRevision:revision.id};assert((await raw('ruyi_design_publish_revision',retry)).isError);
 assert.equal((await call('ruyi_design_get_review_context',sid)).revision.id,revision.id);await frame().getByRole('heading',{name:'After',exact:true}).waitFor();
 await writeFile(file,html('Recovered'));const recovered=await call('ruyi_design_publish_revision',retry);await frame().getByRole('heading',{name:'Recovered',exact:true}).waitFor();
 const original=await page.request.get(`${info.previewUrl}/r/${info.revisionId}/index.html`);assert((await original.text()).includes('<h1>Before</h1>'));
 await call('ruyi_design_end_review',sid);const reopened=await call('ruyi_design_start_review',{projectRoot:root,designRoot:design});assert.equal(reopened.sessionId,info.sessionId);assert.equal(reopened.revisionId,recovered.id);
 const final=await call('ruyi_design_get_review_context',sid);assert.deepEqual(final.comments,before.comments);assert.equal(final.batches.length,0);assert.equal((await call('ruyi_design_publish_revision',retry)).id,recovered.id);await call('ruyi_design_end_review',sid);
 console.log('Conversation MCP/browser passed: nine tools, explicit request validation, same session and URL, automatic revision update, untouched comments/no batches, idempotency/conflict, failed candidate recovery, original version, restart.');
}finally{await browser?.close();await client.close();await rm(root,{recursive:true,force:true})}
