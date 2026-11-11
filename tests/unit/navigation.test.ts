import {describe, it, expect} from 'vitest';
import {manifestSchema, combinations} from '../../src/contracts/catalog.js';
import {validateReferences} from '../../src/core/catalog/index.js';
import {resolvePageNavigation} from '../../design/components/page-navigation.js';

const entry = {path:'index.html'};
const page = (id: string, name = id) => ({id, name, states:[{id:'default',name:'Default',entries:{desktop:entry}}]});
const base = () => manifestSchema.parse({schemaVersion:1,id:'tree',name:'Tree',devices:[{id:'desktop',name:'Desktop',width:1280,height:800}],pages:[page('orders'),page('pending'),page('settings'),page('extra')]});

describe('page navigation contract', () => {
  it('accepts old, empty and recursive optional trees without changing combinations', () => {
    const flat = base();
    const nodes = [{id:'orders-nav',pageId:'orders',children:[{id:'pending-nav',pageId:'pending'}]}, {id:'admin',name:' Administration ',children:[{id:'settings-nav',pageId:'settings'}]}];
    for (const tree of [undefined, [], nodes]) {
      const manifest = manifestSchema.parse({...flat,pageNavigation:tree});
      validateReferences(manifest);
      expect(combinations(manifest)).toEqual(combinations(flat));
      const resolved = resolvePageNavigation(manifest.pages,manifest.pageNavigation);
      expect(resolved.flatMap(n=>[n.pageId,...n.children.map(c=>c.pageId)]).filter(Boolean).sort()).toEqual(flat.pages.map(p=>p.id).sort());
    }
    const resolved = resolvePageNavigation(flat.pages,nodes);
    expect(resolved.map(n=>n.name)).toEqual(['orders','Administration','extra']);
    expect(resolved[0].descendantCount).toBe(1);
    expect(resolved[0].children[0].pageId).toBe('pending');
  });

  it('rejects invalid trees with the nested location', () => {
    const flat = base();
    const invalid = [
      {id:'same',pageId:'orders',children:[{id:'same',pageId:'pending'}]},
      {id:'root',name:'Group',children:[{id:'missing',pageId:'unknown'}]},
      {id:'root',pageId:'orders',children:[{id:'duplicate',pageId:'orders'}]},
      {id:'root',pageId:'orders',children:[{id:'empty'}]},
      {id:'root',pageId:'orders',children:[{id:'unnamed',children:[{id:'pending',pageId:'pending'}]}]},
    ];
    for (const node of invalid) expect(()=>validateReferences({...flat,pageNavigation:[node]})).toThrow('pageNavigation[0].children[0]');
    expect(()=>manifestSchema.parse({...flat,pageNavigation:[{id:'blank',name:' ',children:[]}]})).toThrow('pageNavigation');
  });

  it('counts 60 pages with 5 descendants per parent and preserves every page once', () => {
    const pages = Array.from({length:10},(_,i)=>[page(`parent-${i}`),...Array.from({length:5},(_,j)=>page(`child-${i}-${j}`))]).flat();
    const nodes = Array.from({length:10},(_,i)=>({id:`parent-nav-${i}`,pageId:`parent-${i}`,children:Array.from({length:5},(_,j)=>({id:`child-nav-${i}-${j}`,pageId:`child-${i}-${j}`}))}));
    const manifest=manifestSchema.parse({...base(),pages,pageNavigation:nodes}); validateReferences(manifest);
    const resolved=resolvePageNavigation(pages,nodes);
    expect(resolved).toHaveLength(10);
    expect(resolved.every(n=>n.descendantCount===5)).toBe(true);
    expect(new Set(resolved.flatMap(n=>[n.pageId,...n.children.map(c=>c.pageId)])).size).toBe(60);
    const moved=[{id:'group',name:'Moved',children:nodes}];
    expect(combinations({...manifest,pageNavigation:moved})).toEqual(combinations(manifest));
  });
});
