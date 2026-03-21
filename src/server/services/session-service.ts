import { prisma } from "@/server/db/prisma";

type CreateSessionInput = {
  userId: string;
  workspaceId: string;
  cwd: string;
  threadId: string;
  status?: string;
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
}
