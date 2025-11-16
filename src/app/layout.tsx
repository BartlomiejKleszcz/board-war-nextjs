import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";


export const metadata: Metadata = {
  title: "Board War",
  description: "A strategic board game experience",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-50 antialiased font-sans">
        <header className="p-4 flex gap-4 border-b border-slate-800">
          <div>
            <Image
              src="/logo.png"
              alt="BoardWar logo"
              width={50}
              height={50}
              className="rounded-2xl shadow"
            />
          </div>
            <nav className="flex gap-4 text-sm text-slate-300 items-center">
              <Link className="hover:text-white cursor-pointer" href="/">Home</Link>
              <Link className="hover:text-white cursor-pointer" href="/new-game">New Game</Link>
              <Link className="hover:text-white cursor-pointer" href="/units">Units</Link>
              <Link className="hover:text-white cursor-pointer" href="/about">About</Link>
            </nav>
        </header>

        {children}

        <footer>
          <div className="p-4 border-t border-slate-800 text-center text-sm text-slate-500">
            &copy; 2025 Board War. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
