import { z } from "zod";

export const publicationFields = {
  source: z.enum(["feedback", "conversation"]).default("feedback").describe("Use conversation only for an explicit user request in chat; feedback preserves the existing batch workflow."),
  request: z.string().trim().min(1).max(20000).optional().describe("Required for conversation: record the user's actual design request. Do not fabricate saved comments."),
  batchId: z.string().min(1).optional(),
  leaseToken: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  expectedBaseRevision: z.string().min(1),
};
export const publicationSchema = z.object(publicationFields).superRefine((value, context) => {
  if (value.source === "conversation") {
    if (!value.request) context.addIssue({ code: "custom", path: ["request"], message: "Conversation publication requires the explicit user request" });
    if (value.batchId || value.leaseToken) context.addIssue({ code: "custom", message: "Conversation publication cannot include a feedback batch or lease" });
  } else {
    if (!value.batchId || !value.leaseToken) context.addIssue({ code: "custom", message: "Feedback publication requires batchId and leaseToken" });
    if (value.request) context.addIssue({ code: "custom", path: ["request"], message: "Use source=conversation for direct user requests" });
  }
});
export type PublicationInput = z.input<typeof publicationSchema>;
