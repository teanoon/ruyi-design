import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ReviewSession } from "../../src/core/sessions/index.js";

async function fixture(run: (session: ReviewSession, design: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-conversation-"));
  const design = path.join(root, "design"); await mkdir(design);
  await writeFile(path.join(design, "index.html"), '<!doctype html><html><body><h1>Initial</h1></body></html>');
  await writeFile(path.join(design, "manifest.json"), JSON.stringify({ schemaVersion: 1, id: "direct", name: "Direct", devices: [{ id: "desktop", name: "Desktop", width: 1000, height: 700 }], pages: [{ id: "home", name: "Home", states: [{ id: "default", name: "Default", entries: { desktop: { path: "index.html" } } }] }] }));
  const session = await ReviewSession.open(root, design);
  try { await run(session, design); } finally { session.close(); await rm(root, { recursive: true, force: true }); }
}
const direct = (base: string, key = "conversation-1") => ({ source: "conversation" as const, request: "Please refine both logo concepts", expectedBaseRevision: base, idempotencyKey: key });
describe("conversation-request publication", () => {
  it("publishes in the same session without changing saved comments, archived results or batches", () => fixture(async (s, design) => {
    const base = s.active()!.id, sid = s.id;
    const target = { kind: "page" as const, objectId: "home", stateId: "default", deviceId: "desktop", revisionId: base };
    const archived = s.feedback.add("Keep historical feedback", target); s.feedback.review(archived.id, "archive");
    s.feedback.add("Wait for a separate feedback request", target);
    const comments = s.store.all("comment"), batches = s.store.all("batch");
    await writeFile(path.join(design, "index.html"), '<!doctype html><html><body><h1>Refined logos</h1></body></html>');
    let validations = 0;
    const revision = await s.publish(direct(base), async () => { validations++; });
    expect(s.id).toBe(sid); expect(s.active()!.id).toBe(revision.id);
    expect(revision).toMatchObject({ source: "conversation", request: "Please refine both logo concepts", baseRevision: base });
    expect(revision.batchId).toBeUndefined(); expect(s.store.all("comment")).toEqual(comments); expect(s.store.all("batch")).toEqual(batches);
    expect(s.store.get("revision", base)).toBeTruthy();
    const retry = await s.publish(direct(base), async () => { validations++; });
    expect(retry.id).toBe(revision.id); expect(validations).toBe(1);
    await expect(s.publish({ ...direct(base), request: "A different request" }, async () => {})).rejects.toThrow("another request");
    await expect(s.publish({ ...direct(base), expectedBaseRevision: revision.id }, async () => {})).rejects.toThrow("another request");
    await expect(s.publish({ batchId: "other", leaseToken: "other", expectedBaseRevision: base, idempotencyKey: "conversation-1" }, async () => {})).rejects.toThrow("another request");
    await expect(s.publish(direct(base, "stale"), async () => {})).rejects.toThrow("Reload current revision");
  }));
  it("keeps the old revision on failed validation and supports a retry with the same key", () => fixture(async (s) => {
    const base = s.active()!.id;
    await expect(s.publish(direct(base), async () => { throw new Error("Candidate broken"); })).rejects.toThrow("Candidate broken");
    expect(s.active()!.id).toBe(base); expect(await readdir(path.join(s.dataRoot, "revisions"))).toEqual([base]);
    const fixed = await s.publish(direct(base), async () => {}); expect(fixed.id).not.toBe(base);
  }));
  it("rejects missing user requests, mixed modes and queued/processing feedback", () => fixture(async (s) => {
    const base = s.active()!.id;
    await expect(s.publish({ ...direct(base), request: undefined }, async () => {})).rejects.toThrow("explicit user request");
    await expect(s.publish({ ...direct(base), batchId: "fake", leaseToken: "fake" }, async () => {})).rejects.toThrow("cannot include");
    await expect(s.publish({ idempotencyKey: "missing-batch", expectedBaseRevision: base }, async () => {})).rejects.toThrow("batchId and leaseToken");
    const c = s.feedback.add("Saved feedback", { kind: "page", objectId: "home", stateId: "default", deviceId: "desktop", revisionId: base });
    const batch = s.feedback.prepare("queued");
    await expect(s.publish(direct(base), async () => {})).rejects.toThrow("queued/processing");
    const claim = s.feedback.claim(batch.id, "agent", "claim");
    await expect(s.publish(direct(base), async () => {})).rejects.toThrow("queued/processing");
    s.feedback.update(batch.id, claim.leaseToken!, "needs_clarification", c.id, "Please clarify");
    s.feedback.update(batch.id, claim.leaseToken!, "release");
    const before = s.store.all("comment");
    await s.publish(direct(base), async () => {}); expect(s.store.all("comment")).toEqual(before);
  }));
  it("blocks overlapping publications and rechecks feedback before committing", () => fixture(async (s) => {
    const base = s.active()!.id;
    let enter!: () => void, resume!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const paused = new Promise<void>(resolve => { resume = resolve; });
    const pending = s.publish(direct(base), async () => { enter(); await paused; });
    await entered;
    await expect(s.publish(direct(base, "overlap"), async () => {})).rejects.toThrow("Another publication");
    s.feedback.add("A newer explicit feedback request", { kind: "page", objectId: "home", stateId: "default", deviceId: "desktop", revisionId: base });
    const batch = s.feedback.prepare("arrived-during-validation");
    resume(); await expect(pending).rejects.toThrow("queued/processing");
    expect(s.active()!.id).toBe(base); expect(s.store.get<any>("batch", batch.id).status).toBe("queued");
    expect(await readdir(path.join(s.dataRoot, "revisions"))).toEqual([base]);
  }));
});
