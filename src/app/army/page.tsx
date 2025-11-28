// src/app/army/page.tsx

"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/features/auth/AuthProvider";
import ArmyBuilder from "@/features/army/ArmyBuilder";
import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";

export default function ArmyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-200">Loading army data...</div>}>
      <ArmyPageContent />
    </Suspense>
  );
}

function ArmyPageContent() {
  const searchParams = useSearchParams();
  const queryPlayerId = searchParams.get("playerId");
  const { user, isReady, authFetch } = useAuth();

  const [player, setPlayer] = useState<Player | null>(null);
  const [units, setUnits] = useState<UnitDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    const playerId = queryPlayerId ?? (user ? String(user.id) : null);
    if (!playerId) {
      setError("Log in to build an army.");
      setIsLoading(false);
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [unitsRes, playerRes] = await Promise.all([
          authFetch("/units", {
            cache: "no-store",
          }),
          authFetch(`/players/${playerId}`, {
            cache: "no-store",
          }),
        ]);

        if (!unitsRes.ok) {
          throw new Error(`Failed to fetch units. Status: ${unitsRes.status}`);
        }
        if (!playerRes.ok) {
          throw new Error(`Failed to fetch player. Status: ${playerRes.status}`);
        }

        const unitsJson = (await unitsRes.json()) as UnitDto[];
        const playerJson = (await playerRes.json()) as Player;

        setUnits(unitsJson);
        setPlayer(playerJson);
      } catch (e: any) {
        setError(e?.message ?? "Unknown error while loading army data");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [authFetch, isReady, queryPlayerId, user]);

  if (isLoading) {
    return (
      <div className="p-6 text-slate-200">Loading army data...</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        {error}
      </div>
    );
  }

  if (!player || !units) {
    return (
      <div className="p-6 text-red-400">Missing player or unit data.</div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ArmyBuilder player={player} units={units} />
    </div>
  );
}
