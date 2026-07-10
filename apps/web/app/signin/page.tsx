import { redirect } from 'next/navigation';
import { isSsoConfigured, signIn } from '@/auth';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (!isSsoConfigured()) {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-sm pt-24 text-center">
      <h1 className="text-3xl font-semibold">fundos</h1>
      <p className="mt-2 text-sm text-slate-500">
        The system-of-record for AI-influenced investment decisions.
      </p>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="mt-8 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
