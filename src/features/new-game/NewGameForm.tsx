"use client";

export default function NewGameForm() {
    return <div>
        <form className="flex flex-col gap-4 mt-4">
            <label className="flex flex-col gap-1" htmlFor="playerName">
                Player Name:</label>
                <textarea id="playerName"
                required
                ></textarea>
            <label className="flex flex-col gap-1">
  Choose Your Color:
</label>

<div className="flex gap-4">
  {/* Czerwony */}
  <label htmlFor="color-red" className="flex items-center gap-2 cursor-pointer">
    <input
      type="radio"
      id="color-red"
      name="color"
      value="RED"
      className="w-4 h-4"
      defaultChecked  // jeśli chcesz, żeby domyślnie był zaznaczony
    />
    <span className="px-3 py-1 rounded bg-red-600 text-white text-sm">
      Red
    </span>
  </label>

  {/* Niebieski */}
  <label htmlFor="color-blue" className="flex items-center gap-2 cursor-pointer">
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
            <button type="submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                Start Game
            </button>
        </form>
    </div>
};