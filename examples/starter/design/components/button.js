export function createButton({
  label = "继续",
  state = "default",
  id = "primary-button",
  onClick,
  variant = "primary",
  type = "button",
  icon,
} = {}) {
  const button = document.createElement("button");
  button.className = "ui-button";
  button.classList.add(`ui-button--${variant}`);
  button.type = type;
  button.dataset.reviewId = id;
  button.dataset.state = state;
  button.disabled = state === "disabled" || state === "loading";
  if (state === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.append(spinner);
  }
  if (icon) button.append(icon);
  button.append(
    document.createTextNode(state === "loading" ? "正在处理…" : label),
  );
  if (onClick) button.addEventListener("click", onClick);
  return button;
}
