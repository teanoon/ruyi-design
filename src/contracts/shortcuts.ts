export const SHORTCUT_ACTIONS = ["preview", "device-previous", "device-next", "state-previous", "state-next"] as const;
export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export const isShortcutAction = (value: unknown): value is ShortcutAction =>
  typeof value === "string" && (SHORTCUT_ACTIONS as readonly string[]).includes(value);

export function shortcutAction(event: KeyboardEvent, context: { preview?: boolean; inCanvas?: boolean; composing?: boolean } = {}): ShortcutAction | undefined {
  if (event.defaultPrevented || event.isComposing || context.composing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const native = 'input,textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"],[role="listbox"],[role="option"],[role="slider"],[role="spinbutton"],[role="menu"],[role="menubar"],[role="menuitem"],[role="tab"],[role="tablist"],[role="tree"],[role="treeitem"],[role="grid"],[role="gridcell"],[role="radiogroup"],[role="radio"]';
  if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || node.matches(native)))) return;
  if (event.key.toLowerCase() === "c") return "preview";
  if (event.shiftKey || (context.preview && context.inCanvas)) return;
  return ({ ArrowLeft: "device-previous", ArrowRight: "device-next", ArrowUp: "state-previous", ArrowDown: "state-next" } as const)[event.key as "ArrowLeft"];
}
export function adjacent(options: string[], current: string, direction: number): string | undefined {
  const index = options.indexOf(current), next = index + direction;
  return index >= 0 && next >= 0 && next < options.length ? options[next] : undefined;
}
export function bindShortcuts(root: Window, context: () => { preview?: boolean; inCanvas?: boolean }, perform: (action: ShortcutAction) => boolean) {
  let composing = false;
  root.addEventListener("compositionstart", () => { composing = true; });
  root.addEventListener("compositionend", () => { composing = false; });
  // Bubble at window so native controls and nested workspaces get first refusal.
  root.addEventListener("keydown", event => {
    const action = shortcutAction(event, { ...context(), composing });
    if (action && perform(action)) event.preventDefault();
  });
}
