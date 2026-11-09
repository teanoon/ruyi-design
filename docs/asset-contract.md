# Asset contract v1

The source of truth is `design/manifest.json`. The generated schema is `schemas/manifest.schema.json`; the complete example is `examples/starter/design/manifest.json`.

```text
design/
  manifest.json
  tokens/tokens.css
  components/
  pages/
  showcases/
  assets/
```

Required manifest properties: `schemaVersion: 1`, `id`, `name`, and a nonempty `devices` array. Device IDs are stable and define logical `width` and `height`, independent of canvas fit scaling. IDs use letters, digits, hyphens or underscores; duplicate IDs in a collection are invalid.

Pages have `id`, `name`, optional `components` IDs, and `states`. Each state has `id`, `name` and `entries`, a device-ID map. Each entry contains `path` and optional `query` object and `hash`. Use relative HTML paths inside the design directory. Paths cannot contain traversal, hidden path segments, percent encoding, query strings or absolute URLs; encode initialization through the separate query/hash fields. The same file may initialize multiple states. Do not rely on earlier clicks or retained browser state for initial scenes.

Components have `id`, `name`, `implementation` paths and `examples`; examples have `id`, `name`, and the same `entries` mapping. All applicable examples for the selected device appear in one component page. Unsupported combinations such as mobile hover can simply be omitted. Component parameters such as size or primary/secondary appearance are example metadata, not additional navigation levels.

Tokens have `id`, `name`, `group`, `type`, `value`, `description` and optionally `cssVariable`. Types are color, typography, spacing, radius, shadow or other. Keep group members adjacent for presentation. Keep actual CSS custom property values synchronized with the token catalog. The tool shows declared values; it does not infer the complete token graph from CSS.

Use shared CSS and ES modules for components, with `data-review-id` on stable interactive/visual elements. Page component associations assist agent impact analysis, but are not a complete static dependency graph. Page-level exceptions can remain local.

The service injects a version-1 bridge into HTML responses and leaves source HTML unchanged. Bridge envelopes contain `channel: uxai-review`, `version: 1`, `frameId`, `type`, and optional payload. Parent and iframe check origin, window source and frame identity. Component examples run in separate iframes.

Optional custom restoration:

```js
window.uxaiReviewState = {
  exportState() {
    return { dialogOpen: document.querySelector("dialog").open };
  },
  restoreState(state) {
    if (state.dialogOpen) document.querySelector("dialog").showModal();
  },
};
```

Only return JSON-serializable, non-sensitive state. Default capture covers URL, scroll, safe stable-ID/name form fields and focus; password, hidden and file fields are excluded. If restoration cannot reliably locate an element, it reports failure instead of guessing.

Snapshots include public HTML/CSS/JS/JSON, common images/fonts and video formats. Hidden files and `node_modules` are excluded. All prototype dependencies should reside under the design root. Browser validation checks every declared page/device and component example/device entry and fails on resource errors or JS exceptions.
