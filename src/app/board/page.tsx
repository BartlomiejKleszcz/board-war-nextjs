// src/app/board/page.tsx
// 0) Opis pliku (wysoki poziom):
//    - Renderuje ekran planszy walki i cala logike UI bitwy.
//    - Laduje stan gry i szablony jednostek, a nastepnie synchronizuje UI ze stanem backendu.
//    - Obsluguje fazy gry (deployment/battle/finished), tury, zwyciestwo i statystyki.
//    - Udostepnia interakcje: rozmieszczenie, ruch, atak, koniec tury, panning mapy.
//    - Renderuje panele informacyjne (status, jednostki, statystyki, kontrola zakonczenia).

// 1) Wymusza renderowanie po stronie klienta (Next.js App Router).
"use client";

// 2) Importy narzedzi UI/React, typow i wspolnych struktur danych gry.
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Board, HexCoords, Tile } from "@/shared/board";
import type { ApplyActionDto, GameState } from "@/shared/game";
import type { UnitDto } from "@/shared/unit";

// 3) Pomocnicza funkcja do bezpiecznego odczytu komunikatu bledu.
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// 4) Typ jednostki "wlasnej" na potrzeby UI (z pozycja, wlascicielem i HP).
type OwnedUnit = UnitDto & {
  uniqueId: number;
  position: HexCoords | null;
  owner: "player" | "enemy";
  color?: string;
  currentHp: number;
};

// 5) Wynik wyszukiwania sciezki: koszt i lista wspolrzednych.
type PathResult = {
  cost: number;
  path: HexCoords[];
};

// 6) Marker obrazen do wyswietlenia na planszy.
type DamageMarker = {
  id: string;
  coords: HexCoords;
  amount: number;
};

// 7) Statystyki grupy jednostek (do panelu statystyk).
type UnitGroupStats = {
  id: string;
  name: string;
  count: number;
  alive: number;
  damageTaken: number;
  maxHpTotal: number;
};

// 8) Tryb zwyciestwa w grze.
type VictoryMode = "points" | "elimination" | "turns";

// 9) Wynik koncowy gry + powod.
type GameResult = {
  winner: "player" | "enemy" | "draw" | null;
  reason: string;
};

// 10) Opis wizualny kafelka na planszy.
type TileVisual = {
  className: string;
  style: CSSProperties;
  label?: string;
};

export default function BoardPage() {
  // 11) Owijamy w Suspense, bo uzywamy hooka useSearchParams (moze byc async).
  return (
    <Suspense fallback={<div className="p-6 text-slate-200">Loading board...</div>}>
      {/* 12) Wlasciwa zawartosc planszy. */}
      <BoardPageContent />
    </Suspense>
  );
}

