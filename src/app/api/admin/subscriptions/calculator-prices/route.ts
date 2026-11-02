import { NextRequest, NextResponse } from 'next/server';
import { calculatorPrices, changeCalculatorPrices } from '@/lib/calculatorSubscriptions';
import { subscriptionAdmin, subscriptionApiError } from '@/lib/clubSubscriptionApi';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await subscriptionAdmin(request);
  if (auth.error) return auth.error;
  try {
    const [prices, latest] = await Promise.all([calculatorPrices(), prisma.calculatorPriceRevision.findFirst({
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
  const origin = request.headers.get('origin');
  const baseUrl = process.env.APP_BASE_URL?.trim();
  let trustedOrigin: string | null = request.nextUrl.origin;
  if (baseUrl) {
    try {
      const configuredUrl = new URL(baseUrl);
      trustedOrigin = ['http:', 'https:'].includes(configuredUrl.protocol) ? configuredUrl.origin : null;
    } catch {
      trustedOrigin = null;
    }
  }
  if (origin && origin !== trustedOrigin) return NextResponse.json({
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
    return NextResponse.json(await changeCalculatorPrices(body as Record<string, unknown>, auth.session!.sub));
  } catch (error) {
    return subscriptionApiError(error);
  }
}
