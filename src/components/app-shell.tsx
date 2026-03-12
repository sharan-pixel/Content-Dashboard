'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Nav } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) return;

    // Verify session is still valid (catches logins from another device)
    fetch('/api/auth/verify')
      .then((res) => {
        if (!res.ok) {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, [pathname, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </>
  );
}
