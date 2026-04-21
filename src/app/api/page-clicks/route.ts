import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    await prisma.pageClick.create({ data: {} });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
  }
}
