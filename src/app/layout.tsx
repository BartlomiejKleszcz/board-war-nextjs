import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";


export const metadata: Metadata = {
  title: "Board War",
  description: "A strategic board game experience",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-50 antialiased font-sans">
        <header className="p-4 flex gap-4 border-b border-slate-800">
          <Image
            src="/logo.png"
            alt="BoardWar logo"
            width={40}
            height={40}
            className="rounded-2xl shadow"
          />
            <nav>
              <a href="/" className="hover:underline">Home</a>
              <a href="/New-Game" className="ml-4 hover:underline">New Game</a>
              <a href="/units" className="ml-4 hover:underline">Units</a>
              <a href="/about" className="ml-4 hover:underline">About</a>

            </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
