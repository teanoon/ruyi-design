# Getting started

Install the tarball from the local release candidate into your project using npm. A published registry package will use the same interface; publication is a separate release action.

```bash
npm install -D /absolute/path/littlehobby-ruyi-design-0.1.0.tgz
npx playwright install chromium
npx ruyi-design doctor
```

Chromium is required for publication checks, not downloaded by package installation. Run `npx playwright install-deps chromium` if your operating system is missing browser shared libraries. `doctor` checks the binary; the publication check reports launch failures as `validation_unavailable` without changing the active version.

Copy the bundled starter directory into `design/`, or ask the coding agent to author a manifest and assets based on `ruyi-design://templates/manifest` and `ruyi-design://schemas/manifest`. The manifest validates object IDs and references as well as local entry files. A Git repository is optional.

Install the optional project skill explicitly:

```bash
npx ruyi-design setup --client codex --project /absolute/path/to/project
```

Setup writes only `.agents/skills/ruyi-design-review/`, leaves identical installed files alone, and rejects changed existing skill files. It does not alter your MCP configuration. Configure the MCP command as described in [MCP integration](mcp.md).

Ask the agent to start a review using the absolute project root and `design/` root. Open the returned URL, including its initial token fragment. The workspace keeps the credential in session-scoped tab storage and removes it from the URL, so refreshing the same tab retains access. Open the complete original link in a new tab.

Select a page from the flat left navigation and use the state/device dropdowns above the canvas. Element commenting is the default: click an element and save a comment. Use the left-side Preview button to interact with the prototype, then Exit preview to comment again. Components show every applicable state for the selected device.

Save your comments, then tell the agent in conversation: “I have added comments; please update the design.” There is no submission button and no agent monitoring loop. The agent reads the saved comments, freezes a processing snapshot, edits the repository, records results and publishes one verified revision. Comments saved during that work stay pending until you explicitly request another update. Confirm published fixes in the browser; resolved comments move out of the active list into the collapsed Archived group and no longer count as active feedback. Open the archive to inspect history or reopen a comment, which returns it to the active list for another user-requested update.

The Locate action opens the comment’s page, state and device in the current published revision, restores available interaction context, then scrolls to and highlights the element. Component feedback opens the matching example. Explicitly recorded deletions highlight the surviving parent container with “此处已删除”. Other missing or ambiguous targets show a failure message. “查看原版本” opens the immutable snapshot from when the comment was made; its banner and “返回最新版本” button distinguish it from the current revision. Original comment context is retained.

Pages and component showcases share implementations and token CSS. Source saves do not publish a revision. CSS-only publications update styles in place; structural and JS changes automatically rebuild the prototype iframe and attempt restoration. The workspace, saved drafts and unsaved composer text remain in place. Arbitrary JS memory is not retained.

Close a review with MCP `ruyi_design_end_review`, or stop its client process. New review records use `.ruyi-design/`. Existing projects reuse a sole `.ruyi-uxai/` or `.uxai-review/` in place. If multiple candidate directories exist, pass `dataRoot` explicitly; no directories are merged. Reopening uses the last published version and existing comment history. The agent must reload context and reclaim expired leases.

The browser also provides **归档** for comments that no longer require work, including unchanged results and reopened drafts. Manual archiving preserves the original result and does not claim a verified fix; **确认解决** remains for published changes. Queued/processing feedback must finish or be released before archiving. Reopen and archive again at any time after processing ends.

You can also ask for changes directly in the AI conversation, without first leaving a browser comment. The agent publishes that explicit request as a new revision of the same session using the conversation mode of publish_revision. Your existing comments, archive and history remain intact.
