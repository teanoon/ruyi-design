# Prototype assets

Keep `design/manifest.json`, `tokens/`, `components/`, `pages/`, `showcases/`, and `assets/` in the consumer repository. Use ordinary HTML, CSS custom properties, and ES modules; avoid a build step for prototypes.

Pages contain named states with device-to-entry mappings. Entries are relative HTML paths plus optional query/hash parameters. Components contain named examples with the same device mappings. All applicable component examples appear together for a selected device; do not add a state navigation menu. Do not invent unsupported combinations.

Use stable `data-review-id` attributes on commentable elements. Declare shared component IDs on pages. Render component showcases using the implementation used by the pages. Give each entry a deterministic initial state and local mock data.

Optional advanced restoration: set `window.ruyiDesignReviewState = { exportState, restoreState }`. Both functions must operate on JSON-serializable, non-sensitive state. `restoreState` runs after the entry loads. Generic restoration supports stable-ID form fields, focus and scroll; arbitrary JS closures are not preserved.

The workbench injects its bridge into HTTP responses; never copy that script into deliverable source HTML. Runtime databases and snapshots belong outside `design/` and should not be committed.

Compatibility: use the first available API in this order: `window.ruyiDesignReviewState`, `window.ruyiUxaiReviewState`, `window.uxaiReviewState`. Each capture or restore calls only that API once. Immutable historical snapshots are not rewritten.

Optional `pageNavigation` is an ordered recursive tree of `{id, pageId?, name?, children?}` referencing flat page definitions. Node IDs must be unique across the tree, page references valid and unique; pure groups need a nonempty name and children. Parent page names open the page, independent arrows toggle children; do not add an extra overview entry. Unconfigured/empty trees stay flat; unreferenced pages append at root. Keep page IDs stable when moving nodes. Prefer two or three levels, keep states/devices in content controls, and use distinct manifest IDs for distinct projects. See `docs/asset-contract.md` for an example. Hierarchical navigation requires an updated workspace.

Element feedback uses one discussion per exact object/state/device/example and element identity across revisions. Stable review IDs take precedence when both sides have them; otherwise the complete selector is used. Parent and child elements, different states/devices and component instances on different pages remain separate. Keep IDs stable so revisiting a resolved or archived discussion does not create another independent comment.
