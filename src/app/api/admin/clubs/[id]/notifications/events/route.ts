import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { subscribeAdminNotificationEvents } from "@/lib/adminNotificationEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureClubExists(clubId: string) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true },
  });
  return Boolean(club);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: clubId } = await params;
  if (!(await ensureClubExists(clubId))) {
    return new Response(JSON.stringify({ error: "Club not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", clubId, timestamp: Date.now() });

      const unsubscribe = subscribeAdminNotificationEvents(clubId, (event) => {
        send(event);
      });

      const keepAlive = setInterval(() => {
        send({ type: "ping", timestamp: Date.now() });
      }, 30000);

      const abortHandler = () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Ignore close errors after abrupt disconnect.
        }
      };

      request.signal.addEventListener("abort", abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
    },
  });
}
