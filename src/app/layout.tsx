import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/AuthProvider";
import AppHeader from "@/features/auth/AppHeader";


export const metadata: Metadata = {
  title: "Board War",
  description: "A strategic board game experience",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-50 antialiased font-sans">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <AppHeader />
            <main className="flex-1">{children}</main>
            <footer>
              <div className="p-4 border-t border-slate-800 text-center text-sm text-slate-500">
                &copy; 2025 Board War. All rights reserved.
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
