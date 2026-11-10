# Getting started

For a new environment, install Node.js 24 or later on the machine running the MCP process. Build the local package in the source repository:

```bash
npm ci --ignore-scripts
npm run pack:local
```

The command builds the tool and creates `dist/littlehobby-ruyi-design-0.1.0.tgz`. Transfer this archive to the new environment, then run the installation commands below **from the consumer project**. The npm package contains the built tool; the consumer does not need this repository's development dependencies.

Install the tarball from the local release candidate into your project using npm. A published registry package will use the same interface; publication is a separate release action.

```bash
npm install -D /absolute/path/to/ruyi-design/dist/littlehobby-ruyi-design-0.1.0.tgz
npx ruyi-design doctor
```

Chromium runs headlessly on the machine running MCP. When the agent publishes a revision, Playwright opens every declared page/state/device and component/device entry with its configured viewport, checks that the entry loads, and collects JavaScript exceptions, HTTP errors and failed resource requests. Only a passing candidate replaces the active revision; failed validation retains the previous version. This checks loading and execution, not subjective visual quality or every interaction.

Starting MCP, viewing an existing preview and saving comments do not launch a validation browser; publishing a revision requires one. Users can review the site in their usual browser. Automatic selection tries Chrome, Edge, Chromium at platform installation paths and absolute PATH entries, then already installed Playwright Chromium. It uses the MCP machine and account; WSL discovers Linux browsers and does not search Windows mounts.

To select explicitly, set either `RUYI_DESIGN_BROWSER_CHANNEL=chrome` (or `msedge`) or `RUYI_DESIGN_BROWSER_EXECUTABLE=/absolute/path/to/chromium`. Both together, empty values, relative paths and unsupported channels fail. Explicit selections never fall back. System/custom versions must pass an actual launch and script check. All validation runs in a separate headless instance with temporary context; it does not use your normal windows, profile or login state.

`doctor` performs that same launch check and closes the browser. It defaults to a readable Chinese text summary, including when redirected or piped. A usable Edge produces “检查结果：通过”, “Microsoft Edge”, “系统安装” and “额外浏览器安装：不需要”; earlier failed Chrome candidates do not appear in the default summary. Use:

```bash
npx ruyi-design doctor                  # readable summary
npx ruyi-design doctor --verbose        # summary plus candidate diagnostics
npx ruyi-design doctor --json           # one JSON object for scripts
npx ruyi-design doctor --json --verbose # still pure JSON, full attempts retained
npx ruyi-design doctor --design /absolute/path/to/design
```

Exit status is 0 when all required checks pass and 1 on failure. The workspace, bridge and browser must be usable; data directory resolution and an optional `--design` catalog must succeed. A new review data directory is marked “首次启动评审时创建”: doctor does not create it or verify future write permissions. Checks skipped after an earlier failure are `not_checked`.

