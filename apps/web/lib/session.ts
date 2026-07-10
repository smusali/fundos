import { redirect } from 'next/navigation';
import { ensureDevSession, getDb, SsoSessionService, type SessionContext } from '@fundos/core';
import { auth, isSsoConfigured } from '@/auth';

/**
 * The partner session for every page and controller: Google SSO when
 * configured, the seeded dev session otherwise, so the app demos with zero
 * credentials.
 */
export async function currentSession(): Promise<SessionContext> {
  if (!isSsoConfigured()) {
    return ensureDevSession();
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/signin');
  return new SsoSessionService(await getDb()).resolve(email, session.user?.name);
}
