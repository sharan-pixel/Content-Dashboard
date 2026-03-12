'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sun, Moon, LogOut } from 'lucide-react';

const links = [
  { href: '/', label: 'Ideas' },
  { href: '/scripts', label: 'Scripts' },
  { href: '/performance', label: 'Performance' },
];

export function Nav() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <nav className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="The Content Mafia"
              width={56}
              height={56}
              className="rounded-full"
            />
            <span className="text-lg font-bold text-[var(--accent)]">Content Copilot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--danger)] transition-colors"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
