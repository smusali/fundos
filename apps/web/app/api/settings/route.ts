import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, SettingsService } from '@fundos/core';
import { currentSession } from '@/lib/session';

const bodySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('workspace'),
    fundName: z.string().min(1),
    intakeSlug: z.string().min(1),
  }),
  z.object({
    scope: z.literal('user'),
    settings: z.record(z.string(), z.unknown()),
  }),
]);

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid settings payload' }, { status: 400 });
  }
  const { workspace, user } = await currentSession();
  const service = new SettingsService(await getDb());
  try {
    if (parsed.data.scope === 'workspace') {
      await service.updateWorkspace(workspace._id, {
        fundName: parsed.data.fundName,
        intakeSlug: parsed.data.intakeSlug,
      });
    } else {
      await service.updateUserSettings(user._id, parsed.data.settings);
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('settings update failed', error);
    return NextResponse.json({ error: 'could not save settings' }, { status: 422 });
  }
}
