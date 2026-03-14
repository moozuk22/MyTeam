import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Questions module is not configured in the current database schema", questions: [] },
    { status: 410 }
  );
}
