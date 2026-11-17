import { trainingPlanAccess as accessPolicy } from "./trainingPlanSubscriptionDomain";
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { amountCents, isDate, isMonth, localToday, money, nextMonth, SubscriptionError, UUID_PATTERN } from './clubSubscriptionDomain';
import { calculatorMode as trainingPlanMode, calculatorPurchase as trainingPlanPurchase, type CalculatorGrant as TrainingPlanGrant, type CalculatorPrice as TrainingPlanPrice } from './calculatorSubscriptionDomain';
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
}): TrainingPlanGrant => ({
  ...g,
  startsAt: g.startsAt.toISOString(),
  endsAt: g.endsAt?.toISOString() ?? null,
  revokedAt: g.revokedAt?.toISOString() ?? null,
  amount: g.amount?.toFixed(2) ?? null
});
export async function trainingPlanPrices(tx: Tx = prisma): Promise<TrainingPlanPrice[]> {
  return (await tx.trainingPlanPriceRevision.findMany({
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
export async function trainingPlanAdminView(clubId: string, tx: Tx = prisma) {
  const stored = await tx.clubTrainingPlanSubscription.findUnique({
    where: {
      clubId
    },
    include
  });
  return trainingPlanAdminSnapshot(stored);
}
function trainingPlanAdminSnapshot(stored: Prisma.ClubTrainingPlanSubscriptionGetPayload<{
  include: typeof include;
}> | null) {
  return {
    freeEnabled: stored?.freeEnabled ?? false,
    version: stored?.version ?? 0,
    billingMode: trainingPlanMode(stored?.billingMode ?? 'monthly'),
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
export async function listTrainingPlanSubscriptions(clubIds: string[]) {
  const stored = await prisma.clubTrainingPlanSubscription.findMany({
    where: {
      clubId: {
        in: clubIds
      }
    },
    include
  });
  return new Map(clubIds.map(id => [id, trainingPlanAdminSnapshot(stored.find(s => s.clubId === id) ?? null)]));
}
export type TrainingPlanAdminView = Awaited<ReturnType<typeof trainingPlanAdminView>>;
function uuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new SubscriptionError('Невалиден идентификатор.');
}
function positive(value: unknown) {
  const cents = amountCents(value);
  if (cents <= 0) throw new SubscriptionError('Цената трябва да е положителна.');
  return money(cents);
}
export async function changeTrainingPlanPrices(body: Record<string, unknown>, actorId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(17112026)`;
    const previous = await tx.trainingPlanPriceRevision.findFirst({
      orderBy: {
        revision: 'desc'
      }
    });
    if ((body.expectedRevision ?? null) !== (previous?.id ?? null)) throw new SubscriptionError('Цените са променени. Обновете страницата.', 409);
    if (!isMonth(body.effectiveMonth)) throw new SubscriptionError('Невалиден месец.');
    const billingMode = trainingPlanMode(body.billingMode);
    const amount = positive(body.amount);
    const previousForMode = await tx.trainingPlanPriceRevision.findFirst({where:{billingMode},orderBy:{revision:'desc'}});
    // Each billing option can be configured independently for the first time.
    if (previousForMode && body.effectiveMonth < nextMonth(localToday().slice(0, 7))) throw new SubscriptionError('Изберете бъдещ месец.');
    if (await tx.trainingPlanPriceRevision.findUnique({
      where: {
        effectiveMonth_billingMode: {effectiveMonth: body.effectiveMonth, billingMode}
      }
    })) throw new SubscriptionError('Вече има промяна за този месец.', 409);
    await tx.trainingPlanPriceRevision.create({
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
export async function changeTrainingPlanSubscription(clubId: string, body: Record<string, unknown>, actorId: string) {
  uuid(clubId);
  const notice = await prisma.$transaction(async tx => {
    // Serialize price revisions with payment quotations; lock order is global then club.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(17112026)`;
    const rows = await tx.$queryRaw<{
      id: string;
    }[]>`SELECT id FROM clubs WHERE id=${clubId}::uuid FOR UPDATE`;
    if (!rows.length) throw new SubscriptionError('Клубът не е намерен.', 404);
    const stored = await tx.clubTrainingPlanSubscription.findUnique({
      where: {
        clubId
      },
      include
    });
    const mode = trainingPlanMode(stored?.billingMode ?? 'monthly');
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
      const prior = await tx.clubTrainingPlanPayment.findUnique({
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
    await tx.clubTrainingPlanSubscription.upsert({
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
      const billingMode = trainingPlanMode(body.billingMode);
      await tx.clubTrainingPlanSubscription.update({
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
      const billingMode = trainingPlanMode(body.billingMode);
      if (!isMonth(body.effectiveMonth)) throw new SubscriptionError('Невалиден месец.');
      if (stored?.prices.some(p => p.billingMode === billingMode) && body.effectiveMonth < nextMonth(localToday().slice(0, 7))) throw new SubscriptionError('Изберете бъдещ месец.');
      const amount = body.amount === null ? null : positive(body.amount);
      await tx.clubTrainingPlanPrice.upsert({
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
      const kind = 'free';
      const active = stored?.grants.filter(g => g.kind === kind && !g.revokedAt && (!g.endsAt || g.endsAt > now)) ?? [];
      if (body.enabled === stored?.freeEnabled && (body.enabled ? active.length > 0 : true)) return null;
      await tx.clubTrainingPlanSubscription.update({
        where: {
          clubId
        },
        data: {
          freeEnabled: body.enabled
        }
      });
      if (body.enabled) {
        const end = null;
        await tx.clubTrainingPlanGrant.create({
          data: {
            clubId,
            kind,
            startsAt: now,
            endsAt: end
          }
        });
      } else {
        await tx.clubTrainingPlanGrant.updateMany({
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
      description = body.enabled ? 'Безплатният достъп до плановете за тренировки е включен.' : 'Безплатният достъп до плановете за тренировки е спрян.';
      details = {
        kind,
        enabled: body.enabled
      };
    } else if (body.action === 'payment' && request) {
      const prices = await trainingPlanPrices(tx);
      const overrides = stored?.prices.map(p => ({
        ...p,
        amount: p.amount?.toFixed(2) ?? null
      })) ?? [];
      const purchase = trainingPlanPurchase(mode, request.months, prices, overrides);
      if (purchase.total !== request.expectedTotal) throw new SubscriptionError('Цената е променена. Обновете страницата.', 409);
      const periods = purchase.periods.map(p => ({
        ...p,
        startsAt: financeDayStart(`${p.month}-01`),
        endsAt: p.end ? financeDayStart(`${p.end}-01`) : null
      }));
      const cancelledOverlap = stored?.grants.some(g => g.kind === 'paid' && g.revokedAt && stored.payments.some(payment => payment.id === g.paymentId && payment.voidedAt) && periods.some(p => (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)));
      if (cancelledOverlap) throw new SubscriptionError('Възстановете анулираното плащане от историята, вместо да записвате второ за същия период.', 409);
      if (periods.some(p => stored?.grants.some(g => g.kind === 'paid' && !g.revokedAt && (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)))) throw new SubscriptionError('Периодът вече е платен.', 409);
      await tx.clubTrainingPlanPayment.create({
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
      description = `Получено плащане за плановете за тренировки: ${purchase.total} EUR на ${request.paidOn}. Периоди: ${purchase.periods.map(p => `${p.month} → ${p.end ?? 'безсрочно'}`).join(', ')}.`;
      details = {
        paymentId: body.paymentId as string,
        ...request,
        billingMode: mode
      };
    } else if (body.action === 'restore') {
      uuid(body.paymentId);
      const payment = stored?.payments.find(p => p.id === body.paymentId);
      if (!payment) throw new SubscriptionError('Плащането не е намерено.', 404);
      if (!payment.voidedAt) return null;
      const cancelledAt = payment.voidedAt.toISOString();
      const periods = stored!.grants.filter(g => g.paymentId === payment.id && g.kind === 'paid');
      if (!periods.length) throw new SubscriptionError('Липсват периоди за това плащане.', 409);
      if (periods.some(p => stored!.grants.some(g => g.kind === 'paid' && g.paymentId !== payment.id && !g.revokedAt && (!g.endsAt || g.endsAt > p.startsAt) && (!p.endsAt || p.endsAt > g.startsAt)))) throw new SubscriptionError('Периодът вече е платен.', 409);
      await tx.clubTrainingPlanPayment.update({where: {id: payment.id}, data: {voidedAt: null, voidedBy: null}});
      await tx.clubTrainingPlanGrant.updateMany({where: {paymentId: payment.id}, data: {revokedAt: null}});
      description = `Възстановено плащане за плановете за тренировки от ${payment.paidOn}: ${payment.total.toFixed(2)} EUR. Запазени са първоначалната сума и периодите на достъп.`;
      details = {paymentId: payment.id, total: payment.total.toFixed(2), paidOn: payment.paidOn, cancelledAt};
    } else if (body.action === 'void') {
      uuid(body.paymentId);
      const payment = stored?.payments.find(p => p.id === body.paymentId);
      if (!payment) throw new SubscriptionError('Плащането не е намерено.', 404);
      if (payment.voidedAt) return null;
      await tx.clubTrainingPlanPayment.update({
        where: {
          id: payment.id
        },
        data: {
          voidedAt: now,
          voidedBy: actorId
        }
      });
      await tx.clubTrainingPlanGrant.updateMany({
        where: {
          paymentId: payment.id
        },
        data: {
          revokedAt: now
        }
      });
      description = `Анулирано плащане за плановете за тренировки от ${payment.paidOn}: ${payment.total.toFixed(2)} EUR. Финансовата история е запазена.`;
      details = {
        paymentId: payment.id,
        total: payment.total.toFixed(2),
        paidOn: payment.paidOn
      };
    } else throw new SubscriptionError('Невалидно действие.');
    await tx.clubTrainingPlanSubscription.update({
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
      title: 'Планове за тренировки',
      body: description,
      url: `/admin/training-plans?clubId=${clubId}`
    };
    await saveSubscriptionNotification(tx, clubId, notification);
    return notification;
  }, {
    timeout: 30000
  });
  return deliverSubscriptionNotification(clubId, notice);
}

export async function trainingPlanCapabilities(clubId: string, roles: readonly string[]) {
  if (roles.includes("admin")) return accessPolicy([], roles);
  const now = new Date();
  const grants = await prisma.clubTrainingPlanGrant.findMany({
    where: { clubId, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    take: 1,
  });
  return accessPolicy(grants.map(grantView), roles, now);
}
