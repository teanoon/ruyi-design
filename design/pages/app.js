import {mountPageNavigation} from '../components/page-navigation.js';
import {icon,button,badge,commentCard,revisionBanner,deviceSelector,navigation,escapeHtml,routedMarkup,samplePages,sampleNavigation,sampleDevices,shortcutHelp,workspaceBrand} from '../components/ui.js';
import {componentExample} from '../components/examples.js';
import {adjacent,bindShortcuts} from '../components/shortcuts.js';
const params=new URLSearchParams(location.search),initial=params.get('state')||'default';
const manifestUrl=new URL('../manifest.json',import.meta.url);
if(params.has('port'))manifestUrl.searchParams.set('port',params.get('port'));
const manifest=await fetch(manifestUrl).then(r=>{if(!r.ok)throw Error('设计清单无法读取');return r.json()});
let state={scene:initial,kind:params.get('sampleKind')||'page',component:params.get('sampleId')||'button',sampleState:params.get('sampleState')||(initial==='navigation-expanded'?'navigation-expanded':'default'),device:params.get('sampleDevice')||(matchMedia('(max-width:760px)').matches?'mobile':'desktop'),selectedPage:params.get('samplePage')||'home',preview:initial==='preview',composing:initial==='commenting',tab:'active',text:'',original:false,sampleExplored:false,selectedElement:params.get('target')==='button'?'button':'headline',editingId:null,replyId:null};
const statusForScene={'feedback-queued':'submitted','feedback-processing':'submitted','feedback-clarification':'needs_clarification','feedback-resolved':'resolved','feedback-archived':'resolved','feedback-original':'awaiting_review','feedback-deleted':'awaiting_review',updated:'awaiting_review'};
state.selectedCommentId=null;state.originalCommentId=initial==='feedback-original'?'headline':null;state.original=initial==='feedback-original';
const primary={id:'headline',text:'标题可以再松弛一点，增加行高。',target:initial==='feedback-deleted'?'note':'headline',status:statusForScene[initial]||'draft',busy:['feedback-queued','feedback-processing'].includes(initial),processing:initial==='feedback-processing',hasHistory:!['default','preview','commenting','navigation-expanded'].includes(initial),savedVersion:'03',thread:[]};
if(primary.hasHistory)primary.savedVersion='02';
if(initial==='feedback-reopened'){primary.previousDraft={status:'resolved',text:primary.text,resolution:'confirmed'};primary.thread=[{author:'user',text:'标题仍然有些紧，请再调整一下。'}];}
if(primary.status==='resolved')primary.resolution=initial==='feedback-archived'?'archived':'confirmed';
state.comments=[...(initial==='feedback-legacy'?[{id:'legacy-headline',text:'旧版本留下的另一条标题反馈。',target:'headline',status:'resolved',resolution:'archived',hasHistory:true,savedVersion:'01',legacy:true,thread:[{author:'agent',text:'历史记录保留，不与当前讨论自动合并。'}]}]:[]),primary,{id:'button',text:'主按钮与正文之间再留一些呼吸感。',target:'button',status:'draft',savedVersion:'03'},{id:'archived',text:'说明文字已调整，符合品牌的语气。',target:'description',status:'resolved',resolution:'confirmed',hasHistory:true,savedVersion:'02',thread:[]}].map(c=>({...c,page:'home',sampleState:'default',device:state.device}));
if(['feedback-resolved','feedback-archived'].includes(initial)){state.tab='archived';state.selectedCommentId='headline';}
const app=document.getElementById('app');
let saveNotice;
let simulatedSave=params.get('commentSave');
const submissions=new Map();
const cardOperations=new Map();
const currentPage=()=>samplePages.find(p=>p.id===state.selectedPage)||samplePages[0];
const currentState=()=>currentPage().states.find(s=>s.id===state.sampleState)||currentPage().states[0];
const currentComponent=()=>manifest.components.find(c=>c.id===state.component)||manifest.components[0];
const availableDevices=()=>state.kind==='page'?sampleDevices.filter(d=>currentState().devices.includes(d.id)):state.kind==='component'?sampleDevices.filter(d=>currentComponent().examples.some(e=>e.entries[d.id])):sampleDevices;
function normalize(){state.selectedPage=currentPage().id;state.sampleState=currentState().id;state.component=currentComponent().id;const available=availableDevices();if(!available.some(d=>d.id===state.device))state.device=available[0].id;}
function syncUrl(){const url=new URL(location.href);for(const [key,value] of Object.entries({sampleKind:state.kind,sampleId:state.component,samplePage:state.selectedPage,sampleState:state.sampleState,sampleDevice:state.device}))url.searchParams.set(key,value);history.replaceState(null,'',url);}
function commentList(archived){return state.comments.filter(c=>(c.status==='resolved')===archived).reverse()}
function commentContext(c){return `${samplePages.find(p=>p.id===(c.page||'home'))?.name||'首页'} / ${c.sampleState==='empty'?'空内容':c.sampleState==='reading'?'阅读模式':'默认'} · ${c.device==='mobile'?'手机':'桌面'}`}
const commentStatus=c=>c.busy?(c.processing?'处理中':'已纳入更新'):({draft:'待处理',submitted:'已纳入更新',needs_clarification:'待澄清',awaiting_review:'待复核',resolved:'已解决'})[c.status];
function cards(archived){return commentList(archived).map(c=>commentCard({text:c.text,id:c.id,archived,resolution:c.resolution,context:commentContext(c),status:commentStatus(c),busy:c.busy,reopened:!!c.previousDraft,hasHistory:c.hasHistory,hasOriginal:c.savedVersion!=='03',thread:c.thread||[],legacy:c.legacy,submission:submissions.get(c.id),pendingAction:cardOperations.get(c.id),selected:c.id===state.selectedCommentId||c.id===state.editingId||c.id===state.replyId,editor:!state.preview&&(c.id===state.editingId||c.id===state.replyId)?composer():''})).join('')}
function matchingComments(target){return state.comments.filter(c=>c.target===target.target&&(c.page||'home')===target.page&&(c.device||'desktop')===target.device&&(c.sampleState||'default')===target.sampleState)}
function existingComment(target){return matchingComments(target).findLast(c=>c.status!=='resolved')}
function elementSelector(c){return `[data-review-id="sample-${({button:'cta'})[c.target]||c.target}"]`}
function locate(c,{original=false}={}){state.original=original;state.originalCommentId=original?c.id:null;state.kind='page';state.preview=false;state.selectedPage=c.page||'home';state.sampleState=c.sampleState||'default';state.device=c.device||'desktop';state.selectedElement=c.target||'headline';state.selectedCommentId=c.id;render(true);const target=document.querySelector(elementSelector(c));if(target){target.classList.add('located-element');target.scrollIntoView({block:'center'});target.focus({preventScroll:true});}else toast('无法定位当前元素，原评论与历史仍保留。');}
function site({old=false,deleted=false}={}){
 const title=state.selectedPage==='story'?'把日子过慢一点，<br/>让故事长出来。':state.selectedPage==='contact'?'下一次相遇，<br/>在山野之间。':state.sampleExplored?'走近山野，<br/>也走近自己。':'在日常里，<br/>找到一点旷野。';
 return `<div class="sample-site" tabindex="0" aria-label="示例页面交互区域"><header><strong class="sample-brand">山野拾光<span style="font-size:8px;display:block;letter-spacing:2px">SHAN YE STUDIO</span></strong><nav class="sample-nav" aria-label="画布示例导航"><span>品牌故事</span><span>山野手记</span><span>联系与到访</span></nav></header><div class="sample-hero"><div><p class="sample-kicker">A LITTLE CLOSER TO NATURE</p><h2 class="${state.scene==='commenting'&&state.selectedElement==='headline'?'annotation':''}" data-action="select-element" data-review-id="sample-headline" tabindex="0" ${old?'style="line-height:1.15"':''}>${title}</h2><p class="sample-description" data-action="select-element" data-review-id="sample-description" tabindex="0">在喧嚣之外，留一处安静的空白。<br/>我们从山川、草木与手作里，<br/>收集那些值得被认真对待的日常。</p>${old&&deleted?'<p class="old-note" data-review-id="sample-note" tabindex="0">向下滚动，发现更多生活灵感。</p>':deleted?'<div class="deleted-note" data-review-id="sample-note" tabindex="0">此处已删除 · 原始说明文字</div>':''}<button ${old?'disabled':''} class="sample-cta ${state.scene==='commenting'&&state.selectedElement==='button'?'annotation':''}" data-action="${state.preview?'explore':'select-element'}" data-review-id="sample-cta">${state.sampleExplored?'回到日常':'慢慢探索'}${icon('arrow')}</button></div><img src="../assets/landscape.svg" alt="松林、山川与温暖日光的插画"/></div>${state.selectedPage==='contact'?`<form class="sample-contact"><label>你的称呼<input name="visitor" placeholder="填写称呼" ${old?'readonly':''}/></label><label>到访目的<select name="visit" ${old?'disabled':''}><option>设计交流</option><option>到访工作室</option></select></label></form>`:''}<div class="sample-footer"><span>MADE WITH TIME & CARE</span><span>山野拾光 © 2026</span></div></div>`;
}
function composer(){return `<form class="composer" id="comment-form" data-review-id="comment-composer"><label for="comment">${state.editingId?'编辑评论':state.replyId?'回复评论':'添加元素评论'}</label><div class="hint">${escapeHtml(commentContext(state.comments.find(c=>c.id===(state.editingId||state.replyId))||state.newCommentTarget||{page:state.selectedPage,device:state.device,sampleState:state.sampleState}))}</div><textarea id="comment" required placeholder="描述你希望如何改进…">${escapeHtml(state.text)}</textarea><div class="composer-actions"><span class="shortcut-hint">Ctrl / ⌘ + Enter 保存</span>${button('取消',{action:'cancel-comment'})}<button class="button primary" type="submit">保存评论</button></div></form>`}
function panel(){const archived=state.tab==='archived',activeCount=commentList(false).length,archiveCount=commentList(true).length;return `<aside class="feedback-panel" data-review-id="feedback-panel"><div class="panel-heading"><h2>评审反馈</h2>${badge(archived?archiveCount:activeCount)}</div><p class="hint">${state.original?'正在查看评论原版本，画布只读；右侧可继续讨论。':state.preview?'正在体验设计，退出预览后可选择元素评论。':'点击元素即可添加评论或打开进行中的讨论。'}</p><div class="comment-tabs"><button class="${!archived?'active':''}" data-action="active-comments">进行中 ${activeCount}</button><button class="${archived?'active':''}" data-action="archive-comments">已归档 ${archiveCount}</button></div>${saveNotice?`<div class="hint"><span role="${saveNotice.tone}">${saveNotice.message}</span>${saveNotice.action?button(saveNotice.label,{action:saveNotice.action}):''}</div>`:''}${state.composing&&!state.preview&&!state.editingId&&!state.replyId?composer():''}${cards(archived)||'<p class="hint">这里暂时没有评论。</p>'}</aside>`}
function showcaseContent(){if(state.kind==='tokens')return `<div class="prototype-tokens">${manifest.tokens.map(t=>`<article data-review-id="token-${escapeHtml(t.id)}"><span class="token-swatch" style="${t.type==='color'?`background:${escapeHtml(t.value)}`:''}"></span><strong>${escapeHtml(t.name)}</strong><code>${escapeHtml(t.value)}</code><small>${escapeHtml(t.description)}</small></article>`).join('')}</div>`;return currentComponent().examples.filter(e=>e.entries[state.device]).map(e=>`<section class="component-example" data-review-id="example-${state.component}-${e.id}"><div class="artboard-heading"><strong>${escapeHtml(e.name)}</strong><span>${state.device==='mobile'?'390':'1280'}px 宽 · 高度自适应</span></div><div class="example-content">${componentExample(state.component,e.id).replace(/\b(id|for|aria-describedby)="([^"]+)"/g,(_,attribute,id)=>`${attribute}="${id.split(' ').map(value=>`example-${state.component}-${e.id}-${value}`).join(' ')}"`)}</div></section>`).join('')}
function workbench(){const isPage=state.kind==='page',title=isPage?currentPage().name:state.kind==='tokens'?'设计令牌':currentComponent().name,device=sampleDevices.find(d=>d.id===state.device);return `<div class="app-layout"><aside class="sidebar" data-review-id="workspace-navigation">${button(state.preview?'退出预览':'预览',{action:'toggle-preview',symbol:state.preview?'close':'play',variant:state.preview?'primary preview-button':'secondary preview-button',id:'preview-toggle',shortcut:state.original?'':'C',pressed:state.preview,version:'03',disabled:state.original})}${navigation(isPage?state.selectedPage:state.kind==='tokens'?'tokens':`component:${state.component}`,{components:manifest.components})}<div class="sidebar-footer" data-review-id="sidebar-footer">${workspaceBrand()}</div></aside><main class="workspace" id="main" tabindex="-1"><div class="toolbar"><div><div class="eyebrow">${isPage?(state.preview?'交互预览':'页面设计'):'设计系统'}</div><h1>${title}${isPage?` <span class="state-title">/ ${currentState().name}</span>`:''}</h1></div>${deviceSelector(state.device,{state:state.sampleState,states:currentPage().states,devices:availableDevices(),kind:state.kind})}</div>${shortcutHelp({hidden:true})}<div class="canvas">${state.original?`<div class="revision-banner warning" data-review-id="original-notice" role="status"><div><strong>正在查看评论原版本 · 只读</strong><p>评论保存时的设计；右侧讨论和未保存内容保持不变。</p></div>${button('返回最新版本',{action:'original'})}</div>`:state.scene==='updated'?revisionBanner():''}<div class="canvas-top"><span>${icon(state.preview?'play':'target')}${state.original?'原版本 · 只读查看':state.preview?'预览模式 · 直接体验页面':'元素评论 · 点击即可留下想法'}</span><span class="zoom">适应画布</span></div>${isPage?`<section class="artboard ${state.device==='mobile'?'mobile-board':''}" data-review-id="design-canvas"><div class="artboard-heading"><strong>${title} / ${currentState().name}</strong><span>${device.width} × ${device.height}</span></div>${state.sampleState==='empty'?'<div class="empty-state" tabindex="0"><h2>这个页面还没有内容</h2><p>可以先为页面添加设计稿，再回到这里预览。</p></div>':site({old:state.original,deleted:initial==='feedback-deleted'})}</section>`:`<div class="system-examples ${state.device==='mobile'?'mobile-examples':''}">${showcaseContent()}</div>`}</div></main>${panel()}</div>`}
function toast(text){document.querySelector('.toast')?.remove();const n=document.createElement('div');n.className='toast';n.setAttribute('role','status');n.textContent=text;document.body.append(n);setTimeout(()=>n.remove(),4000)}
let pageNavigation;
let navigationHost;
function render(reveal=false){normalize();const focusId=document.activeElement?.id;const navFocus=navigationHost?.contains(document.activeElement)?document.activeElement?.dataset.navFocus:null;if(navigationHost)navigationHost.remove();document.title='设计工作区 · 如意设计';app.innerHTML=routedMarkup(workbench());const placeholder=app.querySelector('[data-prototype-page-navigation]');if(!navigationHost)navigationHost=placeholder;else placeholder.replaceWith(navigationHost);const navOptions={projectId:'ruyi-product-prototype',initialExpanded:state.sampleState==='navigation-expanded'?['home-nav']:[],pages:samplePages,nodes:sampleNavigation,activePage:state.kind==='page'?state.selectedPage:undefined,onSelect:id=>{state.kind='page';state.selectedPage=id;normalize();render()}};if(pageNavigation)pageNavigation.update(navOptions,reveal);else pageNavigation=mountPageNavigation(navigationHost,navOptions);if(navFocus)[...navigationHost.querySelectorAll('[data-nav-focus]')].find(n=>n.dataset.navFocus===navFocus)?.focus({preventScroll:true});for(const host of app.querySelectorAll('.component-example [data-prototype-page-navigation]'))mountPageNavigation(host,{...navOptions,projectId:'ruyi-navigation-showcase'});document.body.dataset.scene=state.scene;document.body.dataset.preview=String(state.preview);document.body.dataset.kind=state.kind;if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});syncUrl()}
function cancel(){saveNotice=undefined;state.composing=false;state.editingId=null;state.replyId=null;state.text='';state.newCommentTarget=null;}
function edit(c,reply=false,text=reply?'':c.text){saveNotice=undefined;state.tab=c.status==='resolved'?'archived':'active';state.composing=true;state.editingId=reply?null:c.id;state.replyId=reply?c.id:null;state.selectedElement=c.target||'headline';state.selectedCommentId=c.id;state.text=text;render();document.getElementById('comment')?.focus()}
function chooseDevice(device){if(!availableDevices().some(d=>d.id===device)||device===state.device||state.kind==='tokens')return false;state.device=device;render();return true}
function chooseState(id){if(state.kind!=='page')return false;const target=currentPage().states.find(s=>s.id===id);if(!target||id===state.sampleState)return false;state.sampleState=id;if(id==='navigation-expanded')pageNavigation?.expand(['home-nav']);if(!target.devices.includes(state.device))state.device=target.devices[0];render();return true}
function togglePreview(){if(state.original)return false;state.preview=!state.preview;render();return true}
function perform(action){if(action==='preview')return togglePreview();if(action.startsWith('device-'))return chooseDevice(adjacent(availableDevices().map(d=>d.id),state.device,action==='device-next'?1:-1));if(action.startsWith('state-'))return chooseState(adjacent(currentPage().states.map(s=>s.id),state.sampleState,action==='state-next'?1:-1));return false}
bindShortcuts(document, event=>({preview:state.preview,inCanvas:!!event.target.closest?.('.artboard,.system-examples')}), perform);
app.addEventListener('input',e=>{if(e.target.id==='comment')state.text=e.target.value});
app.addEventListener('change',e=>{if(e.target.id==='device')chooseDevice(e.target.value);if(e.target.id==='scene')chooseState(e.target.value)});
function reportConflict(existing,keepDraft){
 saveNotice={message:keepDraft?'该元素已有进行中的讨论，当前输入已保留。':'该元素已有进行中的讨论。',tone:'status',action:'open-existing',label:keepDraft?'在已有讨论中补充':'打开进行中的讨论',id:existing.id,keepDraft};
 render();
}
function selectDiscussion(c){
 state.tab='active';
 state.selectedCommentId=c.id;
 render();
 const card=document.querySelector(`[data-comment-id="${c.id}"]`);
 if(card){
  card.tabIndex=-1;
  card.scrollIntoView({block:'nearest'});
  card.focus({preventScroll:true});
 }
}
function afterCommentWrite(complete){
 const outcome=simulatedSave;
 if(outcome&&outcome!=='slow')simulatedSave=undefined;
 if(outcome)setTimeout(()=>complete(outcome),650);
 else queueMicrotask(()=>complete());
}
function showRefreshFailure(){
 saveNotice={message:'评论已提交，列表同步失败。',tone:'status',action:'retry-comment-refresh',label:'重试刷新'};
}
function submitBody(before,after){
 const index=before?state.comments.indexOf(before):state.comments.length;
 state.comments.splice(index,before?1:0,after);
 cancel();
 state.selectedCommentId=after.id;
 submissions.set(after.id,'sending');
 render();
 afterCommentWrite(outcome=>{
  if(outcome==='write-error')submissions.set(after.id,'failed');
  else{
   submissions.delete(after.id);
   after.text=after.text.trim();
   if(outcome==='refresh-error')showRefreshFailure();
  }
  render();
 });
}
function saveReply(before,after,restore){
 const index=state.comments.indexOf(before);
 state.comments.splice(index,1,after);
 cancel();
 state.selectedCommentId=after.id;
 render();
 afterCommentWrite(outcome=>{
  if(outcome==='write-error'){
   if(state.comments.includes(after))state.comments.splice(state.comments.indexOf(after),1,before);
   saveNotice={message:'评论同步失败，请重试。',tone:'alert',action:'restore-comment',label:'恢复输入',restore};
  }
  if(outcome==='refresh-error')showRefreshFailure();
  render();
 });
}
function changeCard(comment,action){
 if(cardOperations.has(comment.id)||submissions.has(comment.id))return;
 cardOperations.set(comment.id,action);
 saveNotice=undefined;
 render();
 afterCommentWrite(outcome=>{
  cardOperations.delete(comment.id);
  if(outcome==='write-error'){
   saveNotice={message:'评论操作失败，请重试。',tone:'alert'};
   render();
   return;
  }
  if(action==='reopen'){
   const conflict=comment.status==='resolved'&&existingComment(comment);
   if(conflict){reportConflict(conflict,false);return;}
   comment.previousDraft={status:comment.status,text:comment.text,resolution:comment.resolution};
   comment.status='draft';
   state.tab='active';
   state.selectedCommentId=comment.id;
  }else if(action==='delete'){
   state.comments=state.comments.filter(c=>c.id!==comment.id);
  }else{
   comment.status='resolved';
   comment.resolution=action==='archive'?'archived':'confirmed';
   if(action==='archive')delete comment.previousDraft;
  }
  if(state.editingId===comment.id||state.replyId===comment.id)cancel();
  if(outcome==='refresh-error')showRefreshFailure();
  render();
 });
}
app.addEventListener('submit',e=>{
 e.preventDefault();
 if(e.target.id!=='comment-form'||!state.text.trim())return;
 const input=state.text;
 const text=input.trim();
 const reply=!!state.replyId;
 const existing=state.comments.find(c=>c.id===state.editingId||c.id===state.replyId);
 if(existing&&(cardOperations.has(existing.id)||submissions.get(existing.id)==='sending'))return;
 const target=state.newCommentTarget||{target:state.selectedElement,page:state.selectedPage,sampleState:state.sampleState,device:state.device};
 const conflict=!existing?existingComment(target):existing.status==='resolved'&&existingComment(existing);
 if(conflict){reportConflict(conflict,true);return;}
 const restore=()=>{
  if(existing){edit(state.comments.find(c=>c.id===existing.id)||existing,reply,input);return;}
  state.newCommentTarget=target;
  state.composing=true;
  state.tab='active';
  state.text=input;
  render();
  document.getElementById('comment')?.focus();
 };
 if(existing&&reply){
  const updated={...existing,thread:[...(existing.thread||[]),{author:'user',text}]};
  if(!existing.busy){
   if(existing.status!=='draft'){
    updated.previousDraft={status:existing.status,text:existing.text,resolution:existing.resolution};
    updated.status='draft';
   }
   state.tab='active';
  }
  saveReply(existing,updated,restore);
 }else if(existing){
  if(!existing.busy)submitBody(existing,{...existing,text:input});
 }else{
  const id='new-'+crypto.getRandomValues(new Uint32Array(4)).join('-');
  submitBody(undefined,{id,text:input,...target,status:'draft',savedVersion:'03',thread:[]});
 }
});
app.addEventListener('keydown',e=>{if(e.target.id==='comment'&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.isComposing){e.preventDefault();e.target.form.requestSubmit()}else if(e.key==='Enter'&&e.target.matches('[data-action="select-element"]'))e.target.click()});
app.addEventListener('click',e=>{if(e.target.closest('.component-example'))return;const node=e.target.closest('[data-action]');const card=e.target.closest('[data-comment-id]');const c=state.comments.find(c=>c.id===card?.dataset.commentId);if(!node){if(c?.status==='draft'&&!c.busy&&!cardOperations.has(c.id)&&submissions.get(c.id)!=='sending'&&!e.target.closest('form'))edit(c);return}const action=node.dataset.action;
 if(action==='toggle-preview')togglePreview();
 if(action==='select-element'&&!state.preview&&!state.original){
  state.selectedElement=node.dataset.reviewId.replace('sample-','')==='cta'?'button':node.dataset.reviewId.replace('sample-','');
  const target={target:state.selectedElement,page:state.selectedPage,device:state.device,sampleState:state.sampleState};
  const existing=existingComment(target);
  if(existing){if(existing.status==='draft'&&!existing.busy&&!cardOperations.has(existing.id)&&submissions.get(existing.id)!=='sending')edit(existing);else{cancel();selectDiscussion(existing)}}
  else{cancel();state.newCommentTarget=target;state.composing=true;state.scene='commenting';state.tab='active';render();document.getElementById('comment')?.focus();}
 }
 if(action==='cancel-comment'){cancel();render()}
 if(action==='edit'&&c&&!c.busy&&c.status==='draft')edit(c);
 if(action==='resubmit'&&c&&submissions.get(c.id)==='failed')submitBody(c,{...c});
 if(action==='delete'&&c&&!c.busy&&!c.hasHistory&&!c.previousDraft&&c.status==='draft')changeCard(c,'delete');
 if(action==='archive'&&c&&!c.busy&&c.status!=='resolved')changeCard(c,'archive');
 if(action==='reply'&&c)edit(c,true);
 if(action==='cancel-reopen'&&c?.previousDraft&&!c.busy){Object.assign(c,c.previousDraft);delete c.previousDraft;cancel();state.tab=c.status==='resolved'?'archived':'active';render();toast('已恢复重开前状态，讨论历史已保留。');}
 if(action==='explore'){state.sampleExplored=!state.sampleExplored;render()}
 if(action==='select-page'){state.kind='page';state.selectedPage=node.dataset.page;normalize();render()}
 if(action==='tokens'){state.kind='tokens';render()}
 if(action==='component'){state.kind='component';state.component=node.dataset.component;render()}
 if(action==='archive-comments'){state.tab='archived';render()}
 if(action==='active-comments'){state.tab='active';render()}
 if(action==='resolve'&&c&&!c.busy&&c.status==='awaiting_review')changeCard(c,'resolve');
 if(action==='open-existing'&&saveNotice){
  const discussion=state.comments.find(c=>c.id===saveNotice.id&&c.status!=='resolved');
  if(discussion){if(saveNotice.keepDraft)edit(discussion,true,state.text);else{saveNotice=undefined;selectDiscussion(discussion)}}
 }
 if(action==='restore-comment'&&saveNotice?.restore){const restore=saveNotice.restore;saveNotice=undefined;restore()}
 if(action==='retry-comment-refresh'){saveNotice=undefined;render();toast('评论列表已刷新。')}
 if(action==='reopen'&&c&&!c.busy)changeCard(c,'reopen');
 if(action==='locate'&&c)locate(c);
 if(action==='compare'&&c&&c.savedVersion!=='03')locate(c,{original:true});
 if(action==='original'){
  const original=state.comments.find(c=>c.id===state.originalCommentId);
  if(state.original){if(original)locate(original);else{state.original=false;render();}}
  else if(original)locate(original,{original:true});
 }
 if(action==='review'){state.tab='active';render();document.querySelector('.feedback-panel')?.scrollIntoView({block:'start'})}
});
window.ruyiDesignReviewState={exportState:()=>({...state}),restoreState:s=>{state={...state,...s};state.comments=state.comments.map(c=>({...c,target:c.target||(c.id==='button'?'button':'headline')}));render(true)}};
render();
