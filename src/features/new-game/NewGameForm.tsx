"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Player = {
  id: number;
  name: string;
  color: "RED" | "BLUE";
};

export default function NewGameForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createPlayerAndGoToNextStep(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const playerName = formData.get("playerName") as string | null;
      const color = formData.get("color") as "RED" | "BLUE" | null;

      if (!playerName || !color) {
        setError("Uzupełnij imię i wybierz kolor.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("http://localhost:3000/players/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "*/*",
        },
        body: JSON.stringify({
          name: playerName,
          color: color,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create player");
      }

      const player: Player = await res.json();

      router.push(`/army?playerId=${player.id}`);
    } catch (e) {
      setError("Nie udało się stworzyć gracza.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form
        className="flex flex-col gap-4 mt-4"
        onSubmit={createPlayerAndGoToNextStep}
      >
        <label className="flex flex-col gap-1" htmlFor="playerName">
          Player Name:
        </label>
        <textarea
          id="playerName"
          name="playerName"
          required
          className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-50"
        ></textarea>

        <label className="flex flex-col gap-1">Choose Your Color:</label>

        <div className="flex gap-4">
          {/* Czerwony */}
          <label
            htmlFor="color-red"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="radio"
              id="color-red"
              name="color"
              value="RED"
              className="w-4 h-4"
              defaultChecked
            />
            <span className="px-3 py-1 rounded bg-red-600 text-white text-sm">
              Red
            </span>
          </label>

          {/* Niebieski */}
          <label
            htmlFor="color-blue"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="radio"
              id="color-blue"
              name="color"
              value="BLUE"
              className="w-4 h-4"
            />
            <span className="px-3 py-1 rounded bg-blue-600 text-white text-sm">
              Blue
            </span>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Start Game"}
        </button>
      </form>
    </div>
  );
}
