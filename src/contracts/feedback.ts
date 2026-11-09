import { z } from "zod";

export const feedbackLocationSchema = z.object({
  kind: z.literal("deleted"),
  container: z.object({
    selector: z.string().min(1).max(2000),
    reviewId: z.string().nullable().optional(),
    tag: z.string().optional(),
  }),
});
export type FeedbackLocation = z.infer<typeof feedbackLocationSchema>;
