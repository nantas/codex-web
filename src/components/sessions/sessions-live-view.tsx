"use client";

import { useEffect, useState } from "react";
import SessionList from "@/components/sessions/session-list";

type SessionListEntry = {
  id: string;
  status: string;
  workspaceId: string;
  cwd: string;
  pendingApprovals: number;
  latestOperation: { id: string; status: string } | null;
  updatedAt: string;
};

async function fetchSessions(): Promise<SessionListEntry[]> {
  const response = await fetch("/api/v1/sessions", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load sessions");
  }

  const payload = (await response.json()) as { sessions: SessionListEntry[] };
  return payload.sessions;
}

export default function SessionsLiveView({
  initialSessions,
  pollIntervalMs = 3000,
}: {
  initialSessions: SessionListEntry[];
  pollIntervalMs?: number;
}) {
  const [sessions, setSessions] = useState<SessionListEntry[]>(initialSessions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const nextSessions = await fetchSessions();
        setSessions(nextSessions);
        setErrorMessage(null);
      } catch {
        setErrorMessage("Failed to refresh sessions.");
      }
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [pollIntervalMs]);

  return (
    <section className="space-y-3">
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      <SessionList sessions={sessions} />
    </section>
  );
}
