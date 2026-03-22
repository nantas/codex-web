import { NextResponse } from "next/server";
import { SessionService } from "@/server/services/session-service";
import { HttpError, toErrorResponse } from "@/server/http/errors";

const sessionService = new SessionService();

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const session = await sessionService.getDetailForConsole(sessionId);

    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        workspaceId: session.workspaceId,
        cwd: session.cwd,
        threadId: session.threadId,
        updatedAt: session.updatedAt,
      },
      operations: session.operations.map((operation) => ({
        id: operation.id,
        status: operation.status,
        requestText: operation.requestText,
        resultText: operation.resultText,
        errorMessage: operation.errorMessage,
        updatedAt: operation.updatedAt,
        logs: operation.logs
          .slice()
          .reverse()
          .map((log) => ({
            id: log.id,
            level: log.level === "error" ? "error" : "info",
            message: log.message,
            timestamp: log.createdAt.toISOString(),
          })),
        approvals: operation.approvals.map((approval) => ({
          id: approval.id,
          kind: approval.kind,
          status: approval.status,
          prompt: approval.prompt,
          decision: approval.decision,
          updatedAt: approval.updatedAt,
        })),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
