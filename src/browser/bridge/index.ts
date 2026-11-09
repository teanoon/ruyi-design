import { isBridgeMessage, type BridgeMessage } from "../../contracts/bridge.js";

declare global {
  interface Window {
    __UXAI_CONFIG__?: { origin: string; sessionId: string };
    uxaiReviewState?: {
      exportState: () => unknown;
      restoreState: (state: unknown) => void | Promise<void>;
    };
  }
}
const config = window.__UXAI_CONFIG__;
if (config && window.parent !== window) {
  const frameId = window.name;
  let mode = "experience";
  let start: { x: number; y: number } | undefined;
  const send = (type: BridgeMessage["type"], payload?: any) =>
    window.parent.postMessage(
      { channel: "uxai-review", version: 1, frameId, type, payload },
      config.origin,
    );
  const outline = document.createElement("div");
  outline.setAttribute("data-uxai-overlay", "");
  outline.style.cssText =
    "position:fixed;pointer-events:none;border:2px solid #4f46e5;background:#4f46e514;z-index:2147483647;display:none;box-sizing:border-box";
  const show = (r: { x: number; y: number; width: number; height: number }, deleted = false) => {
    outline.textContent = deleted ? "此处已删除" : "";
    Object.assign(outline.style, {
      display: "block",
      left: r.x + "px",
      top: r.y + "px",
      width: r.width + "px",
      height: r.height + "px",
      borderStyle: deleted ? "dashed" : "solid",
      borderColor: deleted ? "#b77912" : "#4f46e5",
      background: deleted ? "#f59e0b14" : "#4f46e514",
      color: "#78500b",
      font: "600 12px/1.5 system-ui, sans-serif",
      padding: deleted ? "6px" : "0",
    });
  };
  const key = (e: Element) =>
    e.getAttribute("data-review-id")
      ? `[data-review-id="${CSS.escape(e.getAttribute("data-review-id")!)}"]`
      : e.id
        ? `#${CSS.escape(e.id)}`
        : e.getAttribute("name")
          ? `${e.tagName.toLowerCase()}[name="${CSS.escape(e.getAttribute("name")!)}"]`
          : undefined;
  function selector(e: Element): string {
    const k = key(e);
    if (k) return k;
    const p = e.parentElement;
    return p
      ? `${selector(p)} > ${e.tagName.toLowerCase()}:nth-child(${[...p.children].indexOf(e) + 1})`
      : e.tagName.toLowerCase();
  }
  function capture() {
    return {
      path: location.pathname,
      query: location.search,
      hash: location.hash,
      scroll: { x: scrollX, y: scrollY },
      fields: [...document.querySelectorAll("input,textarea,select")]
        .filter(
          (e) =>
            !["password", "file", "hidden"].includes(
              (e as HTMLInputElement).type,
            ),
        )
        .flatMap((e) => {
          const k = key(e);
          return k
            ? [
                {
                  selector: k,
                  value: (e as HTMLInputElement).value,
                  checked: (e as HTMLInputElement).checked,
                },
              ]
            : [];
        }),
      focus: document.activeElement ? key(document.activeElement) : undefined,
      custom: window.uxaiReviewState?.exportState(),
    };
  }
  const loaded = () => {
    document.body.append(outline);
    send("ready");
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", loaded, { once: true });
  else loaded();
  window.addEventListener("message", async (event) => {
    if (
      event.source !== window.parent ||
      event.origin !== config.origin ||
      !isBridgeMessage(event.data) ||
      event.data.frameId !== frameId
    )
      return;
    const m = event.data;
    if (m.type === "mode") {
      mode = m.payload;
      outline.style.display = "none";
    }
    if (m.type === "capture") {
      try {
        send("captured", capture());
      } catch {
        send("captured", { failed: true });
      }
    }
    if (m.type === "restore") {
      try {
        const s = m.payload;
        if (s.failed) throw new Error("State capture failed");
        let restored = true;
        for (const f of s.fields ?? []) {
          const matches = document.querySelectorAll(f.selector);
          if (matches.length !== 1) {
            restored = false;
            continue;
          }
          const e = matches[0] as HTMLInputElement;
          if (["password", "file", "hidden"].includes(e.type)) continue;
          e.value = f.value;
          if (typeof f.checked === "boolean") e.checked = f.checked;
          e.dispatchEvent(new Event("input", { bubbles: true }));
          e.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (s.custom !== undefined) {
          if (window.uxaiReviewState)
            await window.uxaiReviewState.restoreState(s.custom);
          else restored = false;
        }
        if (s.hash) location.hash = s.hash;
        if (s.focus)
          (document.querySelector(s.focus) as HTMLElement | null)?.focus();
        scrollTo(s.scroll?.x ?? 0, s.scroll?.y ?? 0);
        send("restored", { ok: restored });
      } catch {
        send("restored", { ok: false });
      }
    }
    if (m.type === "styles") {
      history.replaceState(
        null,
        "",
        location.href.replace(/\/r\/[^/]+\//, `/r/${m.payload.revisionId}/`),
      );
      for (const link of document.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"]',
      ))
        link.href = link.href.replace(
          /\/r\/[^/]+\//,
          `/r/${m.payload.revisionId}/`,
        );
    }
    if (m.type === "locate") {
      try {
        const a = m.payload.deletion ?? m.payload;
        const matches = document.querySelectorAll(a.selector);
        if (matches.length !== 1) {
          outline.style.display = "none";
          send("located", { ok: false });
          return;
        }
        const e = matches[0];
        if ((a.reviewId && e.getAttribute("data-review-id") !== a.reviewId) ||
          (a.tag && e.tagName !== a.tag.toUpperCase())) {
          outline.style.display = "none";
          send("located", { ok: false });
          return;
        }
        if (!e.getClientRects().length) {
          outline.style.display = "none";
          send("located", { ok: false });
          return;
        }
        e.scrollIntoView({ block: "center" });
        const deleted = !!m.payload.deletion;
        show(e.getBoundingClientRect(), deleted);
        send("located", { ok: true, kind: deleted ? "deleted" : "element" });
      } catch {
        send("located", { ok: false });
      }
    }
  });
  document.addEventListener(
    "pointermove",
    (e) => {
      if (mode === "experience") return;
      if (mode === "region" && start)
        show({
          x: Math.min(start.x, e.clientX),
          y: Math.min(start.y, e.clientY),
          width: Math.abs(e.clientX - start.x),
          height: Math.abs(e.clientY - start.y),
        });
      else if (e.target instanceof Element)
        show(e.target.getBoundingClientRect());
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (mode === "region") {
        start = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener(
    "pointerup",
    (e) => {
      if (mode !== "region" || !start) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = {
        x: Math.min(start.x, e.clientX) + scrollX,
        y: Math.min(start.y, e.clientY) + scrollY,
        width: Math.abs(e.clientX - start.x),
        height: Math.abs(e.clientY - start.y),
      };
      start = undefined;
      send("selection", {
        anchor: { kind: "region", rect: r },
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        state: capture(),
      });
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      if (mode === "experience") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (mode !== "element" || !(e.target instanceof Element)) return;
      const el = e.target,
        r = el.getBoundingClientRect();
      send("selection", {
        anchor: {
          kind: "element",
          selector: selector(el),
          reviewId: el.getAttribute("data-review-id"),
          tag: el.tagName,
          text: (el.textContent ?? "").trim().slice(0, 300),
          role: el.getAttribute("role"),
          ancestors: [el.parentElement, el.parentElement?.parentElement]
            .filter((p): p is HTMLElement => !!p && p !== document.body && p !== document.documentElement)
            .map((p) => ({ selector: selector(p), tag: p.tagName,
              reviewId: p.getAttribute("data-review-id") })),
          rect: {
            x: r.x + scrollX,
            y: r.y + scrollY,
            width: r.width,
            height: r.height,
          },
        },
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        state: capture(),
      });
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        start = undefined;
        outline.style.display = "none";
      }
      if (
        mode === "element" &&
        e.key === "Enter" &&
        e.target instanceof HTMLElement
      ) {
        e.preventDefault();
        e.target.click();
      }
    },
    true,
  );
}
