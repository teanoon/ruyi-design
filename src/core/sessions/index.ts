import path from "node:path";
import { publicationSchema, type PublicationInput } from "../../contracts/publication.js";
import { resolveDataRoot } from "./data-root.js";
import { randomUUID } from "node:crypto";
import { realpath, rm } from "node:fs/promises";
import { Store } from "../../storage/index.js";
import { Feedback, type Batch, type Comment } from "../feedback/index.js";
import { snapshot, changeMode, type Revision } from "../revisions/index.js";
import { ensure } from "../errors.js";
import { combinations, type Target } from "../../contracts/catalog.js";

export class ReviewSession {
  id: string;
  store: Store;
  feedback: Feedback;
  closed = false;
  publishing = false;
  constructor(
    public projectRoot: string,
    public designRoot: string,
    public dataRoot: string,
  ) {
    this.store = new Store(dataRoot);
    const project = this.store.get("meta", "project");
    if (
      project &&
      (project.projectRoot !== projectRoot || project.designRoot !== designRoot)
    ) {
      this.store.close();
      throw new Error(
        "Data directory belongs to a different project/design root",
      );
    }
    this.id = project?.sessionId ?? randomUUID();
    this.store.put("meta", {
      id: "project",
      projectRoot,
      designRoot,
      sessionId: this.id,
    });
    this.feedback = new Feedback(this.store);
    this.feedback.recover();
  }
  static async open(
    projectRoot: string,
    designRoot: string,
    dataRoot?: string,
  ) {
    ensure(
      path.isAbsolute(projectRoot) && path.isAbsolute(designRoot),
      "absolute_path_required",
      "Pass absolute projectRoot and designRoot",
    );
    const p = await realpath(projectRoot),
      d = await realpath(designRoot);
    ensure(
      d.startsWith(p + path.sep),
      "outside_project",
      "designRoot must be inside projectRoot",
    );
    const data = resolveDataRoot(p, dataRoot).path;
    ensure(
      !data.startsWith(d + path.sep) && data !== d,
      "invalid_data_root",
      "Data directory must be outside designRoot",
    );
    const s = new ReviewSession(p, d, data);
    try {
      if (!s.active()) {
        const rev = await snapshot(d, data);
        s.store.transaction(() => {
          s.store.put("revision", rev);
          s.store.put("meta", { id: "active", revisionId: rev.id });
        });
      }
      return s;
    } catch (e) {
      s.close();
      throw e;
    }
  }
  active(): Revision | undefined {
    const active = this.store.get("meta", "active");
    return active && this.store.get("revision", active.revisionId);
  }
  context() {
    this.feedback.recover();
    const batches = this.store.all<Batch>("batch");
    return {
      sessionId: this.id,
      projectRoot: this.projectRoot,
      designRoot: this.designRoot,
      revision: this.active(),
      comments: this.store.all<Comment>("comment"),
      batches: batches.map(({ leaseToken, ...b }) => b),
      cursor: this.store.cursor(),
      activity: batches.some((b) => b.status === "processing")
        ? "working"
        : "idle",
    };
  }
  validateTarget(target: Target) {
    const rev = this.store.get<Revision>("revision", target.revisionId);
    ensure(rev, "invalid_revision", "Unknown revision");
    if (target.kind === "token")
      ensure(
        rev.manifest.tokens.some((t) => t.id === target.objectId),
        "invalid_target",
        "Unknown token",
      );
    else
      ensure(
        combinations(rev.manifest).some(
          (c) =>
            c.kind === target.kind &&
            c.objectId === target.objectId &&
            c.deviceId === target.deviceId &&
            (c.kind === "page"
              ? c.stateId === target.stateId
              : c.exampleId === target.exampleId),
        ),
        "invalid_target",
        "Unknown page/state/device or component example",
      );
  }
  private ensureNoActiveFeedback() {
    this.feedback.recover();
    ensure(!this.store.all<Batch>("batch").some(b => b.status === "queued" || b.status === "processing"),
      "feedback_active", "Finish or release queued/processing feedback before publishing a conversation request", 409);
  }
  async publish(input: PublicationInput, validate: (revision: Revision) => Promise<void>) {
    const args = publicationSchema.parse(input);
    const conversation = args.source === "conversation";
    const previous = this.store.all<Revision>("revision").find(r => r.key === args.idempotencyKey);
    if (previous) {
      const sameSource = (previous.source ?? "feedback") === args.source;
      const sameRequest = conversation
        ? previous.request === args.request && previous.baseRevision === args.expectedBaseRevision
        : previous.batchId === args.batchId;
      ensure(sameSource && sameRequest, "key_conflict", "Publication key belongs to another request or batch", 409);
      return previous;
    }
    ensure(!this.publishing, "publish_busy", "Another publication is running", 409);
    if (conversation) this.ensureNoActiveFeedback();
    const batch = conversation ? undefined : this.feedback.lease(args.batchId!, args.leaseToken!);
    ensure(this.active()?.id === args.expectedBaseRevision, "stale_revision", "Reload current revision before publishing", 409);
    if (batch) ensure(batch.items.every(item => this.feedback.comment(item.id).results.some(r => r.batchId === batch.id)),
      "missing_results", "Record a result and scope for every batch item before publishing");
    this.publishing = true;
    let revision: Revision | undefined;
    try {
      revision = await snapshot(this.designRoot, this.dataRoot);
      await validate(revision);
      if (conversation) this.ensureNoActiveFeedback();
      else this.feedback.lease(args.batchId!, args.leaseToken!);
      ensure(this.active()?.id === args.expectedBaseRevision, "stale_revision", "Active revision changed during validation", 409);
      revision.mode = changeMode(this.active()!, revision);
      revision.key = args.idempotencyKey;
      revision.source = args.source;
      revision.baseRevision = args.expectedBaseRevision;
      if (conversation) revision.request = args.request;
      else revision.batchId = args.batchId;
      const rev = revision;
      this.store.transaction(() => {
        this.store.put("revision", rev);
        this.store.put("meta", { id: "active", revisionId: rev.id });
        if (batch) this.feedback.published(batch.id, rev.id);
        this.store.event("revision.published", { revisionId: rev.id, mode: rev.mode, source: rev.source });
      });
      return rev;
    } catch (error) {
      if (revision) await rm(path.join(this.dataRoot, "revisions", revision.id), { recursive: true, force: true });
      throw error;
    } finally { this.publishing = false; }
  }
  close() {
    if (!this.closed) {
      this.closed = true;
      this.store.close();
    }
  }
}
