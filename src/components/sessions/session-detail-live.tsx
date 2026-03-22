"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApprovalCard from "@/components/sessions/approval-card";
import { computeLogPollDelayMs } from "@/components/sessions/log-poll-backoff";
import SessionDetailConsole from "@/components/sessions/session-detail-console";
import SessionTurnComposer from "@/components/sessions/session-turn-composer";
import {
  buildSessionDetailUrlQuery,
  type SessionDetailUrlState,
} from "@/components/sessions/session-detail-url-state";

type ApprovalItem = {
  id: string;
  kind: string;
  status: string;
  prompt: string;
  decision: string | null;
  updatedAt: string;
};

type OperationItem = {
  id: string;
  status: string;
  requestText: string;
  resultText: string | null;
  errorMessage: string | null;
  updatedAt: string;
  logs?: Array<{
    id: number;
    level: "info" | "error";
    message: string;
    timestamp: string;
  }>;
  approvals: ApprovalItem[];
};

type SessionDetailData = {
  session: {
    id: string;
    status: string;
    workspaceId: string;
    cwd: string;
    threadId: string;
    updatedAt: string;
  };
  operations: OperationItem[];
};

type LogFilterInput = {
  level: "all" | "info" | "error";
  from: string;
  to: string;
};

type OperationLogsResponse = {
  logs: Array<{
    id: number;
    level: "info" | "error";
    message: string;
    timestamp: string;
  }>;
  nextCursor: number;
};

async function fetchSessionDetail(sessionId: string): Promise<SessionDetailData> {
  const response = await fetch(`/api/v1/sessions/${sessionId}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load session detail");
  }
  return (await response.json()) as SessionDetailData;
}

async function postApprovalDecision(approvalId: string, decision: "approve" | "deny") {
  const response = await fetch(`/api/v1/approvals/${approvalId}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit approval decision");
  }
}

async function postTurnStart(sessionId: string, text: string) {
  const response = await fetch("/api/v1/operations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      type: "turn.start",
      input: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit turn");
  }
}

