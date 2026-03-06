import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  // 1. Verify admin session
  const cookieHeader = request.headers.get("cookie");
  const cookies = cookieHeader
    ? Object.fromEntries(cookieHeader.split("; ").map((c) => c.split("=")))
    : {};
  const token = cookies["admin_session"];

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { firstName, secondName, visitsTotal } = await request.json();

    if (!firstName || !secondName) {
      return NextResponse.json(
        { error: "First name and second name are required" },
        { status: 400 }
      );
    }

    // Generate a unique card code (e.g., 8 character hex string)
    const cardCode = randomBytes(4).toString("hex").toUpperCase();

    // Use Prisma nested write to create member and card together
    const newMember = await prisma.member.create({
      data: {
        firstName,
        secondName,
        visitsTotal: visitsTotal || 0,
        visitsUsed: 0,
        card: {
          create: {
            cardCode,
            isActive: false, // Required: new cards start inactive
          },
        },
      },
      include: {
        card: true,
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Member creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
    // Verify admin session
    const cookieHeader = request.headers.get("cookie");
    const cookies = cookieHeader
      ? Object.fromEntries(cookieHeader.split("; ").map((c) => c.split("=")))
      : {};
    const token = cookies["admin_session"];
  
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const members = await prisma.member.findMany({
            include: {
                card: true
            },
            orderBy: {
                firstName: 'asc'
            }
        });
        return NextResponse.json(members);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
