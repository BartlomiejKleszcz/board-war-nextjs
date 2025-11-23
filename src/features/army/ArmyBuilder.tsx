// src/features/army/ArmyBuilder.tsx

"use client";

import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";
import type { Game } from "@/shared/game";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type ArmyBuilderProps = {
  player: Player;
  units: UnitDto[];
};

export default function ArmyBuilder({ player, units }: ArmyBuilderProps) {
  const router = useRouter();

  const [selected, setSelected] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function addUnit(unitId: string) {
    setSelected((prev) => {
      const current = prev[unitId] ?? 0;
      return {
        ...prev,
        [unitId]: current + 1,
      };
    });
  }

  function removeUnit(unitId: string) {
    setSelected((prev) => {
      const current = prev[unitId] ?? 0;
      if (current <= 1) {
        const { [unitId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [unitId]: current - 1,
      };
    });
  }

  const totalCost = useMemo(() => {
    return Object.entries(selected).reduce<number>(
      (sum, [unitId, count]) => {
        const unit = units.find((u) => u.id === unitId);
        if (!unit) return sum;
        return sum + unit.cost * count;
      },
      0
    );
  }, [selected, units]);

  async function handleSaveArmy() {
    try {
      setIsSaving(true);
      setError(null);

      // budujemy payload z selected
      const armyUnits = Object.entries(selected).map(([unitId, count]) => ({
        unitId, // np. "line-infantry"
        count,
      }));

      if (armyUnits.length === 0) {
        setError("Army is empty");
        setIsSaving(false);
        return;
      }

      if (totalCost > player.budget) {
        setError("Army cost exceeds budget");
        setIsSaving(false);
        return;
      }

      // dodajemy jednostki gracza do backendu (pojedyncze POST-y)
      for (const { unitId, count } of armyUnits) {
        for (let i = 0; i < count; i++) {
          const res = await fetch(
            `http://localhost:3000/players/${player.id}/units/${unitId}`,
            { method: "POST" }
          );
          if (!res.ok) {
            throw new Error(
              `Failed to add unit ${unitId}. Status: ${res.status}`
            );
          }
        }
      }

      // tworzymy grę solo (z wrogą armią sklonowaną po stronie backendu)
      const gameRes = await fetch("http://localhost:3000/game/solo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId: player.id }),
      });

      if (!gameRes.ok) {
        throw new Error(`Failed to create game. Status: ${gameRes.status}`);
      }

      const game: Game = await gameRes.json();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("currentGame", JSON.stringify(game));
      }

      router.push(`/board?gameId=${game.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error while saving army");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      {/* LEWA KOLUMNA – lista jednostek */}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold mb-2">
          Army for {player.name} ({player.color})
        </h1>
        <p className="text-slate-300 mb-1">
          Budget: {player.budget} | Current cost: {totalCost}
        </p>
        {error && (
          <p className="text-sm text-red-400 mb-2">
            {error}
          </p>
        )}

        {units.map((unit) => {
          const count = selected[unit.id] ?? 0;

          return (
            <div
              key={unit.id}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3"
            >
              <div>
                <div className="font-semibold">{unit.name}</div>
                <div className="text-xs text-slate-400">
                  Cost: {unit.cost}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => removeUnit(unit.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-500 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                  disabled={count === 0 || isSaving}
                >
                  -
                </button>

                <span className="w-6 text-center text-sm text-slate-100">
                  {count}
                </span>

                <button
                  type="button"
                  onClick={() => addUnit(unit.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-emerald-500 text-emerald-200 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                  disabled={isSaving}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PRAWA KOLUMNA – podsumowanie */}
      <aside className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <h2 className="text-lg font-semibold mb-2">Army summary</h2>
        <p className="text-sm text-slate-300">
          Player: {player.name} ({player.color})
        </p>
        <p className="text-sm text-slate-300">
          Budget: {player.budget}
        </p>
        <p className="text-sm text-slate-300 mb-4">
          Current cost: {totalCost}
        </p>

        <button
          type="button"
          onClick={handleSaveArmy}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={totalCost === 0 || totalCost > player.budget || isSaving}
        >
          {isSaving ? "Saving..." : "Save army & go to board"}
        </button>
      </aside>
    </div>
  );
}
