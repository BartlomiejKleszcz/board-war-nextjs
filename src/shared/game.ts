// Podstawowe typy i DTO opisujace stan rozgrywki oraz akcje w turach.
import type { Player } from "./player";
import type { UnitDto } from "./unit";
import type { TerrainType } from "./board";

// Etapy zycia gry (np. lobby vs aktywna tura vs zakonczona).
export type GameStatus = "not_started" | "in_progress" | "finished" | "paused";

// Dozwolone typy akcji, ktore gracz moze wykonac w turze.
export type GameActionType = "MOVE" | "ATTACK" | "END_TURN";

// Dowolny ksztalt danych przenoszacych szczegoly akcji.
// W praktyce to luzny slownik (np. dla MOVE: { unitId, from: {q,r}, to: {q,r} }).
// Kazdy handler akcji powinien walidowac i rzutowac payload do wlasnego kontraktu.
export type GameActionPayload = Record<string, unknown>;

// Wejscie do systemu wykonywania akcji (typ + opcjonalny gracz + payload).
export interface ApplyActionDto {
  type: GameActionType;
  playerId?: number;
  payload?: GameActionPayload;
}

// Pelny stan gry renderowany/serializowany do klienta lub backendu.
export interface GameState {
  gameId: string;
  turnNumber: number;
  currentPlayerId: Player["id"];
  status: GameStatus;
  players: GamePlayerState[];
  units: UnitOnBoardState[];
  tiles: HexTileState[];
}

// Minimalny stan dotyczacy gracza bioracego udzial w partii.
export interface GamePlayerState {
  playerId: Player["id"];
  name: string;
  color?: string;
}

// Stan pojedynczej jednostki na planszy (pozycja axial q/r, punkty zycia itp.).
export interface UnitOnBoardState {
  unitId: string;
  ownerPlayerId: Player["id"];
  template: UnitDto["id"];
  currentHP: number;
  q: number;
  r: number;
}

// Stan hexa na planszy (typ terenu, ruchliwosc).
export interface HexTileState {
  q: number;
  r: number;
  terrain: TerrainType;
  passable: boolean;
  movementCost: number;
}
