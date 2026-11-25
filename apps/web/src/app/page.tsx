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
          <Link href="/login" className="rounded-full bg-[#E4572E] px-4 py-2 font-semibold text-white">
            Sign in
          </Link>
        </nav>
      </header>
      <section className="mt-20 grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1F6F5B]">
            কথা বলো · share it
          </p>
          <h1 className="mt-3 text-5xl leading-tight">
            A quieter place to post, follow, and go live.
          </h1>
          <p className="mt-4 max-w-md text-lg text-[#14202B]/80">
            nSedo is its own social network. Write in English or বাংলা, keep a
            private account, and message the people you actually know.
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
        <div className="rounded-[28px] bg-[#14202B] p-6 text-[#F6F3EE] shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <Logo size={36} />
            <div>
              <p className="font-semibold">mina</p>
              <p className="text-sm text-white/60">@mina · public</p>
            </div>
          </div>
          <p className="text-xl">Evening adda starts in ten minutes. আসছো?</p>
          <div className="mt-6 flex gap-4 text-sm text-[#F4C95D]">
            <span>পছন্দ 12</span>
            <span>মন্তব্য 3</span>
            <span>শেয়ার 1</span>
          </div>
        </div>
      </section>
    </main>
  );
}
