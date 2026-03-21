import ApprovalCard from "@/components/sessions/approval-card";
import SessionDetailConsole from "@/components/sessions/session-detail-console";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Session {sessionId}</h1>
      <SessionDetailConsole
        initialOperation={{ id: "op_1", status: "waitingApproval", resultText: null }}
      />
      <ApprovalCard id="apr_1" prompt="Approve command?" status="pending" />
    </main>
  );
}
