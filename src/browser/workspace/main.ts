import { BRAND } from "../../contracts/brand.js";
import "../styles/workspace.css";
import { isBridgeMessage, type BridgeMessage } from "../../contracts/bridge.js";
import { routedUrl } from "../../contracts/urls.js";
import {
  combinations,
  type Manifest,
  type Target,
} from "../../contracts/catalog.js";

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const session = params.get("session") ?? "";
const gatewayPort = params.get("port");
function apiUrl(route: string) {
  const base = new URL("/", location.origin);
  if (gatewayPort) base.searchParams.set("port", gatewayPort);
  return routedUrl(base.href, `api/sessions/${session}/${route}`).href;
}
let token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
const tokenKey = `${BRAND.tokenNamespace}:${session}:token`;
try {
  if (token) sessionStorage.setItem(tokenKey, token);
  else {
    token = sessionStorage.getItem(tokenKey) ?? sessionStorage.getItem(`ruyi-uxai:${session}:token`) ?? sessionStorage.getItem(`uxai-review:${session}:token`) ?? "";
    if (token) sessionStorage.setItem(tokenKey, token);
  }
} catch {
  // Browsers may disable storage. Keep a supplied token in the URL so reload works.
}
if (token) {
  try {
    if (sessionStorage.getItem(tokenKey) === token)
      history.replaceState(null, "", location.pathname + location.search);
  } catch { /* Keep the fragment when storage is unavailable. */ }
}
let context: any;
let historicalRevision: any;
const displayedRevision = () => historicalRevision ?? context.revision;
let selection: Target | undefined;
let editing: string | undefined;
let activeCommentId: string | undefined;
let mode = "element";
let cursor = 0;
let connected = false;
type View = {
  kind: "page" | "component" | "tokens";
  id: string;
  state?: string;
  device: string;
};
let view: View = {
  kind: (params.get("kind") as View["kind"]) ?? "page",
  id: params.get("id") ?? "",
  state: params.get("state") ?? undefined,
  device: params.get("device") ?? "",
};
type Frame = {
  element: HTMLIFrameElement;
  target: Target;
  entry: any;
  ready: boolean;
  height: number;
  resize?: () => void;
  restore?: any;
  capture?: (value: any) => void;
  locate?: any;
};
const frames = new Map<string, Frame>();
let locateTimer: ReturnType<typeof setTimeout> | undefined;
function notice(text: string, tone: "info" | "error" | "warning" = "info") {
  const node = el("notice");
  node.textContent = text;
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "error" ? "alert" : "status");
}
async function api(route: string, body?: unknown, method?: string) {
  const r = await fetch(apiUrl(route), {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message ?? r.statusText);
  return data;
}
const button = (
  text: string,
  fn: () => void | Promise<void>,
  className = "",
) => {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = className;
  b.onclick = () => {
    Promise.resolve(fn()).catch((e) => notice(e.message, "error"));
  };
  return b;
};
function message(frame: Frame, type: BridgeMessage["type"], payload?: any) {
  frame.element.contentWindow?.postMessage(
    {
      version: 1,
      channel: BRAND.bridgeChannel,
      frameId: frame.element.name,
      type,
      payload,
    },
    context.previewSandboxed ? "*" : new URL(context.previewBase).origin,
  );
}
function choose(next: View) {
  clearTimeout(locateTimer);
  view = next;
  const q = new URLSearchParams({
    session,
    kind: view.kind,
    id: view.id,
    device: view.device,
    ...(view.state ? { state: view.state } : {}),
  });
  if (gatewayPort) q.set("port", gatewayPort);
  if (historicalRevision) q.set("revision", historicalRevision.id);
  history.pushState(null, "", `?${q}`);
  renderNav();
  renderCanvas();
}
function renderNav() {
  const m = displayedRevision().manifest as Manifest;
  const nav = el("navigation");
  nav.replaceChildren();
  const label = (text: string) => {
    const p = document.createElement("div");
    p.className = "nav-section";
    p.textContent = text;
    nav.append(p);
  };
  label("页面");
  for (const page of m.pages) {
    const active = view.kind === "page" && view.id === page.id;
    const b = button(page.name, () => {
      const state = page.states.find((s) => s.entries[view.device]) ?? page.states[0];
      choose({ kind: "page", id: page.id, state: state.id,
        device: state.entries[view.device] ? view.device : Object.keys(state.entries)[0] });
    }, active ? "nav-item active" : "nav-item");
    if (active) b.setAttribute("aria-current", "page");
    nav.append(b);
  }
  label("设计系统");
  nav.append(
    button(
      "设计令牌",
      () => choose({ kind: "tokens", id: "tokens", device: view.device }),
      view.kind === "tokens" ? "nav-item active" : "nav-item",
    ),
  );
  for (const c of m.components)
    nav.append(
      button(
        c.name,
        () => choose({ kind: "component", id: c.id, device: view.device }),
        view.kind === "component" && view.id === c.id
          ? "nav-item active"
          : "nav-item",
      ),
    );
}
function frameCard(entry: any, target: Target, name: string, restore?: any) {
  const device = (displayedRevision().manifest as Manifest).devices.find(
    (d) => d.id === target.deviceId,
  )!;
  const card = document.createElement("section");
  card.className = "preview-card";
  card.style.maxWidth = device.width + 2 + "px";
  card.style.marginInline = "auto";
  const heading = document.createElement("div");
  heading.className = "card-heading";
  heading.textContent = name;
  const dims = document.createElement("span");
  dims.textContent = target.kind === "component" ? `${device.width}px 宽 · 高度自适应` : `${device.width} × ${device.height}`;
  heading.append(dims);
  card.append(heading);
  const fit = document.createElement("div");
  fit.className = "frame-fit";
  const iframe = document.createElement("iframe");
  iframe.title = name;
  iframe.name = crypto.randomUUID();
  iframe.width = String(device.width);
  iframe.height = String(device.height);
  iframe.style.width = device.width + "px";
  iframe.style.height = device.height + "px";
  iframe.setAttribute(
    "sandbox",
    context.previewSandboxed
      ? "allow-scripts allow-forms allow-modals"
      : "allow-scripts allow-same-origin allow-forms allow-modals",
  );
  const url = routedUrl(
    context.previewBase,
    `r/${target.revisionId}/${entry.path}`,
  );
  for (const [k, v] of Object.entries(entry.query ?? {}))
    url.searchParams.set(k, String(v));
  url.hash = entry.hash ?? "";
  iframe.src = url.href;
  frames.set(iframe.name, {
    element: iframe,
    target,
    entry,
    ready: false,
    height: device.height,
    restore,
  });
  fit.append(iframe);
  card.append(fit);
  el("canvas").append(card);
  const resize = () => {
    if (!fit.isConnected) return;
    const scale = Math.min(1, fit.clientWidth / device.width);
    iframe.style.transform = `scale(${scale})`;
    fit.style.height = (frames.get(iframe.name)?.height ?? device.height) * scale + "px";
  };
  frames.get(iframe.name)!.resize = resize;
  new ResizeObserver(resize).observe(fit);
}
function renderCanvas(restores = new Map<string, any>()) {
  clearTimeout(locateTimer);
  el("history-banner").hidden = !historicalRevision;
  el("history-version").textContent = historicalRevision ? `正在查看原版本 ${historicalRevision.id.slice(0, 8)}` : "";
  el("revision").textContent = (historicalRevision ? "原版本 " : "版本 ") + displayedRevision().id.slice(0, 8);
  el<HTMLButtonElement>("preview-toggle").disabled = !!historicalRevision;
  el("interaction-hint").textContent = historicalRevision ? "正在查看原版本，返回最新版本后可继续评论。" : mode === "experience" ? "预览中：直接操作设计稿体验交互。" : "点击元素添加评论，保存后在对话中告诉 AI 可以更新。";
  frames.clear();
  el("canvas").replaceChildren();
  const m = displayedRevision().manifest as Manifest;
  const states = el<HTMLSelectElement>("state");
  const page = m.pages.find((p) => p.id === view.id);
  el("state-control").hidden = view.kind !== "page";
  states.replaceChildren(...(view.kind === "page" ? page?.states ?? [] : [])
    .map((s) => new Option(s.name, s.id)));
  states.value = view.state ?? "";
  const available = view.kind === "page"
    ? Object.keys(page?.states.find((s) => s.id === view.state)?.entries ?? {})
    : view.kind === "component"
      ? [...new Set(m.components.find((c) => c.id === view.id)?.examples.flatMap((e) => Object.keys(e.entries)) ?? [])]
      : m.devices.map((d) => d.id);
  if (!available.includes(view.device)) view.device = available[0] ?? m.devices[0].id;
  const devices = el<HTMLSelectElement>("device");
  devices.replaceChildren(...m.devices.filter((d) => available.includes(d.id)).map((d) => new Option(d.name, d.id)));
  devices.value = view.device;
  devices.disabled = view.kind === "tokens";
  el("eyebrow").textContent =
    view.kind === "page" ? "页面设计" : "设计系统";
  if (view.kind === "tokens") {
    el("title").textContent = "设计令牌";
    const grid = document.createElement("div");
    grid.className = "token-grid";
    let currentGroup = "";
    for (const t of m.tokens) {
      if (t.group !== currentGroup) {
        const label = document.createElement("h2");
        label.className = "token-group";
        label.textContent = t.group;
        grid.append(label);
        currentGroup = t.group;
      }
      const card = document.createElement("article");
      card.className = "token-card";
      const sample = document.createElement("div");
      sample.className = "token-sample";
      if (t.type === "color") sample.style.background = t.value;
      else {
        sample.textContent =
          t.type === "typography"
            ? "Aa 字体样例"
            : t.type === "spacing"
              ? ""
              : "间距与形状";
        if (t.type === "typography") sample.style.fontSize = t.value;
        if (t.type === "spacing") {
          const bar = document.createElement("div");
          bar.style.cssText = `height:48px;background:var(--brand)`;
          bar.style.width = t.value;
          sample.append(bar);
        }
        if (t.type === "radius") sample.style.borderRadius = t.value;
        if (t.type === "shadow") sample.style.boxShadow = t.value;
      }
      const title = document.createElement("h2");
      title.textContent = t.name;
      const value = document.createElement("code");
      value.textContent = `${t.cssVariable ?? t.id}: ${t.value}`;
      const desc = document.createElement("p");
      desc.textContent = t.description;
      card.append(
        sample,
        title,
        value,
        desc,
        button(
          "评论此令牌",
          () =>
            compose({
              kind: "token",
              objectId: t.id,
              revisionId: displayedRevision().id,
            }),
          "secondary",
        ),
      );
      if (historicalRevision) card.querySelectorAll("button").forEach((b) => b.disabled = true);
      grid.append(card);
    }
    el("canvas").append(grid);
    return;
  }
  const all = combinations(m).filter(
    (c) =>
      c.kind === view.kind &&
      c.objectId === view.id &&
      c.deviceId === view.device &&
      (c.kind === "component" || c.stateId === view.state),
  );
  el("title").textContent =
    view.kind === "page"
      ? (m.pages.find((p) => p.id === view.id)?.name ?? "页面") +
        " / " +
        (m.pages
          .find((p) => p.id === view.id)
          ?.states.find((s) => s.id === view.state)?.name ?? "状态")
      : (m.components.find((c) => c.id === view.id)?.name ?? "组件");
  if (!all.length) {
    el("canvas").textContent =
      "该组合不可用，请选择其他状态或设备。";
    return;
  }
  for (const c of all) {
    const target = { ...c, revisionId: displayedRevision().id };
    frameCard(c.entry, target, c.name, restores.get(c.name));
  }
}
function placeComposer() {
  const composer = el("composer");
  for (const card of document.querySelectorAll<HTMLElement>("#comments .comment-card")) { card.classList.remove("editing"); card.classList.toggle("selected", card.dataset.commentId === activeCommentId); }
  const id = editing?.replace(/^reply:/, "");
  const card = [...document.querySelectorAll<HTMLElement>("#comments .comment-card")].find(c => c.dataset.commentId === id);
  if (card && !composer.hidden) {
    card.classList.add("editing");
    card.querySelector(".comment-actions")!.before(composer);
  } else el("comments").before(composer);
}
function compose(target: Target, comment?: any) {
  selection = structuredClone(target);
  editing = comment?.id;
  activeCommentId = comment?.id;
  el("composer").hidden = false;
  el("target-label").textContent =
    `${target.kind} / ${target.objectId}${target.stateId ? " / " + target.stateId : ""}${target.exampleId ? " / " + target.exampleId : ""}`;
  el<HTMLTextAreaElement>("comment-text").value = comment?.text ?? "";
  placeComposer();
  el("comment-text").focus();
}
async function locateComment(comment: any, original = false) {
  const target = comment.target as Target;
  const revision = original ? await api(`revisions/${encodeURIComponent(target.revisionId)}`) : context.revision;
  const combo = combinations(revision.manifest).find((c) =>
    c.kind === target.kind && c.objectId === target.objectId &&
    c.deviceId === target.deviceId &&
    (c.kind === "page" ? c.stateId === target.stateId : c.exampleId === target.exampleId),
  );
  if (!combo) {
    notice("评论对应的页面、状态或设备已不存在，原版本上下文仍保留。", "warning");
    return;
  }
  historicalRevision = original ? revision : undefined;
  // Reopen the declared entry even if an existing frame navigated elsewhere
  // during preview. Keep the comment's original revision and target immutable.
  choose({ kind: combo.kind, id: combo.objectId, device: combo.deviceId,
    state: combo.kind === "page" ? combo.stateId : undefined });
  const f = [...frames.values()].find((f) =>
    f.target.kind === target.kind && f.target.objectId === target.objectId &&
    f.target.deviceId === target.deviceId && f.target.stateId === target.stateId &&
    f.target.exampleId === target.exampleId,
  );
  if (!f) return;
  const state = target.context?.state as Record<string, unknown> | undefined;
  // Locating scrolls/highlights the target; restoring old input focus can both
  // move the viewport away and violate opaque-frame focus permissions.
  f.restore = state ? { ...state, focus: undefined } : undefined;
  const latestResult = comment.results.at(-1);
  const deletion = !original && latestResult?.action === "modified" && latestResult?.location?.kind === "deleted"
    ? latestResult.location.container : undefined;
  f.locate = { ...(target.context?.anchor as object ?? {}), ...(deletion ? { deletion } : {}) };
  f.element.scrollIntoView({ block: "center" });
  notice("正在打开评论对应的设计并定位元素…");
  locateTimer = setTimeout(() => notice("设计尚未完成定位，请重试；原评论上下文仍保留。", "warning"), 10000);
}
function locateInFrame(f: Frame) {
  if (!f.locate) return;
  message(f, "locate", f.locate);
  f.locate = undefined;
}
let archiveOpen = false;
function renderComments() {
  const list = el("comments");
  const existingArchive = list.querySelector<HTMLDetailsElement>("#archived-comments");
  if (existingArchive) archiveOpen = existingArchive.open;
  list.before(el("composer"));
  list.replaceChildren();
  const comments = [...context.comments].reverse() as any[];
  const active = comments.filter((c) => c.status !== "resolved");
  const archived = comments.filter((c) => c.status === "resolved");
  el("count").textContent = String(active.length);
  const activeList = document.createElement("div");
  activeList.id = "active-comments";
  if (!active.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "当前没有未解决的评论。";
    activeList.append(empty);
  }
  list.append(activeList);
  const archive = document.createElement("details");
  archive.id = "archived-comments";
  archive.className = "comment-archive";
  archive.open = archiveOpen;
  const summary = document.createElement("summary");
  summary.textContent = `已归档（${archived.length}）`;
  const archiveList = document.createElement("div");
  archive.append(summary, archiveList);
  if (archived.length) list.append(archive);
  const statusNames: Record<string, string> = {
    draft: "待处理",
    submitted: "已纳入更新",
    needs_clarification: "待澄清",
    awaiting_review: "待复核",
    resolved: "已解决",
  };
  for (const c of comments) {
    const card = document.createElement("article");
    card.className = "comment-card" + (activeCommentId === c.id ? " selected" : "");
    card.dataset.commentId = c.id;
    card.dataset.status = c.status;
    const head = document.createElement("div");
    head.className = "comment-meta";
    head.textContent = `${c.target.objectId} · ${c.target.deviceId ?? "令牌"} · ${c.status === "resolved" && c.resolution === "archived" ? "已归档" : statusNames[c.status]}`;
    const text = document.createElement("p");
    text.textContent = c.text;
    card.append(head, text);
    for (const t of c.thread) {
      const reply = document.createElement("div");
      reply.className = "thread";
      reply.textContent = `${t.author === "agent" ? "AI" : "你"}：${t.text}`;
      card.append(reply);
    }
    const actions = document.createElement("div");
    actions.className = "comment-actions";
    if (c.status === "draft") {
      actions.append(
        button("编辑", () => compose(c.target, c)),
        button("删除", async () => {
          await api(`comments/${c.id}`, undefined, "DELETE");
          await refresh();
        }),
      );
    }
    if (c.target.context?.anchor?.selector)
      actions.append(
        button("定位", () => locateComment(c)),
        button("查看原版本", () => locateComment(c, true)),
      );
    if (c.status === "awaiting_review")
      actions.append(
        button("确认解决", async () => {
          await api(`comments/${c.id}/review`, { action: "resolve" });
          await refresh();
        }),
      );
    if (c.status !== "resolved") {
      const archiveButton = button("归档", async () => {
        await api(`comments/${c.id}/review`, { action: "archive" });
        if (editing?.replace(/^reply:/, "") === c.id) {
          el("composer").hidden = true;
          editing = undefined;
          selection = undefined;
        }
        await refresh();
      });
      const busy = context.batches.some((b: any) =>
        ["queued", "processing"].includes(b.status) && b.items.some((item: any) => item.id === c.id));
      archiveButton.disabled = busy;
      if (busy) archiveButton.title = "本轮处理完成后可以归档";
      actions.append(archiveButton);
    }
    if (c.status !== "draft")
      actions.append(
        button("重新打开", async () => {
          await api(`comments/${c.id}/review`, { action: "reopen" });
          await refresh();
        }),
      );
    actions.append(
      button("回复", () => {
        compose(c.target);
        editing = `reply:${c.id}`;
        activeCommentId = c.id;
        placeComposer();
      }),
    );
    card.append(actions);
    (c.status === "resolved" ? archiveList : activeList).append(card);
  }
  placeComposer();
  const drafts = comments.filter((c) => c.status === "draft").length;
  el("pending-count").textContent = drafts
    ? `${drafts} 条评论待处理`
    : "没有待处理评论";
}
async function refresh() {
  context = await api("context");
  el("revision").textContent = (historicalRevision ? "原版本 " : "版本 ") + displayedRevision().id.slice(0, 8);
  el("project").textContent = context.revision.manifest.name;
  renderComments();
}
window.addEventListener("message", (e) => {
  if (
    !context ||
    e.origin !==
      (context.previewSandboxed
        ? "null"
        : new URL(context.previewBase).origin) ||
    !isBridgeMessage(e.data)
  )
    return;
  const m = e.data,
    f = frames.get(m.frameId);
  if (!f || e.source !== f.element.contentWindow) return;
  if (m.type === "ready") {
    f.ready = true;
    if (f.target.kind === "component") message(f, "measure");
    message(f, "mode", historicalRevision ? "experience" : mode);
    if (f.restore) {
      const restore = f.restore;
      f.restore = undefined;
      message(f, "restore", restore);
    } else locateInFrame(f);
  }
  if (m.type === "resize" && f.target.kind === "component") {
    const height = m.payload?.height;
    if (typeof height === "number" && Number.isFinite(height) && height >= 160 && height <= 7680) {
      f.height = Math.ceil(height);
      f.element.height = String(f.height);
      f.element.style.height = f.height + "px";
      f.resize?.();
    }
  }
  if (m.type === "selection" && !historicalRevision) {
    const target = { ...f.target, context: m.payload };
    const anchor = m.payload?.anchor;
    const existing = [...context.comments].reverse().find((c: any) => {
      const t = c.target, a = t.context?.anchor;
      if (c.status === "resolved" || t.kind !== target.kind || t.objectId !== target.objectId || t.stateId !== target.stateId || t.deviceId !== target.deviceId || t.exampleId !== target.exampleId || !anchor?.selector || !a?.selector) return false;
      return a.selector === anchor.selector || (a.reviewId && a.reviewId === anchor.reviewId) || anchor.ancestors?.some((p: any) => p.selector === a.selector) || a.ancestors?.some((p: any) => p.selector === anchor.selector);
    });
    if (existing?.status === "draft") compose(existing.target, existing);
    else if (existing) {
      compose(existing.target);
      editing = `reply:${existing.id}`;
      activeCommentId = existing.id;
      renderComments();
      el("comment-text").focus();
      notice("此评论已纳入更新，可在原位补充回复。");
    } else compose(target);
  }
  if (m.type === "captured") {
    f.capture?.(m.payload);
    f.capture = undefined;
  }
  if (m.type === "restored") {
    if (f.locate) locateInFrame(f);
    else if (!m.payload.ok)
      notice("新版已发布，部分交互状态无法恢复；评论草稿已保留。", "warning");
  }
  if (m.type === "located") {
    clearTimeout(locateTimer);
    notice(!m.payload.ok ? "定位已失效或存在歧义，保留原版本评论上下文。"
      : m.payload.kind === "deleted" ? "已定位到保留的父容器：此处已删除。"
      : historicalRevision ? "已在原版本中定位元素。" : "已切换到评论对应的设计并定位元素。", !m.payload.ok ? "error" : m.payload.kind === "deleted" ? "warning" : "info");
  }
});
function latestAvailableView(): View {
  const m = context.revision.manifest as Manifest;
  if (view.kind === "tokens") return { ...view, device: m.devices.some(d => d.id === view.device) ? view.device : m.devices[0].id };
  const all = combinations(m);
  const current = all.find(c => c.kind === view.kind && c.objectId === view.id && c.deviceId === view.device && (c.kind !== "page" || c.stateId === view.state));
  if (current) return view;
  const fallback = all.find(c => c.kind === view.kind && c.objectId === view.id) ?? all[0];
  return fallback ? { kind: fallback.kind, id: fallback.objectId, state: fallback.kind === "page" ? fallback.stateId : undefined, device: fallback.deviceId } : { kind: "tokens", id: "tokens", device: m.devices[0].id };
}
async function updateRevision() {
  if (historicalRevision) {
    await refresh();
    notice("新版本已发布，可返回最新版本查看；当前保留原版本对照。");
    return;
  }
  const restores = new Map<string, any>();
  await Promise.all(
    [...frames.values()].map(
      (f) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 500);
          f.capture = (value) => {
            clearTimeout(timer);
            restores.set(f.element.title, value);
            resolve();
          };
          message(f, "capture");
        }),
    ),
  );
  const old = context.revision.id;
  await refresh();
  if (old === context.revision.id) return;
  const next = latestAvailableView();
  if (next !== view) {
    choose(next);
    notice("原设计入口已移除，已切换到最新可用页面；原版本仍可查看。");
    return;
  }
  renderNav();
  if (context.revision.mode === "styles" && !context.previewSandboxed) {
    for (const f of frames.values()) {
      f.target.revisionId = context.revision.id;
      message(f, "styles", { revisionId: context.revision.id });
    }
  } else renderCanvas(restores);
  notice("已自动更新到最新版本，等待你复核。");
}
async function events() {
  while (connected) {
    try {
      const r = await fetch(apiUrl(`events?cursor=${cursor}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("评审连接不可用");
      const reader = r.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (connected) {
        const { value, done } = await reader.read();
        if (done) throw new Error("评审服务已断开");
        buffer += value;
        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const result = JSON.parse(line.slice(6));
          cursor = result.nextCursor;
          el("activity").textContent =
            {
              working: "AI 正在修改",
              idle: "等待你告知 AI 更新",
            }[result.activity as string] ?? "已连接";
          if (
            result.resyncRequired ||
            result.events.some((e: any) => e.type === "revision.published")
          )
            await updateRevision();
          else if (result.events.length) await refresh();
        }
      }
    } catch {
      el("activity").textContent = "服务连接中断，正在重连";
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
el<HTMLSelectElement>("device").onchange = () =>
  choose({ ...view, device: el<HTMLSelectElement>("device").value });
el<HTMLSelectElement>("state").onchange = () => {
  const state = (displayedRevision().manifest as Manifest).pages
    .find((p) => p.id === view.id)!.states.find((s) => s.id === el<HTMLSelectElement>("state").value)!;
  choose({ ...view, state: state.id,
    device: state.entries[view.device] ? view.device : Object.keys(state.entries)[0] });
};
el("preview-toggle").onclick = () => {
  mode = mode === "experience" ? "element" : "experience";
  const preview = mode === "experience";
  el("preview-toggle").textContent = preview ? "退出预览" : "预览";
  el("preview-toggle").setAttribute("aria-pressed", String(preview));
  el("interaction-hint").textContent = preview ? "预览中：直接操作设计稿体验交互。" : "点击元素添加评论，保存后在对话中告诉 AI 可以更新。";
  el("composer").hidden = true;
  for (const f of frames.values()) message(f, "mode", mode);
};
el("cancel-comment").onclick = () => {
  el("composer").hidden = true;
  selection = undefined;
  editing = undefined;
};
el("comment-text").addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    el<HTMLFormElement>("composer").requestSubmit();
  }
});
el("composer").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const text = el<HTMLTextAreaElement>("comment-text").value;
    if (editing?.startsWith("reply:"))
      await api(`comments/${editing.slice(6)}/review`, {
        action: "reply",
        message: text,
      });
    else if (editing) await api(`comments/${editing}`, { text }, "PATCH");
    else if (selection) await api("comments", { text, target: selection });
    el("composer").hidden = true;
    editing = undefined;
    await refresh();
    notice("评论已保存。请在 AI 对话中说：我已评论，可以更新。");
  } catch (e: any) {
    notice(e.message, "error");
  }
};
el("return-latest").onclick = () => {
  historicalRevision = undefined;
  choose(latestAvailableView());
  notice("已返回最新版本。");
};
window.onpopstate = async () => {
  const requestedUrl = location.href;
  const p = new URLSearchParams(location.search);
  try {
    const revisionId = p.get("revision");
    const revision = revisionId
      ? await api(`revisions/${encodeURIComponent(revisionId)}`) : undefined;
    if (location.href !== requestedUrl) return;
    historicalRevision = revision;
  } catch (e: any) {
    notice(e.message, "error");
    return;
  }
  view = {
    kind: p.get("kind") as View["kind"],
    id: p.get("id") ?? "",
    device: p.get("device") ?? "",
    state: p.get("state") ?? undefined,
  };
  renderNav();
  renderCanvas();
};
async function init() {
  if (!token) throw new Error("请从 AI 客户端提供的评审链接打开工作区。");
  await refresh();
  cursor = context.cursor;
  const revisionId = params.get("revision");
  if (revisionId)
    historicalRevision = await api(`revisions/${encodeURIComponent(revisionId)}`);
  const m = displayedRevision().manifest as Manifest;
  if (!view.id) {
    const first = combinations(m)[0];
    if (first)
      view = {
        kind: first.kind,
        id: first.objectId,
        state: first.kind === "page" ? first.stateId : undefined,
        device: first.deviceId,
      };
    else view = { kind: "tokens", id: "tokens", device: m.devices[0].id };
  }
  if (!view.device) view.device = m.devices[0].id;
  renderNav();
  renderCanvas();
  connected = true;
  void events();
}
void init().catch((e) => {
  el("activity").textContent = "工作区连接失败";
  el("activity").dataset.tone = "error";
  notice(e.message, "error");
});
