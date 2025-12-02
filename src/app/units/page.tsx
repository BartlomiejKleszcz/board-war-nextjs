import UnitCard from "@/features/units/UnitCard";
import type { UnitDto } from "@/shared/unit";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

export default async function UnitsPage() {
  if (!API_BASE_URL) {
    throw new Error("Missing API base URL. Set NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_URL.");
  }

  const res = await fetch(`${API_BASE_URL}/units`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać jednostek (status ${res.status}).`);
  }
  const units = (await res.json()) as UnitDto[];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Units</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {units.map((unit) => (
          <UnitCard key={unit.id} unit={unit} />
        ))}
      </div>
    </div>
  );
}

