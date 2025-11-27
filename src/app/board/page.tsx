// src/app/board/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Board, HexCoords, Tile } from "@/shared/board";
import type { ApplyActionDto, GameState } from "@/shared/game";
import type { UnitDto } from "@/shared/unit";

type OwnedUnit = UnitDto & {
  uniqueId: number;
  position: HexCoords | null;
  owner: "player" | "enemy";
  color?: string;
  currentHp: number;
};

type PathResult = {
  cost: number;
  path: HexCoords[];
};

type DamageMarker = {
  id: string;
  coords: HexCoords;
  amount: number;
};

type UnitGroupStats = {
  id: string;
  name: string;
  count: number;
  alive: number;
  damageTaken: number;
  maxHpTotal: number;
};

type VictoryMode = "points" | "elimination" | "turns";

type GameResult = {
  winner: "player" | "enemy" | "draw" | null;
  reason: string;
};

export default function BoardPage() {
  const { user, isReady: isAuthReady, authFetch } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<number | null>(null);
  const [enemyPlayerId, setEnemyPlayerId] = useState<number | null>(null);
  const [unitTemplates, setUnitTemplates] = useState<UnitDto[]>([]);
  const [playerUnits, setPlayerUnits] = useState<OwnedUnit[]>([]);
  const [enemyUnits, setEnemyUnits] = useState<OwnedUnit[]>([]);
  const [phase, setPhase] = useState<"deployment" | "battle" | "finished">("deployment");
  const [activeSide, setActiveSide] = useState<"player" | "enemy">("player");
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [playerColor, setPlayerColor] = useState<string>("red");
  const [enemyColor, setEnemyColor] = useState<string>("blue");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [pathCoords, setPathCoords] = useState<HexCoords[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [victoryMode, setVictoryMode] = useState<VictoryMode>("points");
  const [turnLimit, setTurnLimit] = useState<number>(6);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [gameResult, setGameResult] = useState<GameResult>({ winner: null, reason: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [acted, setActed] = useState<{ player: Set<number>; enemy: Set<number> }>(() => ({
    player: new Set(),
    enemy: new Set(),
  }));
  const [moved, setMoved] = useState<{ player: Set<number>; enemy: Set<number> }>(() => ({
    player: new Set(),
    enemy: new Set(),
  }));
  const [damageMarkers, setDamageMarkers] = useState<DamageMarker[]>([]);
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const unitTemplatesRef = useRef<UnitDto[]>([]);
  const localPlayerIdRef = useRef<number | null>(null);
  const [hasRecordedStats, setHasRecordedStats] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null
  );
  const panMoved = useRef(false);

  useEffect(() => {
    setHasRecordedStats(false);
  }, [gameId]);

  const canonicalColor = (value: string | undefined, fallback: "red" | "blue"): "red" | "blue" => {
    const low = (value ?? "").toLowerCase();
    if (low.includes("blue")) return "blue";
    if (low.includes("red")) return "red";
    return fallback;
  };

  const normalizeColor = (c: string | undefined, owner: "player" | "enemy") => {
    return canonicalColor(c, owner === "enemy" ? "blue" : "red");
  };

  const syncFromState = useCallback(
    (state: GameState, templates: UnitDto[] = unitTemplatesRef.current, explicitLocalId?: number | null) => {
      const mappedBoard: Board = {
        tiles: state.tiles.map((t) => ({
          coords: { q: t.q, r: t.r },
          terrain: t.terrain,
          passable: t.passable,
          movementCost: t.movementCost,
        })),
      };
      setBoard(mappedBoard);
      setGameId(state.gameId);
      setTurnNumber(state.turnNumber);

      const playerId = explicitLocalId ?? localPlayerIdRef.current ?? state.players[0]?.playerId ?? null;
      const enemyId = state.players.find((p) => p.playerId !== playerId)?.playerId ?? null;
      localPlayerIdRef.current = playerId;
      setLocalPlayerId(playerId);
      setEnemyPlayerId(enemyId);

      const playerColorValue = state.players.find((p) => p.playerId === playerId)?.color;
      const enemyColorValue = state.players.find((p) => p.playerId !== playerId)?.color;
      const playerC = canonicalColor(playerColorValue, "red");
      const enemyC = canonicalColor(enemyColorValue, playerC === "red" ? "blue" : "red");
      setPlayerColor(playerC);
      setEnemyColor(enemyC);

      const ownedUnits: OwnedUnit[] = state.units.map((u) => {
        const tpl = templates.find((t) => t.id === u.template);
        const waitingForDeployment =
          state.status === "not_started" && u.q === 0 && u.r === 0 ? null : { q: u.q, r: u.r };
        return {
          ...(tpl ?? {
            id: u.template,
            name: u.template,
            maxHp: u.currentHP,
            meleeAttack: 0,
            rangedAttack: 0,
            attackRange: 1,
            defense: 0,
            speed: 1,
            cost: 0,
          }),
          uniqueId: Number(u.unitId),
          position: waitingForDeployment,
          owner: playerId != null && u.ownerPlayerId === playerId ? "player" : "enemy",
          color: state.players.find((p) => p.playerId === u.ownerPlayerId)?.color,
          currentHp: u.currentHP,
        };
      });

      setPlayerUnits(ownedUnits.filter((u) => u.owner === "player"));
      setEnemyUnits(ownedUnits.filter((u) => u.owner === "enemy"));

      const nextPhase =
        state.status === "not_started"
          ? "deployment"
          : state.status === "finished"
          ? "finished"
          : "battle";
      setPhase((prev) =>
        prev === "deployment" && nextPhase !== "finished" ? prev : nextPhase
      );
      setActiveSide(state.currentPlayerId === playerId ? "player" : "enemy");

      if (state.status === "finished") {
        setGameResult((prev) => (prev.winner ? prev : { winner: null, reason: "" }));
      } else {
        setGameResult({ winner: null, reason: "" });
      }
    },
    []
  );

  const applyActionOnBackend = useCallback(
    async (dto: ApplyActionDto) => {
      if (!gameId) {
        throw new Error("Missing game id");
      }
      const res = await authFetch(`/game/${gameId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        throw new Error(`Failed to apply action. Status: ${res.status}`);
      }
      const state = (await res.json()) as GameState;
      if (typeof window !== "undefined") {
        sessionStorage.setItem("currentGameState", JSON.stringify(state));
      }
      syncFromState(state);
      return state;
    },
    [authFetch, gameId, syncFromState]
  );

  useEffect(() => {
    async function load() {
      if (!isAuthReady) return;
      if (!user) {
        setError("Log in to load a battle.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const queryGameId = searchParams.get("gameId");
        const storedGameId =
          typeof window !== "undefined" ? sessionStorage.getItem("currentGameId") : null;
        const rawLocalPlayerId =
          typeof window !== "undefined" ? sessionStorage.getItem("localPlayerId") : null;
        const derivedLocalPlayerId = rawLocalPlayerId
          ? Number(rawLocalPlayerId)
          : user?.id ?? null;

        const idToUse = queryGameId ?? storedGameId;
        if (!idToUse) {
          setError("No active game. Go back to /army and save an army.");
          setIsLoading(false);
          return;
        }

        setGameId(idToUse);
        localPlayerIdRef.current = derivedLocalPlayerId;
        setLocalPlayerId(derivedLocalPlayerId);

        const [stateRes, unitsRes] = await Promise.all([
          authFetch(`/game/${idToUse}/state`, { cache: "no-store" }),
          authFetch("/units", { cache: "no-store" }),
        ]);

        if (!stateRes.ok) {
          throw new Error(`Failed to load game state. Status: ${stateRes.status}`);
        }
        if (!unitsRes.ok) {
          throw new Error(`Failed to load units. Status: ${unitsRes.status}`);
        }

        const state = (await stateRes.json()) as GameState;
        const templates = (await unitsRes.json()) as UnitDto[];
        unitTemplatesRef.current = templates;
        setUnitTemplates(templates);

        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentGameState", JSON.stringify(state));
          sessionStorage.setItem("currentGameId", state.gameId);
        }

        syncFromState(state, templates, derivedLocalPlayerId);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load game data.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [authFetch, isAuthReady, searchParams, syncFromState, user]);

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
      if (u.position && u.currentHp > 0) {
        map.set(`${u.position.q},${u.position.r}`, u);
      }
    });
    return map;
  }, [playerUnits, enemyUnits]);

  const alivePlayerUnits = useMemo(
    () => playerUnits.filter((u) => u.currentHp > 0),
    [playerUnits]
  );

  const aliveEnemyUnits = useMemo(
    () => enemyUnits.filter((u) => u.currentHp > 0),
    [enemyUnits]
  );

  const damageScore = useMemo(
    () => ({
      player: enemyUnits.reduce(
        (sum, u) => sum + Math.max(0, u.maxHp - (u.currentHp ?? u.maxHp)),
        0
      ),
      enemy: playerUnits.reduce(
        (sum, u) => sum + Math.max(0, u.maxHp - (u.currentHp ?? u.maxHp)),
        0
      ),
    }),
    [playerUnits, enemyUnits]
  );

  const groupedStats = useMemo(() => {
    const build = (units: OwnedUnit[]): UnitGroupStats[] => {
      const map = new Map<string, UnitGroupStats>();
      units.forEach((u) => {
        const existing =
          map.get(u.id) ??
          {
            id: u.id,
            name: u.name,
            count: 0,
            alive: 0,
            damageTaken: 0,
            maxHpTotal: 0,
          };
        const hp = u.currentHp ?? u.maxHp;
        existing.count += 1;
        existing.maxHpTotal += u.maxHp;
        existing.damageTaken += Math.max(0, u.maxHp - hp);
        if (hp > 0) {
          existing.alive += 1;
        }
        map.set(u.id, existing);
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    };
    return { player: build(playerUnits), enemy: build(enemyUnits) };
  }, [playerUnits, enemyUnits]);

  const summarizedUnits = useMemo(() => {
    const counts = new Map<string, number>();
    [...playerUnits, ...enemyUnits].forEach((u) => {
      const label = `${u.owner === "player" ? "Player" : "Enemy"} ${u.name}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => `${label} x${count}`);
  }, [enemyUnits, playerUnits]);

  const pathKeys = useMemo(() => new Set(pathCoords.map((c) => `${c.q},${c.r}`)), [pathCoords]);

  const selectedUnit = useMemo(
    () => [...playerUnits, ...enemyUnits].find((u) => u.uniqueId === selectedUnitId) ?? null,
    [playerUnits, enemyUnits, selectedUnitId]
  );

  const finishGame = useCallback(
    (winner: GameResult["winner"], reason: string) => {
      if (gameResult.winner) return;
      setGameResult({ winner, reason });
      setPhase("finished");
      setSelectedUnitId(null);
      setPathCoords([]);
      setError(null);
    },
    [gameResult.winner]
  );

  const resolveByPoints = useCallback(
    (reason: string) => {
      const playerPoints = damageScore.player;
      const enemyPoints = damageScore.enemy;
      const winner =
        playerPoints === enemyPoints ? "draw" : playerPoints > enemyPoints ? "player" : "enemy";
      finishGame(winner, `${reason} (points ${playerPoints}:${enemyPoints})`);
    },
    [damageScore.enemy, damageScore.player, finishGame]
  );

  useEffect(() => {
    if (selectedUnit && selectedUnit.currentHp <= 0) {
      setSelectedUnitId(null);
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (phase !== "battle" || gameResult.winner) return;
    const enemyAlive = aliveEnemyUnits.length;
    const playerAlive = alivePlayerUnits.length;

    if (victoryMode === "elimination") {
      if (!enemyAlive && !playerAlive) {
        finishGame("draw", "Both armies were destroyed");
      } else if (!enemyAlive) {
        finishGame("player", "All enemies defeated");
      } else if (!playerAlive) {
        finishGame("enemy", "Your units were destroyed");
      }
      return;
    }

    if (!enemyAlive || !playerAlive) {
      const reason =
        !enemyAlive && !playerAlive
          ? "Both armies were destroyed"
          : !enemyAlive
          ? "No enemy units remain"
          : "No player units remain";
      resolveByPoints(reason);
    }
  }, [
    aliveEnemyUnits.length,
    alivePlayerUnits.length,
    victoryMode,
    phase,
    gameResult.winner,
    resolveByPoints,
    finishGame,
  ]);

  useEffect(() => {
    if (phase !== "battle" || victoryMode !== "turns" || gameResult.winner) return;
    if (roundNumber > turnLimit) {
      resolveByPoints("Turn limit reached");
    }
  }, [roundNumber, turnLimit, victoryMode, phase, gameResult.winner, resolveByPoints]);

  useEffect(() => {
    if (!user || !gameResult.winner || hasRecordedStats || !isAuthReady) return;
    const parsedId = gameId ? Number(gameId) : NaN;
    const safeGameId = Number.isFinite(parsedId) ? parsedId : undefined;
    const result =
      gameResult.winner === "player" ? "win" : gameResult.winner === "enemy" ? "lose" : "draw";
    const payload = {
      gameId: safeGameId,
      result,
      damageDealt: damageScore.player,
      damageTaken: damageScore.enemy,
      units: summarizedUnits,
    };

    const sendStats = async () => {
      try {
        const res = await authFetch("/stats/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`Failed to record stats. Status: ${res.status}`);
        }
        setHasRecordedStats(true);
      } catch (e) {
        console.error("Failed to persist battle stats", e);
      }
    };

    void sendStats();
  }, [
    authFetch,
    damageScore.enemy,
    damageScore.player,
    gameId,
    gameResult.winner,
    hasRecordedStats,
    isAuthReady,
    summarizedUnits,
    user,
  ]);

  async function setUnitPositionOnBackend(unitId: number, coords: HexCoords, owner: "player" | "enemy") {
    const playerId = owner === "player" ? localPlayerId : enemyPlayerId;
    if (!playerId) return;
    try {
      await applyActionOnBackend({
        type: "MOVE",
        playerId,
        payload: { unitId, q: coords.q, r: coords.r },
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to move unit on backend");
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

  const distance = (a: HexCoords, b: HexCoords) =>
    Math.abs(a.q - b.q) + Math.abs(a.r - b.r);

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

  const ICON_NAME: Record<string, string> = {
    "twelve-pounder-cannon": "12-pounder-cannon",
    "six-pounder-cannon": "6-pounder-cannon",
  };

  function unitIconSrc(unit: OwnedUnit): string {
    const baseColor = unit.owner === "player" ? playerColor : enemyColor;
    const color = normalizeColor(baseColor ?? unit.color, unit.owner);
    const baseName = ICON_NAME[unit.id] ?? unit.id;
    // handle known blue typo for howitzer
    if (unit.id === "howitzer-cannon" && color === "blue") {
      return `/units/howitze-cannon-blue.png`;
    }
    return `/units/${baseName}-${color}.png`;
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

  function centerOnSide(side: "player" | "enemy") {
    const container = mapRef.current;
    if (!container) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const target = side === "player" ? 0 : Math.max(0, maxScrollLeft);
    container.scrollTo({ left: target, behavior: "smooth" });
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
      await setUnitPositionOnBackend(unitId, coords, "player");
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
        await setUnitPositionOnBackend(u.uniqueId, u.position, "enemy");
      }
    }
    setRoundNumber(1);
    setGameResult({ winner: null, reason: "" });
    setPhase("battle");
    setActiveSide("player");
    setActed({ player: new Set(), enemy: new Set() });
    setMoved({ player: new Set(), enemy: new Set() });
    setSelectedUnitId(null);
    setPathCoords([]);
  }

  function selectUnit(unit: OwnedUnit) {
    if (phase !== "battle" || gameResult.winner) return;
    if (unit.owner !== activeSide || unit.currentHp <= 0) return;
    setSelectedUnitId(unit.uniqueId);
    setPathCoords([]);
  }

  async function handleMoveTo(q: number, r: number) {
    if (phase !== "battle" || gameResult.winner || !selectedUnit || !selectedUnit.position) return;
    if (selectedUnit.owner !== activeSide || selectedUnit.currentHp <= 0) return;
    const actedSet = selectedUnit.owner === "player" ? acted.player : acted.enemy;
    if (actedSet.has(selectedUnit.uniqueId)) {
      setError("This unit already acted this turn.");
      return;
    }
    const movedSet = selectedUnit.owner === "player" ? moved.player : moved.enemy;
    if (movedSet.has(selectedUnit.uniqueId)) {
      setError("This unit already moved this turn.");
      return;
    }

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
    await setUnitPositionOnBackend(selectedUnit.uniqueId, destination, selectedUnit.owner);

    const nextMovedPlayer = new Set(moved.player);
    const nextMovedEnemy = new Set(moved.enemy);
    (selectedUnit.owner === "player" ? nextMovedPlayer : nextMovedEnemy).add(selectedUnit.uniqueId);
    setMoved({ player: nextMovedPlayer, enemy: nextMovedEnemy });
  }

  async function handleAttack(target: OwnedUnit) {
    if (phase !== "battle" || gameResult.winner || !selectedUnit || !selectedUnit.position) return;
    if (selectedUnit.owner !== activeSide || selectedUnit.currentHp <= 0) return;
    if (target.owner === selectedUnit.owner) {
      setSelectedUnitId(target.uniqueId);
      return;
    }
    if (target.currentHp <= 0) return;
    const actedSet = selectedUnit.owner === "player" ? acted.player : acted.enemy;
    if (actedSet.has(selectedUnit.uniqueId)) {
      setError("This unit already acted this turn.");
      return;
    }
    const dist = distance(selectedUnit.position, target.position ?? { q: 0, r: 0 });
    if (dist > selectedUnit.attackRange) {
      setError("Target out of range.");
      return;
    }
    const isRanged = dist > 1 && selectedUnit.rangedAttack > 0;
    const damage = isRanged ? selectedUnit.rangedAttack : selectedUnit.meleeAttack;
    if (damage <= 0) {
      setError("This unit cannot deal damage.");
      return;
    }
    const damageApplied = Math.min(damage, target.currentHp);

    setError(null);
    setPathCoords([]);
    setDamageMarkers((prev) => [
      ...prev,
      {
        id: `${target.uniqueId}-${Date.now()}`,
        coords: target.position ?? { q: 0, r: 0 },
        amount: damageApplied,
      },
    ]);
    setTimeout(() => {
      setDamageMarkers((prev) => prev.slice(1));
    }, 900);

    await applyActionOnBackend({
      type: "ATTACK",
      playerId: selectedUnit.owner === "player" ? localPlayerId ?? undefined : enemyPlayerId ?? undefined,
      payload: { unitId: selectedUnit.uniqueId, targetUnitId: target.uniqueId, damage: damageApplied },
    });

    const nextActedPlayer = new Set(acted.player);
    const nextActedEnemy = new Set(acted.enemy);
    const nextMovedPlayer = new Set(moved.player);
    const nextMovedEnemy = new Set(moved.enemy);
    (selectedUnit.owner === "player" ? nextActedPlayer : nextActedEnemy).add(selectedUnit.uniqueId);
    (selectedUnit.owner === "player" ? nextMovedPlayer : nextMovedEnemy).add(selectedUnit.uniqueId);
    setActed({ player: nextActedPlayer, enemy: nextActedEnemy });
    setMoved({ player: nextMovedPlayer, enemy: nextMovedEnemy });
  }

  async function endTurnInternal() {
    if (gameResult.winner) return;
    try {
      const actingPlayerId =
        activeSide === "player" ? localPlayerId ?? undefined : enemyPlayerId ?? undefined;
      const newState = await applyActionOnBackend({
        type: "END_TURN",
        playerId: actingPlayerId,
      });
      setRoundNumber(newState.turnNumber);
      const nextSide = newState.currentPlayerId === localPlayerId ? "player" : "enemy";
      centerOnSide(nextSide);
      setSelectedUnitId(null);
      setPathCoords([]);
      setError(null);
      setActed({ player: new Set(), enemy: new Set() });
      setMoved({ player: new Set(), enemy: new Set() });
    } catch (e: any) {
      setError(e?.message ?? "Failed to end turn");
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
    <div className="p-6 max-w-8xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="text-sm text-slate-300">
            Phase:{" "}
            {phase === "deployment"
              ? "Deployment"
              : phase === "battle"
              ? "Battle"
              : "Finished"}{" "}
            | Turn: {phase === "finished" ? "-" : activeSide === "player" ? "Player" : "Enemy"} |
            Round: {roundNumber}
          </p>
          {gameResult.winner && (
            <p className="text-sm text-amber-300">
              Winner: {gameResult.winner === "draw" ? "Draw" : gameResult.winner} |{" "}
              {gameResult.reason}
            </p>
          )}
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
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Victory mode</h2>
                <p className="text-xs text-slate-400">Pick how the winner is determined.</p>
              </div>
              <span className="text-[11px] text-slate-300">
                {phase === "deployment" ? "editable" : "locked after start"}
              </span>
            </div>
            <div className="space-y-3 pt-2">
              <label className="block text-xs text-slate-300">
                Mode
                <select
                  value={victoryMode}
                  onChange={(e) => setVictoryMode(e.target.value as VictoryMode)}
                  disabled={phase !== "deployment"}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="points">Points (manual finish)</option>
                  <option value="elimination">Last unit standing</option>
                  <option value="turns">Turn limit</option>
                </select>
              </label>
              {victoryMode === "turns" && (
                <label className="block text-xs text-slate-300">
                  Number of rounds (player+enemy)
                  <input
                    type="number"
                    min={1}
                    value={turnLimit}
                    onChange={(e) => setTurnLimit(Math.max(1, Number(e.target.value) || 1))}
                    disabled={phase !== "deployment"}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
              )}
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Points: damage dealt = score, finish when you decide.</li>
                <li>Last unit standing: auto-finish when one side has no survivors.</li>
                <li>Turn limit: after selected rounds the score decides.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Battle status</h2>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-100">
              <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                <div className="text-[11px] text-slate-400">Player damage</div>
                <div className="font-semibold text-emerald-200">{damageScore.player}</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                <div className="text-[11px] text-slate-400">Enemy damage</div>
                <div className="font-semibold text-amber-200">{damageScore.enemy}</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                <div className="text-[11px] text-slate-400">Player alive</div>
                <div className="font-semibold">
                  {alivePlayerUnits.length} / {playerUnits.length}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                <div className="text-[11px] text-slate-400">Enemy alive</div>
                <div className="font-semibold">
                  {aliveEnemyUnits.length} / {enemyUnits.length}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/40 p-2 col-span-2">
                <div className="text-[11px] text-slate-400">Turn tracker</div>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Active: {phase === "finished" ? "finished" : activeSide === "player" ? "player" : "enemy"}
                  </span>
                  <span>
                    {victoryMode === "turns"
                      ? `Rounds left: ${Math.max(0, turnLimit - (roundNumber - 1))}`
                      : "No round cap"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Finish control</h2>
            <p className="text-xs text-slate-400">
              Use manual finish for the points mode or to close a stalemate. Final score is always
              based on damage dealt.
            </p>
            <button
              type="button"
              onClick={() => resolveByPoints("Manual finish")}
              disabled={phase !== "battle" || !!gameResult.winner}
              className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-slate-50 py-2 text-sm font-semibold"
            >
              End game now (score by damage)
            </button>
            {victoryMode === "points" && !gameResult.winner && (
              <p className="text-[11px] text-slate-400">
                Points mode: click the button when you want to stop and score.
              </p>
            )}
            {gameResult.winner && (
              <div className="rounded border border-emerald-600/50 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100">
                Result: {gameResult.winner === "draw" ? "Draw" : gameResult.winner} -{" "}
                {gameResult.reason}
              </div>
            )}
          </div>
        </div>
      )}

      {board && (
        <div className="grid gap-4 lg:grid-cols-[280px,1fr,320px]">
          <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Unit details</h2>
            {selectedUnit ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={unitIconSrc(selectedUnit)}
                    alt={selectedUnit.name}
                    className="w-6 h-6 object-contain"
                  />
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{selectedUnit.name}</div>
                    <div className="text-xs text-slate-400">
                      {selectedUnit.owner === "player" ? "Player unit" : "Enemy unit"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>HP</span>
                    <span>
                      {selectedUnit.currentHp}/{selectedUnit.maxHp}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, (selectedUnit.currentHp / selectedUnit.maxHp) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                  <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                    <div className="text-slate-400 text-[11px]">Melee</div>
                    <div className="font-semibold">{selectedUnit.meleeAttack}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                    <div className="text-slate-400 text-[11px]">Ranged</div>
                    <div className="font-semibold">{selectedUnit.rangedAttack}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                    <div className="text-slate-400 text-[11px]">Range</div>
                    <div className="font-semibold">{selectedUnit.attackRange}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                    <div className="text-slate-400 text-[11px]">Speed</div>
                    <div className="font-semibold">{selectedUnit.speed}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-800/40 p-2">
                    <div className="text-slate-400 text-[11px]">Defense</div>
                    <div className="font-semibold">{selectedUnit.defense}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a unit to see its stats.</p>
            )}
          </aside>

          <div
            ref={mapRef}
            className="overflow-auto rounded-xl border border-slate-800 bg-slate-900/50 p-2 max-h-[75vh] cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const container = mapRef.current;
              if (!container) return;
              setIsPanning(true);
              panMoved.current = false;
              panStart.current = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: container.scrollLeft,
                scrollTop: container.scrollTop,
              };
            }}
            onMouseMove={(e) => {
              if (!isPanning || !panStart.current || !mapRef.current) return;
              e.preventDefault();
              const deltaX = e.clientX - panStart.current.x;
              const deltaY = e.clientY - panStart.current.y;
              if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                panMoved.current = true;
              }
              mapRef.current.scrollLeft = panStart.current.scrollLeft - deltaX;
              mapRef.current.scrollTop = panStart.current.scrollTop - deltaY;
            }}
            onMouseUp={() => {
              setIsPanning(false);
              panStart.current = null;
            }}
            onMouseLeave={() => {
              setIsPanning(false);
              panStart.current = null;
              panMoved.current = false;
            }}
          >
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
                        if (panMoved.current) {
                          panMoved.current = false;
                          return;
                        }
                        if (occupant) {
                          if (selectedUnit && occupant.owner !== selectedUnit.owner) {
                            void handleAttack(occupant);
                          } else {
                            selectUnit(occupant);
                          }
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
                        <>
                          <div className="absolute top-1 left-1 right-1 h-1 rounded-full bg-black/50 overflow-hidden border border-slate-900/60">
                            <div
                              className="h-full bg-emerald-400"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, (occupant.currentHp / occupant.maxHp) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                          <div
                            className={`absolute inset-0 rounded-md bg-black/25 flex items-center justify-center px-1 text-center ${
                              occupant.owner === "player" ? "text-red-100" : "text-blue-100"
                            }`}
                          >
                            <img
                              src={unitIconSrc(occupant)}
                              alt={occupant.name}
                              className="w-8 h-8 object-contain drop-shadow-md"
                            />
                          </div>
                        </>
                      )}
                      {damageMarkers
                        .filter((m) => m.coords.q === q && m.coords.r === r)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-red-300 animate-bounce"
                          >
                            -{m.amount}
                          </div>
                        ))}
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
                  : `Active side: ${activeSide === "player" ? "player" : "enemy"}. Click a unit, then an enemy to attack or an empty tile to move (one action per turn).`}
              </p>
            </div>

            <div className="space-y-3">
              {[...playerUnits, ...enemyUnits]
                .filter(
                  (u) =>
                    u.currentHp > 0 &&
                    (phase === "deployment" ? u.owner === "player" : u.owner === activeSide)
                )
                .map((unit) => {
                  const isSelected = selectedUnitId === unit.uniqueId;
                  const hasActed =
                    unit.owner === "player"
                      ? acted.player.has(unit.uniqueId)
                      : acted.enemy.has(unit.uniqueId);
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
                            src={unitIconSrc(unit)}
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
                          ? hasActed
                            ? "acted"
                            : hasMoved
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

            {phase === "battle" && (
              <button
                type="button"
                onClick={endTurnInternal}
                className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 py-2 text-sm font-medium"
              >
                End turn
              </button>
            )}
          </aside>
        </div>
      )}

      {board && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Battle stats</h3>
            <div className="text-xs text-slate-300">
              Total damage - player: {damageScore.player} | enemy: {damageScore.enemy}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="flex items-center justify-between text-sm text-slate-100">
                <span>Player units</span>
                <span>
                  Alive {alivePlayerUnits.length} / {playerUnits.length}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {groupedStats.player.map((g) => (
                  <div
                    key={`player-${g.id}`}
                    className="rounded border border-red-500/40 bg-red-900/10 p-2 text-xs text-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-[11px] text-slate-300">Total: {g.count}</div>
                    </div>
                    <div className="text-right">
                      <div>Alive: {g.alive}</div>
                      <div>
                        Damage: {g.damageTaken}/{g.maxHpTotal}
                      </div>
                    </div>
                  </div>
                ))}
                {!groupedStats.player.length && (
                  <p className="text-xs text-slate-400">No player units loaded.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="flex items-center justify-between text-sm text-slate-100">
                <span>Enemy units</span>
                <span>
                  Alive {aliveEnemyUnits.length} / {enemyUnits.length}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {groupedStats.enemy.map((g) => (
                  <div
                    key={`enemy-${g.id}`}
                    className="rounded border border-blue-500/40 bg-blue-900/10 p-2 text-xs text-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-[11px] text-slate-300">Total: {g.count}</div>
                    </div>
                    <div className="text-right">
                      <div>Alive: {g.alive}</div>
                      <div>
                        Damage: {g.damageTaken}/{g.maxHpTotal}
                      </div>
                    </div>
                  </div>
                ))}
                {!groupedStats.enemy.length && (
                  <p className="text-xs text-slate-400">No enemy units loaded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Deployment: drag player units only onto the first 3 columns. After "Continue" the enemy is
        mirrored on the right. In battle: click a unit, then an enemy to attack or an empty tile to
        move (one action per unit per turn). Pick the victory mode above (points = manual finish,
        elimination = auto when one side dies, turn limit = auto after chosen rounds). You can pan
        the map with scrollbars or by click-dragging the map.
      </p>
    </div>
  );
}
