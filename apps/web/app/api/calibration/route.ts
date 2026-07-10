import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CalibrationService, ensureDevSession, getDb } from '@fundos/core';

const bodySchema = z.object({
  deltas: z.array(
    z.object({
      dimension: z.string(),
      delta: z.number().int(),
      decidedDeals: z.number().int(),
    }),
  ),
});

/** The explicit partner approval that lets deltas touch the active rubric. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || parsed.data.deltas.length === 0) {
    return NextResponse.json({ error: 'deltas to approve are required' }, { status: 400 });
  }
  const { workspace, user } = await ensureDevSession();
  try {
    const version = await new CalibrationService(await getDb()).applyDeltas(
      workspace._id,
      parsed.data.deltas,
      user.email,
    );
    return NextResponse.json({ applied: true, version });
  } catch (error) {
    console.error('calibration apply failed', error);
    return NextResponse.json({ error: 'could not apply recalibration' }, { status: 422 });
  }
}
