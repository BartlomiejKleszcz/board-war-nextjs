import type { Board } from "./board";
import type { Player } from "./player";
import type { UnitDto } from "./unit";

export type Phase = "created" | "deployment" | "battle" | "finished";

export interface Game {
  id: number;
  player: Player;
  playerArmy: UnitDto[];
  enemy: Player;
  enemyArmy: UnitDto[];
  board: Board;
  phase: Phase;
  createdAt: string;
}
