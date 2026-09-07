import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUserByEmail, findOrCreateGoogleUser, findUserById } from './db';

export const authOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await findUserByEmail(credentials.email);
        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return { id: String(user.id), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Runs for every sign-in, including Google. We map Google accounts onto
    // the same `users` row as a credentials account with the same email,
    // so a person can use either login method for one library.
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const dbUser = await findOrCreateGoogleUser({
          email: user.email,
          name: user.name,
          googleId: account.providerAccountId,
        });
        user.id = String(dbUser.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.userId) {
        session.user.id = token.userId;
        const dbUser = await findUserById(Number(token.userId));
        if (dbUser) session.user.name = dbUser.name || session.user.name;
      }
      return session;
    },
  },
};

export async function requireUserId(session) {
  if (!session?.user?.id) return null;
  return Number(session.user.id);
}
