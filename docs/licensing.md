# Licensing and distribution review

Reviewed on 2026-11-11 for the Apache-2.0 adoption change, using the 0.2.0 working tree and installed dependencies.

## Project license

Project-owned code and materials use [Apache License 2.0](../LICENSE), unless another license is explicitly stated. Copyright 2026 LittleHobby; the earliest repository commit is dated 2026-11-09, and existing product metadata identifies LittleHobby as publisher.

`LICENSE` is copied verbatim from https://www.apache.org/licenses/LICENSE-2.0. The release check pins its SHA-256 after normalizing CRLF and trimming outer whitespace: `283ea6cc2997a1a70da0049e09adf9317bb60ca1b51279b65196b83a69e1996b`.

The project license does not relicense third-party material or grant trademark rights beyond the license terms. This repository change does not modify already-published npm archives or registry metadata. Future npm publication requires its own version selection and explicit release authorization.

## Reviewed distribution content

- The workspace entry `src/browser/workspace/main.ts` imports project modules, including `design/components/page-navigation.js`. The bridge entry imports project contracts. The workspace also imports `src/contracts/catalog.ts`, which imports Zod 4.6.7; Zod code is bundled into the workspace. Vite adds its modulepreload helper to the built workspace JavaScript. Both MIT copyright and permission notices are retained in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), copied from installed `zod/LICENSE` and the Vite 8.3.6 `LICENSE.md` core-license section. The bridge import closure contains only project modules.
- The packaged `skills/ruyi-design-review`, schemas, starter HTML/CSS/JS/SVG, product SVG assets and documentation were inspected for explicit third-party attributions, external script/font/image dependencies and license declarations. No additional separately attributed material or external asset downloads were identified. SVG XML namespace URLs are not asset downloads. Documentation screenshots depict this project's own workspace and starter.
- Server-side TypeScript output retains npm imports; dependencies are installed separately rather than copied into this package. Their own license and notice files remain in those dependency packages. The project lock's dependency license entries are preserved.
- No additional upstream NOTICE obligation was identified for the inspected material copied into the project archive. A root NOTICE is therefore not introduced; the Vite and Zod MIT statements are shipped as THIRD_PARTY_NOTICES.md instead.

Direct production dependency metadata checked:

| Dependency | Version | Declared license |
| --- | --- | --- |
| @modelcontextprotocol/sdk | 1.32.2 | MIT |
| fastify | 5.12.8 | MIT |
| playwright | 1.65.0 | Apache-2.0 |
| acorn | 8.15.0 | MIT |
| parse5 | 8.1.1 | MIT |
| postcss-value-parser | 4.2.0 | MIT |
| zod | 4.6.7 | MIT |

This records the inspected distribution content and direct dependency metadata. It is not a comprehensive provenance audit of all transitive dependency sources. Recheck bundled resources and accompanying notices when dependency or build behavior changes.

## Verification

Release metadata checks require Apache-2.0 in both package.json and the lock root. Actual tarball checks require Apache-2.0 metadata, the complete pinned LICENSE and THIRD_PARTY_NOTICES.md. Installation acceptance compares both documents against the repository before and after installing the same archive, and checks CLI, MCP and skill behavior. Existing version, registry, scope, OIDC and archive-integrity gates remain in place; see [Releasing](releasing.md).
