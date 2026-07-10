import { NextResponse } from 'next/server';
import { ensureDevSession, getDb } from '@fundos/core';
import { isScoutEnabled, Scout } from '@fundos/agent';

export async function POST() {
  if (!isScoutEnabled()) {
    return NextResponse.json({ error: 'scouting requires an Exa key' }, { status: 503 });
  }
  const { workspace } = await ensureDevSession();
  const scout = new Scout(await getDb());
  try {
    const candidates = await scout.research(workspace._id);
    const deals = await scout.surface(workspace._id, candidates);
    return NextResponse.json({ surfaced: deals.length });
  } catch (error) {
    console.error('scout run failed', error);
    return NextResponse.json({ error: 'scout run failed; check server logs' }, { status: 502 });
  }
}
