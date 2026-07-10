import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@fundos/core';
import { Drafter } from '@fundos/agent';

const bodySchema = z.object({ type: z.enum(['memo', 'pass_note', 'advance_request']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'type must be memo, pass_note, or advance_request' }, { status: 400 });
  }
  const drafter = new Drafter(await getDb());
  try {
    if (parsed.data.type === 'memo') {
      const memo = await drafter.draftMemo(id);
      return NextResponse.json({ drafted: 'memo', id: memo._id });
    }
    const approval =
      parsed.data.type === 'pass_note' ? await drafter.draftPassNote(id) : await drafter.draftAdvanceRequest(id);
    return NextResponse.json({ drafted: parsed.data.type, id: approval._id, status: approval.status });
  } catch (error) {
    console.error(`draft failed for deal ${id}`, error);
    return NextResponse.json({ error: 'draft failed' }, { status: 422 });
  }
}
