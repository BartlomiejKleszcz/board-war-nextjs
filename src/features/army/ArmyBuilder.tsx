// src/features/army/ArmyBuilder.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";
import type { GameState } from "@/shared/game";

type ArmyBuilderProps = {
  player: Player;
  units: UnitDto[];
};

export default function ArmyBuilder({ player, units }: ArmyBuilderProps) {
  const router = useRouter(); // router Next.js do nawigacji po zapisaniu armii (client-side)
  const { authFetch, user } = useAuth(); // authFetch dodaje autoryzacje do fetchy; user to zalogowany uzytkownik

  const [selected, setSelected] = useState<Record<string, number>>({}); // mapa unitId -> ilosc wybranych jednostek w armii
  const [error, setError] = useState<string | null>(null); // komunikat o bledach walidacji lub zapisu
  const [isSaving, setIsSaving] = useState(false); // blokada UI na czas zapisu/fechowania

  function addUnit(unitId: string) {
    // zwiekszamy licznik wybranego unitu; inicjalnie 0 gdy nie ma w mapie
    setSelected((prev) => {
      const current = prev[unitId] ?? 0;
      return {
        ...prev,
        [unitId]: current + 1,
      };
    });
  }

  function removeUnit(unitId: string) {
    // zmniejszamy licznik; gdy schodzimy do 0, usuwamy wpis z mapy
    setSelected((prev) => {
      const current = prev[unitId] ?? 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[unitId];
        return next;
      }
      return {
        ...prev,
        [unitId]: current - 1,
      };
    });
  }

  const totalCost = useMemo(() => {
    // sumujemy koszt: dla kazdego unitId bierzemy cene z listy units i mnozymy przez liczbe sztuk
    return Object.entries(selected).reduce<number>(
      (sum, [unitId, count]) => {
        const unit = units.find((u) => u.id === unitId);
        if (!unit) return sum;
        return sum + unit.cost * count;
      },
      0
    );
  }, [selected, units]);

  async function resetUnits(playerId: number) {
    // usuwamy cala armie gracza na backendzie, by nadpisac ja nowa konfiguracja
    const res = await authFetch(`/players/${playerId}/units`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`Failed to reset army (status ${res.status}).`);
    }
  }

  async function handleSaveArmy() {
    try {
      setIsSaving(true);
      setError(null);

      // przepisujemy mape selected (unitId -> count) na tablice obiektow
      const armyUnits = Object.entries(selected).map(([unitId, count]) => ({
        unitId,
        count,
      }));

      if (armyUnits.length === 0) {
        setError("Army is empty");
        setIsSaving(false);
        return;
      }

      if (totalCost > player.budget) {
        // walidacja budzetu: nie mozna przekroczyc maksymalnej kwoty gracza
        setError("Army cost exceeds budget");
        setIsSaving(false);
        return;
      }
      if (!user) {
        setError("Log in to save your army.");
        setIsSaving(false);
        return;
      }

      // clear player's army before adding new units
      await resetUnits(player.id);

      // push every unit to backend (player only; backend will mirror enemy)
      // tu wysylamy kazda sztuke jako osobny POST (backend zrobi mirroring armii przeciwnika)
      for (const { unitId, count } of armyUnits) {
        for (let i = 0; i < count; i++) {
          const res = await authFetch(
            `/players/${player.id}/units/${unitId}`,
            { method: "POST" }
          );
          if (!res.ok) {
            throw new Error(
              `Failed to add unit ${unitId}. Status: ${res.status}`
            );
          }
        }
      }

      // tworzymy gre solo; backend zestawia przeciwnika i zwraca stan
      const createStatefulGame = async (): Promise<GameState> => {
        const res = await authFetch("/game/state/solo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playerId: player.id }),
        });
        if (!res.ok) {
          throw new Error(`Failed to create game. Status: ${res.status}`);
        }
        return (await res.json()) as GameState;
      };

      const game = await createStatefulGame();

      if (typeof window !== "undefined") {
        // zapisujemy stan gry w sessionStorage, zeby ekran planszy mial dane po przejsciu
        sessionStorage.setItem("currentGameState", JSON.stringify(game));
        sessionStorage.setItem("currentGameId", game.gameId);
        sessionStorage.setItem("localPlayerId", String(player.id));
      }

      // po pomyslnym zapisie i utworzeniu gry przechodzimy do planszy z gameId w query
      router.push(`/board?gameId=${game.gameId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error while saving army");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
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
