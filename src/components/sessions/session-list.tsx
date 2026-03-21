type SessionListItem = {
  id: string;
  status: string;
};

export default function SessionList({ sessions }: { sessions: SessionListItem[] }) {
  return (
    <ul className="space-y-2">
      {sessions.map((session) => (
        <li key={session.id} className="rounded border border-black/10 p-3">
          <p className="font-medium">{session.id}</p>
          <p className="text-sm text-black/60">{session.status}</p>
        </li>
      ))}
    </ul>
  );
}
