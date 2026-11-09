import { mountShell, toast } from "../components/shell.js";
import { createButton } from "../components/button.js";
import { createProjectCard, projects } from "../components/project-card.js";
import { createProjectDialog } from "../components/dialog.js";
import { emptyState, skeletonCards, taskList } from "../components/states.js";
import { icon } from "../components/icons.js";
const state = new URLSearchParams(location.search).get("state") ?? "default";
let filter = "all",
  query = "";
const currentProjects =
  state === "empty" ? [] : projects.map((p) => ({ ...p }));
const content = document.createElement("div"),
  stats = document.createElement("div");
stats.className = "stats-grid";
for (const [label, value, detail, glyph] of [
  ["全部项目", "3", "本月新增 1 个", "folder"],
  ["待完成的任务", "8", "今天，向前一步", "check"],
  ["团队协作成员", "4", "一起，让好事发生", "layers"],
]) {
  const card = document.createElement("section");
  card.className = "stat-card";
  const text = document.createElement("div");
  text.className = "stat-label";
  text.append(document.createTextNode(label), icon(glyph, 16));
  const number = document.createElement("div");
  number.className = "stat-number";
  const strong = document.createElement("strong");
  strong.textContent = state === "empty" ? "0" : value;
  const small = document.createElement("small");
  small.textContent = detail;
  number.append(strong, small);
  card.append(text, number);
  stats.append(card);
}
content.append(stats);
const toolbar = document.createElement("div");
toolbar.className = "section-toolbar";
const tabs = document.createElement("div");
tabs.className = "tabs";
tabs.setAttribute("role", "tablist");
tabs.setAttribute("aria-label", "项目筛选");
for (const [id, label] of [
  ["all", "全部项目"],
  ["progress", "进行中"],
  ["completed", "已完成"],
]) {
  const b = document.createElement("button");
  b.className = "tab";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", String(id === filter));
  b.textContent = label;
  b.onclick = () => {
    filter = id;
    for (const tab of tabs.children)
      tab.setAttribute("aria-selected", String(tab === b));
    renderProjects();
  };
  tabs.append(b);
}
const search = document.createElement("label");
search.className = "search";
search.append(icon("search", 16));
const searchInput = document.createElement("input");
searchInput.type = "search";
searchInput.placeholder = "搜索项目";
searchInput.setAttribute("aria-label", "搜索项目");
searchInput.dataset.reviewId = "project-search";
searchInput.oninput = () => {
  query = searchInput.value;
  renderProjects();
};
search.append(searchInput);
toolbar.append(tabs, search);
content.append(toolbar);
const grid = document.createElement("div");
grid.className = "home-grid";
grid.dataset.reviewId = "project-grid";
content.append(grid);
const dialog = createProjectDialog({
  onCreate: (name) => {
    currentProjects.unshift({
      ...projects[0],
      id: "new-" + currentProjects.length,
      name,
      description: "新的开始，由你和团队共同书写。",
      progress: 0,
      tasks: "0 / 0",
      due: "待安排",
      members: ["林"],
    });
    renderProjects();
    toast("项目已创建，开始安排第一个任务吧。");
  },
});
document.body.append(dialog);
function renderProjects() {
  grid.replaceChildren();
  stats.querySelector("strong").textContent = String(currentProjects.length);
  const navCount = document.querySelector(".nav-count");
  if (navCount) navCount.textContent = String(currentProjects.length);
  if (state === "loading") {
    grid.append(skeletonCards());
    return;
  }
  if (state === "error") {
    grid.append(
      emptyState({
        title: "项目暂时没有加载出来",
        description: "连接似乎打了个盹。你的工作不会丢失，再试一次就好。",
        action: "重新加载",
        glyph: "alert",
        onAction: () => (location.href = "./home.html"),
      }),
    );
    return;
  }
  const visible = currentProjects.filter(
    (p) =>
      (filter === "all" ||
        (filter === "completed"
          ? p.statusTone === "success"
          : p.statusTone === "progress")) &&
      p.name.includes(query),
  );
  if (!visible.length) {
    grid.append(
      emptyState({
        title: query
          ? "没有找到匹配的项目"
          : filter === "completed"
            ? "每一次完成，都值得期待。"
            : undefined,
        description: query ? "试试其他关键词，或者创建一个新项目。" : undefined,
        action: query ? "清除搜索" : "创建第一个项目",
        onAction: () => {
          if (query) {
            query = "";
            searchInput.value = "";
            renderProjects();
          } else dialog.showModal();
        },
      }),
    );
    return;
  }
  for (const project of visible) grid.append(createProjectCard({ project }));
}
const below = document.createElement("div");
below.className = "below-grid";
const tasks = document.createElement("section");
tasks.className = "panel";
tasks.innerHTML =
  '<h2 class="panel-title">今天的重点 <small>一步一步，保持前进</small></h2>';
tasks.append(
  taskList({
    items: [
      { id: "task-review", name: "完成首页设计评审", date: "今天" },
      { id: "task-tokens", name: "整理组件与颜色令牌", date: "今天" },
      { id: "task-research", name: "准备下一轮用户访谈", date: "明天" },
    ],
    onChange: (_id, done) =>
      toast(done ? "又完成了一件重要的小事。" : "任务已重新打开。"),
  }),
);
const activity = document.createElement("section");
activity.className = "panel";
activity.innerHTML =
  '<h2 class="panel-title">团队动态 <small>我们一起完成的事</small></h2>';
for (const [name, text, time] of [
  ["周", "周予安 更新了品牌设计系统的颜色规范。", "20 分钟前"],
  ["陈", "陈以宁 完成了 3 份用户访谈记录。", "1 小时前"],
  ["林", "你 创建了产品体验升级项目。", "昨天"],
]) {
  const row = document.createElement("div");
  row.className = "activity-row";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = name;
  const copy = document.createElement("div");
  const p = document.createElement("p");
  p.textContent = text;
  const t = document.createElement("small");
  t.textContent = time;
  copy.append(p, t);
  row.append(avatar, copy);
  activity.append(row);
}
below.append(tasks, activity);
if (state === "default") content.append(below);
mountShell({
  active: "home",
  title: "早上好，小满",
  subtitle: "把注意力留给重要的事，今天也向前一步。",
  action: createButton({
    label: "新建项目",
    icon: icon("plus", 16),
    id: "new-project",
    state: ["loading", "error"].includes(state) ? "disabled" : "default",
    onClick: () => dialog.showModal(),
  }),
  content,
});
renderProjects();
window.uxaiReviewState = {
  exportState: () => ({
    filter,
    query,
    dialogOpen: dialog.open,
    created: currentProjects.filter((p) => p.id.startsWith("new-")),
  }),
  restoreState: (s) => {
    filter = s.filter ?? "all";
    query = s.query ?? "";
    searchInput.value = query;
    for (const p of s.created ?? [])
      if (!currentProjects.some((x) => x.id === p.id))
        currentProjects.unshift(p);
    for (const tab of tabs.children)
      tab.setAttribute(
        "aria-selected",
        String(
          tab.textContent ===
            { all: "全部项目", progress: "进行中", completed: "已完成" }[
              filter
            ],
        ),
      );
    renderProjects();
    if (s.dialogOpen && !dialog.open) dialog.showModal();
  },
};