function BoardPageContent() {
  // 13) Kontekst autoryzacji + funkcja authFetch.
  const { user, isReady: isAuthReady, authFetch } = useAuth();
  // 14) Stan planszy i identyfikator gry.
  const [board, setBoard] = useState<Board | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  // 15) Identyfikatory graczy (lokalny i przeciwnik).
  const [localPlayerId, setLocalPlayerId] = useState<number | null>(null);
  const [enemyPlayerId, setEnemyPlayerId] = useState<number | null>(null);
  // 16) Jednostki obu stron.
  const [playerUnits, setPlayerUnits] = useState<OwnedUnit[]>([]);
  const [enemyUnits, setEnemyUnits] = useState<OwnedUnit[]>([]);
  // 17) Faza gry i tura aktywnej strony.
  const [phase, setPhase] = useState<"deployment" | "battle" | "finished">("deployment");
  const [activeSide, setActiveSide] = useState<"player" | "enemy">("player");
  // 18) Kolory stron (uzywane w UI i stylach).
  const [playerColor, setPlayerColor] = useState<string>("red");
  const [enemyColor, setEnemyColor] = useState<string>("blue");
  // 19) UI: zaznaczona jednostka i aktualnie wyswietlana sciezka ruchu.
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [pathCoords, setPathCoords] = useState<HexCoords[]>([]);
  // 20) Komunikat bledu dla UI.
  const [error, setError] = useState<string | null>(null);
  // 21) Ustawienia zwyciestwa i liczniki tur.
  const [victoryMode, setVictoryMode] = useState<VictoryMode>("points");
  const [turnLimit, setTurnLimit] = useState<number>(6);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  // 22) Wynik gry + flaga ladowania.
  const [gameResult, setGameResult] = useState<GameResult>({ winner: null, reason: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingAi, setIsResolvingAi] = useState(false);
  // 23) Zestawy "kto juz wykonal akcje/ruch" w danej turze.
  const [acted, setActed] = useState<{ player: Set<number>; enemy: Set<number> }>(() => ({
    player: new Set(),
    enemy: new Set(),
  }));
  const [moved, setMoved] = useState<{ player: Set<number>; enemy: Set<number> }>(() => ({
    player: new Set(),
    enemy: new Set(),
  }));
  // 24) Tymczasowe markery obrazen (UI "pływajacych" liczb).
  const [damageMarkers, setDamageMarkers] = useState<DamageMarker[]>([]);
  // 25) Parametry query (np. gameId z URL).
  const searchParams = useSearchParams();
  // 26) Referencje do DOM i danych, ktore nie powinny powodowac rerenderu.
  const mapRef = useRef<HTMLDivElement | null>(null);
  const unitTemplatesRef = useRef<UnitDto[]>([]);
  const localPlayerIdRef = useRef<number | null>(null);
  // 27) Flagi pomocnicze: zapisywanie statystyk i obsluga panningu mapy.
  const [hasRecordedStats, setHasRecordedStats] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(
    null
  );
  const panMoved = useRef(false);

  // 28) Resetujemy flage statystyk przy zmianie gry.
  useEffect(() => {
    setHasRecordedStats(false);
  }, [gameId]);

  // 29) Normalizacja nazw kolorow do kanonicznych "red"/"blue".
  const canonicalColor = (value: string | undefined, fallback: "red" | "blue"): "red" | "blue" => {
    const low = (value ?? "").toLowerCase();
    if (low.includes("blue")) return "blue";
    if (low.includes("red")) return "red";
    return fallback;
  };

  // 30) Wyliczenie koloru na podstawie wlasciciela jednostki.
  const normalizeColor = (c: string | undefined, owner: "player" | "enemy") => {
    return canonicalColor(c, owner === "enemy" ? "blue" : "red");
  };

  const syncFromState = useCallback(
    (state: GameState, templates: UnitDto[] = unitTemplatesRef.current, explicitLocalId?: number | null) => {
      // 31) Zmapuj surowe kafelki z backendu na format UI (Board).
      const mappedBoard: Board = {
        tiles: state.tiles.map((t) => ({
          coords: { q: t.q, r: t.r },
          terrain: t.terrain,
          passable: t.passable,
          movementCost: t.movementCost,
        })),
      };
      // 32) Zapisz plansze i id gry.
      setBoard(mappedBoard);
      setGameId(state.gameId);

      // 33) Wyznacz lokalnego gracza (priorytet: explicit -> ref -> pierwszy gracz ze stanu).
      const playerId = explicitLocalId ?? localPlayerIdRef.current ?? state.players[0]?.playerId ?? null;
      // 34) Drugi gracz to dowolny inny id niz lokalny.
      const enemyId = state.players.find((p) => p.playerId !== playerId)?.playerId ?? null;
      // 35) Zapisz identyfikatory w stanie i refach.
      localPlayerIdRef.current = playerId;
      setLocalPlayerId(playerId);
      setEnemyPlayerId(enemyId);

      // 36) Pobierz przypisane kolory graczy ze stanu.
      const playerColorValue = state.players.find((p) => p.playerId === playerId)?.color;
      const enemyColorValue = state.players.find((p) => p.playerId !== playerId)?.color;
      // 37) Ustal kolory tak, aby nie byly identyczne.
      const playerC = canonicalColor(playerColorValue, "red");
      const rawEnemyC = canonicalColor(enemyColorValue, playerC === "red" ? "blue" : "red");
      const enemyC = rawEnemyC === playerC ? (playerC === "red" ? "blue" : "red") : rawEnemyC;
      setPlayerColor(playerC);
      setEnemyColor(enemyC);

      // 38) Zmapuj jednostki ze stanu gry na OwnedUnit dla UI.
      const ownedUnits: OwnedUnit[] = state.units.map((u) => {
        // 39) Podciagnij szablon jednostki (statystyki) po id.
        const tpl = templates.find((t) => t.id === u.template);
        // 40) Jezeli gra nie wystartowala i jednostka jest "na 0,0", to traktuj ja jako nie rozmieszczona.
        const waitingForDeployment =
          state.status === "not_started" && u.q === 0 && u.r === 0 ? null : { q: u.q, r: u.r };
        return {
          // 41) Lacz dane szablonu i konkretnej instancji jednostki.
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
          // 42) Id instancji na planszy i jej pozycja.
          uniqueId: Number(u.unitId),
          position: waitingForDeployment,
          // 43) Wlasciciel jednostki (player vs enemy).
          owner: playerId != null && u.ownerPlayerId === playerId ? "player" : "enemy",
          color: state.players.find((p) => p.playerId === u.ownerPlayerId)?.color,
          // 44) Aktualne HP instancji.
          currentHp: u.currentHP,
        };
      });

      // 45) Rozdziel jednostki na dwie listy dla UI.
      setPlayerUnits(ownedUnits.filter((u) => u.owner === "player"));
      setEnemyUnits(ownedUnits.filter((u) => u.owner === "enemy"));

      // 46) Wyznacz faze gry na podstawie statusu z backendu.
      const nextPhase =
        state.status === "not_started"
          ? "deployment"
          : state.status === "finished"
          ? "finished"
          : "battle";
      // 47) Nie przeskakuj z deployment do battle, jesli poprzednio byl deployment i gra nie skonczona.
      setPhase((prev) =>
        prev === "deployment" && nextPhase !== "finished" ? prev : nextPhase
      );
      // 48) Ustaw aktywna strone na podstawie currentPlayerId.
      setActiveSide(state.currentPlayerId === playerId ? "player" : "enemy");

      // 49) Oczysc wynik gry jesli gra trwa, zostaw jesli zakonczona.
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
      // 1) Upewnij sie, ze mamy id gry; bez niego nie da sie wyslac akcji do API.
      if (!gameId) {
        throw new Error("Missing game id");
      }
      // 2) Wyslij akcje na backend: POST /game/{gameId}/actions z JSON-em dto.
      const res = await authFetch(`/game/${gameId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      // 3) Jezeli backend zwrocil blad (np. 4xx/5xx), przerwij i zglos wyjatek.
      if (!res.ok) {
        throw new Error(`Failed to apply action. Status: ${res.status}`);
      }
      // 4) Odczytaj nowe, zaktualizowane State gry z odpowiedzi.
      const state = (await res.json()) as GameState;
      // 5) Jezeli jestesmy w przegladarce, zapisz stan w sessionStorage
      //    (dzieki temu po odswiezeniu mozna go odzyskac).
      if (typeof window !== "undefined") {
        sessionStorage.setItem("currentGameState", JSON.stringify(state));
      }
      // 6) Zsynchronizuj lokalny UI ze stanem z backendu.
      syncFromState(state);
      // 7) Zwracamy stan, zeby wywolujacy mogl go dalej wykorzystac.
      return state;
    },
    [authFetch, gameId, syncFromState]
  );

  const applyAiTurnOnBackend = useCallback(
    async (playerId?: number | null) => {
      if (!gameId) {
        throw new Error("Missing game id");
      }
      const res = await authFetch(`/game/${gameId}/ai/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerId ? { playerId } : {}),
      });
      if (!res.ok) {
        throw new Error(`Failed to apply AI turn. Status: ${res.status}`);
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

  // 31) Ladowanie stanu gry i szablonow jednostek przy starcie/zmianie parametrow.
  useEffect(() => {
    async function load() {
      // 32) Czekamy na gotowosc auth.
      if (!isAuthReady) return;
      // 33) Jesli brak usera, pokaz blad i zakoncz.
      if (!user) {
        setError("Log in to load a battle.");
        setIsLoading(false);
        return;
      }
      try {
        // 34) Ustawiamy flage ladowania na true.
        setIsLoading(true);
        // 35) Pobieramy gameId z URL lub sessionStorage.
        const queryGameId = searchParams.get("gameId");
        const storedGameId =
          typeof window !== "undefined" ? sessionStorage.getItem("currentGameId") : null;
        // 36) Odczytujemy lokalny playerId (z sessionStorage lub z usera).
        const rawLocalPlayerId =
          typeof window !== "undefined" ? sessionStorage.getItem("localPlayerId") : null;
        const derivedLocalPlayerId = rawLocalPlayerId
          ? Number(rawLocalPlayerId)
          : user?.id ?? null;

        // 37) Wybieramy id gry (URL ma priorytet).
        const idToUse = queryGameId ?? storedGameId;
        if (!idToUse) {
          setError("No active game. Go back to /army and save an army.");
          setIsLoading(false);
          return;
        }

        // 38) Zapisujemy gameId i lokalny playerId w stanie/ref.
        setGameId(idToUse);
        localPlayerIdRef.current = derivedLocalPlayerId;
        setLocalPlayerId(derivedLocalPlayerId);

        // 39) Pobieramy rownolegle: stan gry i szablony jednostek.
        const [stateRes, unitsRes] = await Promise.all([
          authFetch(`/game/${idToUse}/state`, { cache: "no-store" }),
          authFetch("/units", { cache: "no-store" }),
        ]);

        // 40) Walidujemy odpowiedzi HTTP.
        if (!stateRes.ok) {
          throw new Error(`Failed to load game state. Status: ${stateRes.status}`);
        }
        if (!unitsRes.ok) {
          throw new Error(`Failed to load units. Status: ${unitsRes.status}`);
        }

        // 41) Parsujemy JSON-y.
        const state = (await stateRes.json()) as GameState;
        const templates = (await unitsRes.json()) as UnitDto[];
        // 42) Zapamietujemy szablony w ref (bez rerenderu).
        unitTemplatesRef.current = templates;

        // 43) Zapisujemy w sessionStorage (uzyteczne po odswiezeniu).
        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentGameState", JSON.stringify(state));
          sessionStorage.setItem("currentGameId", state.gameId);
        }

        // 44) Synchronizujemy UI z danymi gry i szablonami.
        syncFromState(state, templates, derivedLocalPlayerId);
      } catch (e: unknown) {
        // 45) Zamieniamy dowolny blad na czytelny komunikat.
        setError(getErrorMessage(e, "Failed to load game data."));
      } finally {
        // 46) Konczymy tryb ladowania bez wzgledu na wynik.
        setIsLoading(false);
      }
    }

    load();
  }, [authFetch, isAuthReady, searchParams, syncFromState, user]);

  // 47) Szybki lookup kafelkow po kluczu "q,r".
  const tileByCoord = useMemo(() => {
    const map = new Map<string, Tile>();
    board?.tiles.forEach((t) => map.set(`${t.coords.q},${t.coords.r}`, t));
    return map;
  }, [board]);

  // 48) Lista unikalnych wierszy (r) posortowana rosnaco.
  const rows = useMemo(() => {
    if (!board) return [] as number[];
    return Array.from(new Set(board.tiles.map((tile) => tile.coords.r))).sort((a, b) => a - b);
  }, [board]);

  // 49) Lista kolumn (q) od min do max.
  const columns = useMemo(() => {
    if (!board) return [] as number[];
    const qValues = board.tiles.map((tile) => tile.coords.q);
    const minQ = Math.min(...qValues);
    const maxQ = Math.max(...qValues);
    return Array.from({ length: maxQ - minQ + 1 }, (_, idx) => minQ + idx);
  }, [board]);

  // 50) Dozwolone kolumny rozstawienia (pierwsze 3 kolumny).
  const allowedDeployColumns = useMemo(() => {
    if (!columns.length) return new Set<number>();
    const minQ = columns[0];
    return new Set([minQ, minQ + 1, minQ + 2]);
  }, [columns]);

  // 51) Odbicie wspolrzednej q wzgledem osi planszy (lustrzane).
  const mirroredQ = useCallback(
    (q: number) => {
      if (!columns.length) return q;
      const minQ = columns[0];
      const maxQ = columns[columns.length - 1];
      return maxQ - (q - minQ);
    },
    [columns]
  );

  // 52) Mapowanie zajetych pol przez zywe jednostki.
  const occupiedMap = useMemo(() => {
    const map = new Map<string, OwnedUnit>();
    [...playerUnits, ...enemyUnits].forEach((u) => {
      if (u.position && u.currentHp > 0) {
        map.set(`${u.position.q},${u.position.r}`, u);
      }
    });
    return map;
  }, [playerUnits, enemyUnits]);

  // 53) Listy zywych jednostek obu stron.
  const alivePlayerUnits = useMemo(
    () => playerUnits.filter((u) => u.currentHp > 0),
    [playerUnits]
  );

  const aliveEnemyUnits = useMemo(
    () => enemyUnits.filter((u) => u.currentHp > 0),
    [enemyUnits]
  );

  // 54) Suma zadanych obrazen (po stronie gracza i wroga).
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

  // 55) Grupowanie statystyk jednostek wg typu (do panelu).
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

  // 56) Zbiorczy opis jednostek (np. "Player Archer x2").
  const summarizedUnits = useMemo(() => {
    const counts = new Map<string, number>();
    [...playerUnits, ...enemyUnits].forEach((u) => {
      const label = `${u.owner === "player" ? "Player" : "Enemy"} ${u.name}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => `${label} x${count}`);
  }, [enemyUnits, playerUnits]);

  // 57) Szybkie sprawdzanie, czy pole jest na sciezce.
  const pathKeys = useMemo(() => new Set(pathCoords.map((c) => `${c.q},${c.r}`)), [pathCoords]);

  // 58) Aktualnie wybrana jednostka (po id).
  const selectedUnit = useMemo(
    () => [...playerUnits, ...enemyUnits].find((u) => u.uniqueId === selectedUnitId) ?? null,
    [playerUnits, enemyUnits, selectedUnitId]
  );

  // 59) Koniec gry - ustaw wynik i wyczysc UI.
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

  // 60) Rozstrzygniecie po punktach (obrazenia).
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

  // 61) Jesli zaznaczona jednostka umarla, odznacz ja.
  useEffect(() => {
    if (selectedUnit && selectedUnit.currentHp <= 0) {
      setSelectedUnitId(null);
    }
  }, [selectedUnit]);

  // 62) Automatyczne warunki zwyciestwa (elimination/points).
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

  // 63) Warunek zwyciestwa przy limicie tur.
  useEffect(() => {
    if (phase !== "battle" || victoryMode !== "turns" || gameResult.winner) return;
    if (roundNumber > turnLimit) {
      resolveByPoints("Turn limit reached");
    }
  }, [roundNumber, turnLimit, victoryMode, phase, gameResult.winner, resolveByPoints]);

  // 64) Zapis statystyk po zakonczeniu gry (jednorazowo).
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

    // 65) Funkcja wysylajaca statystyki na backend.
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

    // 66) Uruchamiamy zapis bez czekania na rezultat (fire-and-forget).
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

  // 67) Przesuniecie jednostki na backendzie (MOVE).
  const setUnitPositionOnBackend = useCallback(
    async (unitId: number, coords: HexCoords, owner: "player" | "enemy") => {
      // 68) Dobieramy playerId na podstawie wlasciciela.
      const playerId = owner === "player" ? localPlayerId : enemyPlayerId;
      if (!playerId) return;
      try {
        // 69) Wysylamy akcje MOVE z nowymi wspolrzednymi.
        await applyActionOnBackend({
          type: "MOVE",
          playerId,
          payload: { unitId, q: coords.q, r: coords.r },
        });
      } catch (e: unknown) {
        // 70) Wyswietlamy blad w UI.
        setError(getErrorMessage(e, "Failed to move unit on backend"));
      }
    },
    [applyActionOnBackend, enemyPlayerId, localPlayerId]
  );

  // 71) Zwraca sasiadow heksu (4 kierunki na tej planszy).
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

  // 72) Wyszukiwanie sciezki (Dijkstra) z limitem kosztu ruchu.
  const findPath = useCallback(
    (start: HexCoords, target: HexCoords, blocked: Set<string>, maxCost: number): PathResult | null => {
      const startKey = `${start.q},${start.r}`;
      const targetKey = `${target.q},${target.r}`;

      // 73) Struktury danych algorytmu.
      type Node = { key: string; coords: HexCoords; cost: number };
      const dist = new Map<string, number>();
      const prev = new Map<string, string | null>();
      const queue: Node[] = [{ key: startKey, coords: start, cost: 0 }];
      dist.set(startKey, 0);
      prev.set(startKey, null);

      // 74) Pobranie wezla o najmniejszym koszcie.
      const popSmallest = () => {
        queue.sort((a, b) => a.cost - b.cost);
        return queue.shift();
      };

      // 75) Glowna petla przeszukiwania grafu.
      while (queue.length) {
        const current = popSmallest();
        if (!current) break;

        for (const n of getNeighbors(current.coords)) {
          const key = `${n.q},${n.r}`;
          // 76) Pomin zablokowane pola.
          if (blocked.has(key)) continue;
          const tile = tileByCoord.get(key);
          // 77) Pomin brak kafelka lub nieprzechodnie pole.
          if (!tile || !tile.passable) continue;
          // 78) Koszt przejscia na sasiada.
          const tentative = current.cost + tile.movementCost;
          // 79) Pomin trasy przekraczajace limit ruchu.
          if (tentative > maxCost) continue;
          const known = dist.get(key);
          // 80) Aktualizuj dystans, gdy znaleziono lepsza droge.
          if (known == null || tentative < known) {
            dist.set(key, tentative);
            prev.set(key, current.key);
            queue.push({ key, coords: n, cost: tentative });
          }
        }
      }

      // 81) Brak osiagalnych pol.
      if (!dist.size) return null;

      // 82) Wybierz najlepszy cel (preferuj target, inaczej najblizszy).
      const reachableTargetCost = dist.get(targetKey);
      let bestKey: string | null = null;
      let bestCost = Infinity;
      let bestHeuristic = Infinity;

      dist.forEach((cost, key) => {
        if (cost > maxCost) return;
        const [q, r] = key.split(",").map(Number);
        const heuristic = Math.abs(q - target.q) + Math.abs(r - target.r);
        // 83) Jeśli cel jest osiagalny, wybieramy go.
        if (key === targetKey) {
          bestKey = key;
          bestCost = cost;
          bestHeuristic = heuristic;
          return;
        }
        // 84) Gdy celu nie ma, wybieramy najblizsze pole.
        if (
          reachableTargetCost === undefined &&
          (heuristic < bestHeuristic || (heuristic === bestHeuristic && cost < bestCost))
        ) {
          bestKey = key;
          bestCost = cost;
          bestHeuristic = heuristic;
        }
      });

      // 85) Gdy nic sensownego nie znaleziono, zwracamy null.
      if (!bestKey) return null;

      // 86) Odtworzenie sciezki od bestKey do startu.
      const path: HexCoords[] = [];
      let k: string | null = bestKey;
      while (k) {
        const [q, r] = k.split(",").map(Number);
        path.push({ q, r });
        k = prev.get(k) ?? null;
      }

      // 87) Zwracamy koszt i sciezke w prawidlowej kolejnosci.
      return { cost: bestCost, path: path.reverse() };
    },
    [getNeighbors, tileByCoord]
  );

  // 88) Odleglosc Manhattan w tej siatce (uzywana do zasiegu).
  const distance = (a: HexCoords, b: HexCoords) =>
    Math.abs(a.q - b.q) + Math.abs(a.r - b.r);

  // 89) Okresla wyglad kafelka na podstawie typu terenu.
  // Textured gradients to give each terrain a distinct look without external assets.
  function tileVisual(tile?: Tile): TileVisual {
    if (!tile) {
      // 90) Brak danych o kafelku -> zwracamy neutralny wyglad.
      return {
        className: "text-slate-400 shadow-inner",
        style: {
          backgroundColor: "#1e293b",
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0 40%, rgba(0,0,0,0.25) 40% 60%, rgba(255,255,255,0.08) 60% 100%)",
          backgroundSize: "16px 16px",
        },
      };
    }

    // 91) Bazowe ustawienia stylu wspolne dla terenow.
    const base: Pick<TileVisual, "className" | "style"> = {
      className: "text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]",
      style: {},
    };

    // 92) Dobor stylu na podstawie typu terenu.
    switch (tile.terrain) {
      case "water":
        return {
          ...base,
          className: `${base.className} text-sky-50`,
          style: {
            backgroundColor: "#0ea5e9",
            backgroundImage:
              "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.24) 0 18%, transparent 20%), radial-gradient(circle at 75% 70%, rgba(8,47,73,0.4) 0 20%, transparent 25%), linear-gradient(145deg, rgba(14,165,233,0.75), rgba(12,74,110,0.9))",
            backgroundSize: "110% 110%, 120% 120%, 100% 100%",
            backgroundBlendMode: "screen, overlay, normal",
          },
          label: "WTR",
        };
      case "bridge":
        return {
          ...base,
          className: `${base.className} text-amber-50`,
          style: {
            backgroundColor: "#b45309",
            backgroundImage:
              "linear-gradient(90deg, rgba(0,0,0,0.22) 0 6%, transparent 6% 12%, rgba(0,0,0,0.16) 12% 18%, transparent 18% 24%), linear-gradient(135deg, rgba(255,255,255,0.18), rgba(146,64,14,0.35))",
            backgroundSize: "12px 100%, 100% 100%",
            backgroundBlendMode: "multiply, screen",
          },
          label: "BRG",
        };
      case "ford":
        return {
          ...base,
          className: `${base.className} text-cyan-50`,
          style: {
            backgroundColor: "#0ea5e9",
            backgroundImage:
              "linear-gradient(90deg, rgba(14,165,233,0.6) 0 60%, rgba(217,119,6,0.65) 60%), radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18) 0 18%, transparent 26%), radial-gradient(circle at 70% 70%, rgba(8,47,73,0.45) 0 18%, transparent 26%), linear-gradient(135deg, rgba(217,119,6,0.45), rgba(14,165,233,0.55))",
            backgroundSize: "100% 100%, 120% 120%, 140% 140%, 100% 100%",
            backgroundBlendMode: "screen, multiply, overlay, screen",
          },
          label: "FRD",
        };
      case "road":
        return {
          ...base,
          className: `${base.className} text-amber-50`,
          style: {
            backgroundColor: "#78350f",
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 8%, rgba(255,255,255,0.06) 8% 16%), linear-gradient(135deg, rgba(146,64,14,0.75), rgba(30,41,59,0.65))",
            backgroundSize: "18px 100%, 100% 100%",
            backgroundBlendMode: "multiply, screen",
          },
          label: "RD",
        };
      case "hill":
        return {
          ...base,
          className: `${base.className} text-lime-50`,
          style: {
            backgroundColor: "#4d7c0f",
            backgroundImage:
              "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.22) 0 30%, transparent 34%), radial-gradient(circle at 65% 70%, rgba(0,0,0,0.25) 0 35%, transparent 48%), linear-gradient(145deg, rgba(101,163,13,0.9), rgba(63,98,18,0.85))",
            backgroundSize: "120% 120%, 120% 120%, 100% 100%",
            backgroundBlendMode: "screen, overlay, normal",
          },
          label: "HIL",
        };
      case "forest":
        return {
          ...base,
          className: `${base.className} text-emerald-50`,
          style: {
            backgroundColor: "#064e3b",
            backgroundImage:
              "radial-gradient(circle at 24% 32%, rgba(34,197,94,0.8) 0 12%, transparent 18%), radial-gradient(circle at 68% 68%, rgba(16,130,70,0.85) 0 10%, transparent 16%), radial-gradient(circle at 42% 62%, rgba(5,150,105,0.55) 0 9%, transparent 18%), repeating-linear-gradient(45deg, rgba(14,116,144,0.35) 0 4px, rgba(14,116,144,0.2) 4px 10px)",
            backgroundSize: "70% 70%, 70% 70%, 90% 90%, 16px 16px",
            backgroundBlendMode: "screen, screen, multiply",
          },
          label: "FOR",
        };
      case "city":
        return {
          ...base,
          className: `${base.className} text-slate-900`,
          style: {
            backgroundColor: "#cbd5e1",
            backgroundImage:
              "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(148,163,184,0.2)), radial-gradient(circle at 30% 35%, rgba(148,163,184,0.55) 0 12%, transparent 18%), radial-gradient(circle at 70% 65%, rgba(51,65,85,0.35) 0 14%, transparent 22%)",
            backgroundSize: "100% 100%, 110% 110%, 120% 120%",
            backgroundBlendMode: "screen, overlay, multiply",
          },
          label: "CTY",
        };
      case "swamp":
        return {
          ...base,
          className: `${base.className} text-emerald-50`,
          style: {
            backgroundColor: "#134e4a",
            backgroundImage:
              "radial-gradient(circle at 30% 25%, rgba(52,211,153,0.25) 0 32%, transparent 40%), radial-gradient(circle at 70% 70%, rgba(6,78,59,0.65) 0 30%, transparent 44%), linear-gradient(160deg, rgba(15,118,110,0.65), rgba(34,197,94,0.12))",
            backgroundSize: "120% 120%, 120% 120%, 100% 100%",
            backgroundBlendMode: "screen, multiply, normal",
          },
          label: "SWP",
        };
      case "plain":
      default:
        return {
          ...base,
          className: `${base.className} text-emerald-50`,
          style: {
            backgroundColor: "#166534",
            backgroundImage:
              "linear-gradient(120deg, rgba(74,222,128,0.32), rgba(34,197,94,0.16)), repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)",
            backgroundSize: "100% 100%, 12px 12px",
            backgroundBlendMode: "screen, soft-light",
          },
        };
    }
  }

  // 93) Klasa CSS uzalezniona od przechodniosci pola.
  function tileClass(tile?: Tile): string {
    if (!tile) return "";
    return tile.passable ? "" : "opacity-80";
  }

  // 94) Mapowanie "dziwnych" nazw ikon na poprawne nazwy plikow.
  const ICON_NAME: Record<string, string> = {
    "twelve-pounder-cannon": "12-pounder-cannon",
    "six-pounder-cannon": "6-pounder-cannon",
  };

  // 95) Buduje sciezke do ikony jednostki, uwzgledniajac kolor.
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


  // 96) Zapisuje id jednostki do transferu drag&drop.
  function onDragStart(e: DragEvent, unitId: number) {
    e.dataTransfer.setData("text/unit-id", String(unitId));
  }

  // 97) Sprawdza, czy mozna upuscic jednostke na danym polu.
  const canDropOnTile = useCallback(
    (q: number, r: number): boolean => {
      const tile = tileByCoord.get(`${q},${r}`);
      if (!tile || !tile.passable) return false;
      return !occupiedMap.has(`${q},${r}`);
    },
    [occupiedMap, tileByCoord]
  );

  // 98) Przesuwa widok mapy na strone gracza/nieprzyjaciela.
  function centerOnSide(side: "player" | "enemy") {
    const container = mapRef.current;
    if (!container) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const target = side === "player" ? 0 : Math.max(0, maxScrollLeft);
    container.scrollTo({ left: target, behavior: "smooth" });
  }

  useEffect(() => {
    if (phase !== "battle" || gameResult.winner) return;
    if (activeSide !== "enemy" || isResolvingAi) return;
    if (!enemyPlayerId) return;

    let isMounted = true;
    setIsResolvingAi(true);
    centerOnSide("enemy");
    applyAiTurnOnBackend(enemyPlayerId)
      .then((afterAi) => {
        if (!isMounted) return;
        setRoundNumber(afterAi.turnNumber);
        centerOnSide(afterAi.currentPlayerId === localPlayerId ? "player" : "enemy");
      })
      .catch((e: unknown) => {
        if (!isMounted) return;
        setError(getErrorMessage(e, "Failed to apply AI turn"));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsResolvingAi(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeSide,
    applyAiTurnOnBackend,
    enemyPlayerId,
    gameResult.winner,
    isResolvingAi,
    localPlayerId,
    phase,
  ]);

  // 99) Rozmieszczenie jednostki gracza w fazie deploy.
  const placeUnit = useCallback(
    async (unitId: number, coords: HexCoords) => {
      if (phase !== "deployment") return;
      const unit = playerUnits.find((u) => u.uniqueId === unitId);
      if (!unit) return;
      // 100) Weryfikacja: tylko pierwsze 3 kolumny.
      if (!allowedDeployColumns.has(coords.q)) {
        setError("You can deploy player units only in the first 3 columns.");
        return;
      }
      // 101) Weryfikacja: pole musi byc wolne i przechodnie.
      if (!canDropOnTile(coords.q, coords.r)) {
        setError("Tile is occupied or impassable.");
        return;
      }
      // 102) Wysylamy MOVE na backend.
      setError(null);
      await setUnitPositionOnBackend(unitId, coords, "player");
    },
    [allowedDeployColumns, canDropOnTile, phase, playerUnits, setUnitPositionOnBackend]
  );

  // 103) Obsluga upuszczenia jednostki na kafelku.
  function onTileDrop(e: DragEvent, q: number, r: number) {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/unit-id");
    if (!data) return;
    const unitId = Number(data);
    void placeUnit(unitId, { q, r });
  }

  // 104) Odbicie rozmieszczenia gracza po stronie wroga i start bitwy.
  async function mirrorEnemyDeployment() {
    if (!board) return;
    const minQ = columns[0];
    const maxQ = columns[columns.length - 1];
    // 105) Sprawdz, czy wszystkie jednostki gracza sa rozmieszczone.
    const deployComplete = playerUnits.every((u) => u.position);
    if (!deployComplete) {
      setError("Place all player units before continuing.");
      return;
    }
    // 106) Lustrzane ustawienie wrogich jednostek.
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
    // 107) Aktualizacja stanu UI.
    setEnemyUnits(updatedEnemy);
    // 108) Zapis pozycji wroga na backendzie.
    for (const u of updatedEnemy) {
      if (u.position) {
        await setUnitPositionOnBackend(u.uniqueId, u.position, "enemy");
      }
    }
    // 109) Reset stanu na poczatek bitwy.
    setRoundNumber(1);
    setGameResult({ winner: null, reason: "" });
    setPhase("battle");
    setActiveSide("player");
    setActed({ player: new Set(), enemy: new Set() });
    setMoved({ player: new Set(), enemy: new Set() });
    setSelectedUnitId(null);
    setPathCoords([]);
  }

  // 110) Zaznaczenie jednostki (tylko w bitwie i dla aktywnej strony).
  function selectUnit(unit: OwnedUnit) {
    if (phase !== "battle" || gameResult.winner) return;
    if (activeSide !== "player" || unit.owner !== "player" || unit.currentHp <= 0) return;
    setSelectedUnitId(unit.uniqueId);
    setPathCoords([]);
  }

  // 111) Ruch jednostki na klikniete pole.
  async function handleMoveTo(q: number, r: number) {
    if (phase !== "battle" || gameResult.winner || !selectedUnit || !selectedUnit.position) return;
    if (activeSide !== "player" || selectedUnit.owner !== "player" || selectedUnit.currentHp <= 0)
      return;
    const movedSet = selectedUnit.owner === "player" ? moved.player : moved.enemy;
    // 112) Nie pozwalaj na podwojny ruch w turze.
    if (movedSet.has(selectedUnit.uniqueId)) {
      setError("This unit already moved this turn.");
      return;
    }

    // 113) Przygotuj dane do pathfindingu (start + blokady).
    const start = selectedUnit.position;
    const blocked = new Set<string>();
    occupiedMap.forEach((u, key) => {
      if (u.uniqueId !== selectedUnit.uniqueId) {
        blocked.add(key);
      }
    });

    // 114) Wylicz sciezke do celu z limitem ruchu.
    const pathResult = findPath(start, { q, r }, blocked, selectedUnit.speed);
    if (!pathResult || pathResult.path.length === 0) {
      setError("No reachable path within movement points.");
      return;
    }

    // 115) Ostateczny punkt to koniec sciezki.
    const destination = pathResult.path[pathResult.path.length - 1];
    // 116) Jesli cel nieosiagalny, wyczysc sciezke i pokaz blad.
    if (destination.q === start.q && destination.r === start.r && (q !== start.q || r !== start.r)) {
      setError("No reachable path within movement points.");
      setPathCoords([]);
      return;
    }
    // 117) Sprawdz, czy pole docelowe jest zajete.
    const destKey = `${destination.q},${destination.r}`;
    const occupantAtDest = occupiedMap.get(destKey);
    if (occupantAtDest && occupantAtDest.uniqueId !== selectedUnit.uniqueId) {
      setError("Destination is occupied.");
      return;
    }

    // 118) Wyslij MOVE i zaktualizuj lokalny stan ruchu.
    setError(null);
    setPathCoords(pathResult.path);
    await setUnitPositionOnBackend(selectedUnit.uniqueId, destination, selectedUnit.owner);

    const nextMovedPlayer = new Set(moved.player);
    const nextMovedEnemy = new Set(moved.enemy);
    (selectedUnit.owner === "player" ? nextMovedPlayer : nextMovedEnemy).add(selectedUnit.uniqueId);
    setMoved({ player: nextMovedPlayer, enemy: nextMovedEnemy });
  }

  // 119) Atak na inna jednostke.
  async function handleAttack(target: OwnedUnit) {
    if (phase !== "battle" || gameResult.winner || !selectedUnit || !selectedUnit.position) return;
    if (activeSide !== "player" || selectedUnit.owner !== "player" || selectedUnit.currentHp <= 0)
      return;
    // 120) Klikniecie swojej jednostki -> tylko zmiana zaznaczenia.
    if (target.owner === selectedUnit.owner) {
      setSelectedUnitId(target.uniqueId);
      return;
    }
    if (target.currentHp <= 0) return;
    const actedSet = selectedUnit.owner === "player" ? acted.player : acted.enemy;
    // 121) Nie pozwalaj na podwojna akcje ataku.
    if (actedSet.has(selectedUnit.uniqueId)) {
      setError("This unit already acted this turn.");
      return;
    }
    // 122) Sprawdz zasieg.
    const dist = distance(selectedUnit.position, target.position ?? { q: 0, r: 0 });
    if (dist > selectedUnit.attackRange) {
      setError("Target out of range.");
      return;
    }
    // 123) Ustal czy atak jest dystansowy i policz obrazenia.
    const isRanged = dist > 1 && selectedUnit.rangedAttack > 0;
    const damage = isRanged ? selectedUnit.rangedAttack : selectedUnit.meleeAttack;
    if (damage <= 0) {
      setError("This unit cannot deal damage.");
      return;
    }
    const damageApplied = Math.min(damage, target.currentHp);

    // 124) Pokaz marker obrazen w UI.
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

    // 125) Wyslij akcje ATTACK do backendu.
    await applyActionOnBackend({
      type: "ATTACK",
      playerId: selectedUnit.owner === "player" ? localPlayerId ?? undefined : enemyPlayerId ?? undefined,
      payload: { unitId: selectedUnit.uniqueId, targetUnitId: target.uniqueId, damage: damageApplied },
    });

    // 126) Oznacz jednostke jako "acted".
    const nextActedPlayer = new Set(acted.player);
    const nextActedEnemy = new Set(acted.enemy);
    (selectedUnit.owner === "player" ? nextActedPlayer : nextActedEnemy).add(selectedUnit.uniqueId);
    setActed({ player: nextActedPlayer, enemy: nextActedEnemy });
  }

  // 127) Zakoncz ture i przejdz do kolejnej strony.
  async function endTurnInternal() {
    if (gameResult.winner || activeSide !== "player" || isResolvingAi) return;
    try {
      const actingPlayerId = localPlayerId ?? undefined;
      // 128) Wyslij END_TURN na backend i odbierz nowy stan.
      const newState = await applyActionOnBackend({
        type: "END_TURN",
        playerId: actingPlayerId,
      });

      // 129) Wyczysc interakcje z poprzedniej tury.
      setSelectedUnitId(null);
      setPathCoords([]);
      setError(null);
      setActed({ player: new Set(), enemy: new Set() });
      setMoved({ player: new Set(), enemy: new Set() });

      // 130) Jesli tura przechodzi na przeciwnika, uruchom AI i sledz jego ruch.
      const nextSide = newState.currentPlayerId === localPlayerId ? "player" : "enemy";
      setRoundNumber(newState.turnNumber);
      if (nextSide === "player") {
        centerOnSide("player");
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to end turn"));
    }
  }

  // 131) Widok ladowania.
  if (isLoading) {
    return (
      <div className="p-6 text-slate-200">Loading board...</div>
    );
  }

  // 132) Widok bledu, gdy brak planszy.
  if (error && !board) {
    return (
      <div className="p-6 text-red-400">
        {error}
      </div>
    );
  }

  // 133) Glowne UI planszy.
  return (
    <div className="p-6 max-w-8xl mx-auto space-y-4">
      {/* // 134) Pasek naglowka z tytulem, faza, tura i wynikiem. */}
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
        {/* // 135) Przycisk przejscia z deployment do battle. */}
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

      {/* // 136) Globalny komunikat bledu (jesli plansza juz jest). */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* // 137) Panel ustawien trybu zwyciestwa i licznika tur. */}
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
              {/* // 138) Wybor trybu zwyciestwa. */}
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
              {/* // 139) Limit rund aktywny tylko w trybie "turns". */}
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
              {/* // 140) Krótki opis zasad kazdego trybu. */}
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Points: damage dealt = score, finish when you decide.</li>
                <li>Last unit standing: auto-finish when one side has no survivors.</li>
                <li>Turn limit: after selected rounds the score decides.</li>
              </ul>
            </div>
          </div>

          {/* // 141) Panel biezacego statusu bitwy. */}
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

          {/* // 142) Panel kontrolny do recznego zakonczenia gry. */}
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
            {/* // 143) Dodatkowe wskazowki/rezultat w zaleznosci od stanu gry. */}
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

      {/* // 144) Glowny layout: lewy panel, mapa, prawy panel. */}
      {board && (
        <div className="grid gap-4 lg:grid-cols-[280px,1fr,320px]">
          {/* // 145) Panel szczegolow zaznaczonej jednostki. */}
          <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Unit details</h2>
            {selectedUnit ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Image
                    src={unitIconSrc(selectedUnit)}
                    alt={selectedUnit.name}
                    width={24}
                    height={24}
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

          {/* // 146) Mapa/siatka planszy z obsluga panningu i klikniec. */}
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
            {/* // 147) Grid kafelkow dla wszystkich wspolrzednych. */}
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
                  const visuals = tileVisual(tile);
                  const badge = visuals.label;
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
                        if (phase === "battle" && activeSide !== "player") {
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
                      className={`w-12 aspect-square ${visuals.className} ${tileClass(
                        tile
                      )} rounded-md border overflow-hidden flex items-center justify-center text-[10px] leading-tight relative ${
                        canDrop ? "border-amber-300" : "border-slate-900"
                      } ${isSelected ? "ring-2 ring-amber-400" : ""} ${
                        isPath ? "outline outline-2 outline-cyan-300" : ""
                      }`}
                      style={visuals.style}
                      title={
                        tile
                          ? `q=${tile.coords.q}, r=${tile.coords.r}, terrain=${tile.terrain}`
                          : `q=${q}, r=${r} (no tile data)`
                      }
                    >
                      {/* // 148) Ikona i pasek zycia jednostki na kafelku. */}
                      {occupant && (
                        <>
                          <div className="absolute top-1 left-1 right-1 z-20 h-1 rounded-full bg-black/50 overflow-hidden border border-slate-900/60">
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
                            className={`absolute inset-0 z-10 rounded-md bg-black/25 flex items-center justify-center px-1 text-center pointer-events-none ${
                              occupant.owner === "player" ? "text-red-100" : "text-blue-100"
                            }`}
                          >
                            <Image
                              src={unitIconSrc(occupant)}
                              alt={occupant.name}
                              width={32}
                              height={32}
                              className="w-8 h-8 object-contain drop-shadow-md"
                            />
                          </div>
                        </>
                      )}
                      {/* // 149) Etykieta terenu w rogu kafelka. */}
                      {badge && (
                        <span className="pointer-events-none absolute bottom-0.5 right-0.5 z-30 rounded bg-slate-900/70 px-1 text-[9px] font-semibold tracking-tight text-slate-50 shadow-sm backdrop-blur">
                          {badge}
                        </span>
                      )}
                      {/* // 150) Tymczasowe markery obrazen. */}
                      {damageMarkers
                        .filter((m) => m.coords.q === q && m.coords.r === r)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="pointer-events-none absolute -top-6 left-1/2 z-40 -translate-x-1/2 text-xs font-bold text-red-300 animate-bounce"
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

          {/* // 151) Panel listy jednostek i akcji tury. */}
          <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Units panel</h2>
              <p className="text-sm text-slate-400">
                {phase === "deployment"
                  ? "Drag player units onto the first 3 columns on the left."
                  : `Active side: ${activeSide === "player" ? "player" : "enemy"}. Player moves only; enemy acts automatically after end turn.`}
              </p>
            </div>

            {/* // 152) Lista jednostek (filtrowana wg fazy/aktywnej strony). */}
            <div className="space-y-3">
              {[...playerUnits, ...enemyUnits]
                .filter((u) => u.currentHp > 0 && (phase === "deployment" ? u.owner === "player" : true))
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
                          <Image
                            src={unitIconSrc(unit)}
                            alt={unit.name}
                            width={24}
                            height={24}
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

            {/* // 153) Przycisk zakonczenia tury (tylko w battle). */}
            {phase === "battle" && (
              <button
                type="button"
                onClick={endTurnInternal}
                disabled={activeSide !== "player" || isResolvingAi}
                className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-100 py-2 text-sm font-medium"
              >
                {isResolvingAi ? "Enemy turn..." : "End turn"}
              </button>
            )}
          </aside>
        </div>
      )}

      {/* // 154) Panel statystyk bitwy po lewej i prawej stronie. */}
      {board && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Battle stats</h3>
            <div className="text-xs text-slate-300">
              Total damage - player: {damageScore.player} | enemy: {damageScore.enemy}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* // 155) Statystyki jednostek gracza. */}
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
            {/* // 156) Statystyki jednostek wroga. */}
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

      {/* // 157) Instrukcje dla gracza (deployment, battle, panning). */}
      <p className="text-xs text-slate-400">
        Deployment: drag player units only onto the first 3 columns. After &quot;Continue&quot; the enemy is
        mirrored on the right. In battle: each unit may attack once and move once per turn, in any
        order - use this to fall back after firing or charge after moving. Pick the victory mode above
        (points = manual finish, elimination = auto when one side dies, turn limit = auto after
        chosen rounds). You can pan the map with scrollbars or by click-dragging the map.
      </p>
    </div>
  );
}
