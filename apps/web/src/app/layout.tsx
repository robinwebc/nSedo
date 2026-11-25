import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'nSedo',
  description: 'nSedo is a social app for short posts, friends, and live rooms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
