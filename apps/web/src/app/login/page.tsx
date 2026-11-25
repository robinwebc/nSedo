'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@nsedo/ui';
import { usernameError } from '@nsedo/shared';
import { api, saveSession } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'register' | 'email' | 'phone'>('password');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'register') {
        const username = String(form.get('username') || '');
        const nameError = usernameError(username);
        if (nameError) throw new Error(nameError);
        await api('/auth/register', {
          auth: false,
          body: {
            username,
            displayName: form.get('displayName'),
            email: form.get('email'),
            phone: form.get('phone'),
            password: form.get('password'),
          },
        });
        const session = await api('/auth/login', {
          auth: false,
          body: { identifier: username, password: form.get('password') },
        });
        saveSession(session as never);
      } else if (mode === 'password') {
        const session = await api('/auth/login', {
          auth: false,
          body: { identifier: form.get('identifier'), password: form.get('password') },
        });
        saveSession(session as never);
      } else {
        const channel = mode === 'email' ? 'EMAIL' : 'SMS';
        const target = String(form.get('target') || '');
        if (!form.get('code')) {
          await api('/auth/otp/request', {
            auth: false,
            body: { channel, target, purpose: 'LOGIN' },
          });
          setNotice('Code sent.');
          setBusy(false);
          return;
        }
        const username = String(form.get('username') || '');
        if (username) {
          const nameError = usernameError(username);
          if (nameError) throw new Error(nameError);
        }
        const session = await api('/auth/otp/verify', {
          auth: false,
          body: {
            channel,
            target,
            purpose: 'LOGIN',
            code: form.get('code'),
            username: username || undefined,
            displayName: form.get('displayName') || undefined,
          },
        });
        saveSession(session as never);
      }
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xl font-semibold">
        <Logo /> nSedo
      </Link>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {(['password', 'register', 'email', 'phone'] as const).map((item) => (
          <button
            key={item}
            className={`rounded-full px-3 py-1 ${mode === item ? 'bg-[#14202B] text-white' : 'bg-white'}`}
            onClick={() => setMode(item)}
            type="button"
          >
            {item === 'password' ? 'Password' : item === 'register' ? 'Register' : item === 'email' ? 'Email code' : 'Phone OTP'}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-3xl bg-white p-6 shadow-sm">
        {mode === 'password' && (
          <>
            <Input name="identifier" label="Email, phone, or username" />
            <Input name="password" label="Password" type="password" />
          </>
        )}
        {mode === 'register' && (
          <>
            <Input name="username" label="Username" placeholder="sara_01" />
            <Input name="displayName" label="Display name" />
            <Input name="email" label="Email" type="email" />
            <Input name="phone" label="Phone" placeholder="+8801..." />
            <Input name="password" label="Password" type="password" />
          </>
        )}
        {(mode === 'email' || mode === 'phone') && (
          <>
            <Input name="target" label={mode === 'email' ? 'Email' : 'Phone'} />
            <Input name="code" label="Code" required={false} />
            <Input name="username" label="Username, if this is a new account" required={false} />
            <Input name="displayName" label="Display name" required={false} />
          </>
        )}
        {error && <p className="text-sm text-[#E4572E]">{error}</p>}
        {notice && <p className="text-sm text-[#1F6F5B]">{notice}</p>}
        <button disabled={busy} className="w-full rounded-full bg-[#E4572E] py-3 font-semibold text-white">
          {busy ? 'Please wait' : 'Continue'}
        </button>
      </form>
    </main>
  );
}

function Input({
  name,
  label,
  type = 'text',
  placeholder,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-black/10 px-3 py-2"
      />
    </label>
  );
}
