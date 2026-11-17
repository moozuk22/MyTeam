import { NextRequest, NextResponse } from "next/server";
import { authorizeTraining } from "@/lib/exercise/access";
import { trainingPlanCapabilities } from "@/lib/trainingPlanSubscriptions";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  return NextResponse.json(await trainingPlanCapabilities(id, session.roles), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
