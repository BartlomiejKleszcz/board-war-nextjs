"use client";

import { useEffect, useState } from "react";
import UnitCard from "@/features/units/UnitCard";
import { useAuth } from "@/features/auth/AuthProvider";
import type { UnitDto } from "@/shared/unit";

export default function UnitsPage() {
  const { authFetch, isReady, user } = useAuth();
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setError("Zaloguj się, aby zobaczyć listę jednostek.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await authFetch("/units", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Nie udało się pobrać jednostek (status ${res.status}).`);
        }
        const data = (await res.json()) as UnitDto[];
        setUnits(data);
      } catch (e: any) {
        setError(e?.message ?? "Błąd pobierania jednostek.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [authFetch, isReady, user]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Units</h1>
        <p className="text-sm text-slate-300">
          Lista jednostek dostępnych w grze.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-300">Ładowanie jednostek...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}

