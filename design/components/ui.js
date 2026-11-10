export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  play:'m8 5 11 7-11 7Z', arrow:'M5 12h14m-6-6 6 6-6 6', chevron:'m9 5 7 7-7 7',
  page:'M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6',
  comment:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM8 10h8M8 14h5',
  check:'m5 12 4 4L19 6', plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6',
  history:'M3 4v6h6M3 10a9 9 0 1 1 0 5M12 7v5l3 2',
  desktop:'M3 4h18v13H3ZM8 21h8M12 17v4', mobile:'M7 2h10v20H7ZM11 18h2',
  target:'M12 3v4m0 10v4M3 12h4m10 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  archive:'M3 3h18v5H3ZM5 8v13h14V8M9 12h6', link:'m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
};
export function icon(name, cls='') {return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.page}"/></svg>`}
export function button(label, {action='',variant='secondary',symbol='',disabled=false,id='',shortcut='',pressed,version=''}={}) {return `<button type="button" class="button ${variant}" ${action?`data-action="${action}"`:''} ${disabled?'disabled':''} ${id?`data-review-id="${id}"`:''} ${pressed===undefined?'':`aria-pressed="${pressed}"`} ${shortcut?`aria-keyshortcuts="${escapeHtml(shortcut)}"`:''} ${shortcut||version?`aria-describedby="${shortcut?'shortcut-help':''} ${version?'preview-version-description':''}"`:''}>${symbol?icon(symbol):''}<span>${label}</span>${version?`<span class="preview-version" aria-hidden="true" title="版本 ${escapeHtml(version)}">${escapeHtml(version)}</span>`:''}${shortcut?`<kbd aria-hidden="true">${escapeHtml(shortcut)}</kbd>`:''}</button>${version?`<span id="preview-version-description" class="sr-only">当前版本 ${escapeHtml(version)}</span>`:''}`}
export function workspaceBrand() {return `<a class="workspace-brand" href="workbench.html" aria-label="如意设计工作区" data-review-id="workspace-brand"><img src="../assets/ruyi-mark.svg" alt="" width="40" height="40"/><span class="workspace-brand-name">如意设计</span><span class="workspace-brand-en">RUYI DESIGN</span></a>`}
export function badge(label,tone='neutral'){return `<span class="badge ${tone}">${label}</span>`}
export function commentCard({text='标题可以再松弛一点，增加行高。',status='待处理',archived=false,selected=false,id='sample',editor='',resolution='',context='首页 · 桌面'}={}) {
 return `<article class="comment-card ${selected?'selected':''}" data-review-id="comment-${escapeHtml(id)}" data-comment-id="${escapeHtml(id)}"><div class="comment-meta">${escapeHtml(context)} · ${archived?(resolution==='confirmed'?'已解决':'已归档'):status}</div>${editor||`<p>${escapeHtml(text)}</p>`}${status==='待复核'?'<div class="ai-reply"><strong>AI</strong><span>已调整标题行高与上下留白，请体验后确认。</span></div>':''}<div class="comment-actions">${!archived&&status==='待处理'?button('编辑',{action:'edit',variant:'text'})+button('删除',{action:'delete',variant:'text'}):''}${button('定位',{action:'locate',variant:'text'})}${button('查看原版本',{action:'compare',variant:'text'})}${archived?button('重新打开',{action:'reopen',variant:'text'}):status==='待复核'?button('确认解决',{action:'resolve',variant:'text'}):''}${!archived?button('归档',{action:'archive',variant:'text'}):''}${button('回复',{action:'reply',variant:'text'})}</div></article>`;
}
export function revisionBanner(kind='current') {return kind==='deleted'?`<div class="revision-banner warning">${icon('history')}<div><strong>这部分内容已删除</strong><p>保留原始评论和原版本，可对照查看修改前的内容。</p></div>${button('查看原版本',{action:'original',variant:'secondary'})}</div>`:`<div class="revision-banner">${icon('check')}<div><strong>新版本已发布，等你复核</strong><p>本轮调整了标题留白与按钮层次，已有评论和交互上下文仍然保留。</p></div>${button('查看修改',{action:'review',variant:'secondary'})}</div>`}
export const samplePages = [
 {id:'home', name:'首页', states:[{id:'default',name:'默认',devices:['desktop','mobile']},{id:'empty',name:'空内容',devices:['desktop']}]},
 {id:'story',name:'品牌故事',states:[{id:'default',name:'默认',devices:['desktop','mobile']},{id:'reading',name:'阅读模式',devices:['mobile']}]},
 {id:'contact',name:'联系与到访',states:[{id:'default',name:'默认',devices:['desktop','mobile']}]},
];
export const sampleDevices = [{id:'desktop',name:'桌面 · 1280',width:1280,height:800},{id:'mobile',name:'手机 · 390',width:390,height:844}];
export function shortcutHelp({hidden=false}={}) {return `<p class="shortcut-description ${hidden?'sr-only':''}" id="shortcut-help">非输入时：C 切换预览，← → 切换设备，↑ ↓ 切换页面状态。到首尾不循环；预览画布中的方向键留给页面。</p>`}
export function deviceSelector(device='desktop', {state='default',states=samplePages[0].states,devices=sampleDevices,kind='page'}={}) {
 const keyHint=(text)=>`<kbd aria-hidden="true">${text}</kbd>`;
 return `<div class="view-controls">${kind==='page'?`<label><span>状态 ${keyHint('↑ ↓')}</span><select id="scene" aria-label="设计状态" aria-describedby="shortcut-help" aria-keyshortcuts="ArrowUp ArrowDown">${states.map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===state?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}</select></label>`:''}<label><span>设备 ${kind==='tokens'?'':keyHint('← →')}</span><select id="device" aria-label="设计设备" ${kind==='tokens'?'disabled':'aria-keyshortcuts="ArrowLeft ArrowRight"'} aria-describedby="shortcut-help">${devices.map(d=>`<option value="${escapeHtml(d.id)}" ${device===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}</select></label></div>`;
}
export function navigation(active='home',{components=[]}={}) {return `<nav class="page-nav" aria-label="设计页面"><div class="section-label">页面 <span>03</span></div>${samplePages.map(({id,label,name},i)=>`<button class="nav-item ${active===id?'active':''}" data-action="select-page" data-page="${id}" ${active===id?'aria-current="page"':''}>${icon('page')}<span>${name}</span>${i===0?'<span class="tiny-dot"></span>':''}</button>`).join('')}<div class="section-label spaced">设计系统</div><button class="nav-item ${active==='tokens'?'active':''}" data-action="tokens" ${active==='tokens'?'aria-current="page"':''}>${icon('plus')}<span>设计令牌</span></button>${components.map(c=>`<button class="nav-item ${active===`component:${c.id}`?'active':''}" data-action="component" data-component="${escapeHtml(c.id)}" ${active===`component:${c.id}`?'aria-current="page"':''}>${icon('page')}<span>${escapeHtml(c.name)}</span></button>`).join('')}</nav>`}
// Preserve an explicitly selected gateway port on dynamically generated assets
// and links, just as on the original HTML entry. Direct local hosting is unchanged.
export function routedMarkup(html) {
 const port=new URLSearchParams(location.search).get('port');
 if(!port)return html;
 return html.replace(/\b(src|href)="([^"]+)"/g,(attribute,name,value)=>{
  if(value.startsWith('#'))return attribute;
  const url=new URL(value,location.href);
  if(url.origin!==location.origin)return attribute;
  url.searchParams.set('port',port);
  return `${name}="${escapeHtml(url.href)}"`;
 });
}
