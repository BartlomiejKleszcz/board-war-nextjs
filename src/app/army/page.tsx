// src/app/army/page.tsx

import ArmyBuilder from "@/features/army/ArmyBuilder";
import type { Player } from "@/shared/player";
import type { UnitDto } from "@/shared/unit";

type ArmyPageProps = {
  searchParams?: {
    playerId?: string;
  };
};

export default async function ArmyPage({ searchParams }: ArmyPageProps) {
  const playerId = searchParams?.playerId;

  if (!playerId) {
    throw new Error("Missing playerId in query params. Go back to New Game.");
  }

  // 1. Jednostki
  const unitsRes = await fetch("http://localhost:3000/units", {
    cache: "no-store",
  });

  if (!unitsRes.ok) {
    throw new Error("Failed to fetch units");
  }

  const units = (await unitsRes.json()) as UnitDto[];

  // 2. Gracz
  const playerRes = await fetch(`http://localhost:3000/player/${playerId}`, {
    cache: "no-store",
  });

  if (!playerRes.ok) {
    throw new Error("That player doesn't exist");
  }

  // TU JEST KLUCZ:
  const player = (await playerRes.json()) as Player; // NIE Promise<Player>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ArmyBuilder player={player} units={units} />
    </div>
  );
}
