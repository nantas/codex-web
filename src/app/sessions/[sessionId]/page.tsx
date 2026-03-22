import { notFound } from "next/navigation";
import SessionDetailLive from "@/components/sessions/session-detail-live";
import { parseSessionDetailUrlState } from "@/components/sessions/session-detail-url-state";
import { SessionService } from "@/server/services/session-service";

const sessionService = new SessionService();

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const initialUrlState = parseSessionDetailUrlState(await searchParams);
  const session = await sessionService.getDetailForConsole(sessionId);

  if (!session) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Session {sessionId}</h1>
      <SessionDetailLive
        sessionId={sessionId}
        initialUrlState={initialUrlState}
        initialData={{
          session: {
            id: session.id,
            status: session.status,
            workspaceId: session.workspaceId,
            cwd: session.cwd,
            threadId: session.threadId,
            updatedAt: session.updatedAt.toISOString(),
          },
          operations: session.operations.map((operation) => ({
            id: operation.id,
            status: operation.status,
            requestText: operation.requestText,
            resultText: operation.resultText,
            errorMessage: operation.errorMessage,
            updatedAt: operation.updatedAt.toISOString(),
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
              updatedAt: approval.updatedAt.toISOString(),
            })),
          })),
        }}
      />
    </main>
  );
}
