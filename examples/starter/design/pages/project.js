import { mountShell, toast } from "../components/shell.js";
import { createButton } from "../components/button.js";
import { createBadge } from "../components/badge.js";
import { projects } from "../components/project-card.js";
import { taskList } from "../components/states.js";
import { icon } from "../components/icons.js";
const query = new URLSearchParams(location.search),
  state = query.get("state") ?? "default",
  project = projects.find((p) => p.id === query.get("project")) ?? projects[0];
const content = document.createElement("div");
const tabs = document.createElement("div");
tabs.className = "tabs detail-tabs";
tabs.setAttribute("role", "tablist");
tabs.setAttribute("aria-label", "项目详情");
let selected = state === "activity" ? "activity" : "overview";
const body = document.createElement("div");
for (const [id, label] of [
  ["overview", "项目概览"],
  ["activity", "项目动态"],
]) {
  const b = document.createElement("button");
  b.className = "tab";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", String(id === selected));
  b.textContent = label;
  b.onclick = () => {
    selected = id;
    render();
  };
  tabs.append(b);
}
content.append(tabs, body);
const tasks = [
  {
    id: "detail-research",
    name: "梳理关键使用场景",
    date: "已完成",
    done: true,
  },
  {
    id: "detail-wireframe",
    name: "完成首页布局与信息层级",
    date: "已完成",
    done: true,
  },
  { id: "detail-components", name: "统一表单和按钮组件", date: "11 月 12 日" },
  { id: "detail-mobile", name: "完善移动端的交互体验", date: "11 月 15 日" },
  { id: "detail-review", name: "进行一轮完整的设计评审", date: "11 月 18 日" },
];
function render() {
  for (const b of tabs.children)
    b.setAttribute(
      "aria-selected",
      String(
        b.textContent === (selected === "overview" ? "项目概览" : "项目动态"),
      ),
    );
  body.replaceChildren();
  if (selected === "activity") {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = '<h2 class="panel-title">每一步，都有迹可循</h2>';
    for (const [name, description, date] of [
      ["周予安", "更新了页面布局，并补充移动端状态。", "今天 10:24"],
      ["林小满", "完成了第一轮组件梳理。", "昨天 16:30"],
      ["陈以宁", "上传了用户访谈的整理结果。", "11 月 6 日 14:00"],
    ]) {
      const row = document.createElement("div");
      row.className = "milestone";
      const dot = document.createElement("span");
      dot.className = "milestone-mark";
      dot.append(icon("check", 13));
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = name + " · " + description;
      const time = document.createElement("small");
      time.textContent = date;
      text.append(title, time);
      row.append(dot, text);
      panel.append(row);
    }
    body.append(panel);
    return;
  }
  const layout = document.createElement("div");
  layout.className = "project-overview";
  const left = document.createElement("div");
  left.className = "detail-main";
  const overview = document.createElement("section");
  overview.className = "panel";
  overview.innerHTML =
    '<h2 class="panel-title">项目简介 <small>最后更新于今天</small></h2>';
  const description = document.createElement("p");
  description.className = "detail-description";
  description.textContent =
    project.description +
    " 我们希望通过更清晰的信息层级、一致的组件语言和更友好的移动体验，让用户专注于真正重要的事情。";
  const badge = createBadge({
    label: project.status,
    tone: project.statusTone,
    id: "detail-status",
  });
  overview.append(description, badge);
  const list = document.createElement("section");
  list.className = "panel";
  list.innerHTML =
    '<h2 class="panel-title">项目任务 <small>共 5 项</small></h2>';
  list.append(
    taskList({
      items: tasks,
      onChange: (id, done) => {
        tasks.find((t) => t.id === id).done = done;
        toast(done ? "任务已完成。" : "任务已重新打开。");
      },
    }),
  );
  left.append(overview, list);
  const aside = document.createElement("aside");
  aside.className = "detail-aside";
  const meta = document.createElement("section");
  meta.className = "panel";
  meta.innerHTML = '<h2 class="panel-title">项目信息</h2>';
  const details = document.createElement("dl");
  details.className = "detail-meta";
  for (const [label, value] of [
    ["负责人", "林小满"],
    ["截止日期", project.due],
    ["项目进度", project.progress + "%"],
    ["工作空间", "Studio"],
  ]) {
    const row = document.createElement("div"),
      dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    details.append(row);
  }
  meta.append(details);
  const milestones = document.createElement("section");
  milestones.className = "panel";
  milestones.innerHTML = '<h2 class="panel-title">关键里程碑</h2>';
  for (const [n, name, date] of [
    ["1", "发现与定义", "11 月 3 日 · 已完成"],
    ["2", "设计与验证", "11 月 12 日 · 进行中"],
    ["3", "交付与回顾", "11 月 18 日"],
  ]) {
    const row = document.createElement("div");
    row.className = "milestone" + (n === "1" ? " done" : "");
    const mark = document.createElement("span");
    mark.className = "milestone-mark";
    mark.textContent = n;
    const copy = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = name;
    const small = document.createElement("small");
    small.textContent = date;
    copy.append(strong, small);
    row.append(mark, copy);
    milestones.append(row);
  }
  aside.append(meta, milestones);
  layout.append(left, aside);
  body.append(layout);
}
mountShell({
  active: "projects",
  section: "项目 / " + project.name,
  title: project.name,
  subtitle: "共同创造更好的产品体验，每个细节都值得被认真对待。",
  action: createButton({
    label: "返回工作台",
    variant: "secondary",
    icon: icon("back", 16),
    id: "back-home",
    onClick: () => (location.href = "./home.html"),
  }),
  content,
});
render();
window.uxaiReviewState = {
  exportState: () => ({
    selected,
    tasks: tasks.map((t) => ({ id: t.id, done: t.done })),
  }),
  restoreState: (s) => {
    selected = s.selected ?? "overview";
    for (const value of s.tasks ?? []) {
      const t = tasks.find((t) => t.id === value.id);
      if (t) t.done = value.done;
    }
    render();
  },
};
