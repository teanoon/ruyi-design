import { createButton } from "./button.js";
import { createInput } from "./input.js";
import { icon } from "./icons.js";
export function createProjectDialog({ onCreate = () => {} } = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "project-dialog";
  dialog.id = "create-project-dialog";
  dialog.dataset.reviewId = "create-project-dialog";
  dialog.setAttribute("aria-labelledby", "create-project-title");
  const top = document.createElement("div");
  top.className = "dialog-top";
  const mark = document.createElement("div");
  mark.className = "dialog-mark";
  mark.append(icon("folder", 24));
  const close = createButton({
    label: "",
    variant: "icon",
    id: "close-dialog",
    icon: icon("close"),
    onClick: () => dialog.close(),
  });
  close.setAttribute("aria-label", "关闭创建项目");
  top.append(mark, close);
  const title = document.createElement("h2");
  title.id = "create-project-title";
  title.textContent = "让好想法开始生长";
  const description = document.createElement("p");
  description.className = "muted";
  description.textContent = "给项目起个名字，再邀请伙伴一起向前。";
  const form = document.createElement("form");
  form.noValidate = true;
  const field = createInput({
    label: "项目名称",
    type: "text",
    id: "project-name",
    placeholder: "例如：官网体验升级",
    hint: "一个清晰的名字，让团队更容易找到它。",
    required: true,
  });
  const error = document.createElement("p");
  error.className = "field-error";
  error.setAttribute("role", "alert");
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  actions.append(
    createButton({
      label: "取消",
      variant: "secondary",
      id: "cancel-project",
      onClick: () => dialog.close(),
    }),
    createButton({ label: "创建项目", type: "submit", id: "confirm-project" }),
  );
  form.append(field, error, actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = field.querySelector("input").value.trim();
    if (!name) {
      error.textContent = "请先为项目填写名称。";
      field.querySelector("input").setAttribute("aria-invalid", "true");
      field.querySelector("input").focus();
      return;
    }
    onCreate(name);
    form.reset();
    error.textContent = "";
    dialog.close();
  });
  dialog.append(top, title, description, form);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  return dialog;
}
