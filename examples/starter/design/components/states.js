import { icon } from "./icons.js";
import { createButton } from "./button.js";
export function emptyState({
  title = "还没有项目，好想法正等着开始。",
  description = "从一个小目标开始，邀请你的伙伴，把想法变成值得期待的成果。",
  action = "创建第一个项目",
  glyph = "folder",
  onAction = () => {},
} = {}) {
  const el = document.createElement("section");
  el.className = "empty-panel";
  el.dataset.reviewId = "empty-state";
  const mark = document.createElement("div");
  mark.className = "empty-symbol";
  mark.append(icon(glyph, 28));
  const h = document.createElement("h2");
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = description;
  el.append(
    mark,
    h,
    p,
    createButton({ label: action, onClick: onAction, id: "empty-action" }),
  );
  return el;
}
export function skeletonCards() {
  const root = document.createDocumentFragment();
  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");
    const cover = document.createElement("div");
    cover.className = "skeleton skeleton-cover";
    card.append(cover);
    for (let n = 0; n < 4; n++) {
      const line = document.createElement("div");
      line.className = "skeleton skeleton-line" + (n % 2 ? " wide" : "");
      card.append(line);
    }
    root.append(card);
  }
  const label = document.createElement("p");
  label.className = "loading-label";
  label.setAttribute("role", "status");
  label.textContent = "正在整理你的项目…";
  root.append(label);
  return root;
}
export function taskList({ items = [], onChange = () => {} } = {}) {
  const root = document.createElement("div");
  for (const item of items) {
    const label = document.createElement("label");
    label.className = "task-row" + (item.done ? " completed" : "");
    label.dataset.reviewId = item.id;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!item.done;
    input.dataset.reviewId = item.id + "-check";
    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = item.name;
    const date = document.createElement("small");
    date.textContent = item.date ?? "今天";
    input.onchange = () => {
      label.classList.toggle("completed", input.checked);
      onChange(item.id, input.checked);
    };
    label.append(input, copy, date);
    root.append(label);
  }
  return root;
}
