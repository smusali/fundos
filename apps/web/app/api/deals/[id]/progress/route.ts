import { readProgress } from '@fundos/core';

const POLL_INTERVAL_MS = 400;
const MAX_STREAM_MS = 5 * 60 * 1_000;

/** Server-sent events bridge: relays the deal's Redis progress stream to the browser. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastId = '0';
      let closed = false;
      const startedAt = Date.now();

      const finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      request.signal.addEventListener('abort', finish);

      const tick = async () => {
        if (closed) return;
        try {
          const entries = await readProgress(id, lastId);
          for (const entry of entries) {
            lastId = entry.id;
            controller.enqueue(encoder.encode(`data: ${entry.payload}\n\n`));
            const parsed: { type?: string } = JSON.parse(entry.payload);
            if (parsed.type === 'scored' || parsed.type === 'error') {
              finish();
              return;
            }
          }
        } catch (error) {
          console.error(`progress stream failed for deal ${id}`, error);
          finish();
          return;
        }
        if (Date.now() - startedAt > MAX_STREAM_MS) {
          finish();
          return;
        }
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
      };
      void tick();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
