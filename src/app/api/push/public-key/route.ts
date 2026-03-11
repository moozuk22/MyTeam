import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("VAPID public key error:", error);
    return NextResponse.json(
      { error: "Push notifications are not configured on the server." },
      { status: 503 }
    );
  }
}