async function fetchOperationLogs(
  operationId: string,
  filter: LogFilterInput,
  options?: { after?: number },
): Promise<OperationLogsResponse> {
  const params = new URLSearchParams({
    after: String(options?.after ?? 0),
    limit: "200",
  });
  if (filter.level !== "all") {
    params.set("level", filter.level);
  }
  if (filter.from) {
    params.set("from", filter.from);
  }
  if (filter.to) {
    params.set("to", filter.to);
  }

  const response = await fetch(`/api/v1/operations/${operationId}/logs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch logs");
  }
  return (await response.json()) as OperationLogsResponse;
}

export default function SessionDetailLive({
  sessionId,
  initialData,
  initialUrlState,
  pollIntervalMs = 3000,
}: {
  sessionId: string;
  initialData: SessionDetailData;
  initialUrlState?: SessionDetailUrlState;
  pollIntervalMs?: number;
}) {
  const historyPageSize = 5;
  const [data, setData] = useState<SessionDetailData>(initialData);
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [submittingApprovalId, setSubmittingApprovalId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(initialUrlState?.page ?? 1);
  const [logLevel, setLogLevel] = useState<"all" | "info" | "error">(
    initialUrlState?.level ?? "all",
  );
  const [logFrom, setLogFrom] = useState(initialUrlState?.from ?? "");
  const [logTo, setLogTo] = useState(initialUrlState?.to ?? "");
  const [isApplyingLogFilter, setIsApplyingLogFilter] = useState(false);
  const [appliedLogFilter, setAppliedLogFilter] = useState<LogFilterInput | null>(
    initialUrlState?.filtered
      ? {
          level: initialUrlState.level,
          from: initialUrlState.from,
          to: initialUrlState.to,
        }
      : null,
  );
  const [logCursorByOperation, setLogCursorByOperation] = useState<Record<string, number>>({});
  const [autoLogPollFailures, setAutoLogPollFailures] = useState(0);
  const [manualLogReloadFailedAt, setManualLogReloadFailedAt] = useState<string | null>(null);
  const [autoLogPollingFailedAt, setAutoLogPollingFailedAt] = useState<string | null>(null);
  const shouldApplyInitialFilter = useRef(Boolean(initialUrlState?.filtered));

  const refresh = useCallback(async () => {
    const nextData = await fetchSessionDetail(sessionId);
    setData(nextData);
  }, [sessionId]);

  const latestOperation = data.operations[0] ?? null;
  const pendingApprovals = useMemo(
    () =>
      data.operations.flatMap((operation) =>
        operation.approvals.filter((approval) => approval.status === "pending"),
      ),
    [data.operations],
  );
  const totalHistoryPages = Math.max(1, Math.ceil(data.operations.length / historyPageSize));
  const historyStartIndex = (historyPage - 1) * historyPageSize;
  const visibleOperations = data.operations.slice(
    historyStartIndex,
    historyStartIndex + historyPageSize,
  );
  const nextPollDelayMs = useMemo(
    () =>
      computeLogPollDelayMs({
        pollIntervalMs,
        filtered: Boolean(appliedLogFilter),
        failures: autoLogPollFailures,
      }),
    [appliedLogFilter, autoLogPollFailures, pollIntervalMs],
  );

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, totalHistoryPages));
  }, [totalHistoryPages]);

  useEffect(() => {
    const query = buildSessionDetailUrlQuery({
      page: historyPage,
      level: logLevel,
      from: logFrom,
      to: logTo,
      filtered: appliedLogFilter !== null,
    });
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [appliedLogFilter, historyPage, logFrom, logLevel, logTo]);

  async function handleDecision(approvalId: string, decision: "approve" | "deny") {
    try {
      setSubmittingApprovalId(approvalId);
      await postApprovalDecision(approvalId, decision);
      await refresh();
      setErrorMessage(null);
    } catch {
      setErrorMessage("Failed to submit approval decision.");
    } finally {
      setSubmittingApprovalId(null);
    }
  }

  async function handleTurnSubmit(text: string) {
    try {
      setSubmittingTurn(true);
      await postTurnStart(sessionId, text);
      await refresh();
      setErrorMessage(null);
      setHistoryPage(1);
    } catch {
      setErrorMessage("Failed to submit turn.");
    } finally {
      setSubmittingTurn(false);
    }
  }

  const applyLogFilter = useCallback(async () => {
    const operationsInPage = data.operations.slice(historyStartIndex, historyStartIndex + historyPageSize);
    if (operationsInPage.length === 0) return;

    try {
      setIsApplyingLogFilter(true);
      const filter: LogFilterInput = {
        level: logLevel,
        from: logFrom,
        to: logTo,
      };
      const filteredById = await Promise.all(
        operationsInPage.map(async (operation) => ({
          operationId: operation.id,
          response: await fetchOperationLogs(operation.id, filter, { after: 0 }),
        })),
      );
      const logMap = new Map(filteredById.map((item) => [item.operationId, item.response.logs]));
      const cursorMap = Object.fromEntries(
        filteredById.map((item) => [item.operationId, item.response.nextCursor]),
      );
      setData((prev) => ({
        ...prev,
        operations: prev.operations.map((operation) =>
          logMap.has(operation.id) ? { ...operation, logs: logMap.get(operation.id) } : operation,
        ),
      }));
      setLogCursorByOperation((prev) => ({ ...prev, ...cursorMap }));
      setAppliedLogFilter(filter);
      setAutoLogPollFailures(0);
      setManualLogReloadFailedAt(null);
      setAutoLogPollingFailedAt(null);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Failed to filter logs.");
    } finally {
      setIsApplyingLogFilter(false);
    }
  }, [data.operations, historyPageSize, historyStartIndex, logFrom, logLevel, logTo]);

  useEffect(() => {
    if (!shouldApplyInitialFilter.current) {
      return;
    }
    shouldApplyInitialFilter.current = false;
    void applyLogFilter();
  }, [applyLogFilter]);

  async function resetLogFilter() {
    setAppliedLogFilter(null);
    setLogCursorByOperation({});
    setAutoLogPollFailures(0);
    setManualLogReloadFailedAt(null);
    setAutoLogPollingFailedAt(null);
    setLogLevel("all");
    setLogFrom("");
    setLogTo("");
    await refresh();
  }

  const loadNewLogs = useCallback(async (mode: "manual" | "auto" = "manual") => {
    if (!appliedLogFilter) {
      return true;
    }
    const operationsInPage = data.operations.slice(historyStartIndex, historyStartIndex + historyPageSize);
    if (operationsInPage.length === 0) return true;

    try {
      setIsApplyingLogFilter(true);
      const incrementalById = await Promise.all(
        operationsInPage.map(async (operation) => ({
          operationId: operation.id,
          response: await fetchOperationLogs(operation.id, appliedLogFilter, {
            after: logCursorByOperation[operation.id] ?? 0,
          }),
        })),
      );

      const newLogsMap = new Map(incrementalById.map((item) => [item.operationId, item.response.logs]));
      const cursorMap = Object.fromEntries(
        incrementalById.map((item) => [item.operationId, item.response.nextCursor]),
      );

      setData((prev) => ({
        ...prev,
        operations: prev.operations.map((operation) => {
          const incoming = newLogsMap.get(operation.id);
          if (!incoming) return operation;

          const merged = [...(operation.logs ?? []), ...incoming];
          const deduped = merged.filter(
            (log, index, array) => index === array.findIndex((item) => item.id === log.id),
          );
          return {
            ...operation,
            logs: deduped,
          };
        }),
      }));
      setLogCursorByOperation((prev) => ({ ...prev, ...cursorMap }));
      if (mode === "manual") {
        setAutoLogPollFailures(0);
        setManualLogReloadFailedAt(null);
      } else {
        setAutoLogPollingFailedAt(null);
      }
      setErrorMessage(null);
      return true;
    } catch {
      const failedAt = new Date().toISOString();
      if (mode === "manual") {
        setManualLogReloadFailedAt(failedAt);
      } else {
        setAutoLogPollingFailedAt(failedAt);
      }
      setErrorMessage(
        mode === "manual" ? "Failed to load new logs." : "Failed to auto-refresh filtered logs.",
      );
      return false;
    } finally {
      setIsApplyingLogFilter(false);
    }
  }, [appliedLogFilter, data.operations, historyPageSize, historyStartIndex, logCursorByOperation]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (appliedLogFilter) {
          const ok = await loadNewLogs("auto");
          setAutoLogPollFailures((count) => (ok ? 0 : Math.min(count + 1, 8)));
          return;
        }

        await refresh();
        setAutoLogPollFailures(0);
        setErrorMessage(null);
      } catch {
        setAutoLogPollFailures((count) => Math.min(count + 1, 8));
        setErrorMessage("Failed to refresh session detail.");
      }
    }, nextPollDelayMs);

    return () => clearTimeout(timer);
  }, [appliedLogFilter, loadNewLogs, nextPollDelayMs, refresh]);

  return (
    <div className="space-y-4">
      <section className="rounded border border-black/10 p-3 text-sm text-black/80">
        <p>workspace: {data.session.workspaceId}</p>
        <p>cwd: {data.session.cwd}</p>
        <p>status: {data.session.status}</p>
      </section>

      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}

      <SessionDetailConsole
        initialOperation={
          latestOperation
            ? {
                id: latestOperation.id,
                status: latestOperation.status,
                resultText: latestOperation.resultText,
              }
            : null
        }
      />

      <SessionTurnComposer disabled={submittingTurn} onSubmit={handleTurnSubmit} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Operation History</h2>
        {data.operations.length === 0 ? (
          <p className="text-sm text-black/60">No operations yet.</p>
        ) : (
          <>
            <div className="grid gap-2 rounded border border-black/10 p-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs text-black/70">
                <span>Log Level</span>
                <select
                  className="w-full rounded border border-black/20 px-2 py-1 text-sm"
                  value={logLevel}
                  onChange={(event) => setLogLevel(event.target.value as "all" | "info" | "error")}
                  aria-label="Log Level"
                >
                  <option value="all">all</option>
                  <option value="info">info</option>
                  <option value="error">error</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-black/70">
                <span>Log From</span>
                <input
                  className="w-full rounded border border-black/20 px-2 py-1 text-sm"
                  type="datetime-local"
                  value={logFrom}
                  onChange={(event) => setLogFrom(event.target.value)}
                  aria-label="Log From"
                />
              </label>
              <label className="space-y-1 text-xs text-black/70">
                <span>Log To</span>
                <input
                  className="w-full rounded border border-black/20 px-2 py-1 text-sm"
                  type="datetime-local"
                  value={logTo}
                  onChange={(event) => setLogTo(event.target.value)}
                  aria-label="Log To"
                />
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50"
                  onClick={applyLogFilter}
                  disabled={isApplyingLogFilter}
                >
                  Apply Log Filter
                </button>
                <button
                  type="button"
                  className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50"
                  onClick={resetLogFilter}
                  disabled={isApplyingLogFilter}
                >
                  Reset Log Filter
                </button>
                <button
                  type="button"
                  className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50"
                  onClick={() => loadNewLogs("manual")}
                  disabled={isApplyingLogFilter || !appliedLogFilter}
                >
                  Load New Logs
                </button>
              </div>
            </div>
            <div
              className="space-y-1 rounded border border-black/10 bg-black/[0.02] p-2 text-xs text-black/70"
              aria-label="Log Polling Status"
            >
              <p>Filter active: {appliedLogFilter ? "yes" : "no"}</p>
              <p>Auto retry count: {autoLogPollFailures}</p>
              <p>Next poll delay: {nextPollDelayMs}ms</p>
              {manualLogReloadFailedAt ? (
                <p className="text-red-700">Manual log reload failed at: {manualLogReloadFailedAt}</p>
              ) : null}
              {autoLogPollingFailedAt ? (
                <p className="text-red-700">Auto log polling failed at: {autoLogPollingFailedAt}</p>
              ) : null}
              {visibleOperations.map((operation) => (
                <p key={operation.id}>Cursor {operation.id}: {logCursorByOperation[operation.id] ?? 0}</p>
              ))}
            </div>
            <ul className="space-y-2">
              {visibleOperations.map((operation) => (
                <li key={operation.id} className="space-y-2 rounded border border-black/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{operation.id}</p>
                    <span className="rounded bg-black/5 px-2 py-1 text-xs uppercase tracking-wide">
                      {operation.status}
                    </span>
                  </div>
                  <p className="text-sm text-black/80">{operation.requestText}</p>
                  {operation.resultText ? (
                    <p className="text-sm text-emerald-800">result: {operation.resultText}</p>
                  ) : null}
                  {operation.errorMessage ? (
                    <p className="text-sm text-red-700">error: {operation.errorMessage}</p>
                  ) : null}
                  <p className="text-xs text-black/60">
                    updated: {new Date(operation.updatedAt).toLocaleString()}
                  </p>
                  {operation.logs && operation.logs.length > 0 ? (
                    <div className="space-y-1 rounded bg-black/[0.03] p-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-black/60">
                        logs
                      </p>
                      <ul className="space-y-1">
                        {operation.logs.map((log) => (
                          <li
                            key={log.id}
                            className={
                              log.level === "error"
                                ? "text-xs text-red-700"
                                : "text-xs text-black/70"
                            }
                          >
                            {log.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {totalHistoryPages > 1 ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50"
                  onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                  disabled={historyPage === 1}
                >
                  Previous
                </button>
                <p className="text-sm text-black/70">
                  Page {historyPage} of {totalHistoryPages}
                </p>
                <button
                  type="button"
                  className="rounded border border-black/20 px-2 py-1 text-sm disabled:opacity-50"
                  onClick={() => setHistoryPage((page) => Math.min(totalHistoryPages, page + 1))}
                  disabled={historyPage === totalHistoryPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {pendingApprovals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Approval Queue</h2>
          {pendingApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              id={approval.id}
              prompt={approval.prompt}
              status={approval.status}
              disabled={submittingApprovalId === approval.id}
              onDecision={(decision) => handleDecision(approval.id, decision)}
            />
          ))}
        </section>
      ) : (
        <p className="text-sm text-black/60">No pending approvals.</p>
      )}
    </div>
  );
}
