import { HexCoords } from "src/board/domain/hex.types";
import { Unit, UnitName } from "./unit.types";

export class GameUnit implements Unit {

    public static globalIdCounter = 1;
    constructor(
        public name: string,
        public id: UnitName,
        public maxHp: number,
        public meleeAttack: number,
        public rangedAttack: number,
        public attackRange: number,
        public defense: number,
        public speed: number,
        public cost: number,
        public uniqueId: number = getUniqueIdForNewInstance(),
        public position: HexCoords | null = null,
        public playerId: number = 0
    ){}


}

    function getUniqueIdForNewInstance(): number {
        return GameUnit.globalIdCounter++;
    }
