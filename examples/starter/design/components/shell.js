import { icon } from "./icons.js";
import { createButton } from "./button.js";
export function mountShell({
  active = "home",
  section = "工作台",
  title = "工作台",
  subtitle = "",
  action,
  content,
} = {}) {
  const root = document.querySelector("#app");
  root.className = "app-shell";
  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";
  const brand = document.createElement("a");
  brand.className = "app-brand";
  brand.href = "./home.html";
  const mark = document.createElement("span");
  mark.className = "brand-symbol";
  mark.textContent = "n";
  brand.append(mark, document.createTextNode("northstar"));
  const workspace = document.createElement("div");
  workspace.className = "workspace-switch";
  workspace.innerHTML =
    '<span class="workspace-initial" aria-hidden="true">S</span><div><strong>Studio 工作空间</strong><small>Free plan · 4 位成员</small></div>';
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "应用导航");
  for (const [key, label, href, glyph] of [
    ["home", "工作台", "./home.html", "grid"],
    ["projects", "所有项目", "./home.html?view=all", "folder"],
    ["settings", "工作空间设置", "./settings.html", "settings"],
  ]) {
    const a = document.createElement("a");
    a.href = href;
    a.className = "app-nav-item" + (active === key ? " selected" : "");
    if (active === key) a.setAttribute("aria-current", "page");
    a.append(icon(glyph, 18), document.createTextNode(label));
    if (key === "projects") {
      const number = document.createElement("span");
      number.className = "nav-count";
      number.textContent = "3";
      a.append(number);
    }
    nav.append(a);
  }
  const note = document.createElement("div");
  note.className = "sidebar-note";
  note.innerHTML =
    '<span class="eyebrow">A LITTLE MORE SPACE</span><strong>好想法，值得更大的舞台。</strong><p>整理计划，与团队保持同一个方向。</p>';
  const user = document.createElement("a");
  user.className = "sidebar-user";
  user.href = "./settings.html";
  user.innerHTML =
    '<span class="avatar avatar--large">林</span><div><strong>林小满</strong><small>xiaoman@studio.design</small></div>';
  sidebar.append(brand, workspace, nav, note, user);
  const area = document.createElement("div");
  area.className = "app-area";
  const top = document.createElement("header");
  top.className = "app-topbar";
  const crumbs = document.createElement("div");
  crumbs.className = "breadcrumbs";
  crumbs.textContent = "工作空间 / " + section;
  const topActions = document.createElement("div");
  topActions.className = "topbar-actions";
  const bell = createButton({
    label: "",
    variant: "icon",
    icon: icon("bell"),
    id: "notifications",
    onClick: () => toast("你已处理所有通知，今天也很有进展。"),
  });
  bell.setAttribute("aria-label", "查看通知");
  const exit = document.createElement("a");
  exit.href = "./login.html";
  exit.className = "exit-link";
  exit.textContent = "退出";
  topActions.append(bell, exit);
  top.append(crumbs, topActions);
  const main = document.createElement("main");
  main.className = "app-main";
  const heading = document.createElement("div");
  heading.className = "page-heading";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent =
    active === "settings" ? "YOUR SPACE, YOUR WAY" : "MAKE ROOM FOR GOOD WORK";
  const h1 = document.createElement("h1");
  h1.dataset.reviewId = active + "-heading";
  h1.textContent = title;
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = subtitle;
  copy.append(eyebrow, h1, p);
  heading.append(copy);
  if (action) heading.append(action);
  main.append(heading, content);
  area.append(top, main);
  root.append(sidebar, area);
}
export function toast(message) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 4000);
}
