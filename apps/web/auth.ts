import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { loadConfig } from '@fundos/core';

export function isSsoConfigured(): boolean {
  const config = loadConfig();
  return config.GOOGLE_CLIENT_ID !== undefined && config.GOOGLE_CLIENT_SECRET !== undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const config = loadConfig();
  return {
    providers: isSsoConfigured()
      ? [Google({ clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET })]
      : [],
    session: { strategy: 'jwt' },
    pages: { signIn: '/signin' },
  };
});
