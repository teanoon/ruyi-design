import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Store } from "../../src/storage/index.js";
import { Feedback, type Comment } from "../../src/core/feedback/index.js";
const target = { kind: "page" as const, objectId: "home", deviceId: "desktop", stateId: "default", revisionId: "v1", context: { anchor: { selector: "#one", reviewId: "one" } } };
async function fixture(check: (f: Feedback, store: Store, root: string) => void | Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ruyi-comment-policy-"));
  const store = new Store(root);
  try { await check(new Feedback(store), store, root); } finally { if (store.db.isOpen) store.close(); await rm(root, { recursive: true, force: true }); }
}
it("rejects duplicates including archived records and preserves original content", () => fixture((f, store) => {
  const c = f.add("First", target); f.review(c.id, "archive");
  expect(() => f.add("Another", { ...target, revisionId: "v2" })).toThrow(expect.objectContaining({ code: "comment_exists", details: { existingCommentId: c.id } }));
  expect(store.all("comment")).toHaveLength(1);
  expect(f.comment(c.id).text).toBe("First");
  f.add("Mobile", { ...target, deviceId: "mobile" });
  f.add("Child", { ...target, context: { anchor: { selector: "#one > span" } } });
  expect(store.all("comment")).toHaveLength(3);
}));
it("preserves legacy duplicates and their creation order across editing and store reopen", () => fixture((f, store, root) => {
  const c = f.add("First", target);
  store.put("comment", { ...structuredClone(c), id: "legacy", text: "Second" });
  f.edit(c.id, "Edited");
  expect(() => f.add("Third", target)).toThrow(expect.objectContaining({ details: { existingCommentId: "legacy" } }));
  expect(store.all<Comment>("comment").map(c => c.id)).toEqual([c.id, "legacy"]);
  store.close();
  const reopened = new Store(root);
  try { expect(reopened.all<Comment>("comment").map(c => c.id)).toEqual([c.id, "legacy"]); } finally { reopened.close(); }
}));
it("protects queued and processing feedback and distinguishes cancellation from deletion", () => fixture((f, store) => {
  const c = f.add("Original", target), batch = f.prepare("fixed");
  for (const action of [() => f.edit(c.id, "Changed"), () => f.edit(c.id), () => f.review(c.id, "reopen"), () => f.review(c.id, "cancel_reopen"), () => f.review(c.id, "resolve")]) expect(action).toThrow(expect.objectContaining({ code: "batch_active" }));
  const lease = f.claim(batch.id, "test", "claim");
  expect(() => f.review(c.id, "reopen")).toThrow(expect.objectContaining({ code: "batch_active" }));
  f.update(batch.id, lease.leaseToken!, "modified", c.id, "Fixed");
  store.transaction(() => f.published(batch.id, "v2"));
  f.review(c.id, "resolve");
  f.review(c.id, "reply", "More requirements");
  f.edit(c.id, "Edited original");
  expect(() => f.edit(c.id)).toThrow(expect.objectContaining({ code: "comment_has_history" }));
  const thread = structuredClone(f.comment(c.id).thread), results = structuredClone(f.comment(c.id).results);
  const restored = f.review(c.id, "cancel_reopen");
  expect(restored).toMatchObject({ status: "resolved", resolution: "confirmed", text: "Original", thread, results, target });
  expect(restored.previousDraft).toBeUndefined();
  expect(() => f.review(c.id, "cancel_reopen")).toThrow(expect.objectContaining({ code: "not_reopened" }));
}));
it("deletes only untouched new drafts, never a released draft with historical batch input", () => fixture((f, store) => {
  const c = f.add("First", target); f.edit(c.id); expect(store.all("comment")).toHaveLength(0);
  const history = f.add("History", target), batch = f.prepare("history"), claim = f.claim(batch.id, "test", "claim");
  f.update(batch.id, claim.leaseToken!, "release");
  const record = f.comment(history.id); record.status = "draft"; store.put("comment", record);
  expect(() => f.edit(history.id)).toThrow(expect.objectContaining({ code: "comment_has_history" }));
}));
