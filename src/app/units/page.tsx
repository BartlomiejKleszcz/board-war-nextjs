"use client";

import { useEffect, useState } from "react";
import UnitCard from "@/features/units/UnitCard";
import type { UnitDto } from "@/shared/unit";

function normalizeApiBase(base: string | undefined) {
  if (!base) return undefined;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const API_BASE_URL = normalizeApiBase(
  (typeof window !== "undefined" ? `${window.location.origin}/api` : undefined) ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000")
);

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_BASE_URL) {
      setError("Brakuje adresu API. Ustaw NEXT_PUBLIC_API_BASE_URL albo NEXT_PUBLIC_API_URL.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/units`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Nie udało się pobrać jednostek (status ${res.status}).`);
        }
        const data = (await res.json()) as UnitDto[];
        setUnits(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Błąd pobierania jednostek.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Units</h1>
        <p className="text-sm text-slate-300">Lista jednostek dostępnych w grze.</p>
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

