import type { Target } from "./catalog.js";

export type CommentSummary = {
  id: string;
  target: Target;
  status: string;
  previousDraft?: unknown;
  results: unknown[];
};
export type BatchSummary = { status: string; items: { id: string }[] };
export function sameCommentElement(left: Target, right: Target): boolean {
  if (["kind", "objectId", "stateId", "deviceId", "exampleId"].some(key => left[key as keyof Target] !== right[key as keyof Target])) return false;
  const a = left.context?.anchor as { reviewId?: string; selector?: string } | undefined;
  const b = right.context?.anchor as typeof a;
  if (typeof a?.reviewId === "string" && a.reviewId && typeof b?.reviewId === "string" && b.reviewId) return a.reviewId === b.reviewId;
  return typeof a?.selector === "string" && !!a.selector && typeof b?.selector === "string" && !!b.selector && a.selector === b.selector;
}
/** Input order is stable creation order; legacy duplicates are never rewritten. */
export function findElementComment<T extends CommentSummary>(comments: T[], target: Target): T | undefined {
  const matches = comments.filter(c => sameCommentElement(c.target, target)).reverse();
  return matches.find(c => c.status !== "resolved") ?? matches[0];
}
export function commentFacts(comment: CommentSummary, batches: BatchSummary[]) {
  const related = batches.filter(b => b.items.some(item => item.id === comment.id));
  return {
    busy: related.some(b => b.status === "queued" || b.status === "processing"),
    processing: related.some(b => b.status === "processing"),
    hasHistory: related.length > 0 || comment.results.length > 0,
  };
}
export type CommentAction = "locate" | "original" | "edit" | "delete" | "reply" | "resolve" | "reopen" | "cancel_reopen";
export function commentActions(comment: CommentSummary, batches: BatchSummary[], latestRevisionId: string): CommentAction[] {
  const { busy, hasHistory } = commentFacts(comment, batches);
  const actions: CommentAction[] = [];
  const anchor = comment.target.context?.anchor as { selector?: string; reviewId?: string } | undefined;
  if ((typeof anchor?.selector === "string" && anchor.selector) || (typeof anchor?.reviewId === "string" && anchor.reviewId)) {
    actions.push("locate");
    if (comment.target.revisionId !== latestRevisionId) actions.push("original");
  }
  if (busy || comment.status === "submitted" || comment.status === "needs_clarification") return [...actions, "reply"];
  if (comment.status === "resolved") return [...actions, "reply", "reopen"];
  if (comment.status === "awaiting_review") return [...actions, "reply", "resolve", "reopen"];
  if (comment.previousDraft) return [...actions, "reply", "edit", "cancel_reopen"];
  if (hasHistory) return [...actions, "reply", "edit"];
  return [...actions, "edit", "delete"];
}
