import Link from 'next/link';
import { Logo } from '@nsedo/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-3 text-2xl font-semibold">
          <Logo />
          nSedo
        </span>
        <nav className="flex gap-3 text-sm">
          <Link href="/privacy" className="rounded-full px-3 py-2 hover:bg-black/5">
            Privacy
          </Link>
          <Link href="/login" className="rounded-full bg-[#2457E6] px-4 py-2 font-semibold text-white">
            Sign in
          </Link>
        </nav>
      </header>
      <section className="mt-20 grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-[#5C6770]">পোস্ট, বার্তা, লাইভ</p>
          <h1 className="mt-3 text-5xl leading-tight">Posts, messages, and live rooms.</h1>
          <p className="mt-4 max-w-md text-lg text-[#14202B]/80">
            nSedo is a social app. Follow people, keep an account private, and message directly.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login" className="rounded-full bg-[#14202B] px-5 py-3 text-white">
              Open the web app
            </Link>
            <Link href="/privacy" className="rounded-full border border-[#14202B]/20 px-5 py-3">
              Privacy policy
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-[#E4DED4] bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <Logo size={36} />
            <div>
              <p className="font-semibold">nSedo</p>
              <p className="text-sm text-[#5C6770]">Home, search, live, alerts, messages</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-[#14202B]">
            <li>Password, phone code, email code, or Google</li>
            <li>Private accounts and approved followers</li>
            <li>Direct messages and calls</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
