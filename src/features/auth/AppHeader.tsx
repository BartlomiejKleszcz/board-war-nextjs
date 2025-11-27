"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/new-game", label: "New Game" },
  { href: "/units", label: "Units" },
  { href: "/stats", label: "Stats" },
];

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-slate-800 text-white"
          : "text-slate-300 hover:text-white hover:bg-slate-800/70"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const { user, logout, isReady } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/auth/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-800">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="BoardWar logo"
          width={48}
          height={48}
          className="rounded-2xl shadow"
        />
        <div>
          <div className="text-lg font-semibold text-white leading-tight">Board War</div>
          <div className="text-xs text-slate-400">Strategic battles with your army</div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {navLinks.map((link) => (
          <NavItem key={link.href} href={link.href} label={link.label} />
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {!isReady ? (
          <span className="text-sm text-slate-400">Checking session...</span>
        ) : user ? (
          <>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">{user.displayName}</div>
              <div className="text-[11px] text-slate-400">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Log in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg border border-emerald-500/60 text-emerald-200 px-3 py-2 text-sm font-semibold hover:bg-emerald-600/20"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
