import type { ReactNode } from 'react';

export const colors = {
  ink: '#14202B',
  cobalt: '#2457E6',
  cobaltBright: '#6E96FF',
  seed: '#F4C95D',
  mist: '#F6F3EE',
  pine: '#1F6F5B',
  card: '#FFFFFF',
};

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="nSedo">
      <rect width="64" height="64" rx="16" fill={colors.ink} />
      <path d="M16 48V16h9l14 20V16h9v32h-9L25 28v20H16z" fill={colors.cobaltBright} />
      <circle cx="50" cy="14" r="4" fill={colors.seed} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <Logo size={32} />
      <span>nSedo</span>
    </span>
  );
}

export function Button({
  children,
  kind = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' }) {
  const cls =
    kind === 'primary'
      ? 'bg-[#2457E6] text-white hover:bg-[#1C46C2]'
      : 'bg-transparent text-[#14202B] hover:bg-black/5';
  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${cls} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#14202B]">{label}</span>
      {children}
    </label>
  );
}
