import { NextResponse } from 'next/server';
import { z } from 'zod';
import { decisionOutcomeSchema, DealService, ensureDevSession, getDb, getStorage, LedgerService } from '@fundos/core';

const bodySchema = z.object({
  outcome: decisionOutcomeSchema,
  reason: z.string().min(3),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'outcome and a one-line reason are required' }, { status: 400 });
  }
  const { user } = await ensureDevSession();
  const db = await getDb();
  const deal = await new DealService(db, getStorage()).getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  }
  const row = await new LedgerService(db).recordDecision(deal, parsed.data.outcome, parsed.data.reason, user.email);
  return NextResponse.json({ recorded: true, ts: row.ts });
}
