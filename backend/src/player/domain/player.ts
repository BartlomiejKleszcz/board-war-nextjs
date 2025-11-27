import { Unit } from "src/units/domain/unit.types";

export class Player {
    id: number;
    name: string;
    color: string;
    units: Unit[];
    budget: number = 1000;
    turn: boolean = true;

    constructor(id: number, name: string, color: string) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.units = [];
    }
}

export class newPlayer {
    name: string;
    color: string;
    units: Unit[];
    budget: number = 1000;
    turn: boolean = true;

    constructor( name: string, color: string) {
        this.name = name;
        this.color = color;
        this.units = [];
    }
}