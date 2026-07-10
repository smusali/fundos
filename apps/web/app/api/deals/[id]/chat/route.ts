import { NextResponse } from 'next/server';
import { convertToModelMessages, validateUIMessages, type UIMessage } from 'ai';
import { getDb } from '@fundos/core';
import { buildDealChatAgent, isChatEnabled } from '@fundos/agent';
import { currentSession } from '@/lib/session';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isChatEnabled()) {
    return NextResponse.json({ error: 'deal chat requires ANTHROPIC_API_KEY' }, { status: 503 });
  }
  const body: { messages?: UIMessage[] } = await request.json().catch(() => ({}));
  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages are required' }, { status: 400 });
  }
  const { workspace, user } = await currentSession();
  const agent = buildDealChatAgent({
    db: await getDb(),
    workspaceId: workspace._id,
    actor: user.email,
    dealId: id,
  });
  const validated = await validateUIMessages({ messages: body.messages });
  const stream = await agent.stream({ messages: await convertToModelMessages(validated) });
  return stream.toUIMessageStreamResponse();
}
