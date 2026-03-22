import { prisma } from "@/server/db/prisma";

type CreateSessionInput = {
  userId: string;
  workspaceId: string;
  cwd: string;
  threadId: string;
  status?: string;
};

export type SessionListItem = {
  id: string;
  status: string;
  workspaceId: string;
  cwd: string;
  updatedAt: Date;
  pendingApprovals: number;
  latestOperation: {
    id: string;
    status: string;
  } | null;
};

export class SessionService {
  async create(input: CreateSessionInput) {
    return prisma.session.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        cwd: input.cwd,
        threadId: input.threadId,
        status: input.status ?? "idle",
      },
    });
  }

  async getById(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  }

  async listForConsole(): Promise<SessionListItem[]> {
    const sessions = await prisma.session.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        operations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            approvals: {
              where: { status: "pending" },
              select: { id: true },
            },
          },
        },
      },
    });

    return sessions.map((session) => {
      const latestOperation = session.operations[0]
        ? {
            id: session.operations[0].id,
            status: session.operations[0].status,
          }
        : null;
      const pendingApprovals = session.operations.reduce(
        (total, operation) => total + operation.approvals.length,
        0,
      );

      return {
        id: session.id,
        status: session.status,
        workspaceId: session.workspaceId,
        cwd: session.cwd,
        updatedAt: session.updatedAt,
        pendingApprovals,
        latestOperation,
      };
    });
  }

  async getDetailForConsole(sessionId: string) {
    return prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        operations: {
          orderBy: { createdAt: "desc" },
          include: {
            approvals: {
              orderBy: { createdAt: "desc" },
            },
            logs: {
              orderBy: { id: "desc" },
              take: 20,
            },
          },
        },
      },
    });
  }
}
