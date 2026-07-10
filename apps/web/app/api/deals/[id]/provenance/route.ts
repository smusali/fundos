import { NextResponse } from 'next/server';
import { getDb, LedgerService, provenanceToPdf } from '@fundos/core';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provenance = await new LedgerService(await getDb()).exportProvenance(id);
  if (!provenance) {
    return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  }
  const format = new URL(request.url).searchParams.get('format') ?? 'json';
  if (format === 'pdf') {
    const bytes = await provenanceToPdf(provenance);
    return new Response(Buffer.from(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="provenance-${id}.pdf"`,
      },
    });
  }
  return NextResponse.json(provenance);
}
