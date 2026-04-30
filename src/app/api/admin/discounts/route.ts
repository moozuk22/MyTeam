import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const discounts = await prisma.partnerDiscount.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(discounts);
  } catch (error) {
    console.error("Fetch discounts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const discount = await prisma.partnerDiscount.create({
      data: {
        name: body.name,
        logoUrl: body.logoUrl,
        badgeText: body.badgeText,
        description: body.description,
        code: body.code,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        storeUrl: body.storeUrl,
        terms: body.terms || [],
      },
    });
    return NextResponse.json(discount);
  } catch (error) {
    console.error("Create discount error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;
    const discount = await prisma.partnerDiscount.update({
      where: { id },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        badgeText: data.badgeText,
        description: data.description,
        code: data.code,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        storeUrl: data.storeUrl,
        terms: data.terms || [],
      },
    });
    return NextResponse.json(discount);
  } catch (error) {
    console.error("Update discount error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.partnerDiscount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete discount error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
