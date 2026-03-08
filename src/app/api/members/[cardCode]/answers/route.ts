import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;

  try {
    const card = await prisma.card.findUnique({
      where: { cardCode },
      include: {
        member: {
          select: {
            answers: {
              select: {
                questionId: true,
                answer: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ answers: card.member.answers });
  } catch (error) {
    console.error("Error fetching member answers:", error);
    return NextResponse.json({ error: "Failed to fetch answers" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;

  try {
    const body = await request.json();
    const questionId = String(body?.questionId ?? "").trim();
    const answer = String(body?.answer ?? "").trim();

    if (!questionId || !answer) {
      return NextResponse.json({ error: "questionId and answer are required" }, { status: 400 });
    }

    const card = await prisma.card.findUnique({
      where: { cardCode },
      include: {
        member: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, isActive: true },
    });

    if (!question || !question.isActive) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const savedAnswer = await prisma.memberQuestionAnswer.upsert({
      where: {
        memberId_questionId: {
          memberId: card.member.id,
          questionId,
        },
      },
      create: {
        memberId: card.member.id,
        questionId,
        answer,
      },
      update: {
        answer,
      },
    });

    return NextResponse.json({ success: true, answer: savedAnswer });
  } catch (error) {
    console.error("Error saving member answer:", error);
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
  }
}
