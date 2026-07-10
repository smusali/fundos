import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, ThesisRepository, ThesisService } from '@fundos/core';
import { currentSession } from '@/lib/session';

const bodySchema = z.object({ artifact: z.string().min(20) });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'artifact must be at least 20 characters' }, { status: 400 });
  }
  const { workspace } = await currentSession();
  const service = new ThesisService(new ThesisRepository(await getDb()));
  try {
    const thesis = await service.compileAndSave(workspace._id, parsed.data.artifact);
    return NextResponse.json({ version: thesis.version });
  } catch (error) {
    console.error('thesis compile failed', error);
    return NextResponse.json({ error: 'could not compile a rubric from this artifact' }, { status: 422 });
  }
}
