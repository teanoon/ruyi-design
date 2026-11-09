import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import path from 'node:path';
const c=new Client({name:'custom-client-key',version:'1'});
try {
 await c.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/cli/index.js'),'mcp'],stderr:'pipe'}));
 assert.equal(c.getServerVersion().name,'ruyi-design-mcp');
 const verbs=['start_review','get_review_context','prepare_update','claim_batch','get_feedback_context','update_feedback','publish_revision','set_feedback_location','end_review'];
 assert.deepEqual((await c.listTools()).tools.map(t=>t.name).sort(),verbs.map(n=>'ruyi_design_'+n).sort());
 for(const uri of ['ruyi-design://guides/review','ruyi-design://schemas/manifest','ruyi-design://templates/manifest'])assert((await c.readResource({uri})).contents.length);
 for(const uri of ['uxai://guides/prototype-review','ruyi-uxai://guides/review']) await assert.rejects(c.readResource({uri}));
 assert.equal((await c.callTool({name:'ruyi_uxai_get_review_context',arguments:{sessionId:'none'}})).isError,true);
 assert.equal((await c.callTool({name:'get_review_context',arguments:{sessionId:'none'}})).isError,true);
 console.log('Brand MCP contract passed: identity, 9 names, resources, legacy rejection, independent client alias.');
} finally {await c.close();}
