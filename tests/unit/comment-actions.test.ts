import { expect, it } from "vitest";
import { commentActions, commentFacts, findElementComment, sameCommentElement } from "../../src/contracts/comment-actions.js";
import type { Target } from "../../src/contracts/catalog.js";

const target: Target = { kind: "page", objectId: "home", stateId: "default", deviceId: "desktop", revisionId: "v1", context: { anchor: { selector: "#button", reviewId: "button" } } };
const comment = { id: "one", target, status: "draft", results: [] };
it("matches exact elements across versions without merging ancestors, states, devices or examples", () => {
  expect(sameCommentElement(target, { ...target, revisionId: "v2", context: { anchor: { selector: "#renamed", reviewId: "button" } } })).toBe(true);
  expect(sameCommentElement(target, { ...target, context: { anchor: { selector: "#button" } } })).toBe(true);
  for (const change of [{ deviceId: "mobile" }, { stateId: "error" }, { objectId: "other" }, { exampleId: "hover" }, { context: { anchor: { selector: "#button", reviewId: "different" } } }, { context: { anchor: { selector: "#button > span" } } }, { context: {} }])
    expect(sameCommentElement(target, { ...target, ...change })).toBe(false);
  expect(sameCommentElement({ ...target, context: {} }, { ...target, context: {} })).toBe(false);
});
it("chooses the latest unresolved legacy comment, otherwise latest resolved, without mutation", () => {
  const comments = [{ ...comment, id: "old", status: "draft" }, { ...comment, id: "new", status: "resolved" }];
  const before = structuredClone(comments);
  expect(findElementComment(comments, target)?.id).toBe("old");
  expect(comments).toEqual(before);
  expect(findElementComment(comments.map(c => ({ ...c, status: "resolved" })), target)?.id).toBe("new");
});
it("shows the complete approved action matrix, with active batches taking precedence", () => {
  const older = { ...comment, target: { ...target, revisionId: "v0" } };
  expect(commentActions(comment, [], "v1")).toEqual(["locate", "edit", "delete"]);
  expect(commentActions({ ...comment, previousDraft: {} }, [], "v1")).toEqual(["locate", "reply", "edit", "cancel_reopen"]);
  const prior = [{ status: "completed", items: [{ id: comment.id }] }];
  expect(commentActions(comment, prior, "v1")).toEqual(["locate", "reply", "edit"]);
  expect(commentFacts(comment, prior)).toMatchObject({ hasHistory: true, busy: false });
  for (const status of ["submitted", "needs_clarification"]) expect(commentActions({ ...older, status }, [], "v1")).toEqual(["locate", "original", "reply"]);
  expect(commentActions({ ...older, status: "awaiting_review" }, [], "v1")).toEqual(["locate", "original", "reply", "resolve", "reopen"]);
  expect(commentActions({ ...older, status: "resolved" }, [], "v1")).toEqual(["locate", "original", "reply", "reopen"]);
  for (const status of ["queued", "processing"]) expect(commentActions({ ...older, previousDraft: {} }, [{ status, items: [comment] }], "v1")).toEqual(["locate", "original", "reply"]);
  expect(commentActions({ ...comment, target: { ...target, context: {} } }, [], "v1")).toEqual(["edit", "delete"]);
});
