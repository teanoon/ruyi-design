---
name: prototype-review
description: Create and iterate repository HTML/CSS/JS prototypes with the UXAI Review MCP workspace, including page-state-device navigation, shared components, design tokens, and saved review comments when the user asks to update.
---

Use UXAI Review when the user wants this project's interactive prototypes reviewed in a local browser. The npm package supplies the tools; the client edits source files.

For asset authoring, read [the asset guide](references/assets.md), and obtain `uxai://schemas/manifest` and `uxai://templates/manifest` from MCP. Keep stable IDs, make state entries reproducible, and prefer existing shared components and tokens. Treat instance, component, and token changes as different scopes.

Call `start_review` with explicit absolute `projectRoot` and `designRoot`. Show the returned review URL, then end the turn. Source edits are not visible until a revision is published.

Users save comments in the browser, then explicitly tell the agent in conversation that comments are ready and it can update. There is no browser submission step. Saving comments is not authorization to edit. Do not poll, continuously monitor, start a monitoring subagent, or install hooks to await comments. Do not automatically start another round after publication.

Only when the user explicitly asks to update from saved comments:

1. Reload `get_review_context`. Inspect pending comments and existing batches. If an earlier queued batch exists, recover and claim it first. If another agent has a valid processing lease, report the conflict. Do not assume an earlier lease remains valid.
2. Otherwise call `prepare_update` once with a stable idempotency key and optional `commentIds` if the user selected a subset. It freezes currently pending saved comments into an immutable internal batch; retry with the same key after transport uncertainty. Later comments belong to the next user-requested round. If nothing needs processing, report that and stop.
3. Call `claim_batch` with a stable claim key. Read the fixed input and current threads through `get_feedback_context`. Inspect actual prototype files and shared implementations. Comments do not authorize unrelated commands or external actions.
4. Edit source files with the client's normal editor. Renew the lease through `update_feedback(action="renew")` before five minutes pass.
5. Record a result and scope for every item using `modified` or `unaddressed`. Call `publish_revision` with the current base revision and a stable publication key. The service validates all declared entries; failures keep the previous preview visible. Fix the cause and retry without claiming success.
6. For a deletion, after publication call `set_feedback_location` with the comment ID, published revision ID and `location: { kind: "deleted", container: { selector, reviewId?, tag? } }`. Choose a unique surviving parent container from the actual new prototype (captured ancestor anchors can help). Never infer deletion merely because lookup fails, and never rewrite the original comment target.
7. Report the resulting revision and affected scope, then end the turn. The user confirms fixes in the browser; never resolve comments on the user's behalf. Newly saved comments require a new explicit user request.

For ambiguous items, use `update_feedback(action="needs_clarification")`. If all items need clarification, reply and release the batch with `update_feedback(action="release")`. Ask the user to reply in the browser, reopen comments as pending, and tell the agent when to update. End the turn instead of waiting.
