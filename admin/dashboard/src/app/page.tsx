'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@nsedo/ui';
import { api, apiBase, loadSession, saveSession } from '../lib/api';

type Me = { role: string; username: string; email: string | null };
type Tab = 'stats' | 'users' | 'posts' | 'comments' | 'reports' | 'live' | 'audit';

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('stats');

  useEffect(() => {
    if (!loadSession()) return;
    api<Me>('/users/me')
      .then((user) => {
        if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
          saveSession(null);
          setError('This console is only for ADMIN and MODERATOR accounts.');
          return;
        }
        setMe(user);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="mb-6 flex items-center gap-2 text-2xl font-semibold">
          <Logo /> nSedo admin
        </div>
        <LoginForm
          onDone={() => {
            api<Me>('/users/me')
              .then((user) => {
                if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
                  saveSession(null);
                  setError('This console is only for ADMIN and MODERATOR accounts.');
                  return;
                }
                setMe(user);
                setError('');
              })
              .catch((err: Error) => setError(err.message));
          }}
        />
        {error && <p className="mt-3 text-sm text-[#2457E6]">{error}</p>}
      </main>
    );
  }

  const tabs: Tab[] = ['stats', 'users', 'posts', 'comments', 'reports', 'live', 'audit'];
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Logo size={32} /> nSedo admin
        </div>
        <div className="text-sm">
          {me.username} · {me.role}
          <button
            className="ml-3 rounded-full px-3 py-1 hover:bg-black/5"
            onClick={() => {
              saveSession(null);
              setMe(null);
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            className={`rounded-full px-3 py-1 text-sm ${tab === item ? 'bg-[#14202B] text-white' : 'bg-white'}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === 'stats' && <Stats />}
      {tab === 'users' && <Users actorRole={me.role} />}
      {tab === 'posts' && <Posts />}
      {tab === 'comments' && <Comments />}
      {tab === 'reports' && <Reports />}
      {tab === 'live' && <Live />}
      {tab === 'audit' && <Audit />}
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-3 rounded-3xl bg-white p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError('');
        try {
          const session = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              identifier: form.get('identifier'),
              password: form.get('password'),
            }),
          }).then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed');
            return data;
          });
          saveSession(session);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Login failed');
        }
      }}
    >
      <input name="identifier" required placeholder="Email, phone, or username" className="w-full rounded-2xl border px-3 py-2" />
      <input name="password" type="password" required placeholder="Password" className="w-full rounded-2xl border px-3 py-2" />
      {error && <p className="text-sm text-[#2457E6]">{error}</p>}
      <button className="w-full rounded-full bg-[#2457E6] py-2 font-semibold text-white">Sign in</button>
    </form>
  );
}

function Stats() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api<Record<string, number>>('/admin/stats').then(setData);
  }, []);
  if (!data) return <p>Loading stats…</p>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="rounded-3xl bg-white p-4">
          <p className="text-sm text-black/50">{key}</p>
          <p className="text-3xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Users({ actorRole }: { actorRole: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  async function load(query = q) {
    setRows(await api(`/admin/users?q=${encodeURIComponent(query)}`));
  }
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/users?q=')
      .then(setRows)
      .catch((err: Error) => setError(err.message));
  }, []);
  return (
    <section>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          load().catch((err: Error) => setError(err.message));
        }}
      >
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search users" className="flex-1 rounded-full border bg-white px-4 py-2" />
        <button className="rounded-full bg-[#14202B] px-4 text-white">Search</button>
      </form>
      {error && <p className="text-sm text-[#2457E6]">{error}</p>}
      <div className="space-y-2">
        {rows.map((user) => (
          <article key={String(user.id)} className="rounded-2xl bg-white p-3 text-sm">
            <p className="font-semibold">
              {String(user.displayName)} @{String(user.username)} · {String(user.role)}
              {user.verifiedBadge ? ' ✓' : ''} {user.banned ? '· banned' : ''}
            </p>
            <p className="text-black/60">
              {String(user.userId)} · {String(user.email ?? '')} · {String(user.phone ?? '')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="rounded-full border px-3 py-1" onClick={() => api(`/admin/users/${user.id}/ban`, { method: 'PATCH', body: { banned: !user.banned } }).then(() => load())}>
                {user.banned ? 'Unban' : 'Ban'}
              </button>
              <button className="rounded-full border px-3 py-1" onClick={() => api(`/admin/users/${user.id}/verify`, { method: 'PATCH', body: { verifiedBadge: !user.verifiedBadge } }).then(() => load())}>
                {user.verifiedBadge ? 'Remove badge' : 'Verify badge'}
              </button>
              {actorRole === 'ADMIN' &&
                ['USER', 'MODERATOR', 'ADMIN'].map((role) => (
                  <button key={role} className="rounded-full border px-3 py-1" onClick={() => api(`/admin/users/${user.id}/role`, { method: 'PATCH', body: { role } }).then(() => load()).catch((err: Error) => setError(err.message))}>
                    Make {role}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Posts() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    setRows(await api('/admin/posts'));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-2">
      {rows.map((post) => (
        <article key={String(post.id)} className="rounded-2xl bg-white p-3">
          <p>{String(post.body ?? '')}</p>
          <button className="mt-2 text-sm text-[#2457E6]" onClick={() => api(`/admin/posts/${post.id}`, { method: 'DELETE' }).then(load)}>
            Delete post
          </button>
        </article>
      ))}
    </div>
  );
}

function Comments() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    setRows(await api('/admin/comments'));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-2">
      {rows.map((comment) => (
        <article key={String(comment.id)} className="rounded-2xl bg-white p-3">
          <p>{String(comment.body)}</p>
          <button className="mt-2 text-sm text-[#2457E6]" onClick={() => api(`/admin/comments/${comment.id}`, { method: 'DELETE' }).then(load)}>
            Delete comment
          </button>
        </article>
      ))}
    </div>
  );
}

function Reports() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    setRows(await api('/admin/reports'));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-2">
      {rows.map((report) => (
        <article key={String(report.id)} className="rounded-2xl bg-white p-3 text-sm">
          <p className="font-semibold">
            {String(report.targetType)} · {String(report.status)}
          </p>
          <p>{String(report.reason)}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => api(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status: 'RESOLVED' } }).then(load)}>Resolve</button>
            <button onClick={() => api(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status: 'DISMISSED' } }).then(load)}>Dismiss</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Live() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function load() {
    setRows(await api('/admin/live'));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p>Nobody is live.</p>}
      {rows.map((stream) => (
        <article key={String(stream.id)} className="rounded-2xl bg-white p-3">
          <p className="font-semibold">{String(stream.title)}</p>
          <button className="mt-2 text-sm text-[#2457E6]" onClick={() => api(`/admin/live/${stream.id}/end`, { method: 'PATCH' }).then(load)}>
            End stream
          </button>
        </article>
      ))}
    </div>
  );
}

function Audit() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api<Array<Record<string, unknown>>>('/admin/audit').then(setRows);
  }, []);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <article key={String(row.id)} className="rounded-2xl bg-white p-3 text-sm">
          <p className="font-semibold">{String(row.action)}</p>
          <p className="text-black/60">
            {String(row.targetType ?? '')} {String(row.targetId ?? '')}
          </p>
        </article>
      ))}
    </div>
  );
}
