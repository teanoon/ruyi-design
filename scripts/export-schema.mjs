import { writeFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import { manifestSchema } from "../dist/contracts/catalog.js";
await mkdir("schemas", { recursive: true });
await writeFile(
  "schemas/manifest.schema.json",
  JSON.stringify(z.toJSONSchema(manifestSchema), null, 2) + "\n",
);
