import { Player } from 'src/player/domain/player';
import { HexTile } from 'src/board/domain/hex.types';
import { Unit, UnitName } from 'src/units/domain/unit.types';

export type GameStatus = 'not_started' | 'in_progress' | 'finished' | 'paused';

export interface GameState {
  gameId: string;
  turnNumber: number;
  currentPlayerId: Player['id'];
  status: GameStatus;
  players: PlayerInGameState[];
  units: UnitOnBoardState[];
  tiles: HexTileState[];
}

export interface PlayerInGameState {
  playerId: Player['id'];
  name: string;
  color?: string;
}

export interface UnitOnBoardState {
  unitId: string;
  ownerPlayerId: Player['id'];
  template: UnitName;
  currentHP: number;
  q: number;
  r: number;
}

export interface HexTileState {
  q: number;
  r: number;
  terrain: HexTile['terrain'];
  passable: boolean;
  movementCost: number;
}

export type GameActionType = 'MOVE' | 'ATTACK' | 'END_TURN';

export interface GameAction {
  id: string;
  gameId: string;
  turnNumber: number;
  playerId: Player['id'];
  type: GameActionType;
  payload: any;
  createdAt: Date;
}
