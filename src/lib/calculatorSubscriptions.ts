import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { amountCents, isDate, isMonth, localToday, money, nextMonth, SubscriptionError, UUID_PATTERN } from './clubSubscriptionDomain';
import { calculatorHasAccess, calculatorMode, calculatorPrice, calculatorPurchase, type CalculatorAccess, type CalculatorGrant, type CalculatorPrice } from './calculatorSubscriptionDomain';
import { financeDayStart } from './clubFinanceDomain';
import { deliverSubscriptionNotification, saveSubscriptionNotification } from './clubSubscriptions';
type Tx = Omit<typeof prisma, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use">;
const include = {
  prices: true,
  grants: {
    orderBy: {
      startsAt: 'asc' as const
    }
  },
  payments: {
    orderBy: {
      createdAt: 'desc' as const
    }
  },
  changes: {
    orderBy: {
      createdAt: 'desc' as const
    }
  }
};
const grantView = (g: {
  id: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
  paymentId: string | null;
  amount: Prisma.Decimal | null;
}): CalculatorGrant => ({
  ...g,
  startsAt: g.startsAt.toISOString(),
  endsAt: g.endsAt?.toISOString() ?? null,
  revokedAt: g.revokedAt?.toISOString() ?? null,
  amount: g.amount?.toFixed(2) ?? null
});
export async function calculatorPrices(tx: Tx = prisma): Promise<CalculatorPrice[]> {
  return (await tx.calculatorPriceRevision.findMany({
    orderBy: {
      effectiveMonth: 'asc'
    }
  })).map(p => ({
    ...p,
    monthly: p.monthly?.toFixed(2) ?? null,
    yearly: p.yearly?.toFixed(2) ?? null,
    lifetime: p.lifetime?.toFixed(2) ?? null
  }));
}
export async function calculatorAdminView(clubId: string, tx: Tx = prisma) {
  const stored = await tx.clubCalculatorSubscription.findUnique({
    where: {
      clubId
    },
    include
  });
  return calculatorAdminSnapshot(stored);
}
function calculatorAdminSnapshot(stored: Prisma.ClubCalculatorSubscriptionGetPayload<{
  include: typeof include;
}> | null) {
  return {
    freeEnabled: stored?.freeEnabled ?? false,
    version: stored?.version ?? 0,
    billingMode: calculatorMode(stored?.billingMode ?? 'monthly'),
    prices: stored?.prices.map(p => ({
      ...p,
      amount: p.amount?.toFixed(2) ?? null
    })) ?? [],
    grants: stored?.grants.map(grantView) ?? [],
    payments: stored?.payments.map(p => ({
      ...p,
      total: p.total.toFixed(2),
      createdAt: p.createdAt.toISOString(),
      voidedAt: p.voidedAt?.toISOString() ?? null
    })) ?? [],
    changes: stored?.changes.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString()
    })) ?? []
  };
}
export async function listCalculatorSubscriptions(clubIds: string[]) {
  const stored = await prisma.clubCalculatorSubscription.findMany({
    where: {
      clubId: {
        in: clubIds
      }
    },
    include
  });
  return new Map(clubIds.map(id => [id, calculatorAdminSnapshot(stored.find(s => s.clubId === id) ?? null)]));
}
export type CalculatorAdminView = Awaited<ReturnType<typeof calculatorAdminView>>;
export async function calculatorAccess(clubId: string, admin = false, tx: Tx = prisma): Promise<CalculatorAccess> {
  const [stored, prices] = await Promise.all([tx.clubCalculatorSubscription.findUnique({
    where: {
      clubId
    },
    include: {
      prices: true,
      grants: true
    }
  }), calculatorPrices(tx)]);
  const billingMode = calculatorMode(stored?.billingMode ?? 'monthly');
  const grants = stored?.grants.map(grantView) ?? [];
  const enabled = calculatorHasAccess(grants);
  return {
    enabled,
    canView: admin || enabled,
    billingMode,
    price: calculatorPrice(prices, stored?.prices.map(p => ({
      ...p,
      amount: p.amount?.toFixed(2) ?? null
    })) ?? [], billingMode, localToday().slice(0, 7)),
    periods: grants.filter(g => !g.revokedAt).map(({
      kind,
      startsAt,
      endsAt
    }) => ({
      kind,
      startsAt,
      endsAt
    }))
  };
}
function uuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new SubscriptionError('Невалиден идентификатор.');
}
function positive(value: unknown) {
  const cents = amountCents(value);
  if (cents <= 0) throw new SubscriptionError('Цената трябва да е положителна.');
  return money(cents);
}
export async function changeCalculatorPrices(body: Record<string, unknown>, actorId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(31012026)`;
    const previous = await tx.calculatorPriceRevision.findFirst({
      orderBy: {
        revision: 'desc'
      }
    });
    if ((body.expectedRevision ?? null) !== (previous?.id ?? null)) throw new SubscriptionError('Цените са променени. Обновете страницата.', 409);
    if (!isMonth(body.effectiveMonth)) throw new SubscriptionError('Невалиден месец.');
    const billingMode = calculatorMode(body.billingMode);
    const amount = positive(body.amount);
    const previousForMode = await tx.calculatorPriceRevision.findFirst({where:{billingMode},orderBy:{revision:'desc'}});
    // Each billing option can be configured independently for the first time.
    if (previousForMode && body.effectiveMonth < nextMonth(localToday().slice(0, 7))) throw new SubscriptionError('Изберете бъдещ месец.');
    if (await tx.calculatorPriceRevision.findUnique({
      where: {
        effectiveMonth_billingMode: {effectiveMonth: body.effectiveMonth, billingMode}
      }
    })) throw new SubscriptionError('Вече има промяна за този месец.', 409);
    await tx.calculatorPriceRevision.create({
      data: {
        effectiveMonth: body.effectiveMonth,
        billingMode,
        monthly: billingMode === 'monthly' ? amount : null,
        yearly: billingMode === 'yearly' ? amount : null,
        lifetime: billingMode === 'lifetime' ? amount : null,
        actorId
      }
    });
    return {
      ok: true
    };
  });
}
export async function changeCalculatorSubscription(clubId: string, body: Record<string, unknown>, actorId: string) {
  uuid(clubId);
  const notice = await prisma.$transaction(async tx => {
    // Serialize price revisions with payment quotations; lock order is global then club.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(31012026)`;
    const rows = await tx.$queryRaw<{
      id: string;
    }[]>`SELECT id FROM clubs WHERE id=${clubId}::uuid FOR UPDATE`;
    if (!rows.length) throw new SubscriptionError('Клубът не е намерен.', 404);
    const club = await tx.club.findUniqueOrThrow({
      where: {
        id: clubId
      },
      select: {
        billingStatus: true,
        platformSubscription: true
      }
    });
    if (club.billingStatus !== 'active' || !club.platformSubscription) throw new SubscriptionError('Първо активирайте клуба.', 409);
    const stored = await tx.clubCalculatorSubscription.findUnique({
      where: {
        clubId
      },
      include
    });
    const mode = calculatorMode(stored?.billingMode ?? 'monthly');
    let request: Prisma.InputJsonObject | undefined;
    if (body.action === 'payment') {
      uuid(body.paymentId);
      if (!isDate(body.paidOn) || body.paidOn > localToday()) throw new SubscriptionError('Невалидна дата на плащане.');
      if (body.note != null && (typeof body.note !== 'string' || body.note.length > 1000)) throw new SubscriptionError('Бележката може да е до 1000 символа.');
      if (!Array.isArray(body.months) || !body.months.every(isMonth)) throw new SubscriptionError('Невалидни месеци.');
      request = {
        months: [...body.months].sort(),
        paidOn: body.paidOn,
        note: typeof body.note === 'string' ? body.note.trim() || null : null,
        expectedTotal: money(amountCents(body.expectedTotal, 12))
      };
      const prior = await tx.clubCalculatorPayment.findUnique({
        where: {
          id: body.paymentId
        }
      });
      if (prior) {
        const old = prior.request as Record<string, unknown>;
        if (prior.clubId !== clubId || prior.createdBy !== actorId || Object.keys(request).some(k => JSON.stringify(old[k]) !== JSON.stringify(request![k]))) throw new SubscriptionError('Идентификаторът вече е използван.', 409);
        return null;
      }
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion !== (stored?.version ?? 0)) throw new SubscriptionError('Данните са променени. Обновете страницата.', 409);
    await tx.clubCalculatorSubscription.upsert({
      where: {
        clubId
      },
      create: {
        clubId
      },
      update: {}
    });
    let description = '';
    let details: Prisma.InputJsonValue = {};
    const now = new Date();
    if (body.action === 'configure') {
      const billingMode = calculatorMode(body.billingMode);
      if (club.platformSubscription.mode === 'contract') throw new SubscriptionError('Калкулаторът се включва по договор.');
      await tx.clubCalculatorSubscription.update({
        where: {
          clubId
        },
        data: {
          billingMode
        }
      });
      details = {
        before: mode,
        billingMode
      };
    } else if (body.action === 'price') {
      const billingMode = calculatorMode(body.billingMode);
      if (!isMonth(body.effectiveMonth)) throw new SubscriptionError('Невалиден месец.');
      if (stored?.prices.some(p => p.billingMode === billingMode) && body.effectiveMonth < nextMonth(localToday().slice(0, 7))) throw new SubscriptionError('Изберете бъдещ месец.');
      const amount = body.amount === null ? null : positive(body.amount);
      await tx.clubCalculatorPrice.upsert({
        where: {
          clubId_billingMode_effectiveMonth: {
            clubId,
            billingMode,
            effectiveMonth: body.effectiveMonth
          }
        },
        create: {
          clubId,
          billingMode,
          effectiveMonth: body.effectiveMonth,
          amount
        },
        update: {
          amount
        }
      });
      details = {
        billingMode,
        effectiveMonth: body.effectiveMonth,
        amount
      };
    } else if (body.action === 'grant') {
      if (typeof body.enabled !== 'boolean') throw new SubscriptionError('Невалиден статус.');
      const kind = club.platformSubscription.mode === 'contract' ? 'contract' : 'trial';
      if (body.enabled && kind === 'trial' && (club.platformSubscription.mode !== 'trial' || club.platformSubscription.trialEndDate && club.platformSubscription.trialEndDate < localToday())) throw new SubscriptionError('Клубът няма активен пробен период.');
      const active = stored?.grants.filter(g => g.kind === kind && !g.revokedAt && (!g.endsAt || g.endsAt > now)) ?? [];
      if (body.enabled === stored?.freeEnabled && (body.enabled ? active.length > 0 : true)) return null;
      await tx.clubCalculatorSubscription.update({
        where: {
          clubId
        },
        data: {
          freeEnabled: body.enabled
        }
      });
      if (body.enabled) {
        const end = kind === 'trial' && club.platformSubscription.trialEndDate ? financeDayStart(nextDay(club.platformSubscription.trialEndDate)) : null;
        await tx.clubCalculatorGrant.create({
          data: {
            clubId,
            kind,
            startsAt: now,
            endsAt: end
          }
        });
      } else {
        await tx.clubCalculatorGrant.updateMany({
          where: {
            id: {
              in: active.map(g => g.id)
            }
          },
          data: {
            endsAt: now
          }
        });
      }
      description = body.enabled ? kind === 'contract' ? 'Калкулаторът е включен по договор.' : 'Калкулаторът е включен за пробния период на клуба.' : 'Безплатният достъп до калкулатора е спрян.';
      details = {
        kind,
        enabled: body.enabled
      };
    } else if (body.action === 'payment' && request) {
      if (club.platformSubscription.mode === 'contract') throw new SubscriptionError('Плащането се управлява по договор.');
      const prices = await calculatorPrices(tx);
      const overrides = stored?.prices.map(p => ({
        ...p,
        amount: p.amount?.toFixed(2) ?? null
      })) ?? [];
      const purchase = calculatorPurchase(mode, request.months, prices, overrides);
      if (purchase.total !== request.expectedTotal) throw new SubscriptionError('Цената е променена. Обновете страницата.', 409);
      const periods = purchase.periods.map(p => ({
        ...p,
        startsAt: financeDayStart(`${p.month}-01`),
        endsAt: p.end ? financeDayStart(`${p.end}-01`) : null
      }));
      const cancelledOverlap = stored?.grants.some(g => g.kind === 'paid' && g.revokedAt && stored.payments.some(payment => payment.id === g.paymentId && payment.voidedAt) && periods.some(p => (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)));
      if (cancelledOverlap) throw new SubscriptionError('Възстановете анулираното плащане от историята, вместо да записвате второ за същия период.', 409);
      if (periods.some(p => stored?.grants.some(g => g.kind === 'paid' && !g.revokedAt && (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)))) throw new SubscriptionError('Периодът вече е платен.', 409);
      await tx.clubCalculatorPayment.create({
        data: {
          id: body.paymentId as string,
          clubId,
          billingMode: mode,
          paidOn: request.paidOn as string,
          note: request.note as string | null,
          total: purchase.total,
          request,
          createdBy: actorId,
          grants: {
            create: periods.map(p => ({
              clubId,
              kind: 'paid',
              startsAt: p.startsAt,
              endsAt: p.endsAt,
              amount: p.amount
            }))
          }
        }
      });
      await tx.$executeRaw`SELECT backfill_calculator_revenue(${clubId}::uuid,${body.paymentId as string}::uuid)`;
      description = `Получено плащане за калкулатора: ${purchase.total} EUR на ${request.paidOn}. Периоди: ${purchase.periods.map(p => `${p.month} → ${p.end ?? 'безсрочно'}`).join(', ')}.`;
      details = {
        paymentId: body.paymentId as string,
        ...request,
        billingMode: mode
      };
    } else if (body.action === 'restore') {
      uuid(body.paymentId);
      if (club.platformSubscription.mode === 'contract') throw new SubscriptionError('Плащането се управлява по договор.');
      const payment = stored?.payments.find(p => p.id === body.paymentId);
      if (!payment) throw new SubscriptionError('Плащането не е намерено.', 404);
      if (!payment.voidedAt) return null;
      const cancelledAt = payment.voidedAt.toISOString();
      const periods = stored!.grants.filter(g => g.paymentId === payment.id && g.kind === 'paid');
      if (!periods.length) throw new SubscriptionError('Липсват периоди за това плащане.', 409);
      if (periods.some(p => stored!.grants.some(g => g.kind === 'paid' && g.paymentId !== payment.id && !g.revokedAt && (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)))) throw new SubscriptionError('Периодът вече е платен.', 409);
      await tx.clubCalculatorPayment.update({where: {id: payment.id}, data: {voidedAt: null, voidedBy: null}});
      await tx.clubCalculatorGrant.updateMany({where: {paymentId: payment.id}, data: {revokedAt: null}});
      await tx.$executeRaw`SELECT backfill_calculator_revenue(${clubId}::uuid,${payment.id}::uuid)`;
      description = `Възстановено плащане за калкулатора от ${payment.paidOn}: ${payment.total.toFixed(2)} EUR. Запазени са първоначалната сума и периодите на достъп.`;
      details = {paymentId: payment.id, total: payment.total.toFixed(2), paidOn: payment.paidOn, cancelledAt};
    } else if (body.action === 'void') {
      uuid(body.paymentId);
      const payment = stored?.payments.find(p => p.id === body.paymentId);
      if (!payment) throw new SubscriptionError('Плащането не е намерено.', 404);
      if (payment.voidedAt) return null;
      await tx.clubCalculatorPayment.update({
        where: {
          id: payment.id
        },
        data: {
          voidedAt: now,
          voidedBy: actorId
        }
      });
      await tx.clubCalculatorGrant.updateMany({
        where: {
          paymentId: payment.id
        },
        data: {
          revokedAt: now
        }
      });
      description = `Анулирано плащане за калкулатора от ${payment.paidOn}: ${payment.total.toFixed(2)} EUR. Финансовата история е запазена.`;
      details = {
        paymentId: payment.id,
        total: payment.total.toFixed(2),
        paidOn: payment.paidOn
      };
    } else throw new SubscriptionError('Невалидно действие.');
    await tx.clubCalculatorSubscription.update({
      where: {
        clubId
      },
      data: {
        version: {
          increment: 1
        },
        changes: {
          create: {
            actorId,
            action: String(body.action),
            details
          }
        }
      }
    });
    if (body.action === 'configure' || body.action === 'price') return null;
    const notification = {
      title: 'Финансов калкулатор',
      body: description,
      url: `/admin/members?clubId=${clubId}`
    };
    await saveSubscriptionNotification(tx, clubId, notification);
    return notification;
  }, {
    timeout: 30000
  });
  return deliverSubscriptionNotification(clubId, notice);
}
function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
