import { it, expect } from "vitest";
import { parse } from "acorn";
import {
  gatewayJavaScript,
  gatewayCss,
  gatewayHtml,
} from "../../src/server/preview/gateway.js";
import { routedUrl } from "../../src/contracts/urls.js";
const base =
  "https://design.dev.test:34000/_preview/r/v1/pages/login.html?port=4173";
it("preserves gateway routing through URL resolution", () => {
  expect(
    routedUrl(
      "https://design.dev.test:34000/?port=4173",
      "api/state?cursor=2",
    ).searchParams.get("port"),
  ).toBe("4173");
});
it("rewrites actual imports and navigations without treating comments as code", () => {
  const source = `// import x from './not-a-module.js'\nimport {a} from '../components/a.js'; export {b} from './b.js'; const part='./chunk.js'; const lazy=()=>import(part); window.location.href='./home.html'; fetch('./mock.json'); const description="do not replace ./copy.js";`;
  const transformed = gatewayJavaScript(source, base);
  expect(() =>
    parse(transformed, { ecmaVersion: "latest", sourceType: "module" }),
  ).not.toThrow();
  expect(transformed).toContain("components/a.js?port=4173");
  expect(transformed).toContain("// import x from './not-a-module.js'");
  expect(transformed).toContain("do not replace ./copy.js");
  expect(transformed).toContain("import(__ruyiDesignGatewayRoute");
  expect(gatewayJavaScript(`xhr.open('GET', './mock.json'); custom.open('panel');`,base)).toBe(`xhr.open('GET', './mock.json'); custom.open('panel');`);
});
it("routes CSS imports, images and HTML module entries explicitly", () => {
  expect(
    gatewayCss(
      `@import '../tokens.css'; .x{background:url('../image.png')}`,
      base,
    ),
  ).toContain("image.png?port=4173");
  const html = gatewayHtml(
    `<html><head><script type="module" src="./login.js"></script></head><body><a href="./home.html">Home</a></body></html>`,
    base,
  );
  expect(html).toContain("login.js?port=4173");
  expect(html).toContain("home.html?port=4173");
  expect(html).toContain('crossorigin="anonymous"');
});
