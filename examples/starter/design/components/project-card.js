import { createBadge } from "./badge.js";
import { icon } from "./icons.js";
export const projects = [
  {
    id: "experience",
    name: "产品体验升级",
    category: "PRODUCT DESIGN",
    description: "让复杂变得轻松，为每一步操作找到更自然的表达。",
    progress: 68,
    tone: "violet",
    due: "11 月 18 日",
    tasks: "17 / 25",
    members: ["林", "周", "陈"],
    status: "进行中",
    statusTone: "progress",
  },
  {
    id: "brand",
    name: "品牌设计系统",
    category: "BRAND & SYSTEMS",
    description: "用一致的语言，让每个触点都传递同样清晰的品牌。",
    progress: 42,
    tone: "mint",
    due: "11 月 22 日",
    tasks: "8 / 19",
    members: ["许", "林"],
    status: "进行中",
    statusTone: "progress",
  },
  {
    id: "research",
    name: "用户访谈计划",
    category: "RESEARCH",
    description: "走近真实的使用场景，让反馈成为下一次改进的起点。",
    progress: 24,
    tone: "peach",
    due: "11 月 12 日",
    tasks: "3 / 12",
    members: ["陈", "周"],
    status: "待开始",
    statusTone: "neutral",
  },
];
export function createProjectCard({ project = projects[0], onOpen } = {}) {
  const p = project,
    card = document.createElement("article");
  card.className = "project-card";
  card.dataset.reviewId = `project-${p.id}`;
  const cover = document.createElement("div");
  cover.className = `project-cover project-cover--${p.tone}`;
  cover.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) {
    const tile = document.createElement("span");
    tile.className = "cover-tile";
    cover.append(tile);
  }
  card.append(cover);
  const content = document.createElement("div");
  content.className = "project-card-content";
  const category = document.createElement("div");
  category.className = "eyebrow";
  category.textContent = p.category;
  const link = document.createElement("a");
  link.href = `./project.html?project=${encodeURIComponent(p.id)}`;
  link.className = "project-title";
  link.textContent = p.name;
  if (onOpen)
    link.addEventListener("click", (e) => {
      e.preventDefault();
      onOpen(p);
    });
  const desc = document.createElement("p");
  desc.className = "muted project-description";
  desc.textContent = p.description;
  const status = createBadge({
    label: p.status,
    tone: p.statusTone,
    id: `status-${p.id}`,
  });
  const progress = document.createElement("div");
  progress.className = "progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", p.name + " 完成度");
  progress.setAttribute("aria-valuenow", p.progress);
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  const fill = document.createElement("span");
  fill.style.width = p.progress + "%";
  progress.append(fill);
  const summary = document.createElement("div");
  summary.className = "progress-summary";
  const task = document.createElement("span");
  task.textContent = `${p.tasks} 项任务`;
  const percent = document.createElement("strong");
  percent.textContent = p.progress + "%";
  summary.append(task, percent);
  const footer = document.createElement("div");
  footer.className = "project-card-footer";
  const people = document.createElement("div");
  people.className = "avatars";
  people.setAttribute("aria-label", "项目成员：" + p.members.join("、"));
  for (const member of p.members) {
    const a = document.createElement("span");
    a.className = "avatar";
    a.textContent = member;
    people.append(a);
  }
  const date = document.createElement("span");
  date.className = "due-date";
  date.append(icon("calendar", 14), document.createTextNode(p.due));
  footer.append(people, date);
  content.append(category, link, desc, status, summary, progress, footer);
  card.append(content);
  return card;
}
