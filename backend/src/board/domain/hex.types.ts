import { Unit } from "src/units/domain/unit.types";

type axialCoords = {
    q: number;
    r: number;
};

export enum TerrainType {
  Plain = 'plain',
  Forest = 'forest',
  Hill = 'hill',
  Water = 'water',
  City = 'city',
  Swamp = 'swamp',
  Road = 'road',
  Bridge = 'bridge',
  Ford = 'ford'
}

export interface HexCoords extends axialCoords {}


export interface HexTile {
    coords: HexCoords;
    terrain: TerrainType;
    passable: boolean;
    movementCost: number;
    unit?: Unit
}
