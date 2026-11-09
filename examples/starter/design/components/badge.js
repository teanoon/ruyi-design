export function createBadge({
  label = "进行中",
  tone = "progress",
  id = "status-badge",
} = {}) {
  const el = document.createElement("span");
  el.className = `badge badge--${tone}`;
  el.dataset.reviewId = id;
  const dot = document.createElement("span");
  dot.className = "badge-dot";
  dot.setAttribute("aria-hidden", "true");
  el.append(dot, document.createTextNode(label));
  return el;
}
