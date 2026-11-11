// Shared by the standalone product prototype and the bundled workspace.
// Page definitions stay flat; navigation nodes only reference stable page IDs.
export function resolvePageNavigation(pages, nodes = []) {
  const referenced = new Set();
  const byId = new Map(pages.map(page => [page.id, page]));
  function resolve(node) {
    if (node.pageId) referenced.add(node.pageId);
    const children = (node.children || []).map(resolve);
    return {...node, name: node.name?.trim() || byId.get(node.pageId)?.name || '',
      pageName: byId.get(node.pageId)?.name || '', children,
      descendantCount: children.reduce((count, child) => count + Number(!!child.pageId) + child.descendantCount, 0)};
  }
  return [...nodes.map(resolve), ...pages.filter(page => !referenced.has(page.id)).map(page => resolve({id:`page:${page.id}`,pageId:page.id}))];
}

let navigationInstance = 0;

export function mountPageNavigation(host, initial) {
  const instanceId = `page-navigation-${++navigationInstance}`;
  let options = initial, query = '', expanded = {}, projectId;
  let scrollTarget = false;
  let composing = false;
  const key = () => `ruyi-design:page-navigation:${options.projectId}`;
  const save = () => {try {localStorage.setItem(key(), JSON.stringify(expanded));} catch { /* In-memory preferences still work. */ }};
  function load() {
    if (projectId === options.projectId) return;
    projectId = options.projectId; expanded = {}; query = '';
    try {
      const stored = JSON.parse(localStorage.getItem(key()) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored))
        for (const [id, value] of Object.entries(stored)) if (typeof value === 'boolean') expanded[id] = value;
    } catch { /* Disabled storage or invalid preferences. */ }
  }
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const makeButton = (text, focusKey, callback) => {
    const node = element('button', '', text); node.type = 'button'; node.dataset.navFocus = focusKey;
    node.onclick = callback; return node;
  };
  const nodeIcon = kind => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('page-tree-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const paths = {
      folder: 'M1.5 4V3h4l1.5 1.5h7.5V13h-13Z',
      'folder-open': 'M1.5 7V3h4L7 4.5h6.5V7M1.5 7h13l-2 6h-10Z',
      page: 'M4 1.5h5L12.5 5v9.5H4ZM9 1.5V5h3.5M6.5 8h3.5M6.5 11h3.5',
    };
    path.setAttribute('d', paths[kind]); svg.append(path); return svg;
  };
  function render() {
    load();
    const focus = host.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focus?.dataset.navFocus;
    const selection = focus instanceof HTMLInputElement ? [focus.selectionStart, focus.selectionEnd] : null;
    const tree = resolvePageNavigation(options.pages, options.nodes);
    const term = query.trim().toLocaleLowerCase();
    const activeAncestors = new Set();
    function findActive(nodes, ancestors = []) {
      for (const node of nodes) {
        if (node.pageId === options.activePage) ancestors.forEach(id => activeAncestors.add(id));
        findActive(node.children, [...ancestors, node.id]);
      }
    }
    findActive(tree);
    function filter(nodes, ancestorMatch = false) {
      return nodes.flatMap(node => {
        const match = ancestorMatch || [node.name, node.pageName].some(name => name.toLocaleLowerCase().includes(term));
        const children = filter(node.children, match);
        return match || children.length ? [{...node, children}] : [];
      });
    }
    host.replaceChildren(); host.dataset.pageNavigation = '';
    const heading = element('div', 'nav-section section-label'); heading.append('页面', element('span', 'page-count', String(options.pages.length).padStart(2, '0')));
    const label = element('label', 'page-search-label'); label.append(element('span', 'sr-only', '搜索页面'));
    const input = element('input', 'page-search'); input.type = 'search'; input.placeholder = '搜索页面'; input.value = query; input.dataset.navFocus = 'search';
    const updateQuery = () => {query = input.value; hiddenSearchBranches.clear();};
    input.addEventListener('compositionstart', () => {composing = true;});
    input.addEventListener('compositionend', () => {composing = false; updateQuery(); render();});
    input.oninput = event => {updateQuery(); if (!event.isComposing && !composing) render();};
    label.append(input); host.append(heading, label);
    function list(nodes, prefix = instanceId) {
      const ul = element('ul', 'page-tree');
      for (const [index, node] of nodes.entries()) {
        const li = element('li', 'page-tree-node'); li.dataset.navNode = node.id;
        const row = element('div', `page-tree-row${node.pageId && node.pageId === options.activePage ? ' active' : ''}${activeAncestors.has(node.id) ? ' has-current' : ''}`);
        const isBranch = node.children.length > 0;
        const open = term ? true : expanded[node.id] === true;
        const childrenId = `${prefix}-${index}`;
        const toggle = () => {
          // Search expansion is temporary and never changes stored preferences.
          if (term) {hiddenSearchBranches.has(node.id) ? hiddenSearchBranches.delete(node.id) : hiddenSearchBranches.add(node.id);}
          else {expanded[node.id] = !open; save();}
          const inside = li.querySelector('ul')?.contains(document.activeElement);
          render();
          if (inside) [...host.querySelectorAll('[data-nav-focus]')].find(n => n.dataset.navFocus === `toggle:${node.id}`)?.focus();
        };
        const visible = open && (!term || !hiddenSearchBranches.has(node.id));
        if (isBranch) {
          const arrow = makeButton('', `toggle:${node.id}`, toggle); arrow.className = 'page-tree-toggle';
          arrow.append(nodeIcon(visible ? 'folder-open' : 'folder'));
          arrow.setAttribute('aria-label', `${visible ? '收起' : '展开'}${node.name}`); arrow.setAttribute('aria-expanded', String(visible)); arrow.setAttribute('aria-controls', childrenId); row.append(arrow);
        } else {const leaf = element('span', 'page-tree-leaf-icon'); leaf.append(nodeIcon('page')); row.append(leaf);}
        const name = makeButton('', `page:${node.id}`, node.pageId ? () => options.onSelect(node.pageId) : toggle);
        name.setAttribute('aria-label', node.name);
        name.className = `nav-item page-tree-name${node.pageId && node.pageId === options.activePage ? ' active' : ''}`;
        if (node.pageId) name.dataset.pageId = node.pageId;
        else if (isBranch) {name.setAttribute('aria-expanded', String(visible)); name.setAttribute('aria-controls', childrenId);}
        if (activeAncestors.has(node.id)) name.setAttribute('aria-description', '包含当前页面');
        if (node.pageId && node.pageId === options.activePage) name.setAttribute('aria-current', 'page');
        name.append(element('span', 'page-tree-title', node.name));
        if (node.descendantCount) name.append(element('span', 'page-tree-count', String(node.descendantCount)));
        if (activeAncestors.has(node.id)) {const hint = element('span', 'page-tree-current', '•'); hint.setAttribute('aria-label', '包含当前页面'); name.append(hint);}
        row.append(name); li.append(row);
        if (isBranch) {const children = list(node.children, `${prefix}-${index}`); children.id = childrenId; children.hidden = !visible; li.append(children);}
        ul.append(li);
      }
      return ul;
    }
    const results = term ? filter(tree) : tree;
    host.append(list(results));
    if (!results.length) {const empty = element('p', 'page-search-empty', '没有匹配的页面'); empty.setAttribute('role', 'status'); host.append(empty);}
    if (focusKey) {
      const next = [...host.querySelectorAll('[data-nav-focus]')].find(n => n.dataset.navFocus === focusKey);
      if (next && !next.closest('[hidden]')) {next.focus({preventScroll:true}); if (selection && next instanceof HTMLInputElement) next.setSelectionRange(...selection);}
    }
    if (scrollTarget) {host.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'}); scrollTarget = false;}
  }
  let hiddenSearchBranches = new Set();
  host.addEventListener('keydown', event => {if (event.key.startsWith('Arrow')) event.stopPropagation();});
  function locate() {
    load(); query = ''; hiddenSearchBranches.clear();
    function visit(nodes, ancestors = []) {
      for (const node of nodes) {
        if (node.pageId === options.activePage) ancestors.forEach(id => {expanded[id] = true;});
        visit(node.children, [...ancestors, node.id]);
      }
    }
    visit(resolvePageNavigation(options.pages, options.nodes)); scrollTarget = true;
  }
  load();
  for (const id of options.initialExpanded || []) expanded[id] = true;
  locate(); render();
  return {expand(ids) {for (const id of ids) expanded[id] = true; render();}, update(next, reveal = false) {options = next; load(); if (reveal) locate(); render();}};
}
