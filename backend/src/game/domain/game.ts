import { Board } from "src/board/domain/board";
import { Player } from "src/player/domain/player";
import { Unit } from "src/units/domain/unit.types";

export interface Game {
    id: number;
    player: Player;
    playerArmy: Unit[];
    enemy: Player;
    enemyArmy: Unit[];
    board: Board;
    phase: "created" | "deployment" | "battle" | "finished"
    createdAt: Date;
}