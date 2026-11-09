import { mountShell, toast } from "../components/shell.js";
import { createButton } from "../components/button.js";
import { createInput } from "../components/input.js";
import { icon } from "../components/icons.js";
const state = new URLSearchParams(location.search).get("state") ?? "default";
const content = document.createElement("div");
content.className = "settings-grid";
const nav = document.createElement("nav");
nav.className = "settings-nav";
nav.setAttribute("aria-label", "设置分类");
const panel = document.createElement("section");
panel.className = "panel settings-panel";
let active = state === "notifications" ? "notifications" : "profile";
const preferences = { updates: true, tasks: true, digest: true };
const profileValues = {
  name: "林小满",
  email: state === "error" ? "xiaoman@" : "xiaoman@studio.design",
  bio: "把复杂的事情，做得简单一点。",
};
for (const [key, label] of [
  ["profile", "个人资料"],
  ["notifications", "通知偏好"],
]) {
  const a = document.createElement("a");
  a.href = "#" + key;
  a.textContent = label;
  a.onclick = (e) => {
    e.preventDefault();
    active = key;
    render();
  };
  nav.append(a);
}
content.append(nav, panel);
mountShell({
  active: "settings",
  section: "设置",
  title: "让工作空间，更像你",
  subtitle: "管理个人资料和通知偏好，找到属于自己的工作节奏。",
  content,
});
function render() {
  for (const a of nav.children) {
    if (a.hash === "#" + active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  panel.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = active === "profile" ? "个人资料" : "通知偏好";
  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent =
    active === "profile"
      ? "让团队更容易认识你、找到你。"
      : "选择何时接收提醒，把注意力留给重要的事。";
  panel.append(h, desc);
  if (active === "notifications") {
    for (const [title, text, id] of [
      ["项目更新", "项目里程碑和状态发生变化时通知我。", "updates"],
      ["任务提醒", "任务即将到期、被分配或被提及时通知我。", "tasks"],
      ["每周回顾", "每周一，用一封邮件回顾团队的进展。", "digest"],
    ]) {
      const label = document.createElement("label");
      label.className = "toggle-row";
      const copy = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = title;
      const p = document.createElement("p");
      p.textContent = text;
      copy.append(strong, p);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = preferences[id];
      input.id = id;
      input.dataset.reviewId = "notification-" + id;
      input.onchange = () => {
        preferences[id] = input.checked;
        toast("通知偏好已更新。");
      };
      label.append(copy, input);
      panel.append(label);
    }
    return;
  }
  const success = document.createElement("div");
  success.className = "success-banner";
  success.setAttribute("role", "status");
  success.append(
    icon("check", 16),
    document.createTextNode("个人资料已保存，新的改变从这里开始。"),
  );
  success.hidden = state !== "saved";
  panel.append(success);
  const profile = document.createElement("div");
  profile.className = "profile-block";
  profile.innerHTML =
    '<span class="profile-avatar" aria-hidden="true">林</span><div><strong>林小满</strong><p>Studio 工作空间 · 产品设计师</p></div>';
  panel.append(profile);
  const form = document.createElement("form");
  form.noValidate = true;
  const fields = document.createElement("div");
  fields.className = "field-grid";
  const name = createInput({
      label: "姓名",
      id: "profile-name",
      type: "text",
      value: profileValues.name,
      required: true,
    }),
    email = createInput({
      label: "邮箱地址",
      id: "profile-email",
      value: profileValues.email,
      error: state === "error" ? "请输入有效的邮箱地址。" : "",
      required: true,
    });
  fields.append(name, email);
  const bio = createInput({
    label: "一句话介绍",
    id: "profile-bio",
    type: "text",
    value: profileValues.bio,
    hint: "分享你的角色、兴趣，或正在关注的事情。",
  });
  const error = document.createElement("p");
  error.className = "field-error";
  error.setAttribute("role", "alert");
  const actions = document.createElement("div");
  actions.className = "settings-actions";
  const save = createButton({
    label: "保存更改",
    type: "submit",
    id: "save-profile",
  });
  actions.append(save);
  form.append(fields, bio, error, actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = name.querySelector("input"),
      emailInput = email.querySelector("input");
    if (!nameInput.value.trim() || !emailInput.validity.valid) {
      error.textContent = "请填写姓名和有效的邮箱地址。";
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      success.hidden = true;
      return;
    }
    Object.assign(profileValues, {
      name: nameInput.value,
      email: emailInput.value,
      bio: bio.querySelector("input").value,
    });
    error.textContent = "";
    emailInput.removeAttribute("aria-invalid");
    email.querySelector(".field-error")?.remove();
    success.hidden = false;
    toast("个人资料已保存。");
  });
  panel.append(form);
}
render();
window.ruyiDesignReviewState = {
  exportState: () => ({
    active,
    preferences,
    profileValues:
      active === "profile"
        ? {
            name: panel.querySelector("#profile-name").value,
            email: panel.querySelector("#profile-email").value,
            bio: panel.querySelector("#profile-bio").value,
          }
        : profileValues,
  }),
  restoreState: (s) => {
    Object.assign(preferences, s.preferences ?? {});
    Object.assign(profileValues, s.profileValues ?? {});
    active = s.active ?? "profile";
    render();
  },
};
