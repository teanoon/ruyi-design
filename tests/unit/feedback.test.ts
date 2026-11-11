import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Store } from "../../src/storage/index.js";
import { Feedback } from "../../src/core/feedback/index.js";

async function fixture(
  fn: (s: Store, f: Feedback, dir: string) => Promise<void> | void,
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uxai-store-"));
  const s = new Store(dir);
  try {
    await fn(s, new Feedback(s), dir);
  } finally {
    try {
      s.close();
    } catch {}
    await rm(dir, { recursive: true, force: true });
  }
}
const target = {
  kind: "page" as const,
  objectId: "login",
  stateId: "error",
  deviceId: "mobile",
  revisionId: "v1",
};
describe("durable review workflow", () => {
  it("reopens follow-up replies while retaining text, targets and published history", () =>
    fixture((store, f) => {
      const c = f.add("Original", target), batch = f.prepare("first"), lease = f.claim(batch.id, "test", "claim");
      f.update(batch.id, lease.leaseToken!, "modified", c.id, "Fixed", "component");
      store.transaction(() => f.published(batch.id, "v2"));
      const before = structuredClone(f.comment(c.id));
      const replied = f.review(c.id, "reply", "Please refine this further");
      expect(replied.status).toBe("draft");
      expect(replied.text).toBe(before.text); expect(replied.target).toEqual(before.target); expect(replied.results).toEqual(before.results);
      expect(f.prepare("second").items[0].thread.at(-1)?.text).toBe("Please refine this further");
    }));
  it("reopens replies to archived comments without discarding their history", () =>
    fixture((_store, f) => {
      const c = f.add("Original", target); f.review(c.id, "archive");
      expect(f.review(c.id, "reply", "More feedback").status).toBe("draft");
      expect(f.comment(c.id).previousDraft?.status).toBe("resolved");
      expect(f.comment(c.id).thread.at(-1)?.text).toBe("More feedback");
    }));
  it("keeps queued/processing inputs fixed and queues later replies after publication", () =>
    fixture((store, f) => {
      const c = f.add("Original", target), batch = f.prepare("fixed");
      f.review(c.id, "reply", "Reply after queueing");
      expect(f.comment(c.id).status).toBe("submitted");
      const lease = f.claim(batch.id, "test", "claim");
      f.review(c.id, "reply", "Reply during processing");
      expect(f.comment(c.id).status).toBe("submitted");
      expect(store.get<any>("batch", batch.id).items[0].thread).toEqual([]);
      f.update(batch.id, lease.leaseToken!, "modified", c.id, "Fixed", "component");
      store.transaction(() => f.published(batch.id, "v2"));
      expect(f.comment(c.id).status).toBe("draft");
      expect(f.comment(c.id).results[0].revisionId).toBe("v2");
      expect(f.prepare("follow-up").items[0].thread.filter(t => t.author === "user")).toHaveLength(2);
    }));

  it("records explicit deletion locations only on published modifications and preserves original anchors", () =>
    fixture((s, f) => {
      const original = { ...target, context: { anchor: { selector: "#removed" } } };
      const c = f.add("Delete this", original);
      const location = { kind: "deleted" as const, container: { selector: "#parent", tag: "DIV" } };
      expect(() => f.setLocation(c.id, "v2", location)).toThrow("published modified");
      const b = f.prepare("delete"), lease = f.claim(b.id, "agent", "claim");
      f.update(b.id, lease.leaseToken!, "modified", c.id, "Deleted", "instance");
      s.transaction(() => f.published(b.id, "v2"));
      f.setLocation(c.id, "v2", location);
      expect(f.comment(c.id).results[0].location).toEqual(location);
      expect(f.comment(c.id).target).toMatchObject(original);
      expect(() => f.setLocation(c.id, "v3", location)).toThrow("published modified");
    }));
  it("preserves history when a reopened draft is discarded and prevents reopening active input", () =>
    fixture((s, f) => {
      const c = f.add("Original", target),
        b = f.prepare("1"),
        claim = f.claim(b.id, "agent", "claim");
      expect(() => f.review(c.id, "reopen")).toThrow("current batch");
      f.update(b.id, claim.leaseToken!, "modified", c.id, "Fixed", "instance");
      s.transaction(() => f.published(b.id, "v2"));
      f.review(c.id, "resolve");
      f.review(c.id, "reopen");
      f.edit(c.id, "Replacement draft");
      f.review(c.id, "cancel_reopen");
      expect(f.comment(c.id).text).toBe("Original");
      expect(f.comment(c.id).status).toBe("resolved");
    }));
  it("does not present unaddressed work as a verified fix", () =>
    fixture((s, f) => {
      const c = f.add("Cannot apply", target),
        b = f.prepare("1"),
        claim = f.claim(b.id, "agent", "claim");
      f.update(
        b.id,
        claim.leaseToken!,
        "unaddressed",
        c.id,
        "Needs a product decision",
        "instance",
      );
      s.transaction(() => f.published(b.id, "v2"));
      expect(f.comment(c.id).status).toBe("submitted");
      expect(() => f.review(c.id, "resolve")).toThrow("published changes");
    }));
  it("lets users archive unaddressed work and reopened drafts without claiming a verified fix", () =>
    fixture((store, feedback) => {
      const comment = feedback.add("Keep as is", target);
      const batch = feedback.prepare("archive-unaddressed");
      expect(() => feedback.review(comment.id, "archive")).toThrow("current batch");
      const claim = feedback.claim(batch.id, "agent", "archive-claim");
      expect(() => feedback.review(comment.id, "archive")).toThrow("current batch");
      feedback.update(batch.id, claim.leaseToken!, "unaddressed", comment.id, "User requested no change", "instance");
      store.transaction(() => feedback.published(batch.id, "v2"));
      const before = structuredClone(feedback.comment(comment.id));
      const archived = feedback.review(comment.id, "archive");
      expect(archived.status).toBe("resolved");
      expect(archived.resolution).toBe("archived");
      expect(archived.results).toEqual(before.results);
      expect(archived.target).toEqual(before.target);
      expect(store.get<import("../../src/core/feedback/index.js").Batch>("batch", batch.id)!.status).toBe("completed");
      feedback.review(comment.id, "reopen");
      feedback.edit(comment.id, "Reopened, still no change needed");
      expect(feedback.review(comment.id, "archive").resolution).toBe("archived");
      expect(feedback.comment(comment.id).text).toBe("Reopened, still no change needed");
      expect(feedback.comment(comment.id).previousDraft).toBeUndefined();
      expect(feedback.review(comment.id, "archive").status).toBe("resolved");
    }));
  it("lets a user archive a fresh draft without generating an agent result", () =>
    fixture((store, feedback) => {
      const comment = feedback.add("Withdraw this idea", target);
      const archived = feedback.review(comment.id, "archive");
      expect(archived.status).toBe("resolved");
      expect(archived.resolution).toBe("archived");
      expect(archived.results).toEqual([]);
      expect(store.all("batch")).toEqual([]);
    }));
  it("freezes user-requested updates, deduplicates retry, and leaves new comments for later", () =>
    fixture((s, f) => {
      const c = f.add("Fix padding", target);
      expect(s.all("batch")).toHaveLength(0);
      const b = f.prepare("submit-1");
      expect(f.prepare("submit-1").id).toBe(b.id);
      expect(() => f.edit(c.id, "changed")).toThrow(expect.objectContaining({ code: "batch_active" }));
      const draft = f.add("Next round", target);
      expect(b.items).toHaveLength(1);
      expect(f.comment(draft.id).status).toBe("draft");
      expect(f.prepare("submit-1").items.map((i) => i.id)).toEqual([c.id]);
      expect(f.prepare("next-update").items.map((i) => i.id)).toEqual([draft.id]);
    }));
  it("enforces ordered exclusive leases, supports retry and reclaims expired work", () =>
    fixture((s, f) => {
      f.add("First", target);
      const b = f.prepare("1");
      f.add("Second", target);
      const second = f.prepare("2");
      expect(() => f.claim(second.id, "agent", "key2")).toThrow("earliest");
      const claimed = f.claim(b.id, "agent", "key1");
      expect(f.claim(b.id, "agent", "key1").leaseToken).toBe(
        claimed.leaseToken,
      );
      expect(() => f.claim(b.id, "another", "key3")).toThrow();
      s.put("batch", { ...claimed, leaseUntil: 0 });
      f.recover();
      expect(f.claim(b.id, "another", "key3").owner).toBe("another");
    }));
  it("keeps changes awaiting user verification and preserves the original target version", () =>
    fixture((s, f) => {
      const c = f.add("Fix", target);
      const b = f.prepare("1");
      const claim = f.claim(b.id, "agent", "key");
      f.update(
        b.id,
        claim.leaseToken!,
        "modified",
        c.id,
        "Adjusted padding",
        "component",
      );
      s.transaction(() => f.published(b.id, "v2"));
      expect(f.comment(c.id).status).toBe("awaiting_review");
      expect(f.comment(c.id).target.revisionId).toBe("v1");
      expect(f.comment(c.id).results[0].revisionId).toBe("v2");
      f.review(c.id, "resolve");
      expect(f.comment(c.id).status).toBe("resolved");
      f.review(c.id, "reopen");
      expect(f.comment(c.id).status).toBe("draft");
    }));
  it("rolls back events with data and detects an expired replay cursor", () =>
    fixture((s) => {
      expect(() =>
        s.transaction(() => {
          s.put("meta", { id: "x" });
          s.event("x", {});
          throw new Error("rollback");
        }),
      ).toThrow();
      expect(s.get("meta", "x")).toBeUndefined();
      expect(s.cursor()).toBe(0);
      for (let i = 0; i < 4; i++) s.event("x", {});
      s.db.exec("DELETE FROM events WHERE id<4");
      expect(s.events(1).resyncRequired).toBe(true);
    }));
  it("prevents duplicate processes, restores records and rejects future database schemas", () =>
    fixture((s, f, dir) => {
      const c = f.add("Persistent", target);
      expect(() => new Store(dir)).toThrow("Another process");
      s.close();
      const reopened = new Store(dir);
      expect(reopened.get("comment", c.id).text).toBe("Persistent");
      reopened.db.exec("PRAGMA user_version=9");
      reopened.close();
      expect(() => new Store(dir)).toThrow("newer package");
    }));
});
