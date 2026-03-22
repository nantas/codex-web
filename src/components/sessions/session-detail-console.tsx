"use client";

type Operation = {
  id: string;
  status: string;
  resultText: string | null;
};

export default function SessionDetailConsole({
  initialOperation,
}: {
  initialOperation: Operation | null;
}) {
  if (!initialOperation) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Session Console</h2>
        <p className="text-sm text-black/60">No operations yet.</p>
      </section>
    );
  }

  const waiting = initialOperation.status === "waitingApproval";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Session Console</h2>
      {waiting ? (
        <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Waiting Approval</span>
      ) : null}
      {initialOperation.status === "completed" ? (
        <article className="whitespace-pre-wrap rounded border p-3">{initialOperation.resultText}</article>
      ) : null}
    </section>
  );
}
