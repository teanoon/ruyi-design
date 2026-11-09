export function createInput({
  label = "邮箱地址",
  type = "email",
  id = "email",
  error = "",
  value = "",
  placeholder = "",
  hint = "",
  disabled = false,
  required = false,
  autocomplete,
} = {}) {
  const group = document.createElement("div");
  group.className = "field";
  const l = document.createElement("label");
  l.htmlFor = id;
  l.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.disabled = disabled;
  input.required = required;
  input.dataset.reviewId = id;
  input.autocomplete =
    autocomplete ??
    (type === "password"
      ? "current-password"
      : type === "email"
        ? "email"
        : "off");
  group.append(l, input);
  if (error) {
    input.setAttribute("aria-invalid", "true");
    const hint = document.createElement("div");
    hint.id = id + "-error";
    hint.className = "field-error";
    hint.textContent = error;
    input.setAttribute("aria-describedby", hint.id);
    group.append(hint);
  } else if (hint) {
    const helper = document.createElement("div");
    helper.id = id + "-hint";
    helper.className = "field-hint";
    helper.textContent = hint;
    input.setAttribute("aria-describedby", helper.id);
    group.append(helper);
  }
  return group;
}
