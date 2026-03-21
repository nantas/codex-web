import { z } from "zod";

export const operationStatusSchema = z.enum([
  "queued",
  "running",
  "waitingApproval",
  "completed",
  "failed",
  "interrupted",
]);

export const createSessionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  cwd: z.string().min(1),
  model: z.string().min(1).optional(),
  resumeThreadId: z.string().min(1).nullable().optional(),
});

export const createOperationRequestSchema = z.object({
  sessionId: z.string().min(1),
  type: z.literal("turn.start"),
  input: z.array(z.object({ type: z.literal("text"), text: z.string().min(1) })).min(1),
});

export const approvalDecisionRequestSchema = z.object({
  decision: z.enum(["approve", "deny"]),
});
