import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserByEmail, createUserWithPassword } from '@/lib/db';

export async function POST(req) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUserWithPassword(normalizedEmail, passwordHash, name);

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Something went wrong creating your account.' }, { status: 500 });
  }
}
