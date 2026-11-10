import {routedMarkup} from '../components/ui.js';
import {componentExample} from '../components/examples.js';
const params=new URLSearchParams(location.search),component=params.get('component')||'button',state=params.get('state')||'default';
const names={button:'按钮',comment:'评论卡片',navigation:'页面导航',revision:'修订提示',selector:'设备与状态控件',brand:'品牌标志'};
const title=names[component]||'组件';
document.getElementById('app').innerHTML=routedMarkup(`<main class="showcase"><div class="eyebrow">RUYI DESIGN / 组件</div><h1>${title}</h1><p>共享实现 · ${state} · 由页面直接复用</p><section class="showcase-stage" data-review-id="component-${component}-${state}">${componentExample(component,state)}</section></main>`);

window.ruyiDesignReviewState={exportState:()=>({}),restoreState:()=>{}};
