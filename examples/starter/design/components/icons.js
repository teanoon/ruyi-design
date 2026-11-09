const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  folder: "M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3z",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14 M5 12h14",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z m5.5-2 5 5",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  back: "M19 12H5 m5-5-5 5 5 5",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  calendar: "M5 3v4 M19 3v4 M3 10h18 M3 5h18v16H3z",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  close: "m6 6 12 12 M6 18 18 6",
  alert: "M12 3 2 21h20z M12 9v5 M12 18h.01",
  layers: "m12 3 10 6-10 6L2 9z M2 14l10 6 10-6",
  logout: "M9 3H3v18h6 M8 12h13 m-5-5 5 5-5 5",
  menu: "M4 6h16 M4 12h16 M4 18h16",
};
export function icon(name, size = 20) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("width", size);
  el.setAttribute("height", size);
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "currentColor");
  el.setAttribute("stroke-width", "1.7");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  el.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(el.namespaceURI, "path");
  p.setAttribute("d", paths[name] ?? paths.folder);
  el.append(p);
  return el;
}
