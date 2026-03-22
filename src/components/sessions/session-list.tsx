import Link from "next/link";

type SessionListItem = {
  id: string;
  status: string;
  workspaceId: string;
  cwd: string;
  pendingApprovals: number;
  latestOperation: {
    id: string;
    status: string;
  } | null;
  updatedAt: string | Date;
};

export default function SessionList({ sessions }: { sessions: SessionListItem[] }) {
  return (
    <ul className="space-y-2">
      {sessions.map((session) => (
        <li key={session.id} className="space-y-2 rounded border border-black/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{session.id}</p>
              <p className="text-sm text-black/60">{session.workspaceId}</p>
            </div>
            <span className="rounded bg-black/5 px-2 py-1 text-xs uppercase tracking-wide">
              {session.status}
            </span>
          </div>
          <p className="text-sm text-black/70">{session.pendingApprovals} pending approvals</p>
          <p className="text-xs text-black/60">cwd: {session.cwd}</p>
          {session.latestOperation ? (
            <p className="text-xs text-black/60">
              latest operation: {session.latestOperation.id} ({session.latestOperation.status})
            </p>
          ) : (
            <p className="text-xs text-black/60">latest operation: none</p>
          )}
          <p className="text-xs text-black/60">
            updated: {new Date(session.updatedAt).toLocaleString()}
          </p>
          <Link className="inline-block text-sm font-medium underline" href={`/sessions/${session.id}`}>
            View details
          </Link>
        </li>
      ))}
    </ul>
  );
}
