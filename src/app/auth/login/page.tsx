"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login, isReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/new-game");
    } catch (e: any) {
      setError(e?.message ?? "Failed to log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Log in</h1>
        <p className="text-sm text-slate-400">
          Use your account to start battles and save statistics.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-slate-200">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none"
            placeholder="player@boardwar.io"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-slate-200">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none"
            placeholder="********"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!isReady && <p className="text-sm text-slate-400">Checking session...</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Signing in..." : "Log in"}
        </button>
      </form>

      <p className="text-sm text-slate-300">
        Need an account?{" "}
        <Link href="/auth/register" className="text-emerald-300 hover:text-emerald-200">
          Register
        </Link>
      </p>
    </div>
  );
}
