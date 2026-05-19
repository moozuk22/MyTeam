import { NextRequest, NextResponse } from "next/server";
import { runDailyBirthdayNotifications } from "@/lib/jobs/dailyBirthdayNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret) {
    return headerSecret;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

async function handleCron(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "Missing CRON_SECRET configuration." },
      { status: 500 }
    );
  }

  const providedSecret = extractSecret(request);
  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyBirthdayNotifications(new Date());
    return NextResponse.json(result);
  } catch (error) {
    console.error("Daily birthday notifications cron error:", error);
    return NextResponse.json(
      { error: "Failed to run daily birthday notifications job." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}
