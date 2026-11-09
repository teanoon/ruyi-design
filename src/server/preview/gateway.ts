import * as html from "parse5";
import { parse } from "acorn";
import valueParser from "postcss-value-parser";

function route(value: string, base: string, module = false) {
  if (/^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(value)) return value;
  if (module && !/^(?:\.|\/|https?:)/.test(value)) return value;
  try {
    const url = new URL(value, base),
      source = new URL(base);
    if (url.origin !== source.origin) return value;
    const port = source.searchParams.get("port");
    if (port) url.searchParams.set("port", port);
    return url.href;
  } catch {
    return value;
  }
}

/** Preserve routing on static/dynamic imports and DOM navigation, not string comments. */
export function gatewayJavaScript(source: string, base: string) {
  const file = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true,
  });
  let helper = "__uxaiGatewayRoute";
  while (source.includes(helper)) helper += "_";
  const edits: { start: number; end: number; text: string }[] = [];
  const wrap = (node: any, module = false) =>
    edits.push({
      start: node.start,
      end: node.end,
      text: `${helper}(${source.slice(node.start, node.end)}, ${module ? "import.meta.url" : "undefined"}, ${module})`,
    });
  const name = (node: any) =>
    node.type === "MemberExpression" && !node.computed
      ? node.property.name
      : node.type === "Identifier"
        ? node.name
        : "";
  function visit(node: any) {
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
      ].includes(node.type) &&
      typeof node.source?.value === "string"
    ) {
      const spec = node.source;
      edits.push({
        start: spec.start,
        end: spec.end,
        text: JSON.stringify(route(spec.value, base, true)),
      });
      return;
    }
    if (node.type === "ImportExpression") {
      wrap(node.source, true);
      return;
    }
    if (node.type === "CallExpression" && node.arguments[0]) {
      if (["fetch", "open", "assign", "replace"].includes(name(node.callee))) {
        const owner = node.callee.type === "MemberExpression"
          ? source.slice(node.callee.object.start, node.callee.object.end)
          : "";
        const isNavigation =
          (node.callee.type === "Identifier" &&
            ["fetch", "open"].includes(node.callee.name)) ||
          (node.callee.type === "MemberExpression" &&
            (["window","globalThis","self"].includes(owner) && ["fetch", "open"].includes(name(node.callee)) ||
              ["location","window.location","globalThis.location","self.location"].includes(owner)));
        if (isNavigation) {
          wrap(node.arguments[0]);
          return;
        }
      }
    }
    if (
      node.type === "AssignmentExpression" &&
      node.operator === "=" &&
      node.left.type === "MemberExpression" &&
      ["href", "src", "action", "location"].includes(name(node.left))
    ) {
      wrap(node.right);
      return;
    }
    for (const value of Object.values(node))
      for (const child of Array.isArray(value) ? value : [value])
        if (
          child &&
          typeof child === "object" &&
          typeof child.type === "string"
        )
          visit(child);
  }
  visit(file);
  if (!edits.length) return source;
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  const port = new URL(base).searchParams.get("port");
  const code = `function ${helper}(value, base, module) { if(typeof value !== 'string' && !(value instanceof URL)) return value; value=String(value); if(/^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(value))return value; if(module&&!/^(?:\\.|\\/|https?:)/.test(value))return value;try { const source=new URL(base || (typeof document!=='undefined'?document.baseURI:location.href));const url=new URL(value,source); if(url.origin===source.origin)url.searchParams.set('port',${JSON.stringify(port)});return url.href;} catch{return value;} }\n`;
  return code + output;
}

export function gatewayCss(source: string, base: string) {
  // Value parser handles escaped URLs and quoted strings; process import literals
  // separately so ordinary content strings are left alone.
  const parsed = valueParser(source);
  parsed.walk((node) => {
    if (node.type === "function" && node.value.toLowerCase() === "url") {
      const item = node.nodes[0];
      if (item && (item.type === "word" || item.type === "string")) {
        item.type = "string";
        Object.assign(item, { quote: '"', value: route(item.value, base) });
      }
      return false;
    }
  });
  return parsed
    .toString()
    .replace(
      /(@import\s+)(["'])([^"']+)\2/gi,
      (_all, prefix, quote, url) =>
        `${prefix}${quote}${route(url, base)}${quote}`,
    );
}

export function gatewayHtml(source: string, base: string) {
  const document: any = html.parse(source);
  function walk(node: any) {
    const attrs = node.attrs ?? [];
    for (const attr of attrs) {
      if (["src", "href", "action", "poster"].includes(attr.name))
        attr.value = route(attr.value, base);
      if (attr.name === "style") attr.value = gatewayCss(attr.value, base);
    }
    if (node.tagName === "script") {
      const type = attrs.find((a: any) => a.name === "type")?.value ?? "";
      if (type === "module") {
        const cross = attrs.find((a: any) => a.name === "crossorigin");
        if (cross) cross.value = "anonymous";
        else attrs.push({ name: "crossorigin", value: "anonymous" });
      }
      if (
        !attrs.some((a: any) => a.name === "src") &&
        ["", "module", "text/javascript", "application/javascript"].includes(
          type,
        )
      )
        for (const child of node.childNodes ?? [])
          if (child.nodeName === "#text")
            child.value = gatewayJavaScript(child.value, base);
      if (type === "importmap")
        for (const child of node.childNodes ?? [])
          if (child.nodeName === "#text")
            try {
              const map = JSON.parse(child.value);
              for (const values of [
                map.imports,
                ...Object.values(map.scopes ?? {}),
              ])
                if (values)
                  for (const key of Object.keys(values))
                    values[key] = route(values[key], base, true);
              child.value = JSON.stringify(map);
            } catch {}
    }
    if (node.tagName === "style")
      for (const child of node.childNodes ?? [])
        if (child.nodeName === "#text")
          child.value = gatewayCss(child.value, base);
    for (const child of node.childNodes ?? []) walk(child);
  }
  walk(document);
  return html.serialize(document);
}
