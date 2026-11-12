import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { ReviewServer, startSchema } from '../../dist/server/index.js';

const root = await mkdtemp(path.join(os.tmpdir(), 'ruyi-popup-comments-'));
const design = path.join(root, 'design');
await mkdir(design);
const kinds = ['modal', 'popover', 'dom', 'stack'];
await writeFile(path.join(design, 'manifest.json'), JSON.stringify({
  schemaVersion: 1, id: 'popup-comments', name: 'Popup comments',
  devices: [{ id: 'desktop', name: 'Desktop', width: 800, height: 650 }],
  pages: [{ id: 'home', name: 'Popup', states: kinds.map(kind => ({
    id: kind, name: kind, entries: { desktop: { path: 'index.html', query: { kind } } },
  })) }],
  components: [{ id: 'popup', name: 'Popup component', implementation: ['index.html'],
    examples: [{ id: 'open', name: 'Open', entries: { desktop: { path: 'index.html', query: { kind: 'modal' } } } }] }],
}));
await writeFile(path.join(design, 'index.html'), `<!doctype html><html><head><style>
body{margin:0;min-height:500px;background:white}button,input,select{display:block;margin:12px;padding:10px}
dialog,[popover],.layer{box-sizing:border-box;width:300px;padding:24px;background:white;color:black;border:2px solid black}
dialog::backdrop{background:rgb(50,50,50)}
[popover]{margin:auto;inset:0;padding:24px}
.layer{position:fixed;left:250px;top:120px;z-index:2147483647}
</style></head><body>
<button id="reopen">Open</button><dialog id="lower"><button id="lower-target">Lower</button></dialog>
<script>
const kind=new URLSearchParams(location.search).get('kind')||'modal';
if(kind!=='stack')lower.remove();
const layer=document.createElement(kind==='modal'||kind==='stack'?'dialog':'div');
layer.id='layer';
if(kind==='popover')layer.setAttribute('popover','auto');
if(kind==='dom')layer.className='layer';
layer.innerHTML='<button data-review-id="target" id="target">Target</button><input id="field" aria-label="Prototype input"><select id="select"><option>One</option><option>Two</option></select><span>Anonymous target</span><button id="close">Close</button>';
document.body.append(layer);
window.actions=0;
target.addEventListener('click',()=>window.actions++);
function open(){
 if(kind==='stack'&&!lower.open)lower.showModal();
 if(layer.tagName==='DIALOG'){if(!layer.open)layer.showModal()}
 else if(kind==='popover'){if(!layer.matches(':popover-open'))layer.showPopover()}
 else layer.hidden=false;
}
function close(){if(layer.tagName==='DIALOG')layer.close();else if(kind==='popover')layer.hidePopover();else layer.hidden=true}
document.getElementById('close').onclick=close;reopen.onclick=open;
window.ruyiDesignReviewState={exportState:()=>({open:layer.tagName==='DIALOG'?layer.open:kind==='popover'?layer.matches(':popover-open'):!layer.hidden}),restoreState:s=>{if(s.open)open();else close()}};
open();
</script></body></html>`);

