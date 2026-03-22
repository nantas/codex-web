import { NextResponse } from "next/server";
import { createOperationRequestSchema } from "@/server/contracts/api";
import { OperationService } from "@/server/services/operation-service";
import { HttpError, toErrorResponse } from "@/server/http/errors";

const service = new OperationService();

export async function POST(req: Request) {
  try {
    const parsed = createOperationRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new HttpError(400, "Invalid operation payload");
    }

    const text = parsed.data.input.map((item) => item.text).join("\n");
    const operation = await service.createQueued({
      sessionId: parsed.data.sessionId,
      requestText: text,
    });

    await service.startExecution(operation.id);

    return NextResponse.json(
      { operationId: operation.id, status: "running", pollAfterMs: 1000 },
      { status: 202 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
