import { NextResponse } from 'next/server';
import { DealService, ensureDevSession, getDb, getStorage, type UploadFile } from '@fundos/core';

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const company = form.get('company');
  if (typeof company !== 'string' || company.trim() === '') {
    return NextResponse.json({ error: 'company is required' }, { status: 400 });
  }

  const files: UploadFile[] = [];
  for (const [field, kind] of [
    ['deck', 'deck'],
    ['dataroom', 'dataroom'],
  ] as const) {
    for (const value of form.getAll(field)) {
      if (value instanceof File && value.size > 0) {
        files.push({
          filename: value.name,
          kind,
          bytes: Buffer.from(await value.arrayBuffer()),
        });
      }
    }
  }
  if (!files.some((file) => file.kind === 'deck')) {
    return NextResponse.json({ error: 'a deck PDF is required' }, { status: 400 });
  }

  const { workspace } = await ensureDevSession();
  const service = new DealService(await getDb(), getStorage());
  const deal = await service.createDeal(workspace._id, company.trim(), files);

  void service.processDeal(deal._id).catch((error: unknown) => {
    console.error(`background processing failed for deal ${deal._id}`, error);
  });

  return NextResponse.json({ dealId: deal._id });
}
