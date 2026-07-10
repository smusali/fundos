import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GatekeeperService, getDb, getStorage } from '@fundos/core';

const fieldsSchema = z.object({
  company: z.string().min(1),
  founderName: z.string().min(1),
  founderEmail: z.email(),
  summary: z.string().min(10),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const parsed = fieldsSchema.safeParse({
    company: form.get('company'),
    founderName: form.get('founderName'),
    founderEmail: form.get('founderEmail'),
    summary: form.get('summary'),
  });
  const deck = form.get('deck');
  if (!parsed.success || !(deck instanceof File) || deck.size === 0) {
    return NextResponse.json({ error: 'all fields including a deck PDF are required' }, { status: 400 });
  }

  const service = new GatekeeperService(await getDb(), getStorage());
  try {
    const deal = await service.submit(slug, {
      company: parsed.data.company,
      founder: {
        name: parsed.data.founderName,
        email: parsed.data.founderEmail,
        summary: parsed.data.summary,
      },
      deck: { filename: deck.name, bytes: Buffer.from(await deck.arrayBuffer()) },
    });
    void service.screen(deal._id).catch((error: unknown) => {
      console.error(`gatekeeper screening failed for deal ${deal._id}`, error);
    });
    return NextResponse.json({ submitted: true });
  } catch (error) {
    console.error(`intake submission failed for ${slug}`, error);
    return NextResponse.json({ error: 'submission could not be accepted' }, { status: 422 });
  }
}
