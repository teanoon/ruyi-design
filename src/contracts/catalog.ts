import { z } from "zod";

export const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
export const localPath = z
  .string()
  .min(1)
  .refine(
    (p) =>
      !p.includes("\\") &&
      !p.startsWith("/") &&
      !p.includes(":") &&
      !p.split("/").some((x) => x === ".." || x.startsWith(".")) &&
      !/[?#%]/.test(p),
    "Expected a relative public asset path",
  );
export const entrySchema = z.object({
  path: localPath,
  query: z.record(z.string(), z.string()).default({}),
  hash: z.string().default(""),
});
const entries = z.record(id, entrySchema);
export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  name: z.string().min(1),
  devices: z
    .array(
      z.object({
        id,
        name: z.string(),
        width: z.number().int().min(240).max(7680),
        height: z.number().int().min(160).max(7680),
      }),
    )
    .min(1),
  pages: z
    .array(
      z.object({
        id,
        name: z.string(),
        components: z.array(id).default([]),
        states: z.array(z.object({ id, name: z.string(), entries })).min(1),
      }),
    )
    .default([]),
  components: z
    .array(
      z.object({
        id,
        name: z.string(),
        implementation: z.array(localPath).min(1),
        examples: z.array(z.object({ id, name: z.string(), entries })).min(1),
      }),
    )
    .default([]),
  tokens: z
    .array(
      z.object({
        id,
        name: z.string(),
        group: z.string(),
        type: z.enum([
          "color",
          "typography",
          "spacing",
          "radius",
          "shadow",
          "other",
        ]),
        value: z.string(),
        description: z.string(),
        cssVariable: z
          .string()
          .regex(/^--[\w-]+$/)
          .optional(),
      }),
    )
    .default([]),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Target = {
  kind: "page" | "component" | "token";
  objectId: string;
  stateId?: string;
  deviceId?: string;
  exampleId?: string;
  revisionId: string;
  context?: Record<string, unknown>;
};
export const targetSchema = z.object({
  kind: z.enum(["page", "component", "token"]),
  objectId: id,
  stateId: id.optional(),
  deviceId: id.optional(),
  exampleId: id.optional(),
  revisionId: id,
  context: z.record(z.string(), z.unknown()).default({}),
});
export function combinations(m: Manifest) {
  return [
    ...m.pages.flatMap((p) =>
      p.states.flatMap((s) =>
        Object.entries(s.entries).map(([deviceId, entry]) => ({
          kind: "page" as const,
          objectId: p.id,
          stateId: s.id,
          deviceId,
          entry,
          name: `${p.name} / ${s.name}`,
        })),
      ),
    ),
    ...m.components.flatMap((c) =>
      c.examples.flatMap((e) =>
        Object.entries(e.entries).map(([deviceId, entry]) => ({
          kind: "component" as const,
          objectId: c.id,
          exampleId: e.id,
          deviceId,
          entry,
          name: `${c.name} / ${e.name}`,
        })),
      ),
    ),
  ];
}
