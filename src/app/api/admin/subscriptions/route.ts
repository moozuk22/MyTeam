import { NextRequest, NextResponse } from "next/server";
import { listCalculatorSubscriptions } from "@/lib/calculatorSubscriptions";
import { listClubSubscriptions } from "@/lib/clubSubscriptions";
import { subscriptionAdmin, subscriptionApiError } from "@/lib/clubSubscriptionApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  try {
    const clubs = await listClubSubscriptions();
    if (!clubs.length) return NextResponse.json(clubs);
    const calculators = await listCalculatorSubscriptions(clubs.map(c => c.id));
    return NextResponse.json(clubs.map(c => ({...c,calculator:calculators.get(c.id)})));
  }
  catch (error) { return subscriptionApiError(error); }
}
