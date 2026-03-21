import SessionList from "@/components/sessions/session-list";

const placeholderSessions = [
  { id: "ses_1", status: "idle" },
  { id: "ses_2", status: "running" },
];

export default function SessionsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <SessionList sessions={placeholderSessions} />
    </main>
  );
}
