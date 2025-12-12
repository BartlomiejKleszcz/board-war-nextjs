"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Player } from "@/shared/player";

export default function NewGameForm() {
  const router = useRouter(); // useRouter: hook Next.js do client-side nawigacji (router.push/replace itp.)
  const { user, isReady, authFetch } = useAuth();
  // Lokalny stan gracza pobranego z backendu, bledow oraz ladowania.
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null); // useState dla error: trzyma tresc ostatniego bledu (null = brak bledu), setError nadpisuje ja po nieudanym fetchu
  const [isLoading, setIsLoading] = useState(true); // isLoading: flaga informujaca UI o trwajacym fetchu; true podczas pobierania danych gracza

  useEffect(() => {
    // Czekamy az provider auth sie zainicjuje; bez tego user moze byc tymczasowo nullem.
    if (!isReady) return;
    // Jesli nie ma zalogowanego uzytkownika, konczymy ladowanie i pokazujemy CTA do logowania.
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Pobranie danych gracza (profil + parametry gry) dla zalogowanego uzytkownika.
    const loadPlayer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await authFetch(`/players/${user.id}`, { cache: "no-store" }); // cache: "no-store" -> fetch omija cache Next.js i zawsze idzie do backendu
        if (!res.ok) {
          throw new Error("Failed to load player.");
        }
        const data = (await res.json()) as Player;
        setPlayer(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch player data.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPlayer();
  }, [authFetch, isReady, user]);

  // W trakcie inicjalizacji auth pokazujemy info diagnostyczne.
  if (!isReady) {
    return <p className="text-sm text-slate-300">Checking login status...</p>;
  }

  // Gdy user niezalogowany, pokazujemy prompt do logowania/rejestracji.
  if (!user) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <p className="text-slate-200 font-semibold">Log in or create an account</p>
        <p className="text-sm text-slate-300">
          Registering also creates your player with the chosen color. After logging in you can build your army.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          >
            I have an account
          </button>
          <button
            type="button"
            onClick={() => router.push("/auth/register")}
            className="rounded-lg border border-emerald-500/60 text-emerald-200 px-3 py-2 text-sm font-semibold hover:bg-emerald-600/20"
          >
            Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h2 className="text-lg font-semibold text-white">New game</h2>
        <p className="text-sm text-slate-300">
          Account: <span className="font-semibold text-white">{user.email}</span>
        </p>
      </div>

      {/* Komunikaty statusu ladowania i ewentualnego bledu */}
      {isLoading && <p className="text-sm text-slate-300">Loading player data...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Gdy mamy dane gracza, pokazujemy jego profil i CTA do budowy armii */}
      {player && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-slate-100">{player.name}</div>
              <div className="text-xs text-slate-400">Color: {player.color}</div>
            </div>
            <div className="text-sm text-slate-200">Budget: {player.budget}</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/army")}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-semibold text-white"
          >
            Build army
          </button>
        </div>
      )}
    </div>
  );
}
