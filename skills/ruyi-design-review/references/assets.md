# Prototype assets

Keep `design/manifest.json`, `tokens/`, `components/`, `pages/`, `showcases/`, and `assets/` in the consumer repository. Use ordinary HTML, CSS custom properties, and ES modules; avoid a build step for prototypes.

Pages contain named states with device-to-entry mappings. Entries are relative HTML paths plus optional query/hash parameters. Components contain named examples with the same device mappings. All applicable component examples appear together for a selected device; do not add a state navigation menu. Do not invent unsupported combinations.

Use stable `data-review-id` attributes on commentable elements. Declare shared component IDs on pages. Render component showcases using the implementation used by the pages. Give each entry a deterministic initial state and local mock data.

Optional advanced restoration: set `window.ruyiDesignReviewState = { exportState, restoreState }`. Both functions must operate on JSON-serializable, non-sensitive state. `restoreState` runs after the entry loads. Generic restoration supports stable-ID form fields, focus and scroll; arbitrary JS closures are not preserved.

The workbench injects its bridge into HTTP responses; never copy that script into deliverable source HTML. Runtime databases and snapshots belong outside `design/` and should not be committed.

Compatibility: use the first available API in this order: `window.ruyiDesignReviewState`, `window.ruyiUxaiReviewState`, `window.uxaiReviewState`. Each capture or restore calls only that API once. Immutable historical snapshots are not rewritten.
