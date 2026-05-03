import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeFieldName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name) {
    throw new Error("Field name is required.");
  }
  if (name.length > 80) {
    throw new Error("Field name must be at most 80 characters.");
  }
  return name;
}

function normalizePieceNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((value, index) => {
    const name = String(value ?? "").trim();
    if (!name) {
      throw new Error(`Piece ${index + 1} name is required.`);
    }
    if (name.length > 80) {
      throw new Error(`Piece ${index + 1} name must be at most 80 characters.`);
    }
    return name;
  });
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  const fields = await prisma.field.findMany({
    where: { clubId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      pieces: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
    },
  });

  return NextResponse.json(fields);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  const body = await request.json().catch(() => ({}));

  let name = "";
  let pieces: string[] = [];
  try {
    name = normalizeFieldName((body as { name?: unknown }).name);
    pieces = normalizePieceNames((body as { pieces?: unknown }).pieces);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid field." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true },
      });
      if (!club) {
        throw new Error("CLUB_NOT_FOUND");
      }

      const field = await tx.field.create({
        data: { clubId, name },
        select: { id: true },
      });

      if (pieces.length > 0) {
        await tx.fieldPiece.createMany({
          data: pieces.map((pieceName, index) => ({
            fieldId: field.id,
            name: pieceName,
            sortOrder: index,
          })),
        });
      }

      return tx.field.findUniqueOrThrow({
        where: { id: field.id },
        select: {
          id: true,
          name: true,
          pieces: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, sortOrder: true },
          },
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CLUB_NOT_FOUND") {
      return NextResponse.json({ error: "Club not found." }, { status: 404 });
    }
    console.error("Fields POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
