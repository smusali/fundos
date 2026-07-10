import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApprovalService, getDb } from '@fundos/core';
import { currentSession } from '@/lib/session';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('edit'), body: z.string().min(3) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'action must be approve, reject, or edit with a body' }, { status: 400 });
  }
  const { user } = await currentSession();
  const service = new ApprovalService(await getDb());
  try {
    if (parsed.data.action === 'approve') {
      const approval = await service.approve(id, user.email);
      return NextResponse.json({ status: approval.status });
    }
    if (parsed.data.action === 'reject') {
      const approval = await service.reject(id, user.email);
      return NextResponse.json({ status: approval.status });
    }
    const redrafted = await service.edit(id, parsed.data.body, user.email);
    return NextResponse.json({ status: redrafted.status, approvalId: redrafted._id });
  } catch (error) {
    console.error(`approval action failed for ${id}`, error);
    return NextResponse.json({ error: 'approval action failed' }, { status: 422 });
  }
}
