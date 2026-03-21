type ApprovalCardProps = {
  id: string;
  prompt: string;
  status: string;
};

export default function ApprovalCard({ id, prompt, status }: ApprovalCardProps) {
  return (
    <article className="rounded border border-amber-300 bg-amber-50 p-3">
      <h3 className="font-semibold">Approval {id}</h3>
      <p className="mt-1 text-sm">{prompt}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-amber-900">{status}</p>
    </article>
  );
}
