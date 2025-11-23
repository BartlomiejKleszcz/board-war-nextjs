export type HexCoords = {
  q: number;
  r: number;
};

export type TerrainType =
  | "plain"
  | "forest"
  | "hill"
  | "water"
  | "city"
  | "swamp"
  | "road"
  | "bridge"
  | "ford";

export type Tile = {
  coords: HexCoords;
  terrain: TerrainType;
  passable: boolean;
  movementCost: number;
};

export type Board = {
  tiles: Tile[];
};
