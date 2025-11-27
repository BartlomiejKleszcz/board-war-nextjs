import { HexCoords } from "src/board/domain/hex.types";

export interface Unit {
    name: string;
    id: UnitName;
    maxHp: number;
    meleeAttack: number;
    rangedAttack: number;
    attackRange: number;
    defense: number;
    speed: number;
    cost: number;
    uniqueId: number;
    position: HexCoords | null;
    playerId: number;
}

export type UnitName =
  | 'light-infantry'
  | 'line-infantry'
  | 'guard-infantry'
  | 'light-cavalry'
  | 'dragon-cavalry'
  | 'heavy-cavalry'
  | 'twelve-pounder-cannon'
  | 'six-pounder-cannon'
  | 'howitzer-cannon';
