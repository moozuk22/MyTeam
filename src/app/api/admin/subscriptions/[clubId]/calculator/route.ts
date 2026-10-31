import { NextRequest, NextResponse } from 'next/server';
import { calculatorAdminView, changeCalculatorSubscription } from '@/lib/calculatorSubscriptions';
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
    error: 'Invalid club'
  }, {
    status: 400
  });
  try {
    return NextResponse.json(await calculatorAdminView(clubId));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
export async function POST(request: NextRequest, {
  params
}: Context) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({
    error: 'Forbidden'
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
    return NextResponse.json(await changeCalculatorSubscription((await params).clubId, body as Record<string, unknown>, auth.session!.sub));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
