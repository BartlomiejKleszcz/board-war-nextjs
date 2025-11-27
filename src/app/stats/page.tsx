"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

type BattleResult = "win" | "lose" | "draw";

type BattleEntry = {
  id: number;
  gameId?: number | null;
  result: BattleResult;
  damageDealt: number;
  damageTaken: number;
  units: string[];
  createdAt: string;
};

type UserStats = {
  total: {
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    damageDealt: number;
    damageTaken: number;
  };
  battles: BattleEntry[];
};

export default function StatsPage() {
  const { authFetch, user, isReady } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setError("Log in to view your statistics.");
      setIsLoading(false);
      return;
    }

    const loadStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await authFetch("/stats", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch stats (status ${res.status}).`);
        }
        const data = (await res.json()) as UserStats;
        setStats(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch stats.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadStats();
  }, [authFetch, isReady, user]);

  const rows = useMemo(() => {
    if (!stats) return [];
    const battleRows = stats.battles ?? [];
    return [...battleRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stats]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Battle statistics</h1>
        <p className="text-sm text-slate-300">
          Overview of all games and individual battles, newest first.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-300">Loading stats...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="All battles" value={stats.total.battles} />
          <StatCard label="Wins" value={stats.total.wins} accent="emerald" />
          <StatCard label="Losses" value={stats.total.losses} accent="red" />
          <StatCard label="Draws" value={stats.total.draws} accent="amber" />
        </div>
      )}

      {stats && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Damage dealt</th>
                <th className="px-4 py-3">Damage taken</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Game ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="bg-slate-800/40 font-semibold text-slate-100">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">
                  {stats.total.wins}W / {stats.total.losses}L / {stats.total.draws}D
                </td>
                <td className="px-4 py-3 text-emerald-200">{stats.total.damageDealt}</td>
                <td className="px-4 py-3 text-red-200">{stats.total.damageTaken}</td>
                <td className="px-4 py-3 text-slate-300">—</td>
                <td className="px-4 py-3 text-slate-400">—</td>
              </tr>

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-300">
                    No recorded battles.
                  </td>
                </tr>
              )}

              {rows.map((battle) => (
                <tr key={battle.id} className="hover:bg-slate-800/30 text-slate-100">
                  <td className="px-4 py-3 text-slate-200">
                    {new Date(battle.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ResultBadge result={battle.result} />
                  </td>
                  <td className="px-4 py-3 text-emerald-200">{battle.damageDealt}</td>
                  <td className="px-4 py-3 text-red-200">{battle.damageTaken}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(battle.units ?? []).map((u, idx) => (
                        <span
                          key={`${battle.id}-${idx}-${u}`}
                          className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {battle.gameId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "red" | "amber" }) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-200"
      : accent === "red"
      ? "text-red-200"
      : accent === "amber"
      ? "text-amber-200"
      : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: BattleResult }) {
  const label =
    result === "win" ? "Win" : result === "lose" ? "Loss" : "Draw";
  const color =
    result === "win"
      ? "bg-emerald-900/50 text-emerald-200 border-emerald-500/40"
      : result === "lose"
      ? "bg-red-900/40 text-red-200 border-red-500/40"
      : "bg-amber-900/30 text-amber-200 border-amber-500/40";
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}
