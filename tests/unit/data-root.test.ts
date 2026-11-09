import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, rm, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { resolveDataRoot } from "../../src/core/sessions/data-root.js";
import { ReviewSession } from "../../src/core/sessions/index.js";

describe("brand migration data discovery", () => {
  it("discovers each directory and refuses every ambiguous pair without creating a database", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-data-"));
    const names = [".ruyi-design", ".ruyi-uxai", ".uxai-review"];
    try {
      expect(resolveDataRoot(root)).toEqual({ path: path.join(root, names[0]), source: "new" });
      for (const name of names) {
        await mkdir(path.join(root, name));
        expect(resolveDataRoot(root)).toEqual({ path: path.join(root, name), source: name === names[0] ? "current" : "legacy" });
        await rm(path.join(root, name), { recursive: true });
      }
      for (const group of [[names[0], names[1]], [names[0], names[2]], [names[1], names[2]], names]) {
        for (const name of group) await mkdir(path.join(root, name));
        expect(() => resolveDataRoot(root)).toThrow("Pass dataRoot explicitly");
        expect(resolveDataRoot(root, path.join(root, group[0])).source).toBe("explicit");
        for (const name of group) {
          expect(existsSync(path.join(root, name, "review.sqlite"))).toBe(false);
          await rm(path.join(root, name), { recursive: true });
        }
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it.each([".uxai-review", ".ruyi-uxai"])("reuses %s history and publishes another round", async (directory) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-legacy-"));
    let session: ReviewSession | undefined;
    try {
      const design = path.join(root, "design");
      await cp("examples/starter/design", design, { recursive: true });
      session = await ReviewSession.open(root, design, path.join(root, directory));
      const sid = session.id;
      const target = { kind: "page" as const, objectId: "settings", stateId: "default", deviceId: "desktop", revisionId: session.active()!.id };
      const c = session.feedback.add("Already deleted", target);
      const b = session.feedback.prepare("legacy");
      const lease = session.feedback.claim(b.id, "legacy", "claim");
      session.feedback.update(b.id, lease.leaseToken!, "modified", c.id, "Deleted", "instance");
      const revision = await session.publish({ batchId: b.id, leaseToken: lease.leaseToken!, idempotencyKey: "publish", expectedBaseRevision: target.revisionId }, async () => {});
      session.feedback.setLocation(c.id, revision.id, { kind: "deleted", container: { selector: ".settings-actions" } });
      session.feedback.review(c.id, "resolve");
      const before = session.context();
      const revisions = session.store.all("revision");
      session.close();
      session = await ReviewSession.open(root, design);
      expect(session.id).toBe(sid);
      expect(session.active()!.id).toBe(revision.id);
      expect(session.context().comments).toEqual(before.comments);
      expect(session.store.all("revision")).toEqual(revisions);
      expect(existsSync(path.join(root, ".ruyi-design"))).toBe(false);
      session.feedback.add("Next requested round", { ...target, revisionId: revision.id });
      const next = session.feedback.prepare("next"), claim = session.feedback.claim(next.id, "ruyi", "next-claim");
      session.feedback.update(next.id, claim.leaseToken!, "modified", next.items[0].id, "Updated", "instance");
      const published = await session.publish({ batchId: next.id, leaseToken: claim.leaseToken!, idempotencyKey: "next-publish", expectedBaseRevision: revision.id }, async () => {});
      expect(published.id).not.toBe(revision.id);
      expect(session.feedback.comment(c.id).status).toBe("resolved");
    } finally { session?.close(); await rm(root, { recursive: true, force: true }); }
  });
});
