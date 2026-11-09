import {button,icon,badge,commentCard,revisionBanner,deviceSelector,navigation,routedMarkup} from '../components/ui.js';
const params=new URLSearchParams(location.search),component=params.get('component')||'button',state=params.get('state')||'default';
const names={button:'按钮',comment:'评论卡片',navigation:'页面导航',revision:'修订提示',selector:'设备与状态控件',brand:'品牌标志'};
const title=names[component]||'组件';
const stage={
 button:()=>`<div class="showcase-buttons">${button(state==='loading'?'正在保存…':state==='disabled'?'保存评论':'保存评论',{variant:'primary',disabled:['loading','disabled'].includes(state),symbol:state==='success'?'check':''})}${button('查看原版本',{symbol:'history',disabled:state==='disabled'})}${button('取消',{variant:'text'})}</div>`,
 comment:()=>commentCard({text:'标题可以再松弛一点，增加行高。',status:state==='review'?'待复核':'待处理',archived:state==='archived',selected:state==='selected'}),
 navigation:()=>`<div style="max-width:240px">${button(state==='preview'?'退出预览':'预览',{variant:state==='preview'?'primary preview-button':'secondary preview-button',symbol:state==='preview'?'close':'play'})}${navigation(state==='selected'?'story':'home')}</div>`,
 revision:()=>revisionBanner(state==='deleted'?'deleted':'current'),
 selector:()=>deviceSelector(state==='mobile'?'mobile':'desktop'),
 brand:()=>{
 if(state==='compact')return `<div class="logo-sizes"><div><strong>提交墙方印 · 最终版</strong><div>${[16,24,32,40,64].map(size=>`<figure style="margin:0"><img src="../assets/ruyi-mark.svg" width="${size}" height="${size}" alt="如意方印 ${size}px"/><figcaption class="hint">${size}px</figcaption></figure>`).join('')}</div></div></div>`;
 if(state==='mono')return `<div class="logo-choice"><img src="../assets/ruyi-mark-mono.svg" alt="如意方印单色适配" width="64" height="64"/><div class="logo-description"><h2>同一标志 · 单色适配</h2><p>保留方印与如意镂空轮廓，用于单色印刷和受限场景。</p></div></div>`;
 return `<div class="logo-choice"><img src="../assets/ruyi-mark.svg" alt="如意设计最终标志" width="64" height="64"/><div class="logo-wordmark"><strong>如意设计</strong><span>RUYI DESIGN</span></div></div><div class="logo-description"><h2>如意方印 · 最终版</h2><p>提交墙式方格、五档玉绿色与白色如意。小尺寸减弱方格纹理，保持如意轮廓清晰。</p><span class="badge success">已定稿</span></div>`;
 },
};
document.getElementById('app').innerHTML=routedMarkup(`<main class="showcase"><div class="eyebrow">RUYI DESIGN / 组件</div><h1>${title}</h1><p>共享实现 · ${state} · 由页面直接复用</p><section class="showcase-stage" data-review-id="component-${component}-${state}">${(stage[component]||stage.button)()}</section></main>`);

window.ruyiDesignReviewState={exportState:()=>({}),restoreState:()=>{}};
