import SessionsLiveView from "@/components/sessions/sessions-live-view";
import { SessionService } from "@/server/services/session-service";

const sessionService = new SessionService();

export default async function SessionsPage() {
  const sessions = await sessionService.listForConsole();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <SessionsLiveView
        initialSessions={sessions.map((session) => ({
          ...session,
          updatedAt: session.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
