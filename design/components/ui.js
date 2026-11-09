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
export function button(label, {action='',variant='secondary',symbol='',disabled=false,id=''}={}) {return `<button type="button" class="button ${variant}" ${action?`data-action="${action}"`:''} ${disabled?'disabled':''} ${id?`data-review-id="${id}"`:''}>${symbol?icon(symbol):''}${label}</button>`}
export function badge(label,tone='neutral'){return `<span class="badge ${tone}">${label}</span>`}
export function commentCard({text='标题可以再松弛一点，增加行高。',status='待处理',archived=false,selected=false,id='sample',editor=''}={}) {
 return `<article class="comment-card ${selected?'selected':''}" data-review-id="comment-${escapeHtml(id)}" data-comment-id="${escapeHtml(id)}"><div class="comment-meta">首页 · 桌面 · ${archived?'已解决':status}</div>${editor||`<p>${escapeHtml(text)}</p>`}${status==='待复核'?'<div class="ai-reply"><strong>AI</strong><span>已调整标题行高与上下留白，请体验后确认。</span></div>':''}<div class="comment-actions">${!archived&&status==='待处理'?button('编辑',{action:'edit',variant:'text'})+button('删除',{action:'delete',variant:'text'}):''}${button('定位',{action:'locate',variant:'text'})}${button('查看原版本',{action:'compare',variant:'text'})}${archived?button('重新打开',{action:'reopen',variant:'text'}):status==='待复核'?button('确认解决',{action:'resolve',variant:'text'}):''}${button('回复',{action:'reply',variant:'text'})}</div></article>`;
}
export function revisionBanner(kind='current') {return kind==='deleted'?`<div class="revision-banner warning">${icon('history')}<div><strong>这部分内容已删除</strong><p>保留原始评论和原版本，可对照查看修改前的内容。</p></div>${button('查看原版本',{action:'original',variant:'secondary'})}</div>`:`<div class="revision-banner">${icon('check')}<div><strong>新版本已发布，等你复核</strong><p>本轮调整了标题留白与按钮层次，已有评论和交互上下文仍然保留。</p></div>${button('查看修改',{action:'review',variant:'secondary'})}</div>`}
export function deviceSelector(device='desktop'){return `<div class="view-controls"><label>设备<select id="device" aria-label="设计设备"><option value="desktop" ${device==='desktop'?'selected':''}>桌面 · 1280</option><option value="mobile" ${device==='mobile'?'selected':''}>手机 · 390</option></select></label><label>状态<select id="scene" aria-label="设计状态"><option value="default">默认</option><option value="empty">空内容</option></select></label></div>`}
export function navigation(active='home'){return `<nav class="page-nav" aria-label="设计页面"><div class="section-label">页面 <span>03</span></div>${[['home','首页'],['story','品牌故事'],['contact','联系与到访']].map(([id,label],i)=>`<button class="nav-item ${active===id?'active':''}" data-action="select-page" data-page="${id}" ${active===id?'aria-current="page"':''}>${icon('page')}<span>${label}</span>${i===0?'<span class="tiny-dot"></span>':''}</button>`).join('')}<div class="section-label spaced">设计系统</div><button class="nav-item" data-action="tokens">${icon('plus')}<span>令牌与组件</span></button></nav>`}
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
