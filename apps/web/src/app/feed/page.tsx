'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@nsedo/ui';
import { api, loadSession, saveSession } from '../../lib/api';

type Post = {
  id: string;
  body: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  shareUrl: string;
  author: { username: string; displayName: string; verifiedBadge: boolean };
};

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [me, setMe] = useState<{ username: string; displayName: string } | null>(null);

  async function load() {
    const feed = await api<Array<{ post?: Post } | Post>>('/posts/feed');
    setPosts(
      feed.map((item) => ('post' in item && item.post ? item.post : (item as Post))),
    );
  }

  useEffect(() => {
    if (!loadSession()) {
      router.replace('/login');
      return;
    }
    api<{ username: string; displayName: string }>('/users/me')
      .then(setMe)
      .catch(() => router.replace('/login'));
    load().catch((err: Error) => setError(err.message));
  }, [router]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/posts', { body: { body } });
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <Logo size={28} /> nSedo
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {me && <Link href={`/u/${me.username}`}>@{me.username}</Link>}
          <button
            className="rounded-full px-3 py-1 hover:bg-black/5"
            onClick={() => {
              saveSession(null);
              router.push('/');
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <form onSubmit={publish} className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={500}
          placeholder="What's happening? কী হচ্ছে?"
          className="h-24 w-full resize-none outline-none"
        />
        <div className="flex justify-end">
          <button className="rounded-full bg-[#2457E6] px-4 py-2 text-sm font-semibold text-white">
            Post · পোস্ট
          </button>
        </div>
      </form>
      {error && <p className="mb-4 text-sm text-[#2457E6]">{error}</p>}
      <div className="space-y-3">
        {posts.map((post) => (
          <article key={post.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <Link href={`/u/${post.author.username}`} className="font-semibold">
              {post.author.displayName}
              {post.author.verifiedBadge ? ' ✓' : ''}{' '}
              <span className="font-normal text-black/50">@{post.author.username}</span>
            </Link>
            <p className="mt-2 whitespace-pre-wrap">{post.body}</p>
            <div className="mt-3 flex gap-4 text-sm text-black/60">
              <button onClick={() => api(`/posts/${post.id}/like`, { method: 'POST' }).then(load)}>
                Like {post.likeCount}
              </button>
              <span>Comments {post.commentCount}</span>
              <button onClick={() => api(`/posts/${post.id}/repost`, { method: 'POST', body: {} }).then(load)}>
                Repost {post.repostCount}
              </button>
            </div>
          </article>
        ))}
        {posts.length === 0 && <p className="text-sm text-black/60">Your home feed is empty. Follow someone or write a post.</p>}
      </div>
    </main>
  );
}
