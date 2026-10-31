import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';
import { financeId, getClubFinance, getClubFinanceAnalysis, mutateClubFinance } from '@/lib/clubFinance';
import { calculatorAccess } from '@/lib/calculatorSubscriptions';
import { FinanceError } from '@/lib/clubFinanceDomain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    const token = request.cookies.get('admin_session')?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = financeId((await context.params).id);
    if (request.nextUrl.searchParams.has('coachGroupId') || (!session.roles.includes('admin') && session.defaultClubId && session.defaultClubId !== id)) return NextResponse.json({ error: 'Нямате достъп до финансите на този клуб.' }, { status: 403 });
    const access = await calculatorAccess(id, session.roles.includes('admin'));
    const duesPreview = !write && request.nextUrl.searchParams.get('view') === 'dues';
    if ((!access.canView && !duesPreview) || (write && !access.enabled)) return NextResponse.json({ error: 'Финансовият калкулатор не е активиран за този клуб.', code: 'CALCULATOR_LOCKED' }, { status: 403 });
    if (write) {
      const origin = request.headers.get('origin');
      if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      let body: unknown;
      try { body = await request.json(); } catch { throw new FinanceError('Невалидна заявка.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FinanceError('Невалидна заявка.');
      return NextResponse.json(await mutateClubFinance(id, body as Record<string, unknown>));
    }
    if (request.nextUrl.searchParams.get('view') === 'analysis') return NextResponse.json(await getClubFinanceAnalysis(id));
    return NextResponse.json(await getClubFinance(id,request.nextUrl.searchParams));
  } catch (error) {
    if (error instanceof FinanceError) return NextResponse.json({ error: error.message, ...(error.status === 403 ? {code:'CALCULATOR_LOCKED'} : {}) }, { status: error.status });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Вече има категория с това име.' }, { status: 409 });
    console.error('Club finance error',error);
    return NextResponse.json({ error: 'Финансите не могат да бъдат обработени. Опитайте отново.' }, { status: 500 });
  }
}
export function GET(request: NextRequest, context: Context) { return handle(request,context,false); }
export function POST(request: NextRequest, context: Context) { return handle(request,context,true); }
