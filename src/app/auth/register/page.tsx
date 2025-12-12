"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

const colors = [
  { value: "red", label: "Czerwony" },
  { value: "blue", label: "Niebieski" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState(colors[0]?.value ?? "red");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ email, password, displayName, color });
      router.push("/new-game");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="text-sm text-slate-400">
          Creating an account also creates your player (name + color). The password is stored as a hashed value.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="displayName" className="text-sm text-slate-200">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none"
            placeholder="Commander"
          />
        </div>

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
            Password (min. 6 characters)
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

        <div className="flex flex-col gap-2">
          <span className="text-sm text-slate-200">Army color</span>
          <div className="flex gap-3">
            {colors.map((c) => (
              <label
                key={c.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${
                  color === c.value
                    ? "border-emerald-500 bg-emerald-900/30"
                    : "border-slate-700 bg-slate-800/60"
                }`}
              >
                <input
                  type="radio"
                  name="color"
                  value={c.value}
                  checked={color === c.value}
                  onChange={() => setColor(c.value)}
                  className="accent-emerald-500"
                />
                <span className="text-sm text-slate-100">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-sm text-slate-300">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-emerald-300 hover:text-emerald-200">
          Log in
        </Link>
      </p>
    </div>
  );
}