JSON includes `status` (`ok`/`error`), `summary`, per-item `checks`, structured `recommendations` and `browser.available`, name, source, version and full attempts. The legacy `chromium` boolean only means the default Playwright executable exists; it can be false while Edge passes. `browserInstall` appears only when an optional Chromium install is an applicable recommendation. Existing JSON consumers must add `--json`; see [migration notes](migration-to-ruyi-design.md#doctor-输出格式迁移).

Verbose output labels earlier candidate failures as diagnostic history. Installation hints inside those raw errors are not current recommendations. Explicit browser configuration failures require fixing that configuration; they do not produce advice to install another browser. Discovery allows up to 10 seconds per candidate within a 30-second overall startup budget. Publication reports failures as `validation_unavailable` and keeps the active version.

If automatic discovery fails, optionally install Chromium explicitly with `npx playwright install chromium` in the same environment/account as MCP, or configure an installed executable. Package installation and runtime discovery never download browsers. Run `npx playwright install-deps chromium` if your operating system is missing browser shared libraries.

If the project already has `design/manifest.json`, keep its existing design assets. Otherwise copy the bundled starter directory into `design/`, or ask the coding agent to author a manifest and assets based on `ruyi-design://templates/manifest` and `ruyi-design://schemas/manifest`. The manifest validates object IDs and references as well as local entry files. A Git repository is optional.

Install the optional project skill explicitly:

```bash
npx ruyi-design setup --client codex --project /absolute/path/to/project
```

Setup writes only `.agents/skills/ruyi-design-review/`, leaves identical installed files alone, and rejects changed existing skill files. It does not alter your MCP configuration. Configure the MCP command as described in [MCP integration](mcp.md).

Ask the agent to start a review using the absolute project root and `design/` root. Open the returned URL, including its initial token fragment. The workspace keeps the credential in session-scoped tab storage and removes it from the URL, so refreshing the same tab retains access. Open the complete original link in a new tab.

Select a page from the flat left navigation and use the state/device dropdowns above the canvas. Element commenting is the default: click an element and save a comment. Use the left-side Preview button to interact with the prototype, then Exit preview to comment again. Components show every applicable state for the selected device.

Keyboard shortcuts work outside text entry: **C** toggles Preview, **← / →** select the previous/next available device, and **↑ / ↓** select the previous/next page state. Lists stop at their ends. State changes retain the device when supported, otherwise they use the same valid fallback as the dropdown. Components only switch devices; tokens do not switch combinations. Inputs, native controls, editable content, IME composition and modifier shortcuts keep their own behavior. In the preview iframe, arrow keys belong to the prototype; C can leave preview when focus is outside an input. Original-version viewing disables preview switching. Existing comment drafts survive mode and combination changes.

Connection status sits above the product mark at the bottom of the navigation. The version is inside the Preview button, with a shorter identifier on narrow screens and the full identifier in its accessible description and tooltip. The tool hides the external project name from its chrome while preserving project identity and the prototype's own branding.

Save your comments, then tell the agent in conversation: “I have added comments; please update the design.” There is no submission button and no agent monitoring loop. The agent reads the saved comments, freezes a processing snapshot, edits the repository, records results and publishes one verified revision. Comments saved during that work stay pending until you explicitly request another update. Confirm published fixes in the browser; resolved comments move out of the active list into the Archived view and no longer count as active feedback. Choose the Archived button to inspect history or reopen a comment, which returns it to the active list for another user-requested update.

The Locate action opens the comment’s page, state and device in the current published revision, restores available interaction context, then scrolls to and highlights the element. Component feedback opens the matching example. Explicitly recorded deletions highlight the surviving parent container with “此处已删除”. Other missing or ambiguous targets show a failure message. “查看原版本” opens the immutable snapshot from when the comment was made; its banner and “返回最新版本” button distinguish it from the current revision. Original comment context is retained.

Pages and component showcases share implementations and token CSS. Source saves do not publish a revision. CSS-only publications update styles in place; structural and JS changes automatically rebuild the prototype iframe and attempt restoration. The workspace, saved drafts and unsaved composer text remain in place. Arbitrary JS memory is not retained.

Close a review with MCP `ruyi_design_end_review`, or stop its client process. New review records use `.ruyi-design/`. Existing projects reuse a sole `.ruyi-uxai/` or `.uxai-review/` in place. If multiple candidate directories exist, pass `dataRoot` explicitly; no directories are merged. Reopening uses the last published version and existing comment history. The agent must reload context and reclaim expired leases.

The browser also provides **归档** for comments that no longer require work, including unchanged results and reopened drafts. Manual archiving preserves the original result and does not claim a verified fix; **确认解决** remains for published changes. Queued/processing feedback must finish or be released before archiving. Reopen and archive again at any time after processing ends.

You can also ask for changes directly in the AI conversation, without first leaving a browser comment. The agent publishes that explicit request as a new revision of the same session using the conversation mode of publish_revision. Your existing comments, archive and history remain intact.
