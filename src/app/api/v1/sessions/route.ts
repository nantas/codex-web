import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionRequestSchema } from "@/server/contracts/api";
import { prisma } from "@/server/db/prisma";
import { SessionService } from "@/server/services/session-service";
import { getRequestGithubId } from "@/server/http/auth";
import { HttpError, toErrorResponse } from "@/server/http/errors";

const sessionService = new SessionService();

export async function GET() {
  try {
    const sessions = await sessionService.listForConsole();
    return NextResponse.json({ sessions });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const parsed = createSessionRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new HttpError(400, "Invalid session payload");
    }

    const githubId = getRequestGithubId(req);
    const user = await prisma.user.upsert({
      where: { githubId },
      update: {},
      create: { githubId },
    });

    const session = await sessionService.create({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
      cwd: parsed.data.cwd,
      threadId: parsed.data.resumeThreadId ?? `thr_${randomUUID()}`,
      status: "idle",
    });

    return NextResponse.json(
      { sessionId: session.id, status: session.status },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
