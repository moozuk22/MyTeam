import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';
import { calculatorAccess } from '@/lib/calculatorSubscriptions';
import { getClubDebtSummary } from '@/lib/clubFinance';
import { UUID_PATTERN } from '@/lib/clubSubscriptionDomain';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, {
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const token = request.cookies.get('admin_session')?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) return NextResponse.json({
    error: 'Unauthorized'
  }, {
    status: 401
  });
  const {
    id
  } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({
    error: 'Invalid club'
  }, {
    status: 400
  });
  const admin = session.roles.includes('admin');
  if (request.nextUrl.searchParams.has('coachGroupId')) return NextResponse.json({
    error: 'Forbidden'
  }, {
    status: 403
  });
  try {
    const [access, debtSummary] = await Promise.all([calculatorAccess(id, admin), getClubDebtSummary(id)]);
    return NextResponse.json({...access, debtSummary});
  } catch (error) {
    console.error('Calculator access failed', error);
    return NextResponse.json({
      error: 'Достъпът не може да бъде проверен.'
    }, {
      status: 500
    });
  }
}
