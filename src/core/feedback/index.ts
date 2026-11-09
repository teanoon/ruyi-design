import { randomUUID } from "node:crypto";
import { targetSchema, type Target } from "../../contracts/catalog.js";
import { Store } from "../../storage/index.js";
import { ensure } from "../errors.js";
import { feedbackLocationSchema, type FeedbackLocation } from "../../contracts/feedback.js";

export type Comment = {
  id: string;
  text: string;
  target: Target;
  status:
    | "draft"
    | "submitted"
    | "needs_clarification"
    | "awaiting_review"
    | "resolved";
  previousDraft?: { text: string; status: Comment["status"] };
  thread: { author: string; text: string; at: number }[];
  results: {
    batchId: string;
    message: string;
    scope: string;
    action?: string;
    revisionId?: string;
    location?: FeedbackLocation;
  }[];
};
export type Batch = {
  id: string;
  key: string;
  status: "queued" | "processing" | "awaiting_review" | "completed";
  items: Comment[];
  owner?: string;
  leaseToken?: string;
  leaseUntil?: number;
  claimKey?: string;
  created: number;
};
export class Feedback {
  constructor(public store: Store) {}
  add(text: string, target: Target) {
    ensure(
      text.trim() && text.length <= 20000,
      "invalid_comment",
      "Comment must contain 1–20000 characters",
    );
    const comment: Comment = {
      id: randomUUID(),
      text: text.trim(),
      target: targetSchema.parse(target),
      status: "draft",
      thread: [],
      results: [],
    };
    this.store.transaction(() => {
      this.store.put("comment", comment);
      this.store.event("comment.created", comment);
    });
    return comment;
  }
  comment(id: string) {
    const c = this.store.get<Comment>("comment", id);
    ensure(c, "not_found", "Comment not found", 404);
    return c;
  }
  edit(id: string, text?: string) {
    const c = this.comment(id);
    ensure(
      c.status === "draft",
      "not_draft",
      "Submitted input is immutable",
      409,
    );
    if (text !== undefined)
      ensure(
        text.trim() && text.length <= 20000,
        "invalid_comment",
        "Invalid comment",
      );
    this.store.transaction(() => {
      if (text === undefined) {
        if (c.previousDraft) {
          Object.assign(c, c.previousDraft);
          delete c.previousDraft;
          this.store.put("comment", c);
        } else this.store.delete("comment", id);
      } else {
        c.text = text.trim();
        this.store.put("comment", c);
      }
      this.store.event("comment.updated", { id });
    });
    return { id };
  }
  prepare(key: string, ids?: string[]) {
    ensure(key, "missing_key", "An idempotency key is required");
    return this.store.transaction(() => {
      const prior = this.store.all<Batch>("batch").find((b) => b.key === key);
      if (prior) return prior;
      const drafts = this.store
        .all<Comment>("comment")
        .filter((c) => c.status === "draft" && (!ids || ids.includes(c.id)));
      ensure(drafts.length, "empty_batch", "No saved pending comments to process");
      const b: Batch = {
        id: randomUUID(),
        key,
        status: "queued",
        items: structuredClone(drafts),
        created: Date.now(),
      };
      for (const c of drafts) {
        c.status = "submitted";
        delete c.previousDraft;
        this.store.put("comment", c);
      }
      this.store.put("batch", b);
      this.store.event("batch.prepared", { batchId: b.id });
      return b;
    });
  }
  recover() {
    this.store.transaction(() => {
      for (const b of this.store.all<Batch>("batch"))
        if (b.status === "processing" && (b.leaseUntil ?? 0) < Date.now()) {
          b.status = "queued";
          delete b.leaseToken;
          this.store.put("batch", b);
          this.store.event("batch.requeued", { batchId: b.id });
        }
    });
  }
  setLocation(id: string, revisionId: string, value: FeedbackLocation) {
    return this.store.transaction(() => {
      const c = this.comment(id);
      const result = c.results.find((r) => r.revisionId === revisionId && r.action === "modified");
      ensure(result, "not_modified", "Location requires a published modified result", 409);
      result.location = feedbackLocationSchema.parse(value);
      this.store.put("comment", c);
      this.store.event("feedback.location_updated", { commentId: id, revisionId });
      return c;
    });
  }
  claim(id: string, owner: string, key: string) {
    this.recover();
    return this.store.transaction(() => {
      const b = this.store.get<Batch>("batch", id);
      ensure(b, "not_found", "Batch not found", 404);
      if (b.status === "processing" && b.claimKey === key && b.owner === owner)
        return b;
      ensure(
        b.status === "queued",
        "already_claimed",
        "Batch is not queued",
        409,
      );
      const processing = this.store
        .all<Batch>("batch")
        .find((x) => x.status === "processing");
      const first = this.store
        .all<Batch>("batch")
        .find((x) => x.status === "queued");
      ensure(
        !processing && first?.id === id,
        "batch_order",
        "Process the earliest available batch first",
        409,
      );
      Object.assign(b, {
        status: "processing",
        owner,
        claimKey: key,
        leaseToken: randomUUID(),
        leaseUntil: Date.now() + 300000,
      });
      this.store.put("batch", b);
      this.store.event("batch.claimed", { batchId: id, owner });
      return b;
    });
  }
  lease(id: string, token: string) {
    const b = this.store.get<Batch>("batch", id);
    ensure(
      b &&
        b.status === "processing" &&
        b.leaseToken === token &&
        (b.leaseUntil ?? 0) > Date.now(),
      "invalid_lease",
      "Lease is invalid or expired",
      409,
    );
    return b;
  }
  update(
    batchId: string,
    token: string,
    action: string,
    commentId?: string,
    message = "",
    scope = "instance",
  ) {
    return this.store.transaction(() => {
      const b = this.lease(batchId, token);
      b.leaseUntil = Date.now() + 300000;
      if (action === "release") {
        b.status = "awaiting_review";
        delete b.leaseToken;
        this.store.put("batch", b);
        this.store.event("batch.released", { batchId });
        return b;
      }
      if (action !== "renew") {
        ensure(
          commentId && b.items.some((c) => c.id === commentId),
          "invalid_target",
          "Comment is not in this batch",
        );
        const c = this.comment(commentId);
        ensure(
          message.trim(),
          "missing_message",
          "Explain the result or question",
        );
        c.thread.push({ author: "agent", text: message, at: Date.now() });
        if (action === "needs_clarification") c.status = "needs_clarification";
        if (action === "modified" || action === "unaddressed") {
          c.results = c.results.filter((r) => r.batchId !== batchId);
          c.results.push({ batchId, message, scope, action });
        }
        this.store.put("comment", c);
      }
      this.store.put("batch", b);
      this.store.event("feedback.updated", { batchId, commentId, action });
      return b;
    });
  }
  review(id: string, action: "resolve" | "reopen" | "reply", message = "") {
    return this.store.transaction(() => {
      const c = this.comment(id);
      if (message.trim())
        c.thread.push({ author: "user", text: message, at: Date.now() });
      if (action === "resolve") {
        ensure(
          c.status === "awaiting_review",
          "not_reviewable",
          "Only published changes can be confirmed",
          409,
        );
        c.status = "resolved";
      }
      if (action === "reopen") {
        ensure(
          c.status !== "draft",
          "already_draft",
          "Comment is already a draft",
          409,
        );
        ensure(
          !this.store
            .all<Batch>("batch")
            .some(
              (b) =>
                b.status === "processing" && b.items.some((i) => i.id === id),
            ),
          "batch_processing",
          "Wait until the current batch is released or published",
          409,
        );
        c.previousDraft = { text: c.text, status: c.status };
        c.status = "draft";
      }
      this.store.put("comment", c);
      for (const b of this.store.all<Batch>("batch"))
        if (
          b.status === "awaiting_review" &&
          b.items.every((i) => this.comment(i.id).status === "resolved")
        ) {
          b.status = "completed";
          this.store.put("batch", b);
        }
      this.store.event("comment.reviewed", { id, action });
      return c;
    });
  }
  published(batchId: string, revisionId: string) {
    const b = this.store.get<Batch>("batch", batchId)!;
    for (const item of b.items) {
      const c = this.comment(item.id);
      const result = c.results.find((r) => r.batchId === batchId);
      if (result) {
        result.revisionId = revisionId;
        c.status =
          result.action === "unaddressed" ? "submitted" : "awaiting_review";
        this.store.put("comment", c);
      }
    }
    b.status = "awaiting_review";
    delete b.leaseToken;
    this.store.put("batch", b);
  }
}
