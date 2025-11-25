import type { Player } from "./player";
import type { UnitDto } from "./unit";
import type { TerrainType } from "./board";

export type GameStatus = "not_started" | "in_progress" | "finished" | "paused";

export type GameActionType = "MOVE" | "ATTACK" | "END_TURN";

export type GameActionPayload = Record<string, any>;

export interface ApplyActionDto {
  type: GameActionType;
  playerId?: number;
  payload?: GameActionPayload;
}

export interface GameState {
  gameId: string;
  turnNumber: number;
  currentPlayerId: Player["id"];
  status: GameStatus;
  players: GamePlayerState[];
  units: UnitOnBoardState[];
  tiles: HexTileState[];
}

export interface GamePlayerState {
  playerId: Player["id"];
  name: string;
  color?: string;
}

export interface UnitOnBoardState {
  unitId: string;
  ownerPlayerId: Player["id"];
  template: UnitDto["id"];
  currentHP: number;
  q: number;
  r: number;
}

export interface HexTileState {
  q: number;
  r: number;
  terrain: TerrainType;
  passable: boolean;
  movementCost: number;
}
