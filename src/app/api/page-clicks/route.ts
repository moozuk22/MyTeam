import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    await prisma.pageClick.create({ data: { action } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error recording click:", err);
    return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const clicks = await prisma.pageClick.groupBy({
      by: ['action'],
      _count: {
        action: true,
      },
    });
    return NextResponse.json({ success: true, clicks });
  } catch {
    return NextResponse.json({ error: "Failed to fetch clicks" }, { status: 500 });
  }
}
