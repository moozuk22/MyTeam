import { hasTrustedOrigin } from "@/lib/requestOrigin";
import { NextRequest, NextResponse } from 'next/server';
import { trainingPlanAdminView, changeTrainingPlanSubscription } from '@/lib/trainingPlanSubscriptions';
import { subscriptionAdmin, subscriptionApiError } from '@/lib/clubSubscriptionApi';
import { UUID_PATTERN } from '@/lib/clubSubscriptionDomain';
export const dynamic = 'force-dynamic';
type Context = {
  params: Promise<{
    clubId: string;
  }>;
};
export async function GET(request: NextRequest, {
  params
}: Context) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  const {
    clubId
  } = await params;
  if (!UUID_PATTERN.test(clubId)) return NextResponse.json({
    error: 'Невалиден клуб.'
  }, {
    status: 400
  });
  try {
    return NextResponse.json(await trainingPlanAdminView(clubId));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
export async function POST(request: NextRequest, {
  params
}: Context) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  if (!hasTrustedOrigin(request)) return NextResponse.json({
    error: 'Нямате достъп.'
  }, {
    status: 403
  });
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({
      error: 'Невалидни данни.'
    }, {
      status: 400
    });
    return NextResponse.json(await changeTrainingPlanSubscription((await params).clubId, body as Record<string, unknown>, auth.session!.sub));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
