'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@nsedo/ui';
import { api } from '../../../lib/api';

type Profile = {
  username: string;
  displayName: string;
  bio: string | null;
  privacy: string;
  verifiedBadge: boolean;
  followerCount: number;
  followingCount: number;
};

type Post = { id: string; body: string | null; createdAt: string };

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const username = params.username;
    api<Profile>(`/users/${username}`)
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
    api<Post[]>(`/users/${username}/posts`)
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [params.username]);

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-6">
      <Link href="/feed" className="inline-flex items-center gap-2 font-semibold">
        <Logo size={28} /> Back to feed
      </Link>
      {error && <p className="mt-6 text-[#E4572E]">{error}</p>}
      {profile && (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl">
            {profile.displayName}
            {profile.verifiedBadge ? ' ✓' : ''}
          </h1>
          <p className="text-black/50">@{profile.username}</p>
          <p className="mt-3">{profile.bio || 'No bio yet.'}</p>
          <p className="mt-3 text-sm">
            {profile.followerCount} followers · {profile.followingCount} following · {profile.privacy.toLowerCase()}
          </p>
          <button
            className="mt-4 rounded-full bg-[#14202B] px-4 py-2 text-sm text-white"
            onClick={() => api(`/follows/${profile.username}`, { method: 'POST' })}
          >
            Follow · ফলো
          </button>
        </section>
      )}
      <div className="mt-4 space-y-3">
        {posts.map((post) => (
          <article key={post.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <p>{post.body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
