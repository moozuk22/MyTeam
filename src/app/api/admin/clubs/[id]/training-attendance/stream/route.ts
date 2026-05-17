import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isIsoDate } from "@/lib/training";
import { subscribeTrainingAttendanceEvents } from "@/lib/trainingAttendanceEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTransientPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeError = error as { code?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  return code === "P1001" || code === "P2024";
}

function parseOptionalTeamGroup(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid teamGroup");
  }
  return parsed;
}

function parseOptionalTrainingGroupId(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = String(raw).trim();
  return value ? value : null;
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const dateParam = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  // date is optional — omit it to subscribe to all club-level attendance updates (week view)
  const trainingDateIso = isIsoDate(dateParam) ? dateParam : null;

  let teamGroup: number | null = null;
  let trainingGroupId: string | null = null;
  if (trainingDateIso) {
    try {
      teamGroup = parseOptionalTeamGroup(request.nextUrl.searchParams.get("teamGroup"));
      trainingGroupId = parseOptionalTrainingGroupId(request.nextUrl.searchParams.get("trainingGroupId"));
    } catch {
      return new Response("Invalid teamGroup or trainingGroupId query parameter", { status: 400 });
    }
    if (teamGroup !== null && trainingGroupId) {
      return new Response("Use either teamGroup or trainingGroupId.", { status: 400 });
    }
  }
  try {
    if (trainingGroupId) {
      const trainingGroup = await prisma.clubTrainingScheduleGroup.findFirst({
        where: {
          id: trainingGroupId,
          clubId: id,
        },
        select: { id: true },
      });
      if (!trainingGroup) {
        return new Response("Training group not found", { status: 404 });
      }
    }

    if (teamGroup !== null) {
      await prisma.player.findFirst({
        where: {
          clubId: id,
          isActive: true,
          teamGroup,
        },
        select: { id: true },
      });
    }

    const club = await prisma.club.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!club) {
      return new Response("Club not found", { status: 404 });
    }
  } catch (error) {
    console.error("Training attendance stream validation error:", error);
    if (isTransientPrismaConnectionError(error)) {
      return new Response("Database temporarily unavailable. Please retry in a few seconds.", {
        status: 503,
      });
    }
    return new Response("Internal Server Error", { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const closeStream = () => {
        if (isClosed) {
          return;
        }
        isClosed = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          // Ignore close errors when the controller is already closed.
        }
      };

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        if (isClosed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closeStream();
        }
      };

      sendEvent("connected", { date: trainingDateIso });

      unsubscribe = subscribeTrainingAttendanceEvents(id, (event) => {
        if (trainingDateIso !== null && event.trainingDate !== trainingDateIso) {
          return;
        }
        sendEvent("attendance-update", { date: event.trainingDate, at: event.timestamp });
      });

      // Keep the connection warm through proxies without database polling.
      keepAlive = setInterval(() => {
        sendEvent("heartbeat", { at: Date.now() });
      }, 30000);

      request.signal.addEventListener("abort", () => {
        closeStream();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
