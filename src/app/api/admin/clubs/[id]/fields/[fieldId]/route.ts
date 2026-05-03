import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PieceInput {
  id: string | null;
  name: string;
}

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

function normalizePieces(raw: unknown): PieceInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item, index) => {
    const value = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
    const id = typeof value.id === "string" && UUID_REGEX.test(value.id.trim()) ? value.id.trim() : null;
    const name = String(value.name ?? "").trim();
    if (!name) {
      throw new Error(`Piece ${index + 1} name is required.`);
    }
    if (name.length > 80) {
      throw new Error(`Piece ${index + 1} name must be at most 80 characters.`);
    }
    return { id, name };
  });
}

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId, fieldId } = await params;
  if (!UUID_REGEX.test(clubId) || !UUID_REGEX.test(fieldId)) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  let name = "";
  let pieces: PieceInput[] = [];
  try {
    name = normalizeFieldName((body as { name?: unknown }).name);
    pieces = normalizePieces((body as { pieces?: unknown }).pieces);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid field." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const field = await tx.field.findFirst({
        where: { id: fieldId, clubId },
        select: {
          id: true,
          pieces: { select: { id: true } },
        },
      });
      if (!field) {
        throw new Error("FIELD_NOT_FOUND");
      }

      const nextExistingIds = new Set(pieces.map((piece) => piece.id).filter((id): id is string => Boolean(id)));
      const removableIds = field.pieces
        .map((piece) => piece.id)
        .filter((id) => !nextExistingIds.has(id));

      await tx.field.update({
        where: { id: fieldId },
        data: { name },
      });

      if (removableIds.length > 0) {
        await tx.fieldPiece.deleteMany({
          where: { id: { in: removableIds }, fieldId },
        });
      }

      for (const [index, piece] of pieces.entries()) {
        if (piece.id) {
          await tx.fieldPiece.updateMany({
            where: { id: piece.id, fieldId },
            data: { name: piece.name, sortOrder: index },
          });
        } else {
          await tx.fieldPiece.create({
            data: { fieldId, name: piece.name, sortOrder: index },
          });
        }
      }

      return tx.field.findUniqueOrThrow({
        where: { id: fieldId },
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "FIELD_NOT_FOUND") {
      return NextResponse.json({ error: "Field not found." }, { status: 404 });
    }
    console.error("Fields PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId, fieldId } = await params;
  if (!UUID_REGEX.test(clubId) || !UUID_REGEX.test(fieldId)) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  const deleted = await prisma.field.deleteMany({
    where: { id: fieldId, clubId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
