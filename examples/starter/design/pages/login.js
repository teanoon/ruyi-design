import { createButton } from "../components/button.js";
import { createInput } from "../components/input.js";
let email, password, submit, timer;
const feedback = document.querySelector("#feedback");
const recovery = document.querySelector("#recovery");
const recoveryForm = document.querySelector("#recovery-form");
const recoveryMessage = document.querySelector("#recovery-message");

function applyLoginState({ query }) {
  const state = query.state ?? "default";
  clearTimeout(timer);
  if (recovery.open) recovery.close();
  recoveryForm.reset();
  recoveryMessage.textContent = "";
  feedback.textContent = "";
  email = createInput({
    error: state === "error" ? "请输入有效的邮箱地址" : "",
    value: state === "error" ? "xiaoman@" : "",
    placeholder: "you@studio.design",
    required: true,
    disabled: state === "loading",
  });
  password = createInput({
    label: "密码",
    type: "password",
    id: "password",
    placeholder: "输入你的密码",
    required: true,
    disabled: state === "loading",
  });
  submit = createButton({
    label: "登录工作空间",
    id: "login-submit",
    type: "submit",
    state: state === "loading" ? "loading" : "default",
  });
  document.querySelector("#fields").replaceChildren(email, password);
  document.querySelector("#submit").replaceChildren(submit);
  document.querySelector("#remember").checked = false;
  scrollTo(0, 0);
}
document.querySelector("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = email.querySelector("input"),
    pass = password.querySelector("input");
  if (!input.value.trim() || !input.validity.valid) {
    feedback.textContent = "请填写有效的邮箱地址。";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  if (!pass.value) {
    feedback.textContent = "请填写密码。";
    pass.focus();
    return;
  }
  feedback.textContent = "正在连接你的工作空间…";
  submit.disabled = true;
  submit.textContent = "正在登录…";
  timer = setTimeout(() => (location.href = "./home.html"), 500);
});
const field = createInput({
    label: "登录邮箱",
    id: "recovery-email",
    placeholder: "you@studio.design",
    required: true,
  });
document.querySelector("#recovery-fields").append(field);
document
  .querySelector("#recovery-actions")
  .append(
    createButton({
      label: "取消",
      variant: "secondary",
      id: "recovery-cancel",
      onClick: () => recovery.close(),
    }),
    createButton({
      label: "发送重置邮件",
      id: "recovery-submit",
      type: "submit",
    }),
  );
document.querySelector("#forgot-password").onclick = () => recovery.showModal();
document.querySelector("#help").onclick = () => {
  recovery.showModal();
  recoveryMessage.textContent =
    "需要帮助？可先填写邮箱，找回你的工作空间。";
};
recoveryForm.onsubmit = (e) => {
  e.preventDefault();
  const input = field.querySelector("input");
  recoveryMessage.textContent =
    input.value && input.validity.valid
      ? "重置指引已准备好，请检查你的邮箱。"
      : "请先填写有效的邮箱地址。";
};
window.ruyiDesignReviewState = {
  exportState: () => ({
    recoveryOpen: recovery.open,
    message: feedback.textContent,
  }),
  restoreState: (s) => {
    clearTimeout(timer);
    if (s.recoveryOpen && !recovery.open) recovery.showModal();
    feedback.textContent = s.message ?? "";
  },
};
applyLoginState({ query: Object.fromEntries(new URLSearchParams(location.search)) });
window.ruyiDesignApplyState = applyLoginState;
