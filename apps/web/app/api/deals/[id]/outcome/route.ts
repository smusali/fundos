import { NextResponse } from 'next/server';
import { z } from 'zod';
import { realizedTypeSchema, DealService, ensureDevSession, getDb, getStorage, LedgerService } from '@fundos/core';

const bodySchema = z.object({
  realizedType: realizedTypeSchema,
  value: z.number().min(0),
  period: z.string().min(2),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'realizedType, value, and period are required' }, { status: 400 });
  }
  const { user } = await ensureDevSession();
  const db = await getDb();
  const deal = await new DealService(db, getStorage()).getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  }
  const row = await new LedgerService(db).recordOutcome(
    deal,
    parsed.data.realizedType,
    parsed.data.value,
    parsed.data.period,
    user.email,
  );
  return NextResponse.json({ recorded: true, ts: row.ts });
}
