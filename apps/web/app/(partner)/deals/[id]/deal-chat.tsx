'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

function ToolChip({ type, state }: { type: string; state: string }) {
  return (
    <span className="mr-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-600">
      {type.replace(/^tool-/, '')}
      {state === 'output-available' ? ' ✓' : ' …'}
    </span>
  );
}

export function DealChat({ dealId, enabled }: { dealId: string; enabled: boolean }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: `/api/deals/${dealId}/chat` }),
  });

  if (!enabled) {
    return (
      <section className="mt-6 rounded border border-slate-200 bg-slate-100 p-4 text-sm text-slate-500" data-testid="chat-disabled">
        Deal chat is disabled. Add ANTHROPIC_API_KEY to your .env to talk to this deal.
      </section>
    );
  }

  return (
    <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="deal-chat">
      <h2 className="text-lg font-medium">Deal chat</h2>
      <div className="mt-3 max-h-96 space-y-3 overflow-y-auto text-sm">
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'text-slate-900' : 'text-slate-700'}>
            <span className="mr-2 text-xs font-medium uppercase text-slate-400">{message.role}</span>
            {message.parts.map((part, index) => {
              if (part.type === 'text') return <span key={index}>{part.text}</span>;
              if (part.type.startsWith('tool-')) {
                const state = 'state' in part && typeof part.state === 'string' ? part.state : '';
                return <ToolChip key={index} type={part.type} state={state} />;
              }
              return null;
            })}
          </div>
        ))}
        {messages.length === 0 ? (
          <p className="text-slate-400">
            Ask things like: why did market score what it did, what did we know about this founder, draft the pass
            note.
          </p>
        ) : null}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim() === '') return;
          void sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this deal"
          className="w-full rounded border border-slate-300 p-2 text-sm"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={status !== 'ready'}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
