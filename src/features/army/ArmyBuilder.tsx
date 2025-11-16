// src/features/army/ArmyBuilder.tsx

"use client";

import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";
import { useState, useMemo } from "react";

type ArmyBuilderProps = {
  player: Player;
  units: UnitDto[];
};

export default function ArmyBuilder({ player, units }: ArmyBuilderProps) {
  // Na razie tylko prosty stan pod przyszłą logikę
  const [selected, setSelected] = useState<Record<string, number>>({});

  // Przykładowe liczenie kosztu (zakładam, że UnitDto ma pole cost: number)
const totalCost = useMemo(() => {
  return Object.entries(selected).reduce((sum, [unitId, count]) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return sum;
    return sum + unit.cost * count;
  }, 0);
}, [selected, units]);


  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      {/* LEWA KOLUMNA – lista jednostek */}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold mb-2">
          Army for {player.name} ({player.color})
        </h1>
        <p className="text-slate-300 mb-4">
          Budget: {player.budget} | Current cost: {totalCost}
        </p>

        {units.map((unit) => (
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

            {/* Na razie tylko licznik na sztywno 0 – potem podłączymy + / - */}
            <div className="text-sm text-slate-300">
              Selected: {selected[unit.id] ?? ""}
            </div>
          </div>
        ))}
      </div>

      {/* PRAWA KOLUMNA – podsumowanie (na razie proste) */}
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
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={totalCost > player.budget}
        >
          Save army (TODO)
        </button>
      </aside>
    </div>
  );
}