const server = await ReviewServer.start(startSchema.parse({ projectRoot: root, designRoot: design }));
const browser = await chromium.launch();
let page;
try {
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mkdir('test-results/popup-comments', { recursive: true });
  const frame = () => page.frameLocator('iframe').first();
  const outline = () => frame().locator('[data-ruyi-design-overlay]');
  const editor = () => page.getByLabel('评论内容', { exact: true });
  const revealCanvas = () => page.locator('iframe').first().scrollIntoViewIfNeeded();
  const cancel = async () => {
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await revealCanvas();
  };
  const preview = () => page.locator('#preview-toggle').click();
  const send = (type, payload) => page.locator('iframe').first().evaluate((f, m) => {
    f.contentWindow.postMessage({ channel: 'ruyi-design', version: 1, frameId: f.name, ...m }, '*');
  }, { type, payload });

  // A visibility assertion alone passes for an outline hidden behind a modal.
  // Temporarily enable hit-testing to prove stacking/clipping at its border,
  // then restore pointer transparency before every real user interaction.
  const assertHighlight = async selector => {
    await outline().waitFor({ state: 'visible' });
    const result = await frame().locator(selector).evaluate(target => {
      const o = document.querySelector('[data-ruyi-design-overlay]');
      const a = target.getBoundingClientRect(), b = o.getBoundingClientRect();
      const before = o.style.pointerEvents;
      o.style.pointerEvents = 'auto';
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + 1);
      o.style.pointerEvents = before;
      return { above: top === o, delta: Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.width-b.width), Math.abs(a.height-b.height)), pointer: getComputedStyle(o).pointerEvents };
    });
    assert(result.above, `${selector}: highlight must paint above popup and backdrop`);
    assert(result.delta < 1, `${selector}: highlight must align with target: ${result.delta}`);
    assert.equal(result.pointer, 'none');
  };

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const kind of kinds) {
      await page.goto(server.info().reviewUrl);
      await page.locator('#state').selectOption(kind);
      const target = () => frame().locator('#target');
      await target().click();
      await page.waitForFunction(() => document.activeElement === document.getElementById('comment-text'));
      console.log(`${width}/${kind}: selection reached host composer`);
      await assertHighlight('#target');
      assert.equal(await target().evaluate(() => window.actions), 0);
      const text = `${width}/${kind} popup comment`;
      await editor().fill(text);
      await page.keyboard.type(' input');
      assert.equal(await editor().inputValue(), text + ' input');
      await page.getByRole('button', { name: '保存评论', exact: true }).click();
      const card = () => page.locator('.comment-card').filter({ has: page.getByText(text + ' input', { exact: true }) });
      await card().waitFor();
      const saved = server.session.context().comments.find(c => c.text === text + ' input');
      assert.equal(saved.target.context.anchor.reviewId, 'target');
      assert.equal(saved.target.context.state.custom.open, true);
      const count = server.session.context().comments.length;
      await revealCanvas();
      await target().click();
      assert.equal(await editor().inputValue(), text + ' input');
      await cancel();
      assert.equal(server.session.context().comments.length, count);

      for (const selector of ['#field', '#select', '#layer > span']) {
        await frame().locator(selector).click();
        await page.waitForFunction(() => document.activeElement === document.getElementById('comment-text'));
        await assertHighlight(selector);
        await editor().fill('focus');
        await page.keyboard.type(' retained');
        assert.equal(await editor().inputValue(), 'focus retained');
        await cancel();
      }

      await preview();
      await outline().waitFor({ state: 'hidden' });
      await target().click();
      assert.equal(await target().evaluate(() => window.actions), 1);
      await frame().locator('#field').fill('native input');
      await frame().locator('#select').selectOption({ label: 'Two' });
      await frame().locator('#close').click();
      if (kind === 'stack') {
        await preview();
        await frame().locator('#lower-target').click();
        await assertHighlight('#lower-target');
        await cancel();
        await preview();
        await frame().locator('#lower').evaluate(e => e.close());
      }
      await frame().locator('#reopen').click();
      await preview();
      await target().hover();
      await assertHighlight('#target');

      // Locate recreates the iframe and uses the saved custom state.
      await card().getByRole('button', { name: '定位', exact: true }).click();
      await page.getByText('已切换到评论对应的设计并定位元素。', { exact: true }).waitFor();
      await assertHighlight('#target');
      assert.equal(server.session.context().comments.find(c => c.id === saved.id).target.context.anchor.selector, saved.target.context.anchor.selector);

      // Escape hides the helper, removal/closure clears stale highlights.
      await frame().locator('#target').press('Escape');
      await outline().waitFor({ state: 'hidden' });
      // Reopen via the declared state API (Escape may dismiss a native popup).
      await target().evaluate(() => window.ruyiDesignReviewState.restoreState({ open: true }));
      await target().hover();
      await assertHighlight('#target');
      await target().evaluate(e => e.remove());
      await outline().waitFor({ state: 'hidden' });
      await send('locate', { selector: '#target' });
      await page.getByText('定位已失效或存在歧义，保留原版本评论上下文。', { exact: true }).waitFor();

      await send('mode', 'readonly');
      await frame().locator('#field').click();
      assert(await page.locator('#composer').isHidden());
      assert.equal(server.session.context().comments.length, count);
      console.log(`${width}/${kind}: highlight, focus, save, locate and preview passed`);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(server.info().reviewUrl);
  await page.locator('#state').selectOption('modal');
  // Structural selectors survive helper relocation; no id/reviewId is needed.
  await frame().locator('#layer > span').click();
  await editor().fill('Anonymous popup comment');
  await page.getByRole('button', { name: '保存评论', exact: true }).click();
  const anonymousCard = page.locator('.comment-card').filter({ has: page.getByText('Anonymous popup comment', { exact: true }) });
  await anonymousCard.getByRole('button', { name: '定位', exact: true }).click();
  await page.getByText('已切换到评论对应的设计并定位元素。', { exact: true }).waitFor();
  await assertHighlight('#layer > span');
  const anonymous = server.session.context().comments.find(c => c.text === 'Anonymous popup comment');
  assert.match(anonymous.target.context.anchor.selector, /span:nth-child/);

  // Observe locate acknowledgements so repeated notices cannot mask failures.
  await page.evaluate(() => {
    window.located = [];
    window.addEventListener('message', e => {
      if (e.data?.channel === 'ruyi-design' && e.data.type === 'located') window.located.push(e.data.payload);
    });
  });
  await frame().locator('#field').evaluate(e => { e.style.visibility = 'hidden'; });
  await send('locate', { selector: '#field' });
  await page.waitForFunction(() => window.located.length === 1);
  assert.equal(await page.evaluate(() => window.located.at(-1).ok), false);
  await frame().locator('#field').evaluate(e => { e.style.visibility = ''; e.after(e.cloneNode(true)); });
  await send('locate', { selector: '#field' });
  await page.waitForFunction(() => window.located.length === 2);
  assert.equal(await page.evaluate(() => window.located.at(-1).ok), false);
  await frame().locator('#target').hover();
  await assertHighlight('#target');
  await frame().locator('#layer').evaluate(e => e.close());
  await outline().waitFor({ state: 'hidden' });

  // Component measurement must not grow when the helper is reparented.
  await page.getByRole('button', { name: 'Popup component', exact: true }).click();
  await frame().locator('#target').waitFor();
  await page.waitForFunction(() => Number(document.querySelector('iframe').height) < 650);
  const height = await page.locator('iframe').first().getAttribute('height');
  await frame().locator('#target').click();
  await assertHighlight('#target');
  await cancel();
  // Let both the mutation observer and its scheduled measurement settle.
  await page.waitForTimeout(100);
  assert.equal(await page.locator('iframe').first().getAttribute('height'), height);

  // Simulate an older engine without Popover API; dialog-local fallback works.
  await page.addInitScript(() => { delete HTMLElement.prototype.showPopover; });
  await page.goto(server.info().reviewUrl);
  await page.getByRole('button', { name: 'Popup', exact: true }).click();
  await page.locator('#state').selectOption('modal');
  await frame().locator('#target').hover();
  await assertHighlight('#target');
  assert.equal(await outline().getAttribute('popover'), null);
  assert.deepEqual(errors, []);
  console.log('Popup comments passed.');
} catch (error) {
  await page?.screenshot({ path: 'test-results/popup-comments/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
  await rm(root, { recursive: true, force: true });
}
