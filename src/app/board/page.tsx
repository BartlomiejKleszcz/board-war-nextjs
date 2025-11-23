// src/app/board/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { Board, HexCoords, Tile } from "@/shared/board";
import type { Game } from "@/shared/game";
import type { UnitDto } from "@/shared/unit";

type OwnedUnit = UnitDto & {
  uniqueId: number;
  position: HexCoords | null;
  owner: "player" | "enemy";
};

type PathResult = {
  cost: number;
  path: HexCoords[];
};

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [playerUnits, setPlayerUnits] = useState<OwnedUnit[]>([]);
  const [enemyUnits, setEnemyUnits] = useState<OwnedUnit[]>([]);
  const [phase, setPhase] = useState<Game["phase"]>("deployment");
  const [activeSide, setActiveSide] = useState<"player" | "enemy">("player");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [pathCoords, setPathCoords] = useState<HexCoords[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [moved, setMoved] = useState<{ player: Set<number>; enemy: Set<number> }>(() => ({
    player: new Set(),
    enemy: new Set(),
  }));

  // load game from sessionStorage (created after building the army)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem("currentGame") : null;
      if (!raw) {
        setError("No active game. Go back to /army and save an army.");
        setIsLoading(false);
        return;
      }
      const parsed = JSON.parse(raw) as Game;
      setBoard(parsed.board);
      setGameId(parsed.id);
      setPhase(parsed.phase ?? "deployment");
      setActiveSide("player");

      const toOwned = (list: UnitDto[], owner: "player" | "enemy"): OwnedUnit[] =>
        list.map((u, idx) => ({
          ...u,
          uniqueId: u.uniqueId ?? idx + 1,
          position: (u as any).position ?? null,
          owner,
        }));

      setPlayerUnits(toOwned(parsed.playerArmy, "player"));
      setEnemyUnits(toOwned(parsed.enemyArmy, "enemy"));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load game data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const tileByCoord = useMemo(() => {
    const map = new Map<string, Tile>();
    board?.tiles.forEach((t) => map.set(`${t.coords.q},${t.coords.r}`, t));
    return map;
  }, [board]);

  const rows = useMemo(() => {
    if (!board) return [] as number[];
    return Array.from(new Set(board.tiles.map((tile) => tile.coords.r))).sort((a, b) => a - b);
  }, [board]);

  const columns = useMemo(() => {
    if (!board) return [] as number[];
    const qValues = board.tiles.map((tile) => tile.coords.q);
    const minQ = Math.min(...qValues);
    const maxQ = Math.max(...qValues);
    return Array.from({ length: maxQ - minQ + 1 }, (_, idx) => minQ + idx);
  }, [board]);

  const allowedDeployColumns = useMemo(() => {
    if (!columns.length) return new Set<number>();
    const minQ = columns[0];
    return new Set([minQ, minQ + 1, minQ + 2]);
  }, [columns]);

  const mirroredQ = useCallback(
    (q: number) => {
      if (!columns.length) return q;
      const minQ = columns[0];
      const maxQ = columns[columns.length - 1];
      return maxQ - (q - minQ);
    },
    [columns]
  );

  const occupiedMap = useMemo(() => {
    const map = new Map<string, OwnedUnit>();
    [...playerUnits, ...enemyUnits].forEach((u) => {
      if (u.position) {
        map.set(`${u.position.q},${u.position.r}`, u);
      }
    });
    return map;
  }, [playerUnits, enemyUnits]);

  const pathKeys = useMemo(() => new Set(pathCoords.map((c) => `${c.q},${c.r}`)), [pathCoords]);

  const selectedUnit = useMemo(
    () => [...playerUnits, ...enemyUnits].find((u) => u.uniqueId === selectedUnitId) ?? null,
    [playerUnits, enemyUnits, selectedUnitId]
  );

  const allUnits = useMemo(() => [...playerUnits, ...enemyUnits], [playerUnits, enemyUnits]);

  async function setUnitPositionOnBackend(unitId: number, coords: HexCoords) {
    if (!gameId) return;
    try {
      await fetch(`http://localhost:3000/game/${gameId}/units/${unitId}/position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: coords.q, r: coords.r }),
      });
    } catch {
      // backend does not strictly validate tile occupancy; keep local state authoritative
    }
  }

  const getNeighbors = useCallback(
    (coords: HexCoords): HexCoords[] => {
      const dirs = [
        { q: 1, r: 0 },
        { q: -1, r: 0 },
        { q: 0, r: 1 },
        { q: 0, r: -1 },
      ];
      return dirs
        .map(({ q, r }) => ({ q: coords.q + q, r: coords.r + r }))
        .filter((c) => tileByCoord.has(`${c.q},${c.r}`));
    },
    [tileByCoord]
  );

  const findPath = useCallback(
    (start: HexCoords, target: HexCoords, blocked: Set<string>, maxCost: number): PathResult | null => {
      const startKey = `${start.q},${start.r}`;
      const targetKey = `${target.q},${target.r}`;

      type Node = { key: string; coords: HexCoords; cost: number };
      const dist = new Map<string, number>();
      const prev = new Map<string, string | null>();
      const queue: Node[] = [{ key: startKey, coords: start, cost: 0 }];
      dist.set(startKey, 0);
      prev.set(startKey, null);

      const popSmallest = () => {
        queue.sort((a, b) => a.cost - b.cost);
        return queue.shift();
      };

      while (queue.length) {
        const current = popSmallest();
        if (!current) break;

        for (const n of getNeighbors(current.coords)) {
          const key = `${n.q},${n.r}`;
          if (blocked.has(key)) continue;
          const tile = tileByCoord.get(key);
          if (!tile || !tile.passable) continue;
          const tentative = current.cost + tile.movementCost;
          if (tentative > maxCost) continue;
          const known = dist.get(key);
          if (known == null || tentative < known) {
            dist.set(key, tentative);
            prev.set(key, current.key);
            queue.push({ key, coords: n, cost: tentative });
          }
        }
      }

      if (!dist.size) return null;

      const reachableTargetCost = dist.get(targetKey);
      let bestKey: string | null = null;
      let bestCost = Infinity;
      let bestHeuristic = Infinity;

      dist.forEach((cost, key) => {
        if (cost > maxCost) return;
        const [q, r] = key.split(",").map(Number);
        const heuristic = Math.abs(q - target.q) + Math.abs(r - target.r);
        if (key === targetKey) {
          bestKey = key;
          bestCost = cost;
          bestHeuristic = heuristic;
          return;
        }
        if (
          reachableTargetCost === undefined &&
          (heuristic < bestHeuristic || (heuristic === bestHeuristic && cost < bestCost))
        ) {
          bestKey = key;
          bestCost = cost;
          bestHeuristic = heuristic;
        }
      });

      if (!bestKey) return null;

      const path: HexCoords[] = [];
      let k: string | null = bestKey;
      while (k) {
        const [q, r] = k.split(",").map(Number);
        path.push({ q, r });
        k = prev.get(k) ?? null;
      }

      return { cost: bestCost, path: path.reverse() };
    },
    [getNeighbors, tileByCoord]
  );

  function tileClass(tile?: Tile): string {
    if (!tile) {
      return "bg-slate-700/40 text-slate-500";
    }

    switch (tile.terrain) {
      case "water":
        return "bg-sky-700";
      case "bridge":
        return "bg-orange-500";
      case "ford":
        return "bg-cyan-700";
      case "road":
        return "bg-amber-700";
      case "hill":
        return "bg-lime-700";
      case "forest":
        return "bg-emerald-900";
      case "city":
        return "bg-yellow-500";
      case "swamp":
        return "bg-teal-700";
      case "plain":
      default:
        return "bg-emerald-600";
    }
  }

  function tileIcon(tile?: Tile): string {
    if (!tile) return "";

    switch (tile.terrain) {
      case "city":
        return "C";
      case "bridge":
        return "B";
      case "ford":
        return "F";
      default:
        return "";
    }
  }

  function onDragStart(e: DragEvent, unitId: number) {
    e.dataTransfer.setData("text/unit-id", String(unitId));
  }

  function canDropOnTile(q: number, r: number): boolean {
    const tile = tileByCoord.get(`${q},${r}`);
    if (!tile || !tile.passable) return false;
    return !occupiedMap.has(`${q},${r}`);
  }

  const placeUnit = useCallback(
    async (unitId: number, coords: HexCoords) => {
      if (phase !== "deployment") return;
      const unit = playerUnits.find((u) => u.uniqueId === unitId);
      if (!unit) return;
      if (!allowedDeployColumns.has(coords.q)) {
        setError("You can deploy player units only in the first 3 columns.");
        return;
      }
      if (!canDropOnTile(coords.q, coords.r)) {
        setError("Tile is occupied or impassable.");
        return;
      }
      setError(null);
      setPlayerUnits((prev) =>
        prev.map((u) => (u.uniqueId === unitId ? { ...u, position: coords } : u))
      );
      await setUnitPositionOnBackend(unitId, coords);
    },
    [phase, playerUnits, allowedDeployColumns]
  );

  function onTileDrop(e: DragEvent, q: number, r: number) {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/unit-id");
    if (!data) return;
    const unitId = Number(data);
    void placeUnit(unitId, { q, r });
  }

  async function mirrorEnemyDeployment() {
    if (!board) return;
    const minQ = columns[0];
    const maxQ = columns[columns.length - 1];
    const deployComplete = playerUnits.every((u) => u.position);
    if (!deployComplete) {
      setError("Place all player units before continuing.");
      return;
    }
    const updatedEnemy = enemyUnits.map((enemyUnit, idx) => {
      const source = playerUnits[idx];
      if (!source?.position) return enemyUnit;
      const mirrored = {
        q: mirroredQ(source.position.q),
        r: source.position.r,
      };
      // clamp to board bounds on the mirrored side
      const clampedQ = Math.max(minQ, Math.min(maxQ, mirrored.q));
      return { ...enemyUnit, position: { q: clampedQ, r: mirrored.r } };
    });
    setEnemyUnits(updatedEnemy);
    for (const u of updatedEnemy) {
      if (u.position) {
        await setUnitPositionOnBackend(u.uniqueId, u.position);
      }
    }
    setPhase("battle");
    setActiveSide("player");
    setMoved({ player: new Set(), enemy: new Set() });
    setSelectedUnitId(null);
    setPathCoords([]);
  }

  function selectUnit(unit: OwnedUnit) {
    if (phase !== "battle") return;
    if (unit.owner !== activeSide) return;
    setSelectedUnitId(unit.uniqueId);
    setPathCoords([]);
  }

  async function handleMoveTo(q: number, r: number) {
    if (phase !== "battle" || !selectedUnit || !selectedUnit.position) return;
    if (selectedUnit.owner !== activeSide) return;

    const start = selectedUnit.position;
    const blocked = new Set<string>();
    occupiedMap.forEach((u, key) => {
      if (u.uniqueId !== selectedUnit.uniqueId) {
        blocked.add(key);
      }
    });

    const pathResult = findPath(start, { q, r }, blocked, selectedUnit.speed);
    if (!pathResult || pathResult.path.length === 0) {
      setError("No reachable path within movement points.");
      return;
    }

    const destination = pathResult.path[pathResult.path.length - 1];
    if (destination.q === start.q && destination.r === start.r && (q !== start.q || r !== start.r)) {
      setError("No reachable path within movement points.");
      setPathCoords([]);
      return;
    }
    const destKey = `${destination.q},${destination.r}`;
    const occupantAtDest = occupiedMap.get(destKey);
    if (occupantAtDest && occupantAtDest.uniqueId !== selectedUnit.uniqueId) {
      setError("Destination is occupied.");
      return;
    }

    setError(null);
    setPathCoords(pathResult.path);

    const updateFn = selectedUnit.owner === "player" ? setPlayerUnits : setEnemyUnits;
    updateFn((prev) =>
      prev.map((u) =>
        u.uniqueId === selectedUnit.uniqueId ? { ...u, position: destination } : u
      )
    );
    await setUnitPositionOnBackend(selectedUnit.uniqueId, destination);

    const nextMovedPlayer = new Set(moved.player);
    const nextMovedEnemy = new Set(moved.enemy);
    (selectedUnit.owner === "player" ? nextMovedPlayer : nextMovedEnemy).add(selectedUnit.uniqueId);
    setMoved({ player: nextMovedPlayer, enemy: nextMovedEnemy });

    const unitsForSide = selectedUnit.owner === "player" ? playerUnits : enemyUnits;
    const movedSet = selectedUnit.owner === "player" ? nextMovedPlayer : nextMovedEnemy;
    const allMoved = unitsForSide.every((u) => movedSet.has(u.uniqueId));
    if (allMoved) {
      const nextSide = activeSide === "player" ? "enemy" : "player";
      const resetForNextRound = activeSide === "enemy";
      setActiveSide(nextSide);
      setSelectedUnitId(null);
      setPathCoords([]);
      if (resetForNextRound) {
        setMoved({ player: new Set(), enemy: new Set() });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-slate-200">Loading board...</div>
    );
  }

  if (error && !board) {
    return (
      <div className="p-6 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="text-sm text-slate-300">
            Phase: {phase === "deployment" ? "Deployment" : "Battle"} | Turn:{" "}
            {activeSide === "player" ? "Player" : "Enemy"}
          </p>
        </div>
        {phase === "deployment" && (
          <button
            type="button"
            onClick={mirrorEnemyDeployment}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-white text-sm disabled:opacity-50"
            disabled={!playerUnits.every((u) => u.position)}
          >
            Continue (mirror enemy)
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {board && (
        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
          <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900/50 p-2">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, 3rem)`,
              }}
            >
              {rows.flatMap((r) =>
                columns.map((q) => {
                  const tile = tileByCoord.get(`${q},${r}`);
                  const occupant = occupiedMap.get(`${q},${r}`);
                  const isSelected = occupant && occupant.uniqueId === selectedUnitId;
                  const isPath = pathKeys.has(`${q},${r}`);
                  const canDrop =
                    phase === "deployment" &&
                    allowedDeployColumns.has(q) &&
                    canDropOnTile(q, r);

                  return (
                    <div
                      key={`${q},${r}`}
                      draggable={false}
                      onClick={() => {
                        if (occupant) {
                          selectUnit(occupant);
                        } else if (selectedUnit) {
                          void handleMoveTo(q, r);
                        }
                      }}
                      onDragOver={(e) => {
                        if (canDrop) e.preventDefault();
                      }}
                      onDrop={(e) => onTileDrop(e, q, r)}
                      className={`w-12 aspect-square ${tileClass(
                        tile
                      )} rounded-md border flex items-center justify-center text-[10px] leading-tight text-slate-100 relative ${
                        canDrop ? "border-amber-300" : "border-slate-900"
                      } ${isSelected ? "ring-2 ring-amber-400" : ""} ${
                        isPath ? "outline outline-2 outline-cyan-300" : ""
                      }`}
                      title={
                        tile
                          ? `q=${tile.coords.q}, r=${tile.coords.r}, terrain=${tile.terrain}`
                          : `q=${q}, r=${r} (no tile data)`
                      }
                    >
                      {tileIcon(tile)}
                      {occupant && (
                        <div
                          className={`absolute inset-0 rounded-md bg-black/25 flex items-center justify-center px-1 text-center ${
                            occupant.owner === "player" ? "text-red-100" : "text-blue-100"
                          }`}
                        >
                          <img
                            src={`/units/${occupant.id}.png`}
                            alt={occupant.name}
                            className="w-8 h-8 object-contain drop-shadow-md"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Units panel</h2>
              <p className="text-sm text-slate-400">
                {phase === "deployment"
                  ? "Drag player units onto the first 3 columns on the left."
                  : `Active side: ${activeSide === "player" ? "player" : "enemy"}. Click a unit then a destination tile.`}
              </p>
            </div>

            <div className="space-y-3">
              {[...playerUnits, ...enemyUnits]
                .filter((u) => (phase === "deployment" ? u.owner === "player" : u.owner === activeSide))
                .map((unit) => {
                  const isSelected = selectedUnitId === unit.uniqueId;
                  const hasMoved =
                    unit.owner === "player"
                      ? moved.player.has(unit.uniqueId)
                      : moved.enemy.has(unit.uniqueId);

                  return (
                    <div
                      key={unit.uniqueId}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                        unit.owner === "player"
                          ? "border-red-400/40 bg-red-900/20"
                          : "border-blue-400/40 bg-blue-900/20"
                      } ${isSelected ? "ring-2 ring-amber-400" : ""}`}
                      draggable={phase === "deployment" && unit.owner === "player"}
                      onDragStart={(e) => onDragStart(e, unit.uniqueId)}
                      onClick={() => selectUnit(unit)}
                    >
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <img
                            src={`/units/${unit.id}.png`}
                            alt={unit.name}
                            className="w-5 h-5 object-contain"
                          />
                          <span>{unit.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {unit.position
                            ? `q=${unit.position.q}, r=${unit.position.r}`
                            : "not placed"}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-200">
                        {phase === "battle"
                          ? hasMoved
                            ? "moved"
                            : "ready"
                          : unit.position
                          ? "placed"
                          : "deploy"}
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Deployment: drag player units only onto the first 3 columns. After "Continue" the enemy is
        mirrored on the right. In battle: click a unit, then a tile; a path is drawn and the unit
        moves as far as its movement points allow. Turns swap after all units on a side move.
      </p>
    </div>
  );
}
