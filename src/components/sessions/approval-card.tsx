"use client";

type ApprovalCardProps = {
  id: string;
  prompt: string;
  status: string;
  disabled?: boolean;
  onDecision?: (decision: "approve" | "deny") => void | Promise<void>;
};

export default function ApprovalCard({
  id,
  prompt,
  status,
  disabled = false,
  onDecision,
}: ApprovalCardProps) {
  const canDecide = status === "pending" && Boolean(onDecision);

  return (
    <article className="rounded border border-amber-300 bg-amber-50 p-3">
      <h3 className="font-semibold">Approval {id}</h3>
      <p className="mt-1 text-sm">{prompt}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-amber-900">{status}</p>
      {canDecide ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded border border-emerald-700 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
            onClick={() => onDecision?.("approve")}
            disabled={disabled}
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded border border-red-700 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
            onClick={() => onDecision?.("deny")}
            disabled={disabled}
          >
            Deny
          </button>
        </div>
      ) : null}
    </article>
  );
}
