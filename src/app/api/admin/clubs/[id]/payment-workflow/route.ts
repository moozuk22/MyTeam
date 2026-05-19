import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_WORKFLOWS = ["calendar_month", "rolling_30_days", "training_credits"] as const;
type PaymentWorkflow = (typeof PAYMENT_WORKFLOWS)[number];

function parsePaymentWorkflow(value: unknown): PaymentWorkflow | null {
  return PAYMENT_WORKFLOWS.includes(value as PaymentWorkflow)
    ? (value as PaymentWorkflow)
    : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!payload.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: clubId } = await params;
    const body = await request.json().catch(() => ({}));
    const paymentWorkflow = parsePaymentWorkflow(
      (body as { paymentWorkflow?: unknown }).paymentWorkflow,
    );

    if (!paymentWorkflow) {
      return NextResponse.json(
        { error: "Invalid paymentWorkflow" },
        { status: 400 },
      );
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });

    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: { paymentWorkflow },
      select: {
        id: true,
        paymentWorkflow: true,
      },
    });

    return NextResponse.json({ club: updatedClub });
  } catch (error) {
    console.error("Payment workflow update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
