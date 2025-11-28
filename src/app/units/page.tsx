import { UnitDto } from "@/shared/unit";
import UnitCard from "@/features/units/UnitCard";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:3000");

export default async function UnitsPage() {
  const res = await fetch(`${API_BASE_URL}/units`, { cache: "no-store" });

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

