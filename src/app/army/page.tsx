// src/app/army/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import ArmyBuilder from "@/features/army/ArmyBuilder";
import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";

export default function ArmyPage() {
  const searchParams = useSearchParams();
  const playerId = searchParams.get("playerId");

  const [player, setPlayer] = useState<Player | null>(null);
  const [units, setUnits] = useState<UnitDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!playerId) {
      setError("Missing playerId query param. Open /army via the New Game form.");
      setIsLoading(false);
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [unitsRes, playerRes] = await Promise.all([
          fetch("http://localhost:3000/units", {
            cache: "no-store",
          }),
          fetch(`http://localhost:3000/players/${playerId}`, {
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

    loadData();
  }, [playerId]);

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
