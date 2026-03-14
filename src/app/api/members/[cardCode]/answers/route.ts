import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  return NextResponse.json(
    {
      error: "Answers module is not configured in the current database schema",
      cardCode,
      answers: [],
    },
    { status: 410 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  void request;
  return NextResponse.json(
    {
      error: "Answers module is not configured in the current database schema",
      cardCode,
    },
    { status: 410 }
  );
}
