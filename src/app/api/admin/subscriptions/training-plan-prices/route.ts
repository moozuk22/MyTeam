import { hasTrustedOrigin } from "@/lib/requestOrigin";
import { NextRequest, NextResponse } from 'next/server';
import { trainingPlanPrices, changeTrainingPlanPrices } from '@/lib/trainingPlanSubscriptions';
import { subscriptionAdmin, subscriptionApiError } from '@/lib/clubSubscriptionApi';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  try {
    const [prices, latest] = await Promise.all([trainingPlanPrices(), prisma.trainingPlanPriceRevision.findFirst({
      orderBy: {
        revision: 'desc'
      },
      select: {
        id: true
      }
    })]);
    return NextResponse.json({
      prices,
      revision: latest?.id ?? null
    });
  } catch (error) {
    return subscriptionApiError(error);
  }
}
export async function POST(request: NextRequest) {
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
    return NextResponse.json(await changeTrainingPlanPrices(body as Record<string, unknown>, auth.session!.sub));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
