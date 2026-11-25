import Link from 'next/link';
import { Logo } from '@nsedo/ui';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="inline-flex items-center gap-2 font-semibold">
        <Logo size={28} /> nSedo
      </Link>
      <h1 className="mt-8 text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-[#14202B]/60">Short version for the nSedo web app.</p>
      <div className="mt-8 space-y-4 leading-7">
        <p>
          nSedo stores the account details you give us: a public username and
          display name, and, when you provide them, an email address, phone
          number, password hash, bio, and photos. Passwords and one-time codes
          are stored only as bcrypt hashes. We do not put email addresses or
          phone numbers in public profile responses.
        </p>
        <p>
          Posts, likes, comments, follows, friend requests, messages, call logs,
          and live comments are kept so the product can show them to the people
          you allow. Private accounts and private posts are shown to you and to
          followers you approve. You can block or mute another account.
        </p>
        <p>
          You can download a copy of your data from the app settings, and you
          can delete your account. Deleting the account removes the user row and
          the related posts, messages, and tokens. Sign-in codes are delivered
          by the SMS or email provider configured on the server. Google sign-in
          sends an ID token to our API so we can verify it with Google.
        </p>
        <p>
          The API uses short-lived access tokens and rotating refresh tokens.
          Do not share those tokens. Hosting operators should set a unique
          JWT secret and use HTTPS.
        </p>
        <p>Questions about this policy can be sent to the operator of the server you connect to.</p>
      </div>
    </main>
  );
}
