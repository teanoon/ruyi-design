// Prototype-only keyboard contract. Runtime integration follows design approval.
export function shortcutAction(event, {preview = false, inCanvas = false, composing = false} = {}) {
  if (event.defaultPrevented || event.isComposing || composing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const path = event.composedPath();
  const native = 'input,textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"],[role="listbox"],[role="option"],[role="slider"],[role="spinbutton"],[role="menu"],[role="menubar"],[role="menuitem"],[role="tab"],[role="tablist"],[role="tree"],[role="treeitem"],[role="grid"],[role="gridcell"],[role="radiogroup"],[role="radio"]';
  if (path.some(node => node instanceof HTMLElement && (node.isContentEditable || node.matches(native)))) return;
  if (event.key.toLowerCase() === 'c') return 'preview';
  if (event.shiftKey || (preview && inCanvas)) return;
  return {ArrowLeft:'device-previous', ArrowRight:'device-next', ArrowUp:'state-previous', ArrowDown:'state-next'}[event.key];
}
export function adjacent(options, current, direction) {
  const index = options.indexOf(current), next = index + direction;
  return index >= 0 && next >= 0 && next < options.length ? options[next] : undefined;
}
export function bindShortcuts(root, context, perform) {
  let composing = false;
  root.addEventListener('compositionstart', () => { composing = true; });
  root.addEventListener('compositionend', () => { composing = false; });
  root.addEventListener('keydown', event => {
    const action = shortcutAction(event, {...context(event), composing});
    if (action && perform(action)) event.preventDefault();
  });
}
